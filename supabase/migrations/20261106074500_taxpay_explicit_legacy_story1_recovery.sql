-- Explicit, nonfinancial recovery of older browser-only Story1 history into
-- the already existing shared fictional profile. Never rewrite payment rows,
-- Office mirrors, original session references or taxpayer identity.
begin;
create table taxpay_guest_private.demo_story_session_links (
  demo_id text not null references taxpay_guest_private.demo_profiles(demo_id),
  legacy_session_id uuid not null primary key,
  created_at timestamptz not null default now()
);
create index demo_story_session_links_profile_idx on taxpay_guest_private.demo_story_session_links(demo_id);
alter table taxpay_guest_private.demo_story_session_links enable row level security;
alter table taxpay_guest_private.demo_story_session_links force row level security;
revoke all on taxpay_guest_private.demo_story_session_links from public,anon,authenticated,service_role;

create function public.taxpay_demo_recover_story1_session(p_capability_hash text,p_legacy_session_id uuid)
returns jsonb language plpgsql security definer
set search_path = '' as $$
declare v_demo text;v_primary uuid;v_total bigint;v_owner text;
begin
  perform taxpay_guest_private.touch_session(p_capability_hash);
  select demo_id,payment_session_id into v_demo,v_primary
    from taxpay_guest_private.demo_profiles
    where encode(extensions.digest(convert_to(capability_token,'UTF8'),'sha256'),'hex')=p_capability_hash;
  if v_demo is null then raise exception 'INVALID_DEMO_PROFILE'; end if;
  if p_legacy_session_id is null or p_legacy_session_id=v_primary then
    raise exception 'INVALID_LEGACY_SESSION';
  end if;
  -- Never attach another current shared profile's records.
  if exists(select 1 from taxpay_guest_private.demo_profiles where payment_session_id=p_legacy_session_id)
    then raise exception 'LEGACY_SESSION_RESERVED'; end if;
  select count(*) into v_total from demo_payment.story_payments
    where session_id=p_legacy_session_id;
  if v_total=0 then raise exception 'LEGACY_SESSION_EMPTY'; end if;
  select demo_id into v_owner from taxpay_guest_private.demo_story_session_links
    where legacy_session_id=p_legacy_session_id for update;
  if v_owner is not null and v_owner<>v_demo then
    raise exception 'LEGACY_SESSION_ALREADY_LINKED'; end if;
  insert into taxpay_guest_private.demo_story_session_links(demo_id,legacy_session_id)
    values(v_demo,p_legacy_session_id)
    on conflict (legacy_session_id) do nothing;
  select demo_id into v_owner from taxpay_guest_private.demo_story_session_links
    where legacy_session_id=p_legacy_session_id;
  if v_owner is distinct from v_demo then raise exception 'LEGACY_SESSION_ALREADY_LINKED'; end if;
  return jsonb_build_object('recovered',v_total);
end; $$;
revoke all on function public.taxpay_demo_recover_story1_session(text,uuid) from public,anon,authenticated;
grant execute on function public.taxpay_demo_recover_story1_session(text,uuid) to service_role;

-- A verified profile session reads its original payments and explicitly linked
-- historical sessions. Existing guest-session reads retain their exact scope.
create or replace function public.demo_story1_list_page(
 p_session uuid,p_page integer default 1,p_per_page integer default 100
) returns jsonb language plpgsql stable security definer set search_path='' as $f$
declare v_total bigint;v_items jsonb;
begin
 if p_session is null or p_page is null or p_page<1 or p_page>10000 or
 p_per_page is null or p_per_page<1 or p_per_page>100 then raise exception 'INVALID_PAGE';end if;
 select count(*) into v_total from demo_payment.story_payments x
 where x.session_id=p_session or x.session_id in (
   select l.legacy_session_id from taxpay_guest_private.demo_story_session_links l
     join taxpay_guest_private.demo_profiles p on p.demo_id=l.demo_id
    where p.payment_session_id=p_session
 );
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',x.id,'service',x.service_code,'amountMinor',x.amount_minor,
 'status',x.status,'createdAt',x.created_at) order by x.created_at desc,x.id desc),'[]'::jsonb)
 into v_items from (
 select id,service_code,amount_minor,status,created_at
 from demo_payment.story_payments x where x.session_id=p_session or x.session_id in (
   select l.legacy_session_id from taxpay_guest_private.demo_story_session_links l
   join taxpay_guest_private.demo_profiles p on p.demo_id=l.demo_id
   where p.payment_session_id=p_session
 ) order by created_at desc,id desc limit p_per_page offset (p_page-1)*p_per_page
 ) x;
 return jsonb_build_object('items',v_items,'total',v_total,'page',p_page,'perPage',p_per_page);
end;$f$;
revoke all on function public.demo_story1_list_page(uuid,integer,integer) from public;
grant execute on function public.demo_story1_list_page(uuid,integer,integer) to anon,authenticated;

create or replace function public.demo_story1_get(p_id uuid,p_session uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $f$
declare v demo_payment.story_payments%rowtype;
begin
 select * into v from demo_payment.story_payments x
  where x.id=p_id and (x.session_id=p_session or x.session_id in (
    select l.legacy_session_id from taxpay_guest_private.demo_story_session_links l
    join taxpay_guest_private.demo_profiles p on p.demo_id=l.demo_id
    where p.payment_session_id=p_session
  ));
 if not found then raise exception 'NOT_FOUND';end if;
 return jsonb_build_object('id',v.id,'data',v.data,'status',v.status,'createdAt',v.created_at);
end;$f$;
revoke all on function public.demo_story1_get(uuid,uuid) from public;
grant execute on function public.demo_story1_get(uuid,uuid) to anon,authenticated;

create or replace function public.demo_story1_notices(p_session uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $f$
begin
 return coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'paymentId',n.payment_id,
  'type',n.event_type,'createdAt',n.created_at) order by n.id desc)
  from (select * from demo_payment.story_notifications x
    where x.session_id=p_session or x.session_id in (
      select l.legacy_session_id from taxpay_guest_private.demo_story_session_links l
      join taxpay_guest_private.demo_profiles p on p.demo_id=l.demo_id
      where p.payment_session_id=p_session
    ) order by id desc limit 100) n),'[]'::jsonb);
end;$f$;
revoke all on function public.demo_story1_notices(uuid) from public;
grant execute on function public.demo_story1_notices(uuid) to anon,authenticated;
commit;
