-- Durable, idempotent retry queue for synthetic TaxPay -> Office Story1 mirrors.
-- This schema never posts money, tax credit, a challan, or Treasury entries.
create table if not exists demo_payment.mirror_outbox (
  entity_type text not null check (entity_type in ('PAYMENT','AUTHORIZATION')),
  entity_id uuid not null,
  status text not null default 'PENDING' check (status in ('PENDING','CLAIMED','ACKED')),
  attempts integer not null default 0 check (attempts between 0 and 100000),
  next_attempt_at timestamptz not null default now(),
  claim_token uuid,
  locked_until timestamptz,
  acknowledged_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (entity_type,entity_id)
);
create index if not exists story1_mirror_outbox_retry
  on demo_payment.mirror_outbox(status,next_attempt_at,created_at)
  where status <> 'ACKED';
alter table demo_payment.mirror_outbox enable row level security;
revoke all on demo_payment.mirror_outbox from public,anon,authenticated;

create or replace function demo_payment.enqueue_story1_mirror()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_type text;
begin
  v_type := case when TG_TABLE_SCHEMA='demo_payment' then 'PAYMENT' else 'AUTHORIZATION' end;
  insert into demo_payment.mirror_outbox(entity_type,entity_id)
    values(v_type,new.id)
  on conflict(entity_type,entity_id) do update
    set status='PENDING',next_attempt_at=now(),claim_token=null,
        locked_until=null,acknowledged_at=null,last_error=null,updated_at=now();
  return new;
end;$$;
revoke all on function demo_payment.enqueue_story1_mirror() from public,anon,authenticated;

drop trigger if exists story1_payment_enqueue_mirror on demo_payment.story_payments;
create trigger story1_payment_enqueue_mirror after insert on demo_payment.story_payments
  for each row execute function demo_payment.enqueue_story1_mirror();
drop trigger if exists story1_authorization_enqueue_mirror on public.demo_authorization_requests;
create trigger story1_authorization_enqueue_mirror
  after insert or update on public.demo_authorization_requests
  for each row execute function demo_payment.enqueue_story1_mirror();

-- Conservative one-time bootstrap: even old records must be read back in Office.
insert into demo_payment.mirror_outbox(entity_type,entity_id)
  select 'PAYMENT',id from demo_payment.story_payments on conflict do nothing;
insert into demo_payment.mirror_outbox(entity_type,entity_id)
  select 'AUTHORIZATION',id from public.demo_authorization_requests on conflict do nothing;

create or replace function public.demo_story1_mirror_claim(p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_limit is null or p_limit not between 1 and 50 then raise exception 'INVALID_BATCH_SIZE';end if;
  with claimable as (
    select entity_type,entity_id from demo_payment.mirror_outbox
    where (status='PENDING' and next_attempt_at<=now())
       or (status='CLAIMED' and locked_until<now())
    order by next_attempt_at,created_at,entity_id
    limit p_limit for update skip locked
  ), claimed as (
    update demo_payment.mirror_outbox q
      set status='CLAIMED',claim_token=gen_random_uuid(),
          locked_until=now()+interval '90 seconds',updated_at=now()
    from claimable c where q.entity_type=c.entity_type and q.entity_id=c.entity_id
    returning q.entity_type,q.entity_id,q.claim_token
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'type',c.entity_type,'id',c.entity_id,'claimToken',c.claim_token,
    'sessionId',case when c.entity_type='PAYMENT' then
      (select p.session_id from demo_payment.story_payments p where p.id=c.entity_id)
      else null end
  )),'[]'::jsonb) into v_result from claimed c;
  return v_result;
end;$$;

create or replace function public.demo_story1_mirror_finish(
 p_type text,p_id uuid,p_claim_token uuid,p_success boolean,p_error text default null
) returns boolean language plpgsql security definer set search_path = '' as $$
declare v_updated integer;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_type not in ('PAYMENT','AUTHORIZATION') or p_id is null or p_claim_token is null
    or p_success is null then raise exception 'INVALID_MIRROR_ACK';end if;
  update demo_payment.mirror_outbox
  set status=case when p_success then 'ACKED' else 'PENDING' end,
      attempts=case when p_success then attempts else least(attempts+1,100000) end,
      next_attempt_at=case when p_success then now()
        else now()+make_interval(secs=>power(2,least(attempts+1,7))::integer) end,
      acknowledged_at=case when p_success then now() else null end,
      last_error=case when p_success then null else left(coalesce(p_error,'DELIVERY_FAILED'),250) end,
      claim_token=null,locked_until=null,updated_at=now()
  where entity_type=p_type and entity_id=p_id and status='CLAIMED'
    and claim_token=p_claim_token;
  get diagnostics v_updated = row_count;
  return v_updated=1;
end;$$;
revoke all on function public.demo_story1_mirror_claim(integer),
  public.demo_story1_mirror_finish(text,uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.demo_story1_mirror_claim(integer),
  public.demo_story1_mirror_finish(text,uuid,uuid,boolean,text) to service_role;
comment on table demo_payment.mirror_outbox is
  'Synthetic mirror delivery ledger; retries and ACKs cannot change payment success or statutory tax credit.';
