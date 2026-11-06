begin;

-- Capability-backed SQL entry points support demo profile payment reads/writes.
-- Existing generic session routes remain compatible until the app rollout is live.
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
  if exists(select 1 from taxpay_guest_private.demo_story_session_links where legacy_session_id=v_session) then
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

create or replace function public.taxpay_demo_story1_submit(
  p_capability_hash text,p_input jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $function$
declare
  v_demo text;
  v_session uuid;
  v_key uuid;
  v_old demo_payment.story_payments%rowtype;
  v_new demo_payment.story_payments%rowtype;
begin
  if p_capability_hash is null or p_capability_hash !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_CAPABILITY'; end if;
  perform taxpay_guest_private.touch_session(p_capability_hash);
  select demo_id,payment_session_id into v_demo,v_session
    from taxpay_guest_private.demo_profiles
   where encode(extensions.digest(convert_to(capability_token,'UTF8'),'sha256'),'hex')=p_capability_hash;
  if v_demo is null then raise exception 'INVALID_DEMO_PROFILE'; end if;
  if p_input is null or jsonb_typeof(p_input)<>'object' then raise exception 'INVALID_INPUT'; end if;
  if coalesce(p_input->>'origin','') is distinct from 'TAXPAY_UI'
     or coalesce(p_input->'details'->>'payerId','') is distinct from v_demo
     or coalesce(p_input->>'sessionId','') is distinct from v_session::text then
    raise exception 'PROFILE_PAYMENT_SCOPE_MISMATCH';
  end if;
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
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_key::text,0));
  select * into v_old from demo_payment.story_payments where idempotency_key=v_key;
  if found then
    if v_old.session_id<>v_session or v_old.data<>p_input then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('id',v_old.id,'status',v_old.status,'replayed',true,'createdAt',v_old.created_at);
  end if;
  insert into demo_payment.story_payments(idempotency_key,session_id,service_code,amount_minor,data,status)
    values(v_key,v_session,p_input->>'service',(p_input->>'amountMinor')::bigint,p_input,'SIMULATED_SUCCESS')
    returning * into v_new;
  insert into demo_payment.story_notifications(payment_id,session_id,event_type)
    values(v_new.id,v_session,'SIMULATED_PAYMENT_SUCCESS');
  return jsonb_build_object('id',v_new.id,'status',v_new.status,'replayed',false,'createdAt',v_new.created_at);
end;
$function$;
revoke all on function public.taxpay_demo_story1_submit(text,jsonb) from public,anon,authenticated;
grant execute on function public.taxpay_demo_story1_submit(text,jsonb) to service_role;

create or replace function public.taxpay_demo_story1_history_page(
  p_capability_hash text,p_view text default 'beneficiary',
  p_before_created_at timestamptz default null,p_before_id uuid default null,
  p_page_size integer default 100
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $function$
declare v_demo text;v_session uuid;
begin
  if p_capability_hash is null or p_capability_hash !~ '^[0-9a-f]{64}$'
     or p_view is null or p_view not in ('payer','beneficiary')
     or p_page_size is null or p_page_size not between 1 and 100
     or ((p_before_created_at is null) <> (p_before_id is null)) then
    raise exception 'INVALID_DEMO_HISTORY_SCOPE';
  end if;
  perform taxpay_guest_private.touch_session(p_capability_hash);
  select demo_id,payment_session_id into v_demo,v_session
    from taxpay_guest_private.demo_profiles
   where encode(extensions.digest(convert_to(capability_token,'UTF8'),'sha256'),'hex')=p_capability_hash;
  if v_demo is null then raise exception 'INVALID_DEMO_PROFILE'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id','SIM-'||upper(substr(replace(p.id::text,'-',''),1,16)),
      'transactionId',p.id,
      'payer',case when p_view='payer' then p.data->'details'->>'payerId' else null end,
      'state','SIMULATED','reviewStatus','MIRRORED_TO_OFFICE','createdAt',p.created_at,
      'totalMinor',case when p_view='payer' then p.amount_minor else (
        select coalesce(sum((line.value->>'amountMinor')::bigint),0)
          from jsonb_array_elements(coalesce(p.data->'details'->'lines','[]'::jsonb)) line
         where line.value->>'beneficiary'=v_demo
      ) end,
      'simulationOnly',true,
      'allocations',case when p_view='payer'
        then coalesce(p.data->'details'->'lines','[]'::jsonb)
        else (select coalesce(jsonb_agg(line.value),'[]'::jsonb)
          from jsonb_array_elements(coalesce(p.data->'details'->'lines','[]'::jsonb)) line
         where line.value->>'beneficiary'=v_demo)
      end,
      'events',jsonb_build_array(jsonb_build_object(
        'id',p.id,'action','SIMULATION_RECORDED',
        'note','TaxPay SQL receipt mirrored to Office SQL','occurredAt',p.created_at))
    ) order by p.created_at desc,p.id desc)
    from (
      select x.* from demo_payment.story_payments x
       where x.data->>'origin'='TAXPAY_UI'
         and (
           (p_view='payer' and exists (
             select 1 from taxpay_guest_private.demo_profiles owner
              where owner.demo_id=v_demo and (owner.payment_session_id=x.session_id or exists (
                select 1 from taxpay_guest_private.demo_story_session_links l
                 where l.demo_id=owner.demo_id and l.legacy_session_id=x.session_id
                   and not exists (
                     select 1 from demo_payment.story_payments unverified
                      where unverified.session_id=l.legacy_session_id
                        and (unverified.data->>'origin' is distinct from 'TAXPAY_UI'
                          or unverified.data->'details'->>'payerId' is distinct from owner.demo_id)
                   )
              ))
                and x.data->'details'->>'payerId'=owner.demo_id
           ))
           or
           (p_view='beneficiary'
             and exists (
               select 1 from jsonb_array_elements(coalesce(x.data->'details'->'lines','[]'::jsonb)) line
                where line.value->>'beneficiary'=v_demo
             )
             and exists (
               select 1 from taxpay_guest_private.demo_profiles owner
                where owner.demo_id=x.data->'details'->>'payerId'
                  and (owner.payment_session_id=x.session_id or exists (
                    select 1 from taxpay_guest_private.demo_story_session_links l
                     where l.demo_id=owner.demo_id and l.legacy_session_id=x.session_id
                       and not exists (
                         select 1 from demo_payment.story_payments unverified
                          where unverified.session_id=l.legacy_session_id
                            and (unverified.data->>'origin' is distinct from 'TAXPAY_UI'
                              or unverified.data->'details'->>'payerId' is distinct from owner.demo_id)
                       )
                  ))
             )
           )
         )
         and (p_before_created_at is null or (x.created_at,x.id)<(p_before_created_at,p_before_id))
       order by x.created_at desc,x.id desc limit p_page_size
    ) p
  ),'[]'::jsonb);
end;
$function$;
revoke all on function public.taxpay_demo_story1_history_page(text,text,timestamptz,uuid,integer)
  from public,anon,authenticated;
grant execute on function public.taxpay_demo_story1_history_page(text,text,timestamptz,uuid,integer)
  to service_role;

create or replace function public.taxpay_demo_story1_session_payments(
  p_capability_hash text,p_page integer default 1,p_per_page integer default 100
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $function$
declare v_demo text;v_session uuid;v_total bigint;v_items jsonb;
begin
  if p_capability_hash is null or p_capability_hash !~ '^[0-9a-f]{64}$'
     or p_page is null or p_page<1 or p_page>10000
     or p_per_page is null or p_per_page<1 or p_per_page>100 then raise exception 'INVALID_PAGE'; end if;
  perform taxpay_guest_private.touch_session(p_capability_hash);
  select demo_id,payment_session_id into v_demo,v_session from taxpay_guest_private.demo_profiles
   where encode(extensions.digest(convert_to(capability_token,'UTF8'),'sha256'),'hex')=p_capability_hash;
  if v_demo is null then raise exception 'INVALID_DEMO_PROFILE'; end if;
  select count(*) into v_total from demo_payment.story_payments x
   where x.data->>'origin'='TAXPAY_UI' and x.data->'details'->>'payerId'=v_demo
     and (x.session_id=v_session or x.session_id in (
       select l.legacy_session_id from taxpay_guest_private.demo_story_session_links l
        where l.demo_id=v_demo and not exists (
          select 1 from demo_payment.story_payments u where u.session_id=l.legacy_session_id
           and (u.data->>'origin' is distinct from 'TAXPAY_UI'
             or u.data->'details'->>'payerId' is distinct from v_demo)
        )
     ));
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'service',p.service_code,
    'amountMinor',p.amount_minor,'status',p.status,'createdAt',p.created_at)
    order by p.created_at desc,p.id desc),'[]'::jsonb) into v_items from (
      select x.id,x.service_code,x.amount_minor,x.status,x.created_at
        from demo_payment.story_payments x
       where x.data->>'origin'='TAXPAY_UI' and x.data->'details'->>'payerId'=v_demo
         and (x.session_id=v_session or x.session_id in (
           select l.legacy_session_id from taxpay_guest_private.demo_story_session_links l
            where l.demo_id=v_demo and not exists (
              select 1 from demo_payment.story_payments u where u.session_id=l.legacy_session_id
               and (u.data->>'origin' is distinct from 'TAXPAY_UI'
                 or u.data->'details'->>'payerId' is distinct from v_demo)
            )
         )) order by x.created_at desc,x.id desc limit p_per_page offset (p_page-1)*p_per_page
    ) p;
  return jsonb_build_object('items',v_items,'total',v_total,'page',p_page,'perPage',p_per_page);
end;
$function$;
revoke all on function public.taxpay_demo_story1_session_payments(text,integer,integer)
  from public,anon,authenticated;
grant execute on function public.taxpay_demo_story1_session_payments(text,integer,integer)
  to service_role;

create or replace function public.taxpay_demo_story1_session_payment(
  p_capability_hash text,p_payment_id uuid
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $function$
declare v_demo text;v_session uuid;v demo_payment.story_payments%rowtype;
begin
  if p_capability_hash is null or p_capability_hash !~ '^[0-9a-f]{64}$' or p_payment_id is null
    then raise exception 'NOT_FOUND'; end if;
  perform taxpay_guest_private.touch_session(p_capability_hash);
  select demo_id,payment_session_id into v_demo,v_session from taxpay_guest_private.demo_profiles
   where encode(extensions.digest(convert_to(capability_token,'UTF8'),'sha256'),'hex')=p_capability_hash;
  if v_demo is null then raise exception 'INVALID_DEMO_PROFILE'; end if;
  select x.* into v from demo_payment.story_payments x
   where x.id=p_payment_id and x.data->>'origin'='TAXPAY_UI'
     and x.data->'details'->>'payerId'=v_demo
     and (x.session_id=v_session or x.session_id in (
       select l.legacy_session_id from taxpay_guest_private.demo_story_session_links l
        where l.demo_id=v_demo and not exists (
          select 1 from demo_payment.story_payments u where u.session_id=l.legacy_session_id
           and (u.data->>'origin' is distinct from 'TAXPAY_UI'
             or u.data->'details'->>'payerId' is distinct from v_demo)
        )
     ));
  if not found then raise exception 'NOT_FOUND'; end if;
  return jsonb_build_object('id',v.id,'data',v.data,'status',v.status,'createdAt',v.created_at);
end;
$function$;
revoke all on function public.taxpay_demo_story1_session_payment(text,uuid)
  from public,anon,authenticated;
grant execute on function public.taxpay_demo_story1_session_payment(text,uuid)
  to service_role;

create or replace function public.taxpay_demo_story1_session_notices(p_capability_hash text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $function$
declare v_demo text;v_session uuid;
begin
  if p_capability_hash is null or p_capability_hash !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_CAPABILITY'; end if;
  perform taxpay_guest_private.touch_session(p_capability_hash);
  select demo_id,payment_session_id into v_demo,v_session from taxpay_guest_private.demo_profiles
   where encode(extensions.digest(convert_to(capability_token,'UTF8'),'sha256'),'hex')=p_capability_hash;
  if v_demo is null then raise exception 'INVALID_DEMO_PROFILE'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',n.id,'paymentId',n.payment_id,'type',n.event_type,'createdAt',n.created_at)
    order by n.id desc) from (
      select notice.* from demo_payment.story_notifications notice
       join demo_payment.story_payments payment on payment.id=notice.payment_id
       where payment.data->>'origin'='TAXPAY_UI'
         and payment.data->'details'->>'payerId'=v_demo
         and (payment.session_id=v_session or payment.session_id in (
           select l.legacy_session_id from taxpay_guest_private.demo_story_session_links l
            where l.demo_id=v_demo and not exists (
              select 1 from demo_payment.story_payments u where u.session_id=l.legacy_session_id
               and (u.data->>'origin' is distinct from 'TAXPAY_UI'
                 or u.data->'details'->>'payerId' is distinct from v_demo)
            )
         )) order by notice.id desc limit 100
    ) n),'[]'::jsonb);
end;
$function$;
revoke all on function public.taxpay_demo_story1_session_notices(text)
  from public,anon,authenticated;
grant execute on function public.taxpay_demo_story1_session_notices(text)
  to service_role;

-- No account/session data or mutations were performed by this migration.
commit;
