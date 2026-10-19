revoke execute on function public.sim_submit_payment(text,jsonb,uuid) from public, anon, authenticated;
revoke execute on function public.sim_payment_history(text,text) from public, anon;
revoke execute on function public.sim_payment_notices(text) from public, anon;
grant execute on function public.sim_payment_history(text,text) to authenticated;
grant execute on function public.sim_payment_notices(text) to authenticated;
