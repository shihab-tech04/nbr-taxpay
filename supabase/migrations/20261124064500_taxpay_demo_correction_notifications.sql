begin;
-- Read markers belong to the fictional account's immutable correction events.
create table taxpay_guest_private.story_correction_notice_reads(
 demo_id text not null, event_id text not null, read_at timestamptz not null default now(),
 primary key(demo_id,event_id)
);
alter table taxpay_guest_private.story_correction_notice_reads enable row level security;
revoke all on taxpay_guest_private.story_correction_notice_reads from public,anon,authenticated;
create view taxpay_guest_private.story_correction_notice_events with (security_invoker=true) as
 select r.demo_id,r.id as request_id,'submitted:'||r.id::text as event_id,'SUBMITTED'::text as code,
 r.original_reference,r.created_at as occurred_at,r.reason as detail
 from taxpay_guest_private.story_correction_requests r
 union all
 select r.demo_id,r.id,'office:'||r.id::text,'OFFICE_RECEIVED',r.original_reference,r.office_ack_at,null::text
 from taxpay_guest_private.story_correction_requests r where r.office_ack_at is not null
 union all
 select r.demo_id,r.id,'decision:'||d.message_id::text,d.resulting_state,r.original_reference,d.recorded_at,d.command->>'reason'
 from taxpay_guest_private.story_correction_decisions d join taxpay_guest_private.story_correction_requests r on r.id=d.request_id;
revoke all on taxpay_guest_private.story_correction_notice_events from public,anon,authenticated;

create function taxpay_guest_private.correction_notice_owner(p_hash text)
returns text language plpgsql security definer set search_path='' as $$
declare v_demo text;
begin
 if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_PROFILE_CAPABILITY'; end if;
 perform taxpay_guest_private.touch_session(p_hash);
 select demo_id into v_demo from taxpay_guest_private.demo_profiles
 where encode(extensions.digest(convert_to(capability_token,'UTF8'),'sha256'),'hex')=p_hash;
 if v_demo is null then raise exception 'INVALID_DEMO_PROFILE'; end if;
 return v_demo;
end;
$$;
revoke all on function taxpay_guest_private.correction_notice_owner(text) from public,anon,authenticated;

create function public.taxpay_demo_correction_notices(p_capability_hash text,p_limit integer default 100,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_demo text; v_rows jsonb; v_unread bigint;
begin
 if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset not between 0 and 1000000 then
 raise exception 'INVALID_CORRECTION_NOTICE_PAGE'; end if;
 v_demo:=taxpay_guest_private.correction_notice_owner(p_capability_hash);
 select count(*) into v_unread from taxpay_guest_private.story_correction_notice_events e
 where e.demo_id=v_demo and not exists(select 1 from taxpay_guest_private.story_correction_notice_reads r where r.demo_id=v_demo and r.event_id=e.event_id);
 select coalesce(jsonb_agg(x.item order by x.occurred_at desc,x.event_id desc),'[]'::jsonb) into v_rows from (
 select e.occurred_at,e.event_id,jsonb_build_object('eventId',e.event_id,'requestId',e.request_id,'code',e.code,
 'reference',e.original_reference,'createdAt',e.occurred_at,'detail',e.detail,'isRead',r.event_id is not null) item
 from taxpay_guest_private.story_correction_notice_events e left join taxpay_guest_private.story_correction_notice_reads r
 on r.demo_id=e.demo_id and r.event_id=e.event_id where e.demo_id=v_demo
 order by e.occurred_at desc,e.event_id desc limit p_limit offset p_offset) x;
 return jsonb_build_object('items',v_rows,'unreadCount',v_unread);
end;
$$;
revoke all on function public.taxpay_demo_correction_notices(text,integer,integer) from public,anon,authenticated;
grant execute on function public.taxpay_demo_correction_notices(text,integer,integer) to service_role;

create function public.taxpay_demo_correction_notice_read(p_capability_hash text,p_event_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_demo text;
begin
 v_demo:=taxpay_guest_private.correction_notice_owner(p_capability_hash);
 if not exists(select 1 from taxpay_guest_private.story_correction_notice_events e where e.demo_id=v_demo and e.event_id=p_event_id)
 then raise exception 'CORRECTION_NOTICE_NOT_FOUND'; end if;
 insert into taxpay_guest_private.story_correction_notice_reads(demo_id,event_id) values(v_demo,p_event_id) on conflict do nothing;
 return jsonb_build_object('eventId',p_event_id,'isRead',true);
end;
$$;
revoke all on function public.taxpay_demo_correction_notice_read(text,text) from public,anon,authenticated;
grant execute on function public.taxpay_demo_correction_notice_read(text,text) to service_role;
commit;
