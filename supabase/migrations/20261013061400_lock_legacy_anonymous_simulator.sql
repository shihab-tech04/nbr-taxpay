-- Recover the hosted simulator access boundary. Taxpayer simulation writes are
-- available only through the account-bound RPC; there is no anonymous or direct
-- payer-ID submission path in a published build.
revoke all on function public.sim_submit_payment(text,jsonb,uuid)
  from public, anon, authenticated;

-- History and notification reads remain authenticated APIs, with ownership and
-- officer-role checks enforced by the follow-up function guard migration.
revoke all on function public.sim_payment_history(text,text) from public, anon;
revoke all on function public.sim_payment_notices(text) from public, anon;
grant execute on function public.sim_payment_history(text,text) to authenticated;
grant execute on function public.sim_payment_notices(text) to authenticated;
