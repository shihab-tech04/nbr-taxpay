-- Additive story1 guest-session pagination. No payment modifications.
create or replace function public.demo_story1_list_page(
 p_session uuid,p_page integer default 1,p_per_page integer default 100
) returns jsonb language plpgsql stable security definer set search_path='' as $f$
declare v_total bigint;v_items jsonb;
begin
 if p_session is null or p_page is null or p_page<1 or p_page>10000 or
 p_per_page is null or p_per_page<1 or p_per_page>100
 then raise exception 'INVALID_PAGE';end if;
 select count(*) into v_total from demo_payment.story_payments where session_id=p_session;
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',x.id,'service',x.service_code,'amountMinor',x.amount_minor,
 'status',x.status,'createdAt',x.created_at) order by x.created_at desc,x.id desc),'[]'::jsonb)
 into v_items from (
 select id,service_code,amount_minor,status,created_at
 from demo_payment.story_payments where session_id=p_session
 order by created_at desc,id desc limit p_per_page offset (p_page-1)*p_per_page
 ) x;
 return jsonb_build_object('items',v_items,'total',v_total,'page',p_page,'perPage',p_per_page);
end;$f$;
revoke all on function public.demo_story1_list_page(uuid,integer,integer) from public;
grant execute on function public.demo_story1_list_page(uuid,integer,integer) to anon,authenticated;
