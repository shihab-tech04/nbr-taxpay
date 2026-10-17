-- API-only Phase 5: Office notification read receipts and safe sync status.
-- Existing TaxPay owner notifications remain on payment_v1_my_notifications.
-- Per-officer read receipts avoid one officer hiding notices from colleagues.

create table if not exists payment_sync.officer_notice_reads (
  notice_id uuid not null references payment_sync.cross_project_notifications(id),
  officer_uid uuid not null references auth.users(id),
  read_at timestamptz not null default now(),
  primary key (notice_id,officer_uid)
);
create index if not exists payment_v1_notice_reads_officer_idx
  on payment_sync.officer_notice_reads(officer_uid,read_at desc);
alter table payment_sync.officer_notice_reads enable row level security;
revoke all on payment_sync.officer_notice_reads from public,anon,authenticated;

create or replace function public.payment_v1_office_notifications(
  p_limit integer default 100,p_unread_only boolean default false
) returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v_actor uuid := auth.uid(); v_origin text; v_result jsonb;
begin
  select origin into v_origin from payment_sync.settings where singleton;
  if v_actor is null or v_origin<>'OFFICE_SQL' or not exists(
    select 1 from payment_sync.officer_roles r where r.user_uid=v_actor and r.active
      and r.role in ('MAKER','REVIEWER','APPROVER')) then
    raise exception 'Authorized Office officer required'; end if;
  if p_limit is null or p_limit not between 1 and 200 then raise exception 'Invalid page size'; end if;
  if p_unread_only is null then raise exception 'Unread filter required'; end if;
  select coalesce(pg_catalog.jsonb_agg(x.obj order by x.created_at desc,x.id desc),'[]'::jsonb)
    into v_result from (
      select n.id,n.created_at,pg_catalog.jsonb_build_object(
        'noticeId',n.id,'requestId',n.request_id,'eventId',n.event_id,
        'sourceOrigin',n.source_origin,'messageCode',n.message_code,
        'createdAt',n.created_at,'isRead',r.officer_uid is not null) obj
      from payment_sync.cross_project_notifications n
      left join payment_sync.officer_notice_reads r
        on r.notice_id=n.id and r.officer_uid=v_actor
      where n.source_origin='TAXPAY_SQL'
        and (not p_unread_only or r.officer_uid is null)
      order by n.created_at desc,n.id desc limit p_limit
    ) x;
  return v_result;
end;
$function$;

create or replace function public.payment_v1_office_set_notice_read(
  p_notice_id uuid,p_is_read boolean default true
) returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_actor uuid := auth.uid(); v_origin text;
begin
  select origin into v_origin from payment_sync.settings where singleton;
  if v_actor is null or v_origin<>'OFFICE_SQL' or not exists(
    select 1 from payment_sync.officer_roles r where r.user_uid=v_actor and r.active
      and r.role in ('MAKER','REVIEWER','APPROVER')) then
    raise exception 'Authorized Office officer required'; end if;
  if p_notice_id is null or p_is_read is null then raise exception 'Notice and read state required'; end if;
  if not exists(select 1 from payment_sync.cross_project_notifications n
    where n.id=p_notice_id and n.source_origin='TAXPAY_SQL') then
    raise exception 'Office notice not found'; end if;
  if p_is_read then
    insert into payment_sync.officer_notice_reads(notice_id,officer_uid)
      values(p_notice_id,v_actor)
    on conflict(notice_id,officer_uid) do update set read_at=now();
  else
    delete from payment_sync.officer_notice_reads
      where notice_id=p_notice_id and officer_uid=v_actor;
  end if;
  return pg_catalog.jsonb_build_object('noticeId',p_notice_id,'isRead',p_is_read);
end;
$function$;

create or replace function public.payment_v1_sync_status(p_request_id uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare
  v_actor uuid := auth.uid(); v_origin text; v_officer boolean;
  v_local payment_sync.requests%rowtype;
  v_mirror payment_sync.mirrored_requests%rowtype;
  v_delivery text; v_attempts integer; v_ack timestamptz;
begin
  if v_actor is null or p_request_id is null then raise exception 'Authenticated request required'; end if;
  select origin into v_origin from payment_sync.settings where singleton;
  select exists(select 1 from payment_sync.officer_roles o
    where o.user_uid=v_actor and o.active and o.role in ('MAKER','REVIEWER','APPROVER'))
    into v_officer;
  select * into v_local from payment_sync.requests r where r.id=p_request_id
    and (r.created_by=v_actor or (v_origin='OFFICE_SQL' and v_officer));
  if found then
    select o.delivery_state,o.attempts,o.acknowledged_at
      into v_delivery,v_attempts,v_ack
    from payment_sync.events e join payment_sync.outbox o on o.event_id=e.event_id
    where e.request_id=p_request_id order by e.source_revision desc limit 1;
    return pg_catalog.jsonb_build_object('requestId',p_request_id,
      'sourceOrigin',v_local.origin,'revision',v_local.revision,
      'reviewState',v_local.review_state,'syncState',coalesce(v_delivery,'NOT_QUEUED'),
      'attempts',coalesce(v_attempts,0),'acknowledgedAt',v_ack);
  end if;
  if v_origin='OFFICE_SQL' and v_officer then
    select * into v_mirror from payment_sync.mirrored_requests m
      where m.request_id=p_request_id and m.source_origin='TAXPAY_SQL';
    if found then
      return pg_catalog.jsonb_build_object('requestId',p_request_id,
        'sourceOrigin',v_mirror.source_origin,'revision',v_mirror.revision,
        'reviewState',v_mirror.review_state,'syncState','RECEIVED',
        'lastEventId',v_mirror.last_event_id,'lastReceivedAt',v_mirror.updated_at);
    end if;
  end if;
  raise exception 'Payment request not found';
end;
$function$;

-- Cover common request, actor and notification scans, including noted FK access paths.
create index if not exists payment_v1_decisions_by_officer
  on payment_sync.officer_decisions(officer_uid,created_at desc);
create index if not exists payment_v1_control_inbox_by_request
  on payment_sync.control_inbox(request_id,received_at desc);
create index if not exists payment_v1_cross_notices_by_request
  on payment_sync.cross_project_notifications(request_id,created_at desc);
create index if not exists payment_v1_events_by_actor
  on payment_sync.events(actor_uid) where actor_uid is not null;
create index if not exists payment_v1_mirror_by_last_event
  on payment_sync.mirrored_requests(last_event_id);
create index if not exists payment_v1_notifications_by_event
  on payment_sync.notifications(event_id);
create index if not exists payment_v1_notifications_by_request
  on payment_sync.notifications(request_id,created_at desc);

revoke all on function public.payment_v1_office_notifications(integer,boolean) from public,anon,authenticated;
revoke all on function public.payment_v1_office_set_notice_read(uuid,boolean) from public,anon,authenticated;
revoke all on function public.payment_v1_sync_status(uuid) from public,anon,authenticated;
grant execute on function public.payment_v1_office_notifications(integer,boolean) to authenticated;
grant execute on function public.payment_v1_office_set_notice_read(uuid,boolean) to authenticated;
grant execute on function public.payment_v1_sync_status(uuid) to authenticated;
