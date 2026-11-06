-- Recover only synthetic legacy sessions whose every payment explicitly names
-- the current demo payer. Keep all original payment, notice and mirror rows.
begin;

create or replace function public.taxpay_demo_recover_story1_session(
  p_capability_hash text,
  p_legacy_session_id uuid
) returns jsonb
language plpgsql security definer
set search_path = '' as $function$
declare
  v_demo text;
  v_primary uuid;
  v_total bigint;
  v_unverified bigint;
  v_owner text;
begin
  perform taxpay_guest_private.touch_session(p_capability_hash);
  select demo_id,payment_session_id into v_demo,v_primary
    from taxpay_guest_private.demo_profiles
   where encode(extensions.digest(convert_to(capability_token,'UTF8'),'sha256'),'hex')=p_capability_hash;
  if v_demo is null then raise exception 'INVALID_DEMO_PROFILE'; end if;
  if p_legacy_session_id is null or p_legacy_session_id=v_primary then
    raise exception 'INVALID_LEGACY_SESSION';
  end if;
  -- Serialize claims for this legacy session, including the first claim when
  -- no link row exists yet.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_legacy_session_id::text,0));
  if exists(select 1 from taxpay_guest_private.demo_profiles
             where payment_session_id=p_legacy_session_id) then
    raise exception 'LEGACY_SESSION_RESERVED';
  end if;
  select demo_id into v_owner
    from taxpay_guest_private.demo_story_session_links
   where legacy_session_id=p_legacy_session_id for update;
  if v_owner is not null and v_owner<>v_demo then
    raise exception 'LEGACY_SESSION_ALREADY_LINKED';
  end if;

  select count(*),count(*) filter (
      where data->'details'->>'payerId' is distinct from v_demo
         or data->>'origin' is distinct from 'TAXPAY_UI')
    into v_total,v_unverified
    from demo_payment.story_payments
   where session_id=p_legacy_session_id;
  if v_total=0 then raise exception 'LEGACY_SESSION_EMPTY'; end if;
  if v_unverified>0 then
    raise exception 'LEGACY_SESSION_OWNER_UNVERIFIED';
  end if;

  insert into taxpay_guest_private.demo_story_session_links(demo_id,legacy_session_id)
    values(v_demo,p_legacy_session_id)
    on conflict (legacy_session_id) do nothing;
  select demo_id into v_owner
    from taxpay_guest_private.demo_story_session_links
   where legacy_session_id=p_legacy_session_id;
  if v_owner is distinct from v_demo then raise exception 'LEGACY_SESSION_ALREADY_LINKED'; end if;
  return jsonb_build_object('recovered',v_total);
end;
$function$;
revoke all on function public.taxpay_demo_recover_story1_session(text,uuid)
  from public,anon,authenticated;
grant execute on function public.taxpay_demo_recover_story1_session(text,uuid)
  to service_role;

-- A claimed browser-only session is a closed, historical source. Existing
-- idempotent retries still return their original receipt before this guard.
create or replace function public.demo_story1_submit(p_input jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare
  v_key uuid;
  v_session uuid;
  v_old demo_payment.story_payments%rowtype;
  v_new demo_payment.story_payments%rowtype;
begin
  if p_input is null or jsonb_typeof(p_input)<>'object' then raise exception 'INVALID_INPUT'; end if;
  if coalesce(p_input->>'idempotencyKey','') !~ '^[0-9a-fA-F-]{36}$' or
     coalesce(p_input->>'sessionId','') !~ '^[0-9a-fA-F-]{36}$' then raise exception 'INVALID_IDS'; end if;
  if coalesce(p_input->>'service','') not in
     ('TAX_WITH_RETURN','ADVANCE_TAX','ASSESSED_DEMAND','PENALTY','SOURCE_TAX_DEPOSIT',
      'APPELLATE_TRIBUNAL','OTHER_TAX_PAYMENT','TRAVEL_TAX') then raise exception 'INVALID_SERVICE'; end if;
  if coalesce(p_input->>'amountMinor','') !~ '^[1-9][0-9]{0,11}$' then raise exception 'INVALID_AMOUNT'; end if;
  if length(p_input::text)>12000 or jsonb_typeof(p_input->'details')<>'object' then
    raise exception 'INVALID_DETAILS';
  end if;
  v_key:=(p_input->>'idempotencyKey')::uuid;
  v_session:=(p_input->>'sessionId')::uuid;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_key::text,0));
  select * into v_old from demo_payment.story_payments where idempotency_key=v_key;
  if found then
    if v_old.session_id<>v_session or v_old.data<>p_input then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('id',v_old.id,'status',v_old.status,'replayed',true,'createdAt',v_old.created_at);
  end if;
  if exists(select 1 from taxpay_guest_private.demo_story_session_links
             where legacy_session_id=v_session) then
    raise exception 'LEGACY_SESSION_READ_ONLY';
  end if;
  insert into demo_payment.story_payments(idempotency_key,session_id,service_code,amount_minor,data,status)
    values(v_key,v_session,p_input->>'service',(p_input->>'amountMinor')::bigint,p_input,'SIMULATED_SUCCESS')
    returning * into v_new;
  insert into demo_payment.story_notifications(payment_id,session_id,event_type)
    values(v_new.id,v_session,'SIMULATED_PAYMENT_SUCCESS');
  return jsonb_build_object('id',v_new.id,'status',v_new.status,'replayed',false,'createdAt',v_new.created_at);
end;
$function$;
revoke all on function public.demo_story1_submit(jsonb) from public;
grant execute on function public.demo_story1_submit(jsonb) to anon,authenticated;

-- Existing links are checked on every read too. This prevents an older unsafe
-- link from exposing a mixed, missing-owner, or QA-only source session.
create or replace function public.demo_story1_list_page(
  p_session uuid,p_page integer default 1,p_per_page integer default 100
) returns jsonb
language plpgsql stable security definer
set search_path = '' as $function$
declare v_total bigint;v_items jsonb;
begin
  if p_session is null or p_page is null or p_page<1 or p_page>10000
     or p_per_page is null or p_per_page<1 or p_per_page>100 then
    raise exception 'INVALID_PAGE';
  end if;
  select count(*) into v_total from demo_payment.story_payments x
   where x.session_id=p_session or x.session_id in (
     select l.legacy_session_id from taxpay_guest_private.demo_story_session_links l
       join taxpay_guest_private.demo_profiles profile on profile.demo_id=l.demo_id
      where profile.payment_session_id=p_session
        and not exists(select 1 from demo_payment.story_payments unverified
          where unverified.session_id=l.legacy_session_id
            and (unverified.data->'details'->>'payerId' is distinct from profile.demo_id
              or unverified.data->>'origin' is distinct from 'TAXPAY_UI'))
   );
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',x.id,'service',x.service_code,'amountMinor',x.amount_minor,
    'status',x.status,'createdAt',x.created_at) order by x.created_at desc,x.id desc),'[]'::jsonb)
    into v_items from (
      select p.id,p.service_code,p.amount_minor,p.status,p.created_at
        from demo_payment.story_payments p
       where p.session_id=p_session or p.session_id in (
         select l.legacy_session_id from taxpay_guest_private.demo_story_session_links l
           join taxpay_guest_private.demo_profiles profile on profile.demo_id=l.demo_id
          where profile.payment_session_id=p_session
            and not exists(select 1 from demo_payment.story_payments unverified
              where unverified.session_id=l.legacy_session_id
                and (unverified.data->'details'->>'payerId' is distinct from profile.demo_id
                  or unverified.data->>'origin' is distinct from 'TAXPAY_UI'))
       )
       order by p.created_at desc,p.id desc
       limit p_per_page offset (p_page-1)*p_per_page
    ) x;
  return jsonb_build_object('items',v_items,'total',v_total,'page',p_page,'perPage',p_per_page);
end;
$function$;
revoke all on function public.demo_story1_list_page(uuid,integer,integer) from public;
grant execute on function public.demo_story1_list_page(uuid,integer,integer) to anon,authenticated;

create or replace function public.demo_story1_get(p_id uuid,p_session uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare v demo_payment.story_payments%rowtype;
begin
  select * into v from demo_payment.story_payments x
   where x.id=p_id and (x.session_id=p_session or x.session_id in (
     select l.legacy_session_id from taxpay_guest_private.demo_story_session_links l
       join taxpay_guest_private.demo_profiles profile on profile.demo_id=l.demo_id
      where profile.payment_session_id=p_session
        and not exists(select 1 from demo_payment.story_payments unverified
          where unverified.session_id=l.legacy_session_id
            and (unverified.data->'details'->>'payerId' is distinct from profile.demo_id
              or unverified.data->>'origin' is distinct from 'TAXPAY_UI'))
   ));
  if not found then raise exception 'NOT_FOUND'; end if;
  return jsonb_build_object('id',v.id,'data',v.data,'status',v.status,'createdAt',v.created_at);
end;
$function$;
revoke all on function public.demo_story1_get(uuid,uuid) from public;
grant execute on function public.demo_story1_get(uuid,uuid) to anon,authenticated;

create or replace function public.demo_story1_notices(p_session uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
begin
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',n.id,'paymentId',n.payment_id,'type',n.event_type,'createdAt',n.created_at)
    order by n.id desc)
    from (select x.* from demo_payment.story_notifications x
      where x.session_id=p_session or x.session_id in (
        select l.legacy_session_id from taxpay_guest_private.demo_story_session_links l
          join taxpay_guest_private.demo_profiles profile on profile.demo_id=l.demo_id
         where profile.payment_session_id=p_session
           and not exists(select 1 from demo_payment.story_payments unverified
             where unverified.session_id=l.legacy_session_id
               and (unverified.data->'details'->>'payerId' is distinct from profile.demo_id
                 or unverified.data->>'origin' is distinct from 'TAXPAY_UI'))
      ) order by x.id desc limit 100) n),'[]'::jsonb);
end;
$function$;
revoke all on function public.demo_story1_notices(uuid) from public;
grant execute on function public.demo_story1_notices(uuid) to anon,authenticated;

-- Keep the compact legacy RPC contract safe for older clients as well.
create or replace function public.demo_story1_demo_history(p_actor text,p_view text default 'beneficiary')
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
begin
  if p_actor is null or p_actor !~ '^user([1-9]|10)$'
     or p_view is null or p_view not in ('payer','beneficiary') then
    raise exception 'INVALID_DEMO_HISTORY_SCOPE';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id','SIM-'||upper(substr(replace(p.id::text,'-',''),1,16)),
      'transactionId',p.id,
      'payer',case when p_view='payer' then p.data->'details'->>'payerId' else null end,
      'state','SIMULATED','reviewStatus','MIRRORED_TO_OFFICE',
      'createdAt',p.created_at,
      'totalMinor',case when p_view='payer' then p.amount_minor else (
        select coalesce(sum((line.value->>'amountMinor')::bigint),0)
          from jsonb_array_elements(coalesce(p.data->'details'->'lines','[]'::jsonb)) line
         where line.value->>'beneficiary'=p_actor
      ) end,
      'simulationOnly',true,
      'allocations',case when p_view='payer'
        then coalesce(p.data->'details'->'lines','[]'::jsonb)
        else (select coalesce(jsonb_agg(line.value),'[]'::jsonb)
          from jsonb_array_elements(coalesce(p.data->'details'->'lines','[]'::jsonb)) line
         where line.value->>'beneficiary'=p_actor)
      end,
      'events',jsonb_build_array(jsonb_build_object(
        'id',p.id,'action','SIMULATION_RECORDED',
        'note','TaxPay SQL receipt mirrored to Office SQL','occurredAt',p.created_at))
    ) order by p.created_at desc,p.id desc)
    from (
      select x.* from demo_payment.story_payments x
       where ((p_view='payer' and x.data->'details'->>'payerId'=p_actor)
          or (p_view='beneficiary' and exists(
            select 1 from jsonb_array_elements(coalesce(x.data->'details'->'lines','[]'::jsonb)) line
             where line.value->>'beneficiary'=p_actor)))
       order by x.created_at desc,x.id desc limit 200
    ) p
  ),'[]'::jsonb);
end;
$function$;
revoke all on function public.demo_story1_demo_history(text,text) from public,anon,authenticated;
grant execute on function public.demo_story1_demo_history(text,text) to anon,authenticated;
comment on function public.demo_story1_demo_history(text,text) is
  'Legacy read-only fictional preview history; payer totals and allocation rows are scoped to the requested view.';

-- Beneficiary views return only the matching allocation and its amount. Payer
-- totals and other beneficiaries' allocations remain visible only to the payer.
create or replace function public.demo_story1_demo_history_page(
  p_actor text,
  p_view text default 'beneficiary',
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_page_size integer default 100
) returns jsonb
language plpgsql stable security definer
set search_path = '' as $function$
begin
  if p_actor is null or p_actor !~ '^user([1-9]|10)$'
     or p_view is null or p_view not in ('payer','beneficiary')
     or p_page_size is null or p_page_size not between 1 and 100
     or ((p_before_created_at is null) <> (p_before_id is null)) then
    raise exception 'INVALID_DEMO_HISTORY_SCOPE';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id','SIM-'||upper(substr(replace(p.id::text,'-',''),1,16)),
      'transactionId',p.id,
      'payer',case when p_view='payer' then p.data->'details'->>'payerId' else null end,
      'state','SIMULATED',
      'reviewStatus','MIRRORED_TO_OFFICE',
      'createdAt',p.created_at,
      'totalMinor',case when p_view='payer' then p.amount_minor else (
        select coalesce(sum((line.value->>'amountMinor')::bigint),0)
          from jsonb_array_elements(coalesce(p.data->'details'->'lines','[]'::jsonb)) line
         where line.value->>'beneficiary'=p_actor
      ) end,
      'simulationOnly',true,
      'allocations',case when p_view='payer'
        then coalesce(p.data->'details'->'lines','[]'::jsonb)
        else (select coalesce(jsonb_agg(line.value),'[]'::jsonb)
          from jsonb_array_elements(coalesce(p.data->'details'->'lines','[]'::jsonb)) line
         where line.value->>'beneficiary'=p_actor)
      end,
      'events',jsonb_build_array(jsonb_build_object(
        'id',p.id,'action','SIMULATION_RECORDED',
        'note','TaxPay SQL receipt mirrored to Office SQL',
        'occurredAt',p.created_at))
    ) order by p.created_at desc,p.id desc)
    from (
      select x.*
        from demo_payment.story_payments x
       where ((p_view='payer' and x.data->'details'->>'payerId'=p_actor)
          or (p_view='beneficiary' and exists(
            select 1 from jsonb_array_elements(coalesce(x.data->'details'->'lines','[]'::jsonb)) line
             where line.value->>'beneficiary'=p_actor)))
         and (p_before_created_at is null
           or (x.created_at,x.id)<(p_before_created_at,p_before_id))
       order by x.created_at desc,x.id desc
       limit p_page_size
    ) p
  ),'[]'::jsonb);
end;
$function$;
revoke all on function public.demo_story1_demo_history_page(text,text,timestamptz,uuid,integer)
  from public,anon,authenticated;
grant execute on function public.demo_story1_demo_history_page(text,text,timestamptz,uuid,integer)
  to anon,authenticated;
comment on function public.demo_story1_demo_history_page(text,text,timestamptz,uuid,integer) is
  'Read-only fictional preview history. Payer totals are payer-only; beneficiary views expose only that profile allocation.';

-- Atomic profile snapshot used by the capability-scoped Edge Function and
-- real-browser acceptance. Never include the capability token or SQL session ID.
create or replace function public.taxpay_guest_beneficiary_snapshot(p_capability_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare
  v_session_id uuid;
  v_demo text;
  v_payment_session uuid;
  v_language text;
  v_selected uuid;
  v_lists jsonb;
  v_people jsonb;
begin
  if p_capability_hash is null or p_capability_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_CAPABILITY';
  end if;
  v_session_id:=taxpay_guest_private.touch_session(p_capability_hash);
  select demo_id,payment_session_id,language,selected_list_id
    into v_demo,v_payment_session,v_language,v_selected
    from taxpay_guest_private.demo_profiles
   where encode(extensions.digest(convert_to(capability_token,'UTF8'),'sha256'),'hex')=p_capability_hash;
  if v_demo is null then raise exception 'INVALID_DEMO_PROFILE'; end if;
  if v_selected is not null and not exists(
    select 1 from taxpay_guest_private.lists where id=v_selected and session_id=v_session_id
  ) then v_selected:=null; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',l.id,'name',l.name,'created_at',l.created_at
  ) order by lower(l.name),l.id),'[]'::jsonb)
    into v_lists from taxpay_guest_private.lists l where l.session_id=v_session_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',b.id,'list_id',b.list_id,'tin',b.tin,'display_name',b.display_name,
    'tag',b.tag,'relationship',b.relationship,'other_label',b.other_label,
    'created_at',b.created_at,'updated_at',b.updated_at
  ) order by b.created_at desc,b.id desc),'[]'::jsonb)
    into v_people from (
      select x.* from taxpay_guest_private.beneficiaries x
       where x.session_id=v_session_id order by x.created_at desc,x.id desc limit 500
    ) b;
  return jsonb_build_object(
    'profileId',v_demo,
    'settings',jsonb_build_object('language',v_language,'selectedListId',v_selected,
      'paymentSessionId',v_payment_session),
    'lists',v_lists,'people',v_people
  );
end;
$function$;
revoke all on function public.taxpay_guest_beneficiary_snapshot(text)
  from public,anon,authenticated,service_role;
grant execute on function public.taxpay_guest_beneficiary_snapshot(text) to service_role;

commit;
