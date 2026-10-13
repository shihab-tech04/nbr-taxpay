-- Disposable Supabase only. Entire transaction rolls back, leaving users6-10 empty.
\set ON_ERROR_STOP on
-- New access contract: anonymous callers may not execute payment/ledger RPCs.
begin;
set local role anon;
do $security$
begin
 if has_function_privilege('anon','public.sim_submit_payment(text,jsonb,uuid)','EXECUTE')
 or has_function_privilege('anon','public.sim_payment_history(text,text)','EXECUTE')
 or has_function_privilege('anon','public.sim_payment_notices(text)','EXECUTE')
 then raise exception 'Anonymous simulator RPC permissions must be denied'; end if;
end $security$;
rollback;
-- Retain every original transactional money and graph assertion below, executed by
-- a privileged disposable-test fixture runner. Auth ownership/RLS is tested separately.
begin;
-- Entire suite runs under rollback-only synthetic Auth identities.
insert into auth.users(id,aud,role,email,created_at,updated_at,email_confirmed_at)
values
('11111111-1111-4111-8111-000000000006','authenticated','authenticated','isolated-user6@example.invalid',now(),now(),now()),
('11111111-1111-4111-8111-000000000007','authenticated','authenticated','isolated-user7@example.invalid',now(),now(),now()),
('11111111-1111-4111-8111-000000000008','authenticated','authenticated','isolated-user8@example.invalid',now(),now(),now()),
('11111111-1111-4111-8111-000000000009','authenticated','authenticated','isolated-officer@example.invalid',now(),now(),now());
insert into public.sim_payment_account_bindings(user_id,owner_uid,assigned_by)
values
('user6','11111111-1111-4111-8111-000000000006','11111111-1111-4111-8111-000000000009'),
('user7','11111111-1111-4111-8111-000000000007','11111111-1111-4111-8111-000000000009'),
('user8','11111111-1111-4111-8111-000000000008','11111111-1111-4111-8111-000000000009');
insert into public.taxpay_officer_roles(user_uid,role,active)
values('11111111-1111-4111-8111-000000000009','REVIEWER',true);
select pg_catalog.set_config('request.jwt.claim.sub','11111111-1111-4111-8111-000000000006',true);
do $$
declare
  payload jsonb;
  result_row jsonb;
  replay jsonb;
  changed_rejected boolean:=false;
  negative_rejected boolean:=false;
begin
  if has_table_privilege('anon','public.sim_payment_transactions','INSERT') then
    raise exception 'Anon may write financial simulation table outside RPC';
  end if;
  if jsonb_array_length(public.sim_payment_history('user6','payer'))<>0 then
    raise exception 'Initial user6 ledger is not empty';
  end if;
  payload:='[{"beneficiary":"user6","category":"ADVANCE_TAX","assessmentYear":"2026-27","amountMinor":12550},{"beneficiary":"user7","category":"TAX_WITH_RETURN","assessmentYear":"2025-26","amountMinor":4200},{"beneficiary":"user8","category":"PENALTY","assessmentYear":"2026-27","amountMinor":100}]'::jsonb;
  result_row:=public.sim_submit_payment('user6',payload,'21220000-0000-4000-8000-000000000001'::uuid);
  if (result_row->>'totalMinor')::bigint<>16850 then raise exception 'Atomic money total failed'; end if;
  if jsonb_array_length(public.sim_payment_history('user6','payer'))<>1 then raise exception 'Payer missing'; end if;
  perform pg_catalog.set_config('request.jwt.claim.sub','11111111-1111-4111-8111-000000000007',true);
  if jsonb_array_length(public.sim_payment_history('user7','beneficiary'))<>1 then raise exception 'Beneficiary missing'; end if;
  perform pg_catalog.set_config('request.jwt.claim.sub','11111111-1111-4111-8111-000000000008',true);
  if jsonb_array_length(public.sim_payment_history('user8','beneficiary'))<>1 then raise exception 'Other beneficiary missing'; end if;
  if jsonb_array_length(public.sim_payment_notices('user8'))<>1 then raise exception 'Notification missing'; end if;
  perform pg_catalog.set_config('request.jwt.claim.sub','11111111-1111-4111-8111-000000000007',true);
  if (public.sim_payment_history('user7','beneficiary')->0->'allocations'->0->>'beneficiary')<>'user7' then raise exception 'Cross-user allocation leakage'; end if;
  perform pg_catalog.set_config('request.jwt.claim.sub','11111111-1111-4111-8111-000000000006',true);
  replay:=public.sim_submit_payment('user6',payload,'21220000-0000-4000-8000-000000000001'::uuid);
  if (replay->>'replayed')::boolean is distinct from true then raise exception 'Idempotency replay failed'; end if;
  if replay->>'transactionId'<>result_row->>'transactionId' then raise exception 'Idempotency duplicated transaction'; end if;
  begin
    perform public.sim_submit_payment('user6','[{"beneficiary":"user9","category":"ADVANCE_TAX","assessmentYear":"2026-27","amountMinor":100}]'::jsonb,'21220000-0000-4000-8000-000000000001'::uuid);
  exception when others then
    if SQLERRM like 'Idempotency key reused%' then changed_rejected:=true; else raise; end if;
  end;
  if not changed_rejected then raise exception 'Mutated replay accepted'; end if;
  begin
    perform public.sim_submit_payment('user6','[{"beneficiary":"user10","category":"PENALTY","assessmentYear":"2026-27","amountMinor":-1}]'::jsonb,'21220000-0000-4000-8000-000000000002'::uuid);
  exception when others then
    if SQLERRM like 'Positive integer paisa required%' then negative_rejected:=true; else raise; end if;
  end;
  if not negative_rejected then raise exception 'Invalid negative allocation accepted'; end if;
  perform pg_catalog.set_config('request.jwt.claim.sub','11111111-1111-4111-8111-000000000009',true);
  if jsonb_array_length(public.sim_payment_history(null,'all'))<>1 then raise exception 'Officer single graph mismatch'; end if;
  raise notice 'PASS: simulated payment atomic API, multiple beneficiaries, audit/events, notice recipients, scoping, idempotency and amount validation';
end $$;
rollback;