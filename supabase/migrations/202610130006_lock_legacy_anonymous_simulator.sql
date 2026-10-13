-- Align the source-controlled disposable test schema with the existing hosted
-- security lock (hosted migration: lock_legacy_anonymous_simulator_20261013).
-- The original public fictional RPCs are not a login or authorization system.
-- Read-only officer access remains role-constrained inside the SQL functions.
revoke all on function public.sim_payment_history(text,text) from public,anon;
revoke all on function public.sim_payment_notices(text) from public,anon;
grant execute on function public.sim_payment_history(text,text) to authenticated;
grant execute on function public.sim_payment_notices(text) to authenticated;
revoke all on function public.sim_submit_payment(text,jsonb,uuid) from public,anon,authenticated;
comment on function public.sim_submit_payment(text,jsonb,uuid) is
 'Legacy anonymous simulator disabled. Use authenticated bound-profile RPC sim_submit_my_payment. Never Treasury payment evidence.';
