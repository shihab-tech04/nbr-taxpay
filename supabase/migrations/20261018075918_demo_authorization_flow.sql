-- Fictional user1-user10 consent workflow. This is NOT legal taxpayer delegation.
-- Demo identities are not Supabase Auth identities: never reuse these RPCs for real TINs.
create table if not exists public.demo_authorization_requests (
  id uuid primary key default gen_random_uuid(),
  payer_id text not null references public.sim_payment_users(id),
  taxpayer_id text not null references public.sim_payment_users(id),
  status text not null default 'PENDING'
    check(status in ('PENDING','CODE_ISSUED','ACTIVE','DENIED','REVOKED')),
  requested_at timestamptz not null default now(),
  code_value text check(code_value is null or code_value ~ '^[0-9]{4}$'),
  code_expires_at timestamptz not null default (now()+interval '15 minutes'),
  accepted_at timestamptz,
  confirmed_at timestamptz,
  revoked_at timestamptz,
  attempts smallint not null default 0 check(attempts between 0 and 3),
  check(payer_id<>taxpayer_id)
);
create index if not exists demo_auth_payer_time on public.demo_authorization_requests(payer_id,requested_at desc);
create index if not exists demo_auth_recipient_time on public.demo_authorization_requests(taxpayer_id,requested_at desc);
create index if not exists demo_auth_active_pair on public.demo_authorization_requests(payer_id,taxpayer_id)
  where status='ACTIVE';
alter table public.demo_authorization_requests enable row level security;
revoke all on public.demo_authorization_requests from public,anon,authenticated;

create or replace function public.demo_auth_list(p_actor text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if p_actor !~ '^user([1-9]|10)$' then raise exception 'UNKNOWN_DEMO_USER'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'id',r.id,'payerId',r.payer_id,'taxpayerId',r.taxpayer_id,
  'status',case when r.status in ('PENDING','CODE_ISSUED') and r.code_expires_at<=now() then 'EXPIRED' else r.status end,
  'requestedAt',floor(extract(epoch from r.requested_at)*1000)::bigint,
  'codeExpiresAt',floor(extract(epoch from r.code_expires_at)*1000)::bigint,
  'consentCode',case when r.taxpayer_id=p_actor and r.status='CODE_ISSUED'
    and r.code_expires_at>now() then r.code_value else null end,
  'confirmedAt',case when r.confirmed_at is null then null else floor(extract(epoch from r.confirmed_at)*1000)::bigint end,
  'activeUntil',null,'attempts',r.attempts,
  'revokedAt',case when r.revoked_at is null then null else floor(extract(epoch from r.revoked_at)*1000)::bigint end
 ) order by r.requested_at desc,r.id desc)
 from (select * from public.demo_authorization_requests
       where payer_id=p_actor or taxpayer_id=p_actor
       order by requested_at desc limit 100) r),'[]'::jsonb);
end;$$;

create or replace function public.demo_auth_transition(
 p_action text,p_actor text,p_request uuid default null,p_target_tin text default null,p_code text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.demo_authorization_requests%rowtype; v_target text; v_now timestamptz:=now(); v_code text;
begin
 if p_actor !~ '^user([1-9]|10)$' or not exists(select 1 from public.sim_payment_users where id=p_actor)
   then raise exception 'UNKNOWN_DEMO_USER';end if;
 if p_action='request' then
   if coalesce(p_target_tin,'') !~ '^[0-9]{13}$' then raise exception 'TIN_MUST_HAVE_13_DIGITS';end if;
   select u.id into v_target from public.sim_payment_users u
   where case when u.id='user10' then '1010101010101' else repeat(substring(u.id from 5),13) end=p_target_tin;
   if v_target is null then raise exception 'TIN_NOT_FOUND';end if;
   if v_target=p_actor then raise exception 'CANNOT_AUTHORIZE_SELF';end if;
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor||':'||v_target,0));
   if exists(select 1 from public.demo_authorization_requests a
     where a.payer_id=p_actor and a.taxpayer_id=v_target
       and (a.status='ACTIVE' or (a.status in ('PENDING','CODE_ISSUED') and a.code_expires_at>v_now)))
     then raise exception 'AUTHORIZATION_ALREADY_EXISTS';end if;
   insert into public.demo_authorization_requests(payer_id,taxpayer_id)
    values(p_actor,v_target) returning * into r;
 else
   if p_request is null then raise exception 'REQUEST_REQUIRED';end if;
   select * into r from public.demo_authorization_requests where id=p_request for update;
   if not found then raise exception 'REQUEST_NOT_FOUND';end if;
   if p_action='accept' then
     if r.taxpayer_id<>p_actor or r.status<>'PENDING' or r.code_expires_at<=v_now
       then raise exception 'REQUEST_NOT_PENDING_FOR_YOU';end if;
     v_code := (1000+floor(random()*9000)::int)::text;
     update public.demo_authorization_requests set status='CODE_ISSUED',code_value=v_code,
       code_expires_at=v_now+interval '15 minutes',accepted_at=v_now where id=r.id returning * into r;
   elsif p_action='confirm' then
     if r.payer_id<>p_actor or r.status<>'CODE_ISSUED' or r.code_expires_at<=v_now
       then raise exception 'CODE_NOT_READY_OR_EXPIRED';end if;
     if coalesce(p_code,'')=r.code_value then
       update public.demo_authorization_requests set status='ACTIVE',code_value=null,confirmed_at=v_now
         where id=r.id returning * into r;
     else
       update public.demo_authorization_requests set attempts=least(3,attempts+1),
         status=case when attempts>=2 then 'DENIED' else status end,
         code_value=case when attempts>=2 then null else code_value end
         where id=r.id returning * into r;
     end if;
   elsif p_action='decline' then
     if r.taxpayer_id<>p_actor or r.status not in ('PENDING','CODE_ISSUED')
       then raise exception 'CANNOT_DECLINE';end if;
     update public.demo_authorization_requests set status='DENIED',code_value=null
       where id=r.id returning * into r;
   elsif p_action='revoke' then
     if r.taxpayer_id<>p_actor or r.status<>'ACTIVE' then raise exception 'CANNOT_REVOKE';end if;
     update public.demo_authorization_requests set status='REVOKED',revoked_at=v_now
       where id=r.id returning * into r;
   else raise exception 'INVALID_ACTION';
   end if;
 end if;
 return jsonb_build_object('id',r.id,'status',r.status,'payerId',r.payer_id,
  'taxpayerId',r.taxpayer_id,'attempts',r.attempts,
  'consentCode',case when p_actor=r.taxpayer_id and r.status='CODE_ISSUED' then r.code_value else null end);
end;$$;

-- For preview payments only; not a substitute for an authenticated taxpayer mandate.
create or replace function public.demo_auth_can_pay(p_payer text,p_beneficiary text)
returns boolean language sql stable security definer set search_path='' as $$
 select p_payer=p_beneficiary or exists (
  select 1 from public.demo_authorization_requests
  where payer_id=p_payer and taxpayer_id=p_beneficiary and status='ACTIVE');
$$;
revoke all on function public.demo_auth_can_pay(text,text), public.demo_auth_list(text),
 public.demo_auth_transition(text,text,uuid,text,text) from public;
grant execute on function public.demo_auth_list(text),
 public.demo_auth_transition(text,text,uuid,text,text) to anon,authenticated;
comment on table public.demo_authorization_requests is
 'Synthetic user1-user10 authorization only; public demo identity is not verified and must not be used for real taxpayer delegation.';

-- Guard the existing TaxPay -> Office Story1 payment route at its SQL write boundary.
-- Existing guest payments do not claim a demo payerId and retain their behavior.
create or replace function demo_payment.validate_demo_authorized_payment()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_payer text; v_lines jsonb; v_line jsonb; v_beneficiary text;
 v_auth uuid; v_amount bigint; v_sum bigint:=0;
begin
 v_payer:=new.data->'details'->>'payerId';
 if v_payer is null then return new;end if;
 if v_payer !~ '^user([1-9]|10)$' or
   not exists(select 1 from public.sim_payment_users where id=v_payer)
   then raise exception 'INVALID_DEMO_PAYER';end if;
 v_lines:=new.data->'details'->'lines';
 if jsonb_typeof(v_lines)<>'array' or jsonb_array_length(v_lines) not between 1 and 20
   then raise exception 'INVALID_BENEFICIARY_LINES';end if;
 for v_line in select value from jsonb_array_elements(v_lines) loop
   v_beneficiary:=v_line->>'beneficiary';
   if not exists(select 1 from public.sim_payment_users where id=v_beneficiary)
     then raise exception 'INVALID_BENEFICIARY';end if;
   if coalesce(v_line->>'amountMinor','') !~ '^[1-9][0-9]{0,11}$'
     then raise exception 'INVALID_ALLOCATION_AMOUNT';end if;
   v_amount:=(v_line->>'amountMinor')::bigint;v_sum:=v_sum+v_amount;
   if v_beneficiary<>v_payer then
     if coalesce(v_line->>'authorizationId','') !~
       '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
       then raise exception 'AUTHORIZATION_REQUIRED';end if;
     v_auth:=(v_line->>'authorizationId')::uuid;
     if not exists(select 1 from public.demo_authorization_requests a
       where a.id=v_auth and a.payer_id=v_payer and a.taxpayer_id=v_beneficiary
         and a.status='ACTIVE') then raise exception 'AUTHORIZATION_REQUIRED';end if;
   end if;
 end loop;
 if v_sum<>new.amount_minor then raise exception 'ALLOCATION_TOTAL_MISMATCH';end if;
 return new;
end;$$;
drop trigger if exists story1_demo_authorization_guard on demo_payment.story_payments;
create trigger story1_demo_authorization_guard
 before insert on demo_payment.story_payments for each row
 execute function demo_payment.validate_demo_authorized_payment();
revoke all on function demo_payment.validate_demo_authorized_payment() from public,anon,authenticated;

-- Account-scoped synthetic history uses the same TaxPay SQL payment IDs that Office mirrors.
create or replace function public.demo_story1_demo_history(p_actor text,p_view text default 'beneficiary')
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if p_actor !~ '^user([1-9]|10)$' or p_view not in ('payer','beneficiary')
   then raise exception 'INVALID_DEMO_HISTORY_SCOPE';end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
    'id','SIM-'||upper(substr(replace(p.id::text,'-',''),1,16)),
    'transactionId',p.id,'payer',p.data->'details'->>'payerId',
    'state','SIMULATED','reviewStatus','MIRRORED_TO_OFFICE',
    'createdAt',p.created_at,'totalMinor',p.amount_minor,'simulationOnly',true,
    'allocations',case when p_view='payer' then p.data->'details'->'lines'
       else (select coalesce(jsonb_agg(line.value),'[]'::jsonb)
          from jsonb_array_elements(p.data->'details'->'lines') line
          where line.value->>'beneficiary'=p_actor) end,
    'events',jsonb_build_array(jsonb_build_object('id',p.id,'action','SIMULATION_RECORDED',
      'note','TaxPay SQL receipt mirrored to Office SQL','occurredAt',p.created_at))
   ) order by p.created_at desc,p.id desc)
 from (select * from demo_payment.story_payments
    where data->'details'->>'payerId' ~ '^user([1-9]|10)$'
      and ( (p_view='payer' and data->'details'->>'payerId'=p_actor)
        or (p_view='beneficiary' and exists(select 1 from jsonb_array_elements(data->'details'->'lines') x
           where x.value->>'beneficiary'=p_actor)))
    order by created_at desc limit 200) p),'[]'::jsonb);
end;$$;
revoke all on function public.demo_story1_demo_history(text,text) from public;
grant execute on function public.demo_story1_demo_history(text,text) to anon,authenticated;

-- Code-free snapshot for the Office mirror. Never transmit the recipient's 4-digit code.
create or replace function public.demo_auth_public_snapshot(p_request uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r public.demo_authorization_requests%rowtype;
begin
 select * into r from public.demo_authorization_requests where id=p_request;
 if not found then raise exception 'REQUEST_NOT_FOUND';end if;
 return jsonb_build_object('id',r.id,'payerId',r.payer_id,'taxpayerId',r.taxpayer_id,
  'status',case when r.status in ('PENDING','CODE_ISSUED') and r.code_expires_at<=now()
    then 'EXPIRED' else r.status end,
  'requestedAt',r.requested_at,'confirmedAt',r.confirmed_at,'revokedAt',r.revoked_at);
end;$$;
revoke all on function public.demo_auth_public_snapshot(uuid) from public;
grant execute on function public.demo_auth_public_snapshot(uuid) to anon,authenticated;
