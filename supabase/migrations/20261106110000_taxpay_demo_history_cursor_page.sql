-- Additive, read-only cursor paging for the already public fictional user1-user10
-- Story1 history. Keep the approved legacy RPC and all existing rows unchanged.
-- Never use this endpoint as actual taxpayer ownership or payment evidence.
begin;
create or replace function public.demo_story1_demo_history_page(
  p_actor text,
  p_view text default 'beneficiary',
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_page_size integer default 100
)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $function$
begin
  if p_actor is null or p_actor !~ '^user([1-9]|10)$'
    or p_view is null or p_view not in ('payer','beneficiary')
    or p_page_size is null or p_page_size not between 1 and 100
    or ((p_before_created_at is null) <> (p_before_id is null))
  then raise exception 'INVALID_DEMO_HISTORY_SCOPE'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id','SIM-'||upper(substr(replace(p.id::text,'-',''),1,16)),
      'transactionId',p.id,
      'payer',p.data->'details'->>'payerId',
      'state','SIMULATED',
      'reviewStatus','MIRRORED_TO_OFFICE',
      'createdAt',p.created_at,
      'totalMinor',p.amount_minor,
      'simulationOnly',true,
      'allocations',case when p_view='payer' then p.data->'details'->'lines'
        else (select coalesce(jsonb_agg(line.value),'[]'::jsonb)
          from jsonb_array_elements(p.data->'details'->'lines') line
          where line.value->>'beneficiary'=p_actor) end,
      'events',jsonb_build_array(jsonb_build_object(
        'id',p.id,'action','SIMULATION_RECORDED',
        'note','TaxPay SQL receipt mirrored to Office SQL',
        'occurredAt',p.created_at))
    ) order by p.created_at desc,p.id desc)
    from (
      select p.*
      from demo_payment.story_payments p
      where p.data->'details'->>'payerId' ~ '^user([1-9]|10)$'
        and (
          (p_view='payer' and p.data->'details'->>'payerId'=p_actor)
          or (p_view='beneficiary' and exists(
            select 1 from jsonb_array_elements(p.data->'details'->'lines') x
            where x.value->>'beneficiary'=p_actor))
        )
        and (p_before_created_at is null
          or (p.created_at,p.id)<(p_before_created_at,p_before_id))
      order by p.created_at desc,p.id desc
      limit p_page_size
    ) p
  ),'[]'::jsonb);
end;
$function$;

revoke all on function public.demo_story1_demo_history_page(text,text,timestamptz,uuid,integer)
  from public,anon,authenticated;
grant execute on function public.demo_story1_demo_history_page(text,text,timestamptz,uuid,integer)
  to anon,authenticated;
comment on function public.demo_story1_demo_history_page(text,text,timestamptz,uuid,integer) is
  'Read-only public synthetic preview history, cursor-paged; never an official payment or taxpayer identity.';
commit;
