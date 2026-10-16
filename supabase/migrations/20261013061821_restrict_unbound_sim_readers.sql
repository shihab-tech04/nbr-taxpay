-- Recover the hosted reader guard: an authenticated account must be bound to
-- its own fictional test profile, or hold a separately assigned officer role.
-- Anonymous visitors and authenticated unbound accounts cannot browse sample
-- histories or notification rows through SECURITY DEFINER RPCs.
create or replace function public.sim_payment_history(
  p_user_id text default null,
  p_view text default 'beneficiary'
)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  out_json jsonb;
  v_actor uuid := auth.uid();
  v_owner_profile text;
  v_is_officer boolean := false;
begin
  select exists(
    select 1 from public.taxpay_officer_roles
    where user_uid=v_actor and active
  ) into v_is_officer;
  select user_id into v_owner_profile
  from public.sim_payment_account_bindings
  where owner_uid=v_actor;

  if v_actor is null then
    raise exception 'Authenticated session required for simulation ledger';
  end if;
  if not v_is_officer and v_owner_profile is null then
    raise exception 'Verified bound taxpayer account or active officer role required';
  end if;
  if not v_is_officer then
    if p_user_id is null or p_user_id<>v_owner_profile or p_view='all' then
      raise exception 'Authenticated profile may read only its own payer/beneficiary history';
    end if;
    if p_user_id is not null and exists (
      select 1 from public.sim_payment_account_bindings where user_id=p_user_id
    ) and v_owner_profile is distinct from p_user_id then
      raise exception 'Protected simulation profile requires its bound account';
    end if;
  end if;
  if p_user_id is not null and not exists(
    select 1 from public.sim_payment_users where id=p_user_id
  ) then
    raise exception 'Unknown simulation user';
  end if;
  if p_view not in ('beneficiary','payer','all') then
    raise exception 'Unsupported view';
  end if;
  if p_user_id is null and p_view<>'all' then
    raise exception 'User scope required';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(trow.obj order by trow.created_at desc,trow.id desc),
    '[]'::jsonb
  ) into out_json
  from (
    select t.id,t.created_at,
      pg_catalog.jsonb_build_object(
        'id',t.public_ref,
        'transactionId',t.id,
        'payer',t.payer_id,
        'state',t.state,
        'createdAt',t.created_at,
        'simulationOnly',true,
        'totalMinor',t.total_minor,
        'reviewStatus',t.review_status,
        'allocations',coalesce((
          select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'id',a.id,
            'lineNo',a.line_no,
            'beneficiary',a.beneficiary_id,
            'category',a.category,
            'assessmentYear',a.assessment_year,
            'amountMinor',a.amount_minor
          ) order by a.line_no)
          from public.sim_payment_allocations a
          where a.transaction_id=t.id
            and (p_user_id is null or p_view in ('all','payer') or a.beneficiary_id=p_user_id)
        ),'[]'::jsonb),
        'events',coalesce((
          select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'id',e.id,
            'action',e.action,
            'note',e.note,
            'occurredAt',e.occurred_at
          ) order by e.seq)
          from public.sim_payment_events e
          where e.transaction_id=t.id
        ),'[]'::jsonb)
      ) as obj
    from public.sim_payment_transactions t
    where p_user_id is null
      or (p_view='payer' and t.payer_id=p_user_id)
      or (p_view='beneficiary' and exists (
        select 1 from public.sim_payment_allocations a
        where a.transaction_id=t.id and a.beneficiary_id=p_user_id
      ))
      or (p_view='all' and t.payer_id=p_user_id)
    order by t.created_at desc,t.id desc
    limit 2000
  ) trow;

  -- Extra defense in depth for any future unbound-reader path.
  if not v_is_officer and v_owner_profile is null then
    select coalesce(
      pg_catalog.jsonb_agg(x.item order by x.position),
      '[]'::jsonb
    ) into out_json
    from pg_catalog.jsonb_array_elements(out_json) with ordinality x(item,position)
    where not exists(
      select 1 from public.sim_payment_account_bindings b
      where b.user_id=x.item->>'payer'
        or exists(
          select 1 from public.sim_payment_allocations a
          where a.transaction_id=(x.item->>'transactionId')::uuid
            and a.beneficiary_id=b.user_id
        )
    );
  end if;
  return out_json;
end;
$$;

create or replace function public.sim_payment_notices(p_user_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  v_actor uuid := auth.uid();
  v_owner_profile text;
  v_is_officer boolean := false;
  v_result jsonb;
begin
  if p_user_id is null or not exists(
    select 1 from public.sim_payment_users where id=p_user_id
  ) then
    raise exception 'Valid simulation profile required';
  end if;
  select exists(
    select 1 from public.taxpay_officer_roles
    where user_uid=v_actor and active
  ) into v_is_officer;
  select user_id into v_owner_profile
  from public.sim_payment_account_bindings
  where owner_uid=v_actor;

  if v_actor is null then
    raise exception 'Authenticated session required for simulation ledger';
  end if;
  if not v_is_officer and v_owner_profile is null then
    raise exception 'Verified bound taxpayer account or active officer role required';
  end if;
  if not v_is_officer and exists(
    select 1 from public.sim_payment_account_bindings where user_id=p_user_id
  ) and v_owner_profile is distinct from p_user_id then
    raise exception 'Protected notices require their bound account';
  end if;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',n.id,
    'userId',n.user_id,
    'transactionId',n.transaction_id,
    'messageCode',n.message_code,
    'createdAt',n.created_at,
    'isRead',n.is_read
  ) order by n.created_at desc,n.id desc),'[]'::jsonb)
  into v_result
  from public.sim_payment_notifications n
  where n.user_id=p_user_id
    and (v_is_officer or v_owner_profile=p_user_id
      or not exists(
        select 1 from public.sim_payment_account_bindings b
        where b.user_id=n.user_id
      )
      and not exists(
        select 1
        from public.sim_payment_account_bindings b
        join public.sim_payment_transactions t on t.id=n.transaction_id
        where b.user_id=t.payer_id
          or exists(
            select 1 from public.sim_payment_allocations a
            where a.transaction_id=t.id and a.beneficiary_id=b.user_id
          )
      )
    );
  return v_result;
end;
$$;

revoke all on function public.sim_payment_history(text,text) from public,anon;
revoke all on function public.sim_payment_notices(text) from public,anon;
grant execute on function public.sim_payment_history(text,text) to authenticated;
grant execute on function public.sim_payment_notices(text) to authenticated;
