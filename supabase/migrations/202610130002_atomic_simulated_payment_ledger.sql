
-- Controlled fictional user1-user10 payment simulation. Publicly inspectable synthetic
-- workspace ONLY; no identity documents, ACS/gateway/Treasury/eLedger, or tax credit.
create table public.sim_payment_users (
  id text primary key check (id ~ '^user([1-9]|10)$')
);
insert into public.sim_payment_users(id)
select 'user'||n from pg_catalog.generate_series(1,10) as n on conflict do nothing;

create table public.sim_payment_transactions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  public_ref text not null unique,
  payer_id text not null references public.sim_payment_users(id),
  idempotency_key uuid not null unique,
  request_fingerprint text not null,
  total_minor bigint not null check (total_minor>0 and total_minor<=1000000000000),
  state text not null default 'SIMULATED' check (state in ('SIMULATED','PENDING','FAILED','REVERSED')),
  simulation_only boolean not null default true check (simulation_only),
  created_at timestamptz not null default now()
);
create index sim_payment_tx_payer_time on public.sim_payment_transactions(payer_id,created_at desc);
create table public.sim_payment_allocations (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  transaction_id uuid not null references public.sim_payment_transactions(id),
  line_no integer not null check(line_no between 1 and 20),
  beneficiary_id text not null references public.sim_payment_users(id),
  category text not null check (category in ('TAX_WITH_RETURN','ADVANCE_TAX','ASSESSED_DEMAND','PENALTY','SOURCE_TAX_DEPOSIT','APPELLATE_TRIBUNAL','OTHER_TAX_PAYMENT')),
  assessment_year text not null check(assessment_year ~ '^20[0-9]{2}-[0-9]{2}$'),
  amount_minor bigint not null check(amount_minor>0 and amount_minor<=1000000000000),
  unique(transaction_id,line_no)
);
create index sim_payment_alloc_user on public.sim_payment_allocations(beneficiary_id,transaction_id);
create table public.sim_payment_events(
  id bigint generated always as identity primary key,
  transaction_id uuid not null references public.sim_payment_transactions(id),
  seq int not null check(seq between 1 and 30),
  action text not null check(action in ('CREATED','REVIEWED','SIMULATION_RECORDED','PENDING','FAILED','REVERSED')),
  note text not null default '',
  occurred_at timestamptz not null default now(),
  unique(transaction_id,seq)
);
create table public.sim_payment_notifications(
  id bigint generated always as identity primary key,
  user_id text not null references public.sim_payment_users(id),
  transaction_id uuid not null references public.sim_payment_transactions(id),
  event_id bigint not null references public.sim_payment_events(id),
  message_code text not null default 'SIM_PAYMENT_ACTIVITY',
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id,event_id)
);
create index sim_payment_notice_user on public.sim_payment_notifications(user_id,created_at desc);

create or replace function public.sim_payment_history(p_user_id text default null,p_view text default 'beneficiary')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare out_json jsonb;
begin
  if p_user_id is not null and not exists(select 1 from public.sim_payment_users where id=p_user_id) then
    raise exception 'Unknown simulation user';
  end if;
  if p_view not in ('beneficiary','payer','all') then raise exception 'Unsupported view'; end if;
  if p_user_id is null and p_view<>'all' then raise exception 'User scope required'; end if;
  select coalesce(pg_catalog.jsonb_agg(trow.obj order by trow.created_at desc,trow.id desc),'[]'::jsonb)
    into out_json
  from (
    select t.id,t.created_at,
      pg_catalog.jsonb_build_object(
        'id',t.public_ref,'transactionId',t.id,'payer',t.payer_id,'state',t.state,
        'createdAt',t.created_at,'simulationOnly',true,'totalMinor',t.total_minor,
        'allocations',coalesce((
          select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'id',a.id,'lineNo',a.line_no,'beneficiary',a.beneficiary_id,
            'category',a.category,'assessmentYear',a.assessment_year,'amountMinor',a.amount_minor
          ) order by a.line_no)
          from public.sim_payment_allocations a where a.transaction_id=t.id
            and (p_user_id is null or p_view in ('all','payer') or a.beneficiary_id=p_user_id)
        ),'[]'::jsonb),
        'events',coalesce((
          select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'id',e.id,'action',e.action,'note',e.note,'occurredAt',e.occurred_at
          ) order by e.seq)
          from public.sim_payment_events e where e.transaction_id=t.id
        ),'[]'::jsonb)
      ) as obj
    from public.sim_payment_transactions t
    where p_user_id is null or
      (p_view='payer' and t.payer_id=p_user_id) or
      (p_view='beneficiary' and exists (
         select 1 from public.sim_payment_allocations a
         where a.transaction_id=t.id and a.beneficiary_id=p_user_id
      )) or (p_view='all' and t.payer_id=p_user_id)
    order by t.created_at desc,t.id desc limit 2000
  ) trow;
  return out_json;
end;$$;

create or replace function public.sim_payment_notices(p_user_id text)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',n.id,'userId',n.user_id,'transactionId',n.transaction_id,
    'messageCode',n.message_code,'createdAt',n.created_at,'isRead',n.is_read
 ) order by n.created_at desc,n.id desc),'[]'::jsonb)
 from public.sim_payment_notifications n
 where n.user_id=p_user_id;
$$;

create or replace function public.sim_submit_payment(
  p_payer_id text, p_lines jsonb, p_idempotency_key uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  v_count int; v_total bigint:=0; v_line jsonb; v_beneficiary text;
  v_category text; v_year text; v_minor_text text; v_amount bigint;
  v_hash text; v_existing public.sim_payment_transactions%rowtype;
  v_new public.sim_payment_transactions%rowtype; v_event bigint; v_i int:=0;
begin
  if p_payer_id is null or not exists(select 1 from public.sim_payment_users where id=p_payer_id) then
    raise exception 'Unknown synthetic payer';
  end if;
  if p_idempotency_key is null then raise exception 'Idempotency key required'; end if;
  if p_lines is null or pg_catalog.jsonb_typeof(p_lines)<>'array' then raise exception 'Allocation array required'; end if;
  v_count:=pg_catalog.jsonb_array_length(p_lines);
  if v_count<1 or v_count>20 then raise exception 'One to twenty allocation lines required'; end if;
  v_hash:=pg_catalog.md5(p_payer_id||':'||p_lines::text);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_idempotency_key::text,0));
  select * into v_existing from public.sim_payment_transactions where idempotency_key=p_idempotency_key;
  if found then
    if v_existing.request_fingerprint<>v_hash then raise exception 'Idempotency key reused with different payment'; end if;
    return pg_catalog.jsonb_build_object('transactionId',v_existing.id,'reference',v_existing.public_ref,'totalMinor',v_existing.total_minor,'replayed',true);
  end if;
  for v_line in select value from pg_catalog.jsonb_array_elements(p_lines) loop
    v_beneficiary:=v_line->>'beneficiary'; v_category:=v_line->>'category';
    v_year:=v_line->>'assessmentYear'; v_minor_text:=v_line->>'amountMinor';
    if not exists(select 1 from public.sim_payment_users where id=v_beneficiary) then
      raise exception 'Unknown beneficiary';
    end if;
    if v_category not in ('TAX_WITH_RETURN','ADVANCE_TAX','ASSESSED_DEMAND','PENALTY','SOURCE_TAX_DEPOSIT','APPELLATE_TRIBUNAL','OTHER_TAX_PAYMENT') then
      raise exception 'Invalid payment category';
    end if;
    if v_year is null or v_year !~ '^20[0-9]{2}-[0-9]{2}$' then raise exception 'Invalid assessment year'; end if;
    if v_minor_text is null or v_minor_text !~ '^[1-9][0-9]{0,11}$' then raise exception 'Positive integer paisa required'; end if;
    v_amount:=v_minor_text::bigint;
    if v_amount>1000000000000 then raise exception 'Allocation amount outside safe simulation limit'; end if;
    v_total:=v_total+v_amount;
    if v_total>1000000000000 then raise exception 'Total outside safe simulation limit'; end if;
  end loop;
  insert into public.sim_payment_transactions(public_ref,payer_id,idempotency_key,request_fingerprint,total_minor)
  values ('SIM-'||upper(substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text,'-',''),1,16)),p_payer_id,p_idempotency_key,v_hash,v_total)
  returning * into v_new;
  for v_line in select value from pg_catalog.jsonb_array_elements(p_lines) loop
    v_i:=v_i+1;
    insert into public.sim_payment_allocations(transaction_id,line_no,beneficiary_id,category,assessment_year,amount_minor)
    values(v_new.id,v_i,v_line->>'beneficiary',v_line->>'category',v_line->>'assessmentYear',(v_line->>'amountMinor')::bigint);
  end loop;
  insert into public.sim_payment_events(transaction_id,seq,action,note)
    values(v_new.id,1,'CREATED','Payment simulation requested');
  insert into public.sim_payment_events(transaction_id,seq,action,note)
    values(v_new.id,2,'REVIEWED','All beneficiary allocations validated');
  insert into public.sim_payment_events(transaction_id,seq,action,note)
    values(v_new.id,3,'SIMULATION_RECORDED','Simulated completion only; no money moved')
    returning id into v_event;
  insert into public.sim_payment_notifications(user_id,transaction_id,event_id,message_code)
    select recipients.user_id,v_new.id,v_event,'SIM_PAYMENT_ACTIVITY'
    from (select p_payer_id as user_id union select distinct a.beneficiary_id
          from public.sim_payment_allocations a where a.transaction_id=v_new.id) recipients
    on conflict(user_id,event_id) do nothing;
  return pg_catalog.jsonb_build_object('transactionId',v_new.id,'reference',v_new.public_ref,'totalMinor',v_total,'replayed',false);
end;$$;

alter table public.sim_payment_users enable row level security;
alter table public.sim_payment_transactions enable row level security;
alter table public.sim_payment_allocations enable row level security;
alter table public.sim_payment_events enable row level security;
alter table public.sim_payment_notifications enable row level security;
revoke all on public.sim_payment_users,public.sim_payment_transactions,public.sim_payment_allocations,public.sim_payment_events,public.sim_payment_notifications from public,anon,authenticated;
grant select on public.sim_payment_users to anon,authenticated;
create policy sim_public_users on public.sim_payment_users for select to anon,authenticated using(true);
revoke all on function public.sim_submit_payment(text,jsonb,uuid),public.sim_payment_history(text,text),public.sim_payment_notices(text) from public;
grant execute on function public.sim_submit_payment(text,jsonb,uuid),public.sim_payment_history(text,text),public.sim_payment_notices(text) to anon,authenticated;
comment on table public.sim_payment_transactions is 'Public synthetic simulation only. NEVER government payment, tax credit or taxpayer identity evidence.';
