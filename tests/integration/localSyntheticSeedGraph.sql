-- Disposable-only physical SQL acceptance for the exact archived nine-row synthetic fixture.
-- No hosted project is touched. Every write is rolled back.
\set ON_ERROR_STOP on
begin;
\i supabase/seeds/20261013_user1_to_user5_simulation.sql
do $test$
declare row_count integer; line_count integer; event_count integer; bad_count integer; money bigint;
begin
  select count(*) into row_count from public.sim_payment_transactions
    where public_ref ~ '^DEMO-TX-00[1-9]$';
  if row_count<>9 then raise exception 'Exact nine historical seeded transactions failed: %',row_count; end if;
  select count(*),sum(amount_minor) into line_count,money
    from public.sim_payment_allocations a
    join public.sim_payment_transactions t on t.id=a.transaction_id
    where t.public_ref ~ '^DEMO-TX-00[1-9]$';
  if line_count<>16 or money<>5040000 then
    raise exception 'Source fixture 16 allocation/5040000 paisa check failed: %, %',line_count,money;
  end if;
  select count(*) into event_count from public.sim_payment_events e
    join public.sim_payment_transactions t on t.id=e.transaction_id
    where t.public_ref ~ '^DEMO-TX-00[1-9]$';
  if event_count<>27 then raise exception 'Twenty-seven source event steps not preserved: %',event_count; end if;
  select count(*) into bad_count from public.sim_payment_transactions t
    where t.public_ref ~ '^DEMO-TX-00[1-9]$'
      and ((select coalesce(sum(a.amount_minor),0) from public.sim_payment_allocations a where a.transaction_id=t.id)<>t.total_minor
        or (select count(*) from public.sim_payment_events e where e.transaction_id=t.id)<3);
  if bad_count<>0 then raise exception 'Allocation-to-total integrity or event coverage regression'; end if;
  select count(*) into bad_count from (
    select e.transaction_id,e.occurred_at,
      lag(e.occurred_at) over(partition by e.transaction_id order by e.seq) as previous_at
    from public.sim_payment_events e join public.sim_payment_transactions t on t.id=e.transaction_id
    where t.public_ref ~ '^DEMO-TX-00[1-9]$'
  ) events where previous_at>occurred_at;
  if bad_count<>0 then raise exception 'Transaction event order regression'; end if;
  select count(*) into bad_count from public.sim_payment_notifications n
    join public.sim_payment_transactions t on t.id=n.transaction_id
    where t.public_ref ~ '^DEMO-TX-00[1-9]$'
      and not(n.user_id=t.payer_id or exists(
        select 1 from public.sim_payment_allocations a where a.transaction_id=t.id and a.beneficiary_id=n.user_id));
  if bad_count<>0 then raise exception 'Notice leaked outside payer/beneficiary graph'; end if;
  select count(*) into bad_count from public.sim_payment_allocations a
    join public.sim_payment_transactions t on t.id=a.transaction_id
    where t.public_ref ~ '^DEMO-TX-00[1-9]$'
      and a.beneficiary_id not in (select id from public.sim_payment_users);
  if bad_count<>0 then raise exception 'Unknown beneficiary in seed'; end if;
  raise notice 'PASS: exact 9 transactions / 16 allocations / 5040000 paisa / 27 ordered events; beneficiary and notice boundaries';
end
$test$;
rollback;
