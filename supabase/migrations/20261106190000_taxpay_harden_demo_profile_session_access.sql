begin;

-- Legacy anonymous session RPCs remain available for ordinary guest UUIDs,
-- but a shared demo profile must use its server-issued capability.
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
  if exists(select 1 from taxpay_guest_private.demo_profiles where payment_session_id=v_session) then
    raise exception 'PROFILE_CAPABILITY_REQUIRED';
  end if;
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

create or replace function public.demo_story1_list(p_session uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
begin
  if exists(select 1 from taxpay_guest_private.demo_profiles where payment_session_id=p_session)
     or exists(select 1 from taxpay_guest_private.demo_story_session_links where legacy_session_id=p_session) then
    raise exception 'PROFILE_CAPABILITY_REQUIRED';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'service',x.service_code,
    'amountMinor',x.amount_minor,'status',x.status,'createdAt',x.created_at) order by x.created_at desc)
    from (select * from demo_payment.story_payments where session_id=p_session order by created_at desc limit 100) x),'[]'::jsonb);
end;
$function$;

create or replace function public.demo_story1_list_page(
  p_session uuid,p_page integer default 1,p_per_page integer default 100
) returns jsonb
language plpgsql stable security definer
set search_path = '' as $function$
declare v_total bigint;v_items jsonb;
begin
  if exists(select 1 from taxpay_guest_private.demo_profiles where payment_session_id=p_session)
     or exists(select 1 from taxpay_guest_private.demo_story_session_links where legacy_session_id=p_session) then
    raise exception 'PROFILE_CAPABILITY_REQUIRED';
  end if;
  if p_session is null or p_page is null or p_page<1 or p_page>10000
     or p_per_page is null or p_per_page<1 or p_per_page>100 then raise exception 'INVALID_PAGE'; end if;
  select count(*) into v_total from demo_payment.story_payments x where x.session_id=p_session;
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'service',x.service_code,
    'amountMinor',x.amount_minor,'status',x.status,'createdAt',x.created_at)
    order by x.created_at desc,x.id desc),'[]'::jsonb) into v_items from (
      select p.id,p.service_code,p.amount_minor,p.status,p.created_at
        from demo_payment.story_payments p where p.session_id=p_session
       order by p.created_at desc,p.id desc limit p_per_page offset (p_page-1)*p_per_page
    ) x;
  return jsonb_build_object('items',v_items,'total',v_total,'page',p_page,'perPage',p_per_page);
end;
$function$;

create or replace function public.demo_story1_get(p_id uuid,p_session uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare v demo_payment.story_payments%rowtype;
begin
  if exists(select 1 from taxpay_guest_private.demo_profiles where payment_session_id=p_session)
     or exists(select 1 from taxpay_guest_private.demo_story_session_links where legacy_session_id=p_session) then
    raise exception 'PROFILE_CAPABILITY_REQUIRED';
  end if;
  select * into v from demo_payment.story_payments where id=p_id and session_id=p_session;
  if not found then raise exception 'NOT_FOUND'; end if;
  return jsonb_build_object('id',v.id,'data',v.data,'status',v.status,'createdAt',v.created_at);
end;
$function$;

create or replace function public.demo_story1_notices(p_session uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
begin
  if exists(select 1 from taxpay_guest_private.demo_profiles where payment_session_id=p_session)
     or exists(select 1 from taxpay_guest_private.demo_story_session_links where legacy_session_id=p_session) then
    raise exception 'PROFILE_CAPABILITY_REQUIRED';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',n.id,'paymentId',n.payment_id,'type',n.event_type,'createdAt',n.created_at)
    order by n.id desc) from (
      select * from demo_payment.story_notifications where session_id=p_session order by id desc limit 100
    ) n),'[]'::jsonb);
end;
$function$;

-- These legacy functions accepted a caller-chosen public User ID. Preserve
-- them for the trusted server bridge only; browsers use capability RPCs.
revoke all on function public.demo_story1_demo_history(text,text) from public,anon,authenticated;
grant execute on function public.demo_story1_demo_history(text,text) to service_role;
revoke all on function public.demo_story1_demo_history_page(text,text,timestamptz,uuid,integer)
  from public,anon,authenticated;
grant execute on function public.demo_story1_demo_history_page(text,text,timestamptz,uuid,integer)
  to service_role;

commit;
