-- Simulation-only correction intake. Never creates an authenticated tax case,
-- changes a payment/ledger, or claims Office acknowledgement.
create table if not exists taxpay_guest_private.story_correction_requests (
  id uuid primary key default gen_random_uuid(),
  demo_id text not null,
  payment_id uuid not null references demo_payment.story_payments(id) on delete restrict,
  request_key uuid not null,
  allocation_index integer check (allocation_index is null or allocation_index >= 0),
  allocation_id text,
  original_reference text not null,
  current_year text not null, proposed_year text not null,
  current_circle text not null, proposed_circle text not null,
  current_head text not null, proposed_head text not null,
  reason text not null check (char_length(reason) between 10 and 1000),
  created_at timestamptz not null default now(),
  unique (demo_id, request_key)
);
alter table taxpay_guest_private.story_correction_requests enable row level security;
revoke all on taxpay_guest_private.story_correction_requests from public, anon, authenticated;
create index if not exists story_correction_requests_owner_time
  on taxpay_guest_private.story_correction_requests (demo_id, created_at desc, id desc);

create or replace function taxpay_guest_private.story_correction_json(
  p_row taxpay_guest_private.story_correction_requests
) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id',(p_row).id,'paymentId',(p_row).payment_id,'originalReference',(p_row).original_reference,
    'allocationIndex',(p_row).allocation_index,'allocationId',(p_row).allocation_id,
    'currentAY',(p_row).current_year,'proposedAY',(p_row).proposed_year,
    'currentCircle',(p_row).current_circle,'proposedCircle',(p_row).proposed_circle,
    'currentHeadCode',(p_row).current_head,'proposedHeadCode',(p_row).proposed_head,
    'reason',(p_row).reason,'createdAt',(p_row).created_at,'status','RECORDED'
  );
$$;
revoke all on function taxpay_guest_private.story_correction_json(taxpay_guest_private.story_correction_requests) from public, anon, authenticated;

create or replace function public.taxpay_demo_correction_list(
  p_capability_hash text, p_limit integer default 100, p_offset integer default 0
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_demo text; v_rows jsonb;
begin
  if p_capability_hash is null or p_capability_hash !~ '^[0-9a-f]{64}$'
     or p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset < 0 then
    raise exception 'INVALID_CORRECTION_REQUEST';
  end if;
  perform taxpay_guest_private.touch_session(p_capability_hash);
  select demo_id into v_demo from taxpay_guest_private.demo_profiles
    where encode(extensions.digest(convert_to(capability_token,'UTF8'),'sha256'),'hex')=p_capability_hash;
  if v_demo is null then raise exception 'INVALID_DEMO_PROFILE'; end if;
  select coalesce(jsonb_agg(taxpay_guest_private.story_correction_json(r.record) order by r.created_at desc,r.id desc),'[]'::jsonb)
    into v_rows from (
      select x as record,x.created_at,x.id from taxpay_guest_private.story_correction_requests x
      where x.demo_id=v_demo order by x.created_at desc,x.id desc limit p_limit offset p_offset
    ) r;
  return v_rows;
end;
$$;
revoke all on function public.taxpay_demo_correction_list(text,integer,integer) from public, anon, authenticated;
grant execute on function public.taxpay_demo_correction_list(text,integer,integer) to service_role;

create or replace function public.taxpay_demo_correction_save(
  p_capability_hash text, p_payment_id uuid, p_request_key uuid, p_input jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_demo text; v_payment jsonb; v_details jsonb; v_snapshot jsonb;
  v_allocs jsonb; v_items jsonb; v_lines jsonb; v_alloc jsonb; v_snap_alloc jsonb;
  v_count integer; v_index integer; v_alloc_id text; v_reference text;
  v_year text; v_new_year text; v_circle text; v_new_circle text;
  v_head text; v_new_head text; v_reason text;
  v_year_normal text; v_new_year_normal text;
  v_row taxpay_guest_private.story_correction_requests%rowtype;
begin
  if p_capability_hash is null or p_capability_hash !~ '^[0-9a-f]{64}$'
     or p_payment_id is null or p_request_key is null or jsonb_typeof(p_input) is distinct from 'object' then
    raise exception 'INVALID_CORRECTION_REQUEST';
  end if;
  -- Existing private owner read validates live capability, profile and legacy
  -- session ownership before returning the immutable source payment.
  v_payment:=public.taxpay_demo_story1_session_payment(p_capability_hash,p_payment_id);
  if v_payment->>'status' is distinct from 'SIMULATED_SUCCESS' then raise exception 'CORRECTION_PAYMENT_UNAVAILABLE'; end if;
  select demo_id into v_demo from taxpay_guest_private.demo_profiles
    where encode(extensions.digest(convert_to(capability_token,'UTF8'),'sha256'),'hex')=p_capability_hash;
  if v_demo is null then raise exception 'INVALID_DEMO_PROFILE'; end if;
  v_details:=v_payment#>'{data,details}';
  v_snapshot:=coalesce(v_details->'receiptSnapshot','{}'::jsonb);
  v_allocs:=case when jsonb_typeof(v_details->'allocations')='array' then v_details->'allocations' else '[]'::jsonb end;
  v_items:=case when jsonb_typeof(v_snapshot->'allocationItems')='array' then v_snapshot->'allocationItems' else '[]'::jsonb end;
  v_lines:=case when jsonb_typeof(v_details->'lines')='array' then v_details->'lines' else '[]'::jsonb end;
  v_count:=greatest(jsonb_array_length(v_allocs),jsonb_array_length(v_items),jsonb_array_length(v_lines));
  if p_input->>'allocationIndex' is not null then
    if p_input->>'allocationIndex' !~ '^[0-9]{1,6}$' then raise exception 'INVALID_CORRECTION_ALLOCATION'; end if;
    v_index:=(p_input->>'allocationIndex')::integer;
  elsif v_count>1 then raise exception 'INVALID_CORRECTION_ALLOCATION';
  elsif v_count=1 then v_index:=0;
  end if;
  if v_index is not null and v_index>=v_count then raise exception 'INVALID_CORRECTION_ALLOCATION'; end if;
  v_alloc:=v_allocs->v_index;
  v_snap_alloc:=v_items->v_index;
  v_alloc_id:=nullif(coalesce(v_alloc->>'allocationId',v_snap_alloc->>'allocationId'),'');
  if nullif(p_input->>'allocationId','') is distinct from v_alloc_id then raise exception 'INVALID_CORRECTION_ALLOCATION'; end if;
  if v_count>1 and v_alloc is null and v_snap_alloc is null and v_lines->v_index is null then
    raise exception 'INVALID_CORRECTION_ALLOCATION';
  end if;
  v_reference:=coalesce(nullif(v_snapshot->>'challanNo',''),nullif(v_details->>'receiptReference',''),p_payment_id::text);
  v_year:=coalesce(nullif(v_alloc->>'assessmentYear',''),nullif(v_snap_alloc->>'assessmentYear',''),
    nullif(v_lines->v_index->>'assessmentYear',''),nullif(v_snapshot->>'assessmentYear',''),nullif(v_details->>'assessmentYear',''),'');
  v_circle:=coalesce(v_snapshot->>'taxCircle',v_details->>'taxCircle','');
  v_head:=coalesce(nullif(v_snap_alloc->>'economicCode',''),nullif(v_lines->v_index->>'economicCode',''),
    nullif(v_snapshot->'items'->v_index->>'economicCode',''),
    case when v_count<=1 then nullif(v_snapshot#>>'{items,0,economicCode}','') end,'');
  v_reason:=btrim(coalesce(p_input->>'reason',''));
  v_new_year:=coalesce(nullif(btrim(p_input->>'proposedAY'),''),v_year);
  v_new_circle:=coalesce(nullif(btrim(p_input->>'proposedCircle'),''),v_circle);
  v_new_head:=coalesce(nullif(btrim(p_input->>'proposedHeadCode'),''),v_head);
  if char_length(v_reason) not between 10 and 1000 or char_length(v_new_circle)>120 or char_length(v_new_head)>120
     or (v_new_year is distinct from v_year and v_new_year !~ '^[0-9]{4}-([0-9]{2}|[0-9]{4})$') then
    raise exception 'INVALID_CORRECTION_REQUEST';
  end if;
  v_year_normal:=case when v_year ~ '^[0-9]{4}-[0-9]{2}$' then left(v_year,5)||left(v_year,2)||right(v_year,2) else v_year end;
  v_new_year_normal:=case when v_new_year ~ '^[0-9]{4}-[0-9]{2}$' then left(v_new_year,5)||left(v_new_year,2)||right(v_new_year,2) else v_new_year end;
  if v_year_normal=v_new_year_normal and v_circle=v_new_circle and v_head=v_new_head then
    raise exception 'CORRECTION_NO_CHANGE';
  end if;
  insert into taxpay_guest_private.story_correction_requests
    (demo_id,payment_id,request_key,allocation_index,allocation_id,original_reference,
     current_year,proposed_year,current_circle,proposed_circle,current_head,proposed_head,reason)
  values(v_demo,p_payment_id,p_request_key,v_index,v_alloc_id,v_reference,
    v_year,v_new_year,v_circle,v_new_circle,v_head,v_new_head,v_reason)
  on conflict(demo_id,request_key) do nothing;
  select * into v_row from taxpay_guest_private.story_correction_requests where demo_id=v_demo and request_key=p_request_key;
  if v_row.payment_id is distinct from p_payment_id or v_row.allocation_index is distinct from v_index
     or v_row.allocation_id is distinct from v_alloc_id or v_row.proposed_year is distinct from v_new_year
     or v_row.proposed_circle is distinct from v_new_circle or v_row.proposed_head is distinct from v_new_head
     or v_row.reason is distinct from v_reason then raise exception 'CORRECTION_REQUEST_CONFLICT'; end if;
  return taxpay_guest_private.story_correction_json(v_row);
end;
$$;
revoke all on function public.taxpay_demo_correction_save(text,uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.taxpay_demo_correction_save(text,uuid,uuid,jsonb) to service_role;
