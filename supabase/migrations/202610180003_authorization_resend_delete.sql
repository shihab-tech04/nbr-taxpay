-- Add resend/cancel/archive behavior to the fictional user1-user10 consent demo.
-- These actor names are not authenticated identities; this is not taxpayer delegation.
alter table public.demo_authorization_requests
  add column if not exists code_resends smallint not null default 0
    check (code_resends between 0 and 3),
  add column if not exists code_sent_at timestamptz,
  add column if not exists payer_deleted_at timestamptz,
  add column if not exists taxpayer_deleted_at timestamptz;

alter table public.demo_authorization_requests
  drop constraint if exists demo_authorization_requests_status_check;
alter table public.demo_authorization_requests
  add constraint demo_authorization_requests_status_check
    check(status in ('PENDING','CODE_ISSUED','ACTIVE','DENIED','REVOKED','CANCELLED'));

create or replace function public.demo_auth_list(p_actor text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if p_actor !~ '^user([1-9]|10)$' then raise exception 'UNKNOWN_DEMO_USER'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'id',r.id,'payerId',r.payer_id,'taxpayerId',r.taxpayer_id,
  'status',case when r.status in ('PENDING','CODE_ISSUED') and r.code_expires_at<=now() then 'EXPIRED' else r.status end,
  'requestedAt',floor(extract(epoch from r.requested_at)*1000)::bigint,
  'codeExpiresAt',floor(extract(epoch from r.code_expires_at)*1000)::bigint,
  'codeSentAt',case when r.code_sent_at is null then null else floor(extract(epoch from r.code_sent_at)*1000)::bigint end,
  'codeResends',r.code_resends,
  'consentCode',case when r.taxpayer_id=p_actor and r.status='CODE_ISSUED'
    and r.code_expires_at>now() then r.code_value else null end,
  'confirmedAt',case when r.confirmed_at is null then null else floor(extract(epoch from r.confirmed_at)*1000)::bigint end,
  'activeUntil',null,'attempts',r.attempts,
  'revokedAt',case when r.revoked_at is null then null else floor(extract(epoch from r.revoked_at)*1000)::bigint end
 ) order by r.requested_at desc,r.id desc)
 from (select * from public.demo_authorization_requests
       where (payer_id=p_actor and payer_deleted_at is null)
          or (taxpayer_id=p_actor and taxpayer_deleted_at is null)
       order by requested_at desc limit 100) r),'[]'::jsonb);
end;$$;

create or replace function public.demo_auth_transition(
 p_action text,p_actor text,p_request uuid default null,p_target_tin text default null,p_code text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.demo_authorization_requests%rowtype;
 v_target text; v_now timestamptz:=now(); v_code text; v_bytes bytea;
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
   if (p_actor=r.payer_id and r.payer_deleted_at is not null)
      or (p_actor=r.taxpayer_id and r.taxpayer_deleted_at is not null)
     then raise exception 'REQUEST_ALREADY_DELETED';end if;
   if p_action='accept' then
     if r.taxpayer_id<>p_actor or r.status<>'PENDING' or r.code_expires_at<=v_now
       then raise exception 'REQUEST_NOT_PENDING_FOR_YOU';end if;
     v_bytes:=extensions.gen_random_bytes(2);
     v_code:=lpad(((get_byte(v_bytes,0)*256+get_byte(v_bytes,1))%10000)::text,4,'0');
     update public.demo_authorization_requests set status='CODE_ISSUED',code_value=v_code,
       code_expires_at=v_now+interval '15 minutes',accepted_at=v_now,code_sent_at=v_now
       where id=r.id returning * into r;
   elsif p_action='resend' then
     if r.payer_id<>p_actor or r.status<>'CODE_ISSUED' or r.code_expires_at<=v_now
       then raise exception 'CODE_NOT_READY_OR_EXPIRED';end if;
     if r.code_resends>=3 then raise exception 'RESEND_LIMIT_REACHED';end if;
     if r.code_sent_at is not null and r.code_sent_at>v_now-interval '60 seconds'
       then raise exception 'RESEND_WAIT_60_SECONDS';end if;
     v_bytes:=extensions.gen_random_bytes(2);
     v_code:=lpad(((get_byte(v_bytes,0)*256+get_byte(v_bytes,1))%10000)::text,4,'0');
     -- Guarantee the previous code is invalid, even if the random draw repeats it.
     if v_code=r.code_value then
       v_code:=lpad(((v_code::int+1)%10000)::text,4,'0');
     end if;
     update public.demo_authorization_requests set code_value=v_code,
       code_expires_at=v_now+interval '15 minutes',code_sent_at=v_now,code_resends=code_resends+1
       where id=r.id returning * into r;
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
   elsif p_action='delete' then
     if p_actor not in (r.payer_id,r.taxpayer_id) then raise exception 'CANNOT_DELETE';end if;
     -- Deleting an active permission revokes it for BOTH parties first.
     -- Pending requests are cancelled. The row remains for historical audit.
     update public.demo_authorization_requests set
       status=case when status='ACTIVE' then 'REVOKED'
                   when status in ('PENDING','CODE_ISSUED') then 'CANCELLED' else status end,
       code_value=null,
       revoked_at=case when status='ACTIVE' then v_now else revoked_at end,
       payer_deleted_at=case when p_actor=payer_id then v_now else payer_deleted_at end,
       taxpayer_deleted_at=case when p_actor=taxpayer_id then v_now else taxpayer_deleted_at end
       where id=r.id returning * into r;
   else raise exception 'INVALID_ACTION';
   end if;
 end if;
 return jsonb_build_object('id',r.id,'status',r.status,'payerId',r.payer_id,
  'taxpayerId',r.taxpayer_id,'attempts',r.attempts,
  'codeResends',r.code_resends,
  'consentCode',case when p_actor=r.taxpayer_id and r.status='CODE_ISSUED' then r.code_value else null end);
end;$$;

-- Office sees resend activity, never the code itself or user-specific archive flags.
create or replace function public.demo_auth_public_snapshot(p_request uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r public.demo_authorization_requests%rowtype;
begin
 select * into r from public.demo_authorization_requests where id=p_request;
 if not found then raise exception 'REQUEST_NOT_FOUND';end if;
 return jsonb_build_object('id',r.id,'payerId',r.payer_id,'taxpayerId',r.taxpayer_id,
  'status',case when r.status in ('PENDING','CODE_ISSUED') and r.code_expires_at<=now()
    then 'EXPIRED' else r.status end,
  'requestedAt',r.requested_at,'confirmedAt',r.confirmed_at,'revokedAt',r.revoked_at,
  'codeResends',r.code_resends,'codeSentAt',r.code_sent_at);
end;$$;

revoke all on function public.demo_auth_list(text),
  public.demo_auth_transition(text,text,uuid,text,text),
  public.demo_auth_public_snapshot(uuid) from public;
grant execute on function public.demo_auth_list(text),
  public.demo_auth_transition(text,text,uuid,text,text),
  public.demo_auth_public_snapshot(uuid) to anon,authenticated;
