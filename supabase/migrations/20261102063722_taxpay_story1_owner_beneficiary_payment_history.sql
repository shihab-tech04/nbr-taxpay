-- Account-owned read index for already-recorded multi-beneficiary payments.
-- No historical payment rows, amounts, or mirror events are modified.
create table if not exists public.taxpay_story1_payment_owners (
 payment_id uuid primary key references demo_payment.story_payments(id) on delete cascade,
 owner_uid uuid not null references auth.users(id) on delete cascade,
 claimed_at timestamptz not null default now()
);
create index if not exists taxpay_story1_payment_owners_owner_idx
 on public.taxpay_story1_payment_owners(owner_uid,claimed_at desc);
alter table public.taxpay_story1_payment_owners enable row level security;
revoke all on public.taxpay_story1_payment_owners from public,anon,authenticated;

-- Session UUID is the existing bearer capability, never a taxpayer TIN
-- or a browser-supplied owner UID. Each payment may be claimed only once.
create or replace function public.taxpay_claim_story1_session(p_session_id uuid)
returns integer language plpgsql volatile security definer
set search_path = '' as $fn$
declare v_uid uuid; v_count integer;
begin
 v_uid := auth.uid();
 if v_uid is null or p_session_id is null then
   raise exception 'AUTHENTICATED_SESSION_REQUIRED';
 end if;
 insert into public.taxpay_story1_payment_owners(payment_id,owner_uid)
 select p.id,v_uid from demo_payment.story_payments p
 where p.session_id=p_session_id and p.status='SIMULATED_SUCCESS'
 on conflict (payment_id) do nothing;
 get diagnostics v_count = row_count;
 return v_count;
end $fn$;

-- Only the JWT-confirmed owner may read the linked payment details.
create or replace function public.taxpay_my_story1_payments(
 p_page integer default 1, p_per_page integer default 100
) returns jsonb language plpgsql stable security definer
set search_path = '' as $fn$
declare v_uid uuid; v_total bigint; v_items jsonb;
begin
 v_uid := auth.uid();
 if v_uid is null then raise exception 'SIGN_IN_REQUIRED'; end if;
 if p_page is null or p_per_page is null or p_page < 1 or p_page > 2000 or
    p_per_page < 1 or p_per_page > 100 then raise exception 'INVALID_PAGE'; end if;
 select count(*) into v_total from public.taxpay_story1_payment_owners o
 where o.owner_uid=v_uid;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',q.id,'service',q.service_code,'amountMinor',q.amount_minor,
   'status',q.status,'createdAt',q.created_at,
   'details',coalesce(q.data->'details','{}'::jsonb))
   order by q.created_at desc,q.id desc),'[]'::jsonb)
 into v_items from (
   select p.id,p.service_code,p.amount_minor,p.status,p.created_at,p.data
   from demo_payment.story_payments p
   join public.taxpay_story1_payment_owners o on o.payment_id=p.id
   where o.owner_uid=v_uid
   order by p.created_at desc,p.id desc
   limit p_per_page offset (p_page-1)*p_per_page
 ) q;
 return jsonb_build_object('items',v_items,'total',v_total,'page',p_page,'perPage',p_per_page);
end $fn$;
revoke all on function public.taxpay_claim_story1_session(uuid) from public,anon;
revoke all on function public.taxpay_my_story1_payments(integer,integer) from public,anon;
grant execute on function public.taxpay_claim_story1_session(uuid) to authenticated;
grant execute on function public.taxpay_my_story1_payments(integer,integer) to authenticated;
comment on table public.taxpay_story1_payment_owners is
 'Opaque authenticated payer-to-existing-payment ownership index; not an official receipt, beneficiary identity or tax credit.';
