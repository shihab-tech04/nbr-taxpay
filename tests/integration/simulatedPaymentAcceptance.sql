-- Disposable Supabase only. Verify the public boundary; authenticated private
-- payment behavior is exercised with real disposable Auth in simPrivateLifecycle.mjs.
\set ON_ERROR_STOP on
begin;
do $$
begin
  if has_table_privilege('anon','public.sim_payment_transactions','INSERT') then
    raise exception 'Anon may write financial simulation table outside RPC';
  end if;
  if has_function_privilege('anon','public.sim_submit_payment(text,jsonb,uuid)','EXECUTE') then
    raise exception 'Anonymous RPC may submit a synthetic payment';
  end if;
  if has_function_privilege('authenticated','public.sim_submit_payment(text,jsonb,uuid)','EXECUTE') then
    raise exception 'Authenticated clients may bypass the bound-profile payment RPC';
  end if;
  if has_function_privilege('anon','public.sim_payment_history(text,text)','EXECUTE')
    or has_function_privilege('anon','public.sim_payment_notices(text)','EXECUTE') then
    raise exception 'Anonymous client may read fictional account history or notices';
  end if;
  if not has_function_privilege('authenticated','public.sim_submit_my_payment(jsonb,uuid)','EXECUTE')
    or not has_function_privilege('authenticated','public.sim_my_payment_history(text)','EXECUTE')
    or not has_function_privilege('authenticated','public.sim_my_payment_notices()','EXECUTE') then
    raise exception 'Bound authenticated simulation APIs are not available';
  end if;
  raise notice 'PASS: anonymous and direct payer-ID RPCs disabled; authenticated owner-bound APIs retained';
end $$;
rollback;
