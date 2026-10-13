-- Read-only public fictional sample access. Bound taxpayer profiles remain private
-- under the verified predicate in 202610130005_sim_bound_account_isolation.sql.
-- Anonymous writes and every financial/government mutation remain forbidden.
grant execute on function public.sim_payment_history(text,text) to anon;
grant execute on function public.sim_payment_notices(text) to anon;
revoke all on function public.sim_submit_payment(text,jsonb,uuid) from public,anon,authenticated;
comment on function public.sim_payment_history(text,text) is
 'Read-only fictional sample history; every transaction touching a bound profile is withheld from unbound callers. Not tax-payment evidence.';
comment on function public.sim_payment_notices(text) is
 'Read-only fictional notices with bound payer/beneficiary exclusion. No official credit or receipt.';
