-- Public session read correctly denies profile-owned payments. Office
-- verification uses a short-lived signed TaxPay Edge proof and this
-- service-role-only readback; it never accepts a client-supplied receipt.
create or replace function public.taxpay_office_story1_mirror_read(p_id uuid,p_session uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v demo_payment.story_payments%rowtype;
begin
  if p_id is null or p_session is null then raise exception 'NOT_FOUND'; end if;
  select * into v from demo_payment.story_payments
    where id=p_id and session_id=p_session and status='SIMULATED_SUCCESS';
  if not found then raise exception 'NOT_FOUND'; end if;
  return jsonb_build_object('id',v.id,'data',v.data,'status',v.status,'createdAt',v.created_at);
end; $$;
revoke all on function public.taxpay_office_story1_mirror_read(uuid,uuid) from PUBLIC, anon, authenticated;
grant execute on function public.taxpay_office_story1_mirror_read(uuid,uuid) to service_role;
comment on function public.taxpay_office_story1_mirror_read(uuid,uuid)
  is 'Private TaxPay Edge-only readback for verified synthetic Office mirroring, never a public taxpayer API';
