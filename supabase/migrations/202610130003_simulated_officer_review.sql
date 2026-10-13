-- Review-only, synthetic ledger overlay. All financial fields remain demo-only.
-- Requires 202610130002_atomic_simulated_payment_ledger.sql and existing
-- taxpay_officer_roles (verified authenticated officers). No public mutation RPC.
alter table public.sim_payment_transactions
  add column review_status text not null default 'PENDING_OFFICER'
  constraint sim_payment_review_status_allowed
  check (review_status in ('PENDING_OFFICER','MAKER_ACKNOWLEDGED','REVIEWER_VERIFIED','APPROVER_CLOSED'));
alter table public.sim_payment_events drop constraint if exists sim_payment_events_action_check;
alter table public.sim_payment_events add constraint sim_payment_events_action_check
  check (action in ('CREATED','REVIEWED','SIMULATION_RECORDED','PENDING','FAILED','REVERSED',
   'OFFICER_MAKER_ACKNOWLEDGED','OFFICER_REVIEWER_VERIFIED','OFFICER_APPROVER_CLOSED'));

create table public.sim_payment_officer_decisions(
  id uuid primary key default pg_catalog.gen_random_uuid(),
  transaction_id uuid not null references public.sim_payment_transactions(id),
  officer_uid uuid not null references auth.users(id),
  role text not null check (role in ('MAKER','REVIEWER','APPROVER')),
  action text not null check(action in ('MAKER_ACKNOWLEDGE','REVIEWER_VERIFY','APPROVER_CLOSE')),
  reason text not null check(pg_catalog.char_length(pg_catalog.btrim(reason)) between 10 and 1000),
  idempotency_key uuid not null,
  previous_status text not null,
  next_status text not null,
  decided_at timestamptz not null default now(),
  unique(transaction_id,idempotency_key)
);
create index sim_payment_decision_tx_time on public.sim_payment_officer_decisions(transaction_id,decided_at desc);
alter table public.sim_payment_officer_decisions enable row level security;
revoke all on public.sim_payment_officer_decisions from public,anon,authenticated;
grant select on public.sim_payment_officer_decisions to authenticated;
create policy sim_payment_decisions_officers_read on public.sim_payment_officer_decisions
  for select to authenticated using((select public.taxpay_is_officer()));

create or replace function public.sim_payment_officer_action(
 p_transaction_id uuid,p_action text,p_reason text,p_idempotency_key uuid
) returns text language plpgsql volatile security definer set search_path='' as $$
declare
 v_actor uuid := auth.uid();
 v_role text;
 v_tx public.sim_payment_transactions%rowtype;
 v_old public.sim_payment_officer_decisions%rowtype;
 v_next text;
 v_event bigint;
 v_seq int;
 v_event_type text;
begin
 if v_actor is null then raise exception 'Authenticated officer session required'; end if;
 select role into v_role from public.taxpay_officer_roles
 where user_uid=v_actor and active for share;
 if v_role is null then raise exception 'Authorized officer role required'; end if;
 if p_transaction_id is null or p_idempotency_key is null
   or pg_catalog.char_length(pg_catalog.btrim(pg_catalog.coalesce(p_reason,''))) not between 10 and 1000
 then raise exception 'Invalid transaction, key, or reason'; end if;
 if not ((p_action='MAKER_ACKNOWLEDGE' and v_role='MAKER')
       or (p_action='REVIEWER_VERIFY' and v_role='REVIEWER')
       or (p_action='APPROVER_CLOSE' and v_role='APPROVER'))
 then raise exception 'Action requires a different assigned officer role'; end if;
 select * into v_tx from public.sim_payment_transactions
 where id=p_transaction_id and simulation_only for update;
 if not found then raise exception 'Synthetic transaction not found'; end if;
 select * into v_old from public.sim_payment_officer_decisions
 where transaction_id=p_transaction_id and idempotency_key=p_idempotency_key;
 if found then
   if v_old.officer_uid=v_actor and v_old.action=p_action and v_old.reason=p_reason
   then return v_old.next_status; end if;
   raise exception 'Idempotency key collision'; 
 end if;
 if exists(select 1 from public.sim_payment_officer_decisions d
           where d.transaction_id=p_transaction_id and d.officer_uid=v_actor)
 then raise exception 'Separation of duties: a different officer must act'; end if;
 if p_action='MAKER_ACKNOWLEDGE' and v_tx.review_status='PENDING_OFFICER' then
   v_next:='MAKER_ACKNOWLEDGED';v_event_type:='OFFICER_MAKER_ACKNOWLEDGED';
 elsif p_action='REVIEWER_VERIFY' and v_tx.review_status='MAKER_ACKNOWLEDGED' then
   v_next:='REVIEWER_VERIFIED';v_event_type:='OFFICER_REVIEWER_VERIFIED';
 elsif p_action='APPROVER_CLOSE' and v_tx.review_status='REVIEWER_VERIFIED' then
   v_next:='APPROVER_CLOSED';v_event_type:='OFFICER_APPROVER_CLOSED';
 else raise exception 'Review action out of sequence or already closed'; end if;
 update public.sim_payment_transactions set review_status=v_next where id=v_tx.id;
 insert into public.sim_payment_officer_decisions
  (transaction_id,officer_uid,role,action,reason,idempotency_key,previous_status,next_status)
 values(p_transaction_id,v_actor,v_role,p_action,p_reason,p_idempotency_key,v_tx.review_status,v_next);
 select pg_catalog.coalesce(pg_catalog.max(seq),0)+1 into v_seq
 from public.sim_payment_events where transaction_id=p_transaction_id;
 insert into public.sim_payment_events(transaction_id,seq,action,note)
 values(p_transaction_id,v_seq,v_event_type,'Synthetic review action recorded; no financial status or tax credit changed')
 returning id into v_event;
 insert into public.sim_payment_notifications(user_id,transaction_id,event_id,message_code)
 select recipients.user_id,p_transaction_id,v_event,'SIM_'||v_event_type
 from (select v_tx.payer_id as user_id
       union select distinct a.beneficiary_id from public.sim_payment_allocations a
       where a.transaction_id=p_transaction_id) recipients
 on conflict(user_id,event_id) do nothing;
 return v_next;
end;$$;

revoke all on function public.sim_payment_officer_action(uuid,text,text,uuid) from public,anon;
grant execute on function public.sim_payment_officer_action(uuid,text,text,uuid) to authenticated;
comment on function public.sim_payment_officer_action(uuid,text,text,uuid)
is 'Strict three-distinct-officer simulated review. No money, gateway, Treasury, credit, challan, or refund posting.';
-- Include current review status in the shared public fictional history snapshot.
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
        'reviewStatus',t.review_status,
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

