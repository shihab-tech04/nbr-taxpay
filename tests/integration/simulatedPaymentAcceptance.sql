-- Disposable Supabase only. Entire transaction rolls back, leaving users6-10 empty.
\set ON_ERROR_STOP on
begin;
set local role anon;
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
  if jsonb_array_length(public.sim_payment_history('user7','beneficiary'))<>1 then raise exception 'Beneficiary missing'; end if;
  if jsonb_array_length(public.sim_payment_history('user8','beneficiary'))<>1 then raise exception 'Other beneficiary missing'; end if;
  if jsonb_array_length(public.sim_payment_notices('user8'))<>1 then raise exception 'Notification missing'; end if;
  if (public.sim_payment_history('user7','beneficiary')->0->'allocations'->0->>'beneficiary')<>'user7' then raise exception 'Cross-user allocation leakage'; end if;
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
  if jsonb_array_length(public.sim_payment_history(null,'all'))<>1 then raise exception 'Officer single graph mismatch'; end if;
  raise notice 'PASS: simulated payment atomic API, multiple beneficiaries, audit/events, notice recipients, scoping, idempotency and amount validation';
end $$;
rollback;