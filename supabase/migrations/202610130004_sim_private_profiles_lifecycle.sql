-- SIMULATION-ONLY enhancement: private account bindings, notice state and audited status
-- transitions. Depends on review-only overlay 202610130003. Preserve all original rows.
-- No gateway, challan, Treasury, statutory liability, credit, or real taxpayer identities.
create table public.sim_payment_account_bindings(
  user_id text primary key references public.sim_payment_users(id),
  owner_uid uuid not null unique references auth.users(id),
  assigned_by uuid not null references auth.users(id),
  assigned_at timestamptz not null default now()
);
alter table public.sim_payment_account_bindings enable row level security;
revoke all on public.sim_payment_account_bindings from public, anon, authenticated;
grant select on public.sim_payment_account_bindings to authenticated;
create policy sim_binding_self_or_officer_select on public.sim_payment_account_bindings
 for select to authenticated using (
  owner_uid=(select auth.uid()) or (select public.taxpay_is_officer())
 );

create or replace function public.sim_bind_taxpayer_account(p_user_id text,p_owner_uid uuid)
returns text language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=auth.uid(); email_confirmed timestamptz; v_role text;
begin
 if actor is null then raise exception 'Officer authentication required'; end if;
 select role into v_role from public.taxpay_officer_roles
 where user_uid=actor and active for share;
 if v_role is distinct from 'APPROVER' then raise exception 'Authorized Approver required'; end if;
 if p_user_id is null or not exists(select 1 from public.sim_payment_users where id=p_user_id)
   then raise exception 'Unknown synthetic profile'; end if;
 select email_confirmed_at into email_confirmed from auth.users
  where id=p_owner_uid;
 if email_confirmed is null then raise exception 'Confirmed account required'; end if;
 if exists(select 1 from public.sim_payment_account_bindings where user_id=p_user_id)
   then raise exception 'Profile already assigned; reassignments require separate reviewed process'; end if;
 if exists(select 1 from public.sim_payment_account_bindings where owner_uid=p_owner_uid)
   then raise exception 'Account already assigned'; end if;
 insert into public.sim_payment_account_bindings(user_id,owner_uid,assigned_by)
 values(p_user_id,p_owner_uid,actor);
 return p_user_id;
end;$$;
revoke all on function public.sim_bind_taxpayer_account(text,uuid) from public,anon;
grant execute on function public.sim_bind_taxpayer_account(text,uuid) to authenticated;

create or replace function public.sim_my_taxpayer_profile()
returns text language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); profile text;
begin
 if actor is null then raise exception 'Authentication required'; end if;
 select user_id into profile from public.sim_payment_account_bindings where owner_uid=actor;
 if profile is null then raise exception 'No approved synthetic profile binding'; end if;
 return profile;
end;$$;
revoke all on function public.sim_my_taxpayer_profile() from public,anon;
grant execute on function public.sim_my_taxpayer_profile() to authenticated;

create or replace function public.sim_my_payment_history(p_view text default 'beneficiary')
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if p_view not in ('beneficiary','payer') then raise exception 'Unsupported account view'; end if;
 return public.sim_payment_history(public.sim_my_taxpayer_profile(),p_view);
end;$$;
revoke all on function public.sim_my_payment_history(text) from public,anon;
grant execute on function public.sim_my_payment_history(text) to authenticated;

create or replace function public.sim_my_payment_notices()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 return public.sim_payment_notices(public.sim_my_taxpayer_profile());
end;$$;
revoke all on function public.sim_my_payment_notices() from public,anon;
grant execute on function public.sim_my_payment_notices() to authenticated;

create or replace function public.sim_submit_my_payment(p_lines jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
 return public.sim_submit_payment(public.sim_my_taxpayer_profile(),p_lines,p_idempotency_key);
end;$$;
revoke all on function public.sim_submit_my_payment(jsonb,uuid) from public,anon;
grant execute on function public.sim_submit_my_payment(jsonb,uuid) to authenticated;

create or replace function public.sim_set_my_notice_read(p_notice_id bigint,p_is_read boolean)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare user_profile text; event_row public.sim_payment_notifications%rowtype;
begin
 user_profile:=public.sim_my_taxpayer_profile();
 if p_notice_id is null or p_is_read is null then raise exception 'Notification ID and read state required'; end if;
 update public.sim_payment_notifications n
 set is_read=p_is_read
 where n.id=p_notice_id and n.user_id=user_profile
 returning n.* into event_row;
 if not found then raise exception 'Notification does not belong to authenticated profile'; end if;
 return pg_catalog.jsonb_build_object('id',event_row.id,'isRead',event_row.is_read,'userId',event_row.user_id);
end;$$;
revoke all on function public.sim_set_my_notice_read(bigint,boolean) from public,anon;
grant execute on function public.sim_set_my_notice_read(bigint,boolean) to authenticated;

create table public.sim_payment_state_decisions(
 id bigint generated always as identity primary key,
 transaction_id uuid not null references public.sim_payment_transactions(id),
 officer_uid uuid not null references auth.users(id),
 action text not null check(action in ('COMPLETE_SIMULATION','FAIL_SIMULATION','REVERSE_SIMULATION')),
 reason text not null check(pg_catalog.char_length(pg_catalog.btrim(reason)) between 10 and 1000),
 idempotency_key uuid not null,
 prior_state text not null,
 next_state text not null,
 event_id bigint not null references public.sim_payment_events(id),
 created_at timestamptz not null default now(),
 unique(transaction_id,idempotency_key)
);
alter table public.sim_payment_state_decisions enable row level security;
revoke all on public.sim_payment_state_decisions from public,anon,authenticated;
grant select on public.sim_payment_state_decisions to authenticated;
create policy sim_state_decisions_officers on public.sim_payment_state_decisions
 for select to authenticated using ((select public.taxpay_is_officer()));

create or replace function public.sim_payment_status_action(
 p_transaction_id uuid,p_action text,p_reason text,p_idempotency_key uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=auth.uid(); v_role text; t public.sim_payment_transactions%rowtype;
 old_decision public.sim_payment_state_decisions%rowtype;
 action_state text; action_event text; event_sequence int; new_event_id bigint;
begin
 if actor is null then raise exception 'Authenticated officer required'; end if;
 select role into v_role from public.taxpay_officer_roles
  where user_uid=actor and active for share;
 if v_role is distinct from 'APPROVER' then raise exception 'Only an assigned Approver may change simulation state'; end if;
 if p_transaction_id is null or p_idempotency_key is null or
 pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason,''))) not between 10 and 1000
 then raise exception 'Invalid transaction, idempotency key or reason'; end if;
 if p_action not in ('COMPLETE_SIMULATION','FAIL_SIMULATION','REVERSE_SIMULATION')
 then raise exception 'Unrecognized simulated lifecycle action'; end if;
 select * into t from public.sim_payment_transactions
 where id=p_transaction_id and simulation_only for update;
 if not found then raise exception 'Synthetic payment not found'; end if;
 select * into old_decision from public.sim_payment_state_decisions
 where transaction_id=p_transaction_id and idempotency_key=p_idempotency_key;
 if found then
   if old_decision.officer_uid=actor and old_decision.action=p_action and
      old_decision.reason=p_reason then
      return pg_catalog.jsonb_build_object('state',old_decision.next_state,'replayed',true,'eventId',old_decision.event_id);
   end if;
   raise exception 'Idempotency collision; different lifecycle payload';
 end if;
 if t.review_status<>'APPROVER_CLOSED' then
  raise exception 'Complete three-distinct-officer review before changing simulation state'; end if;
 if t.state='PENDING' and p_action='COMPLETE_SIMULATION' then
   action_state:='SIMULATED';action_event:='SIMULATION_RECORDED';
 elsif t.state='PENDING' and p_action='FAIL_SIMULATION' then
   action_state:='FAILED';action_event:='FAILED';
 elsif t.state='SIMULATED' and p_action='REVERSE_SIMULATION' then
   action_state:='REVERSED';action_event:='REVERSED';
 else
   raise exception 'Invalid transition from % using %',t.state,p_action;
 end if;
 select coalesce(pg_catalog.max(seq),0)+1 into event_sequence
 from public.sim_payment_events where transaction_id=p_transaction_id;
 if event_sequence>30 then raise exception 'Event limit reached; no partial state change'; end if;
 update public.sim_payment_transactions set state=action_state where id=p_transaction_id;
 insert into public.sim_payment_events(transaction_id,seq,action,note)
 values(p_transaction_id,event_sequence,action_event,'Officer-authorized fictional state change; no payment/credit: '||pg_catalog.btrim(p_reason))
 returning id into new_event_id;
 insert into public.sim_payment_state_decisions
  (transaction_id,officer_uid,action,reason,idempotency_key,prior_state,next_state,event_id)
 values(p_transaction_id,actor,p_action,p_reason,p_idempotency_key,t.state,action_state,new_event_id);
 insert into public.sim_payment_notifications(user_id,transaction_id,event_id,message_code)
 select recipients.user_id,p_transaction_id,new_event_id,'SIM_STATE_'||action_state
 from (select t.payer_id user_id union
       select distinct a.beneficiary_id from public.sim_payment_allocations a
       where a.transaction_id=p_transaction_id) recipients
 on conflict(user_id,event_id) do nothing;
 return pg_catalog.jsonb_build_object('state',action_state,'replayed',false,'eventId',new_event_id);
end;$$;
revoke all on function public.sim_payment_status_action(uuid,text,text,uuid) from public,anon;
grant execute on function public.sim_payment_status_action(uuid,text,text,uuid) to authenticated;

-- The anonymous simulator remains public and fictional during this additive rollout.
-- It MUST NOT be mistaken for the authenticated profile API above.
comment on function public.sim_my_payment_history(text) is
  'Authenticated profile-scoped simulation history; no tax-credit entitlement.';
comment on function public.sim_payment_status_action(uuid,text,text,uuid) is
  'Restricted, audited, idempotent fictional status transition; no real financial settlement.';
