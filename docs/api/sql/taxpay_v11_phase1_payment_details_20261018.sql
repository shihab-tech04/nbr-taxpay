-- Phase 1: preserve payment form details without replacing existing requests.
-- Synthetic handoff only. Public get/inbox continue omitting identifying fields.
alter table taxpay_handoff.requests add column if not exists payment_details jsonb not null default '{}'::jsonb;
create or replace function public.taxpay_v11_handoff_submit(p_input jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_key uuid;v_session uuid;v_service text;v_year text;
 v_minor bigint;v_tin text;v_reference text;v_fp text;v_details jsonb;v_b jsonb;v_a jsonb;
 v_existing taxpay_handoff.requests%rowtype;v_new taxpay_handoff.requests%rowtype;
begin
 if p_input is null or jsonb_typeof(p_input)<>'object' or
    length(p_input::text)>8192 or
    exists(select 1 from jsonb_object_keys(p_input) k(key)
      where k.key not in ('service','amountMinor','assessmentYear',
        'tin','reference','sessionId','idempotencyKey','paymentDetails')) then
   raise exception 'INVALID_HANDOFF_REQUEST';
 end if;
 if coalesce(p_input->>'sessionId','') !~
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    or coalesce(p_input->>'idempotencyKey','') !~
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
 then raise exception 'INVALID_HANDOFF_KEY'; end if;
 v_key:=(p_input->>'idempotencyKey')::uuid;
 v_session:=(p_input->>'sessionId')::uuid;
 v_service:=p_input->>'service';
 v_year:=nullif(p_input->>'assessmentYear','');
 v_tin:=coalesce(p_input->>'tin','');
 v_reference:=coalesce(p_input->>'reference','');
 v_details:=coalesce(p_input->'paymentDetails','{}'::jsonb);
 if v_service is null or v_service not in ('TAX_WITH_RETURN','ADVANCE_TAX','ASSESSED_DEMAND',
   'PENALTY','SOURCE_TAX_DEPOSIT','APPELLATE_TRIBUNAL',
   'OTHER_TAX_PAYMENT','TRAVEL_TAX') or
   coalesce(p_input->>'amountMinor','') !~ '^[1-9][0-9]{0,11}$'
 then raise exception 'INVALID_HANDOFF_SERVICE_OR_AMOUNT'; end if;
 v_minor:=(p_input->>'amountMinor')::bigint;
 if v_minor>1000000000000 then raise exception 'INVALID_HANDOFF_AMOUNT'; end if;
 if v_service='TRAVEL_TAX' then
   if v_year is not null then raise exception 'TRAVEL_TAX_HAS_NO_ASSESSMENT_YEAR'; end if;
 elsif v_year is null or v_year !~ '^20[0-9]{2}-[0-9]{2}$' or
   v_tin !~ '^(DEMO-TIN-[0-9]{3}|[0-9]{12,13}) then
   raise exception 'INVALID_HANDOFF_TAX_YEAR_OR_TIN';
 end if;
 if v_service='OTHER_TAX_PAYMENT' and
   length(btrim(v_reference)) not between 1 and 80 then
   raise exception 'REFERENCE_REQUIRED'; end if;
 if length(v_tin)>20 or length(v_reference)>80 then
   raise exception 'INVALID_HANDOFF_FIELD_SIZE'; end if;

 if jsonb_typeof(v_details)<>'object' or length(v_details::text)>6144 or
 exists(select 1 from jsonb_object_keys(v_details) k(key) where k.key not in
 ('headId','headName','economicCode','headAllocations','purpose','incomeTaxType',
  'payerMode','payerName','payerTin','representativeName','representativeTin',
  'deducteeName','deducteeTin','taxZone','taxCircle','contactMobile','contactEmail',
  'paymentChannel','paymentMethod','amountBreakdown','remarks','noticeReference',
  'travelPassengers','incomeYear','paymentLines')) then
 raise exception 'INVALID_PAYMENT_DETAILS';end if;
 if v_details ? 'paymentChannel' and
    v_details->>'paymentChannel' not in ('NOW','OTC') then
 raise exception 'INVALID_PAYMENT_CHANNEL';end if;
 if v_details ? 'incomeTaxType' and
    v_details->>'incomeTaxType' not in ('NON_COMPANY','COMPANY') then
 raise exception 'INVALID_INCOME_TAX_TYPE';end if;
 if v_details ? 'payerMode' and
    v_details->>'payerMode' not in ('SELF','OTHER') then
 raise exception 'INVALID_PAYER_MODE';end if;
 if v_details ? 'paymentMethod' and
    v_details->>'paymentMethod' not in
 ('BKASH','NAGAD','ROCKET','INTERNET_BANKING','SONALI_E_SHEBA',
  'BEFTN_RTGS','VISA','MASTERCARD','OTC','BANK','CARD') then
 raise exception 'INVALID_PAYMENT_METHOD';end if;
 if exists(select 1 from jsonb_each(v_details) v(key,value) where
  v.key not in ('amountBreakdown','headAllocations','paymentLines','travelPassengers')
  and (jsonb_typeof(v.value)<>'string' or length(v.value#>>'{}')>250)) then
 raise exception 'INVALID_PAYMENT_DETAIL_FIELD';end if;
 if v_details ? 'amountBreakdown' then
 v_b:=v_details->'amountBreakdown';
 if jsonb_typeof(v_b)<>'object' or exists(select 1 from jsonb_object_keys(v_b) k(key)
 where k.key not in ('taxMinor','penaltyMinor','surchargeMinor','interestMinor'))
 or exists(select 1 from jsonb_each_text(v_b) v(key,value)
 where v.value !~ '^(0|[1-9][0-9]{0,12})
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_key::text,0));
 select * into v_existing from taxpay_handoff.requests where idempotency_key=v_key;
 if found then
   if v_existing.request_fingerprint<>v_fp then
     raise exception 'IDEMPOTENCY_COLLISION'; end if;
   return jsonb_build_object('requestId',v_existing.id,
      'reference',v_existing.public_reference,'state',v_existing.lifecycle_state,
      'reviewState',v_existing.review_state,'totalMinor',v_existing.amount_minor,
      'simulationOnly',true,'replayed',true);
 end if;
 insert into taxpay_handoff.requests
   (public_reference,idempotency_key,request_fingerprint,session_id,service_code,
    amount_minor,assessment_year,tin_provided,reference_provided,payment_details)
 values('HND-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),
  v_key,v_fp,v_session,v_service,v_minor,v_year,v_tin<>'',v_reference<>'',v_details)
 returning * into v_new;
 insert into taxpay_handoff.events(request_id,event_type,detail)
 values(v_new.id,'REQUEST_CREATED','Synthetic payment request recorded');
 insert into taxpay_handoff.notifications(request_id,session_id,event_code)
 values(v_new.id,v_session,'REQUEST_CREATED');
 return jsonb_build_object('requestId',v_new.id,
   'reference',v_new.public_reference,'state','PENDING','reviewState','PENDING_OFFICER',
   'totalMinor',v_minor,'simulationOnly',true,'replayed',false);
end;
$function$;

 then
   raise exception 'INVALID_HANDOFF_TAX_YEAR_OR_TIN';
 end if;
 if v_service='OTHER_TAX_PAYMENT' and
   length(btrim(v_reference)) not between 1 and 80 then
   raise exception 'REFERENCE_REQUIRED'; end if;
 if length(v_tin)>20 or length(v_reference)>80 then
   raise exception 'INVALID_HANDOFF_FIELD_SIZE'; end if;
 v_fp:=md5(p_input::text);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_key::text,0));
 select * into v_existing from taxpay_handoff.requests where idempotency_key=v_key;
 if found then
   if v_existing.request_fingerprint<>v_fp then
     raise exception 'IDEMPOTENCY_COLLISION'; end if;
   return jsonb_build_object('requestId',v_existing.id,
      'reference',v_existing.public_reference,'state',v_existing.lifecycle_state,
      'reviewState',v_existing.review_state,'totalMinor',v_existing.amount_minor,
      'simulationOnly',true,'replayed',true);
 end if;
 insert into taxpay_handoff.requests
   (public_reference,idempotency_key,request_fingerprint,session_id,service_code,
    amount_minor,assessment_year,tin_provided,reference_provided)
 values('HND-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),
  v_key,v_fp,v_session,v_service,v_minor,v_year,v_tin<>'',v_reference<>'')
 returning * into v_new;
 insert into taxpay_handoff.events(request_id,event_type,detail)
 values(v_new.id,'REQUEST_CREATED','Synthetic payment request recorded');
 insert into taxpay_handoff.notifications(request_id,session_id,event_code)
 values(v_new.id,v_session,'REQUEST_CREATED');
 return jsonb_build_object('requestId',v_new.id,
   'reference',v_new.public_reference,'state','PENDING','reviewState','PENDING_OFFICER',
   'totalMinor',v_minor,'simulationOnly',true,'replayed',false);
end;
$function$;

) then
 raise exception 'INVALID_PAYMENT_BREAKDOWN';end if;
 if coalesce((v_b->>'taxMinor')::bigint,0)
  +coalesce((v_b->>'penaltyMinor')::bigint,0)
  +coalesce((v_b->>'surchargeMinor')::bigint,0)
  +coalesce((v_b->>'interestMinor')::bigint,0)<>v_minor then
 raise exception 'PAYMENT_TOTAL_MISMATCH';end if;
 end if;
 if v_details ? 'headAllocations' then
 v_a:=v_details->'headAllocations';
 if jsonb_typeof(v_a)<>'array' or jsonb_array_length(v_a) not between 1 and 20
 or exists(select 1 from jsonb_array_elements(v_a) item(value)
 where jsonb_typeof(item.value)<>'object'
 or coalesce(item.value->>'headId','') !~ '^[0-9]{1,8}
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_key::text,0));
 select * into v_existing from taxpay_handoff.requests where idempotency_key=v_key;
 if found then
   if v_existing.request_fingerprint<>v_fp then
     raise exception 'IDEMPOTENCY_COLLISION'; end if;
   return jsonb_build_object('requestId',v_existing.id,
      'reference',v_existing.public_reference,'state',v_existing.lifecycle_state,
      'reviewState',v_existing.review_state,'totalMinor',v_existing.amount_minor,
      'simulationOnly',true,'replayed',true);
 end if;
 insert into taxpay_handoff.requests
   (public_reference,idempotency_key,request_fingerprint,session_id,service_code,
    amount_minor,assessment_year,tin_provided,reference_provided)
 values('HND-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),
  v_key,v_fp,v_session,v_service,v_minor,v_year,v_tin<>'',v_reference<>'')
 returning * into v_new;
 insert into taxpay_handoff.events(request_id,event_type,detail)
 values(v_new.id,'REQUEST_CREATED','Synthetic payment request recorded');
 insert into taxpay_handoff.notifications(request_id,session_id,event_code)
 values(v_new.id,v_session,'REQUEST_CREATED');
 return jsonb_build_object('requestId',v_new.id,
   'reference',v_new.public_reference,'state','PENDING','reviewState','PENDING_OFFICER',
   'totalMinor',v_minor,'simulationOnly',true,'replayed',false);
end;
$function$;

 then
   raise exception 'INVALID_HANDOFF_TAX_YEAR_OR_TIN';
 end if;
 if v_service='OTHER_TAX_PAYMENT' and
   length(btrim(v_reference)) not between 1 and 80 then
   raise exception 'REFERENCE_REQUIRED'; end if;
 if length(v_tin)>20 or length(v_reference)>80 then
   raise exception 'INVALID_HANDOFF_FIELD_SIZE'; end if;
 v_fp:=md5(p_input::text);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_key::text,0));
 select * into v_existing from taxpay_handoff.requests where idempotency_key=v_key;
 if found then
   if v_existing.request_fingerprint<>v_fp then
     raise exception 'IDEMPOTENCY_COLLISION'; end if;
   return jsonb_build_object('requestId',v_existing.id,
      'reference',v_existing.public_reference,'state',v_existing.lifecycle_state,
      'reviewState',v_existing.review_state,'totalMinor',v_existing.amount_minor,
      'simulationOnly',true,'replayed',true);
 end if;
 insert into taxpay_handoff.requests
   (public_reference,idempotency_key,request_fingerprint,session_id,service_code,
    amount_minor,assessment_year,tin_provided,reference_provided)
 values('HND-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),
  v_key,v_fp,v_session,v_service,v_minor,v_year,v_tin<>'',v_reference<>'')
 returning * into v_new;
 insert into taxpay_handoff.events(request_id,event_type,detail)
 values(v_new.id,'REQUEST_CREATED','Synthetic payment request recorded');
 insert into taxpay_handoff.notifications(request_id,session_id,event_code)
 values(v_new.id,v_session,'REQUEST_CREATED');
 return jsonb_build_object('requestId',v_new.id,
   'reference',v_new.public_reference,'state','PENDING','reviewState','PENDING_OFFICER',
   'totalMinor',v_minor,'simulationOnly',true,'replayed',false);
end;
$function$;


 or coalesce(item.value->>'amountMinor','') !~ '^[1-9][0-9]{0,11}
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_key::text,0));
 select * into v_existing from taxpay_handoff.requests where idempotency_key=v_key;
 if found then
   if v_existing.request_fingerprint<>v_fp then
     raise exception 'IDEMPOTENCY_COLLISION'; end if;
   return jsonb_build_object('requestId',v_existing.id,
      'reference',v_existing.public_reference,'state',v_existing.lifecycle_state,
      'reviewState',v_existing.review_state,'totalMinor',v_existing.amount_minor,
      'simulationOnly',true,'replayed',true);
 end if;
 insert into taxpay_handoff.requests
   (public_reference,idempotency_key,request_fingerprint,session_id,service_code,
    amount_minor,assessment_year,tin_provided,reference_provided)
 values('HND-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),
  v_key,v_fp,v_session,v_service,v_minor,v_year,v_tin<>'',v_reference<>'')
 returning * into v_new;
 insert into taxpay_handoff.events(request_id,event_type,detail)
 values(v_new.id,'REQUEST_CREATED','Synthetic payment request recorded');
 insert into taxpay_handoff.notifications(request_id,session_id,event_code)
 values(v_new.id,v_session,'REQUEST_CREATED');
 return jsonb_build_object('requestId',v_new.id,
   'reference',v_new.public_reference,'state','PENDING','reviewState','PENDING_OFFICER',
   'totalMinor',v_minor,'simulationOnly',true,'replayed',false);
end;
$function$;

 then
   raise exception 'INVALID_HANDOFF_TAX_YEAR_OR_TIN';
 end if;
 if v_service='OTHER_TAX_PAYMENT' and
   length(btrim(v_reference)) not between 1 and 80 then
   raise exception 'REFERENCE_REQUIRED'; end if;
 if length(v_tin)>20 or length(v_reference)>80 then
   raise exception 'INVALID_HANDOFF_FIELD_SIZE'; end if;
 v_fp:=md5(p_input::text);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_key::text,0));
 select * into v_existing from taxpay_handoff.requests where idempotency_key=v_key;
 if found then
   if v_existing.request_fingerprint<>v_fp then
     raise exception 'IDEMPOTENCY_COLLISION'; end if;
   return jsonb_build_object('requestId',v_existing.id,
      'reference',v_existing.public_reference,'state',v_existing.lifecycle_state,
      'reviewState',v_existing.review_state,'totalMinor',v_existing.amount_minor,
      'simulationOnly',true,'replayed',true);
 end if;
 insert into taxpay_handoff.requests
   (public_reference,idempotency_key,request_fingerprint,session_id,service_code,
    amount_minor,assessment_year,tin_provided,reference_provided)
 values('HND-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),
  v_key,v_fp,v_session,v_service,v_minor,v_year,v_tin<>'',v_reference<>'')
 returning * into v_new;
 insert into taxpay_handoff.events(request_id,event_type,detail)
 values(v_new.id,'REQUEST_CREATED','Synthetic payment request recorded');
 insert into taxpay_handoff.notifications(request_id,session_id,event_code)
 values(v_new.id,v_session,'REQUEST_CREATED');
 return jsonb_build_object('requestId',v_new.id,
   'reference',v_new.public_reference,'state','PENDING','reviewState','PENDING_OFFICER',
   'totalMinor',v_minor,'simulationOnly',true,'replayed',false);
end;
$function$;

)
 then raise exception 'INVALID_HEAD_ALLOCATION';end if;
 if (select sum((item.value->>'amountMinor')::bigint)
 from jsonb_array_elements(v_a) item(value))<>v_minor then
 raise exception 'HEAD_TOTAL_MISMATCH';end if;end if;
 if exists(select 1 from jsonb_each(v_details) v(key,value)
 where v.key in ('paymentLines','travelPassengers') and
 (jsonb_typeof(v.value)<>'array' or jsonb_array_length(v.value)>40))
 then raise exception 'INVALID_PAYMENT_ITEMS';end if;
 v_fp:=md5(p_input::text);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_key::text,0));
 select * into v_existing from taxpay_handoff.requests where idempotency_key=v_key;
 if found then
   if v_existing.request_fingerprint<>v_fp then
     raise exception 'IDEMPOTENCY_COLLISION'; end if;
   return jsonb_build_object('requestId',v_existing.id,
      'reference',v_existing.public_reference,'state',v_existing.lifecycle_state,
      'reviewState',v_existing.review_state,'totalMinor',v_existing.amount_minor,
      'simulationOnly',true,'replayed',true);
 end if;
 insert into taxpay_handoff.requests
   (public_reference,idempotency_key,request_fingerprint,session_id,service_code,
    amount_minor,assessment_year,tin_provided,reference_provided)
 values('HND-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),
  v_key,v_fp,v_session,v_service,v_minor,v_year,v_tin<>'',v_reference<>'')
 returning * into v_new;
 insert into taxpay_handoff.events(request_id,event_type,detail)
 values(v_new.id,'REQUEST_CREATED','Synthetic payment request recorded');
 insert into taxpay_handoff.notifications(request_id,session_id,event_code)
 values(v_new.id,v_session,'REQUEST_CREATED');
 return jsonb_build_object('requestId',v_new.id,
   'reference',v_new.public_reference,'state','PENDING','reviewState','PENDING_OFFICER',
   'totalMinor',v_minor,'simulationOnly',true,'replayed',false);
end;
$function$;

 then
   raise exception 'INVALID_HANDOFF_TAX_YEAR_OR_TIN';
 end if;
 if v_service='OTHER_TAX_PAYMENT' and
   length(btrim(v_reference)) not between 1 and 80 then
   raise exception 'REFERENCE_REQUIRED'; end if;
 if length(v_tin)>20 or length(v_reference)>80 then
   raise exception 'INVALID_HANDOFF_FIELD_SIZE'; end if;
 v_fp:=md5(p_input::text);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_key::text,0));
 select * into v_existing from taxpay_handoff.requests where idempotency_key=v_key;
 if found then
   if v_existing.request_fingerprint<>v_fp then
     raise exception 'IDEMPOTENCY_COLLISION'; end if;
   return jsonb_build_object('requestId',v_existing.id,
      'reference',v_existing.public_reference,'state',v_existing.lifecycle_state,
      'reviewState',v_existing.review_state,'totalMinor',v_existing.amount_minor,
      'simulationOnly',true,'replayed',true);
 end if;
 insert into taxpay_handoff.requests
   (public_reference,idempotency_key,request_fingerprint,session_id,service_code,
    amount_minor,assessment_year,tin_provided,reference_provided)
 values('HND-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),
  v_key,v_fp,v_session,v_service,v_minor,v_year,v_tin<>'',v_reference<>'')
 returning * into v_new;
 insert into taxpay_handoff.events(request_id,event_type,detail)
 values(v_new.id,'REQUEST_CREATED','Synthetic payment request recorded');
 insert into taxpay_handoff.notifications(request_id,session_id,event_code)
 values(v_new.id,v_session,'REQUEST_CREATED');
 return jsonb_build_object('requestId',v_new.id,
   'reference',v_new.public_reference,'state','PENDING','reviewState','PENDING_OFFICER',
   'totalMinor',v_minor,'simulationOnly',true,'replayed',false);
end;
$function$;


create or replace function public.taxpay_v11_handoff_get_private(p_request_id uuid,p_session_id uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v taxpay_handoff.requests%rowtype;
begin
 if p_request_id is null or p_session_id is null then raise exception 'INVALID_HANDOFF_SESSION';end if;
 select * into v from taxpay_handoff.requests where id=p_request_id and session_id=p_session_id;
 if not found then raise exception 'UNKNOWN_HANDOFF_REQUEST';end if;
 return jsonb_build_object('requestId',v.id,'reference',v.public_reference,
  'service',v.service_code,'assessmentYear',v.assessment_year,'totalMinor',v.amount_minor,
  'paymentDetails',v.payment_details,'state',v.lifecycle_state,'reviewState',v.review_state,
  'createdAt',v.created_at,'simulationOnly',true);
end;$function$;
revoke all on function public.taxpay_v11_handoff_get_private(uuid,uuid) from public,anon,authenticated;
grant execute on function public.taxpay_v11_handoff_get_private(uuid,uuid) to anon,authenticated;
