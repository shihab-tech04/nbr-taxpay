-- v2: lock financial simulation API to authenticated taxpayer/authorized office role.
-- Preserve historical seeded 9 synthetic transaction records and audit events.
-- Existing private wrappers run as SECURITY DEFINER, subject to auth.uid checks.
revoke execute on function public.sim_submit_payment(text,jsonb,uuid) from public, anon, authenticated;
revoke execute on function public.sim_payment_history(text,text) from public, anon;
revoke execute on function public.sim_payment_notices(text) from public, anon;
grant execute on function public.sim_payment_history(text,text) to authenticated;
grant execute on function public.sim_payment_notices(text) to authenticated;
-- PostgREST authenticated account RPCs are separately secured by verified bound UID.
-- None of these changes alter settled money, taxpayer data, or frozen tax rules.
