-- Hosted outbox dispatcher for the two private payment databases.
-- The shared signing key and dispatch token are provisioned separately,
-- never in migrations, the frontend, or repository configuration.
create extension if not exists pg_net;
create extension if not exists pg_cron with schema pg_catalog;

create table payment_sync.bridge_config (
  singleton boolean primary key default true check(singleton),
  self_url text not null,
  peer_url text not null,
  dispatch_token text not null,
  signing_key text not null,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint payment_v1_bridge_https check(
    self_url ~ '^https://[a-zA-Z0-9.-]+/functions/v1/payment-sync-bridge$' and
    peer_url ~ '^https://[a-zA-Z0-9.-]+/functions/v1/payment-sync-bridge$'
  ),
  constraint payment_v1_bridge_keys check(
    dispatch_token ~ '^[0-9a-f]{64}$' and signing_key ~ '^[0-9a-f]{64}$'
  )
);
alter table payment_sync.bridge_config enable row level security;
revoke all on payment_sync.bridge_config from public,anon,authenticated;

-- Readable only by the Edge Function using its own project's secret API key.
create function public.payment_v1_internal_bridge_config() returns jsonb
language sql stable security definer set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'origin',(select origin from payment_sync.settings where singleton),
    'selfUrl',b.self_url,'peerUrl',b.peer_url,'dispatchToken',b.dispatch_token,
    'signingKey',b.signing_key,'enabled',b.enabled
  ) from payment_sync.bridge_config b where b.singleton;
$$;
revoke all on function public.payment_v1_internal_bridge_config() from public,anon,authenticated;
grant execute on function public.payment_v1_internal_bridge_config() to service_role;

-- pg_net transmits only after the inserting transaction commits. Retries are
-- independently scheduled by pg_cron, so a lost HTTP wakeup is recoverable.
create function payment_sync.wake_bridge() returns bigint
language plpgsql volatile security definer set search_path = '' as $$
declare v_config payment_sync.bridge_config%rowtype;
declare v_job bigint;
begin
  select * into v_config from payment_sync.bridge_config where singleton and enabled;
  if not found or not exists(
    select 1 from payment_sync.outbox
    where delivery_state<>'ACKNOWLEDGED' and next_attempt_at<=now()
  ) then return null; end if;
  select net.http_post(
    url:=v_config.self_url,
    body:=pg_catalog.jsonb_build_object('mode','dispatch','token',v_config.dispatch_token),
    headers:='{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds:=15000
  ) into v_job;
  return v_job;
end;
$$;
revoke all on function payment_sync.wake_bridge() from public,anon,authenticated;

create function payment_sync.wake_on_outbox_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform payment_sync.wake_bridge();
  return new;
end;
$$;
revoke all on function payment_sync.wake_on_outbox_insert() from public,anon,authenticated;
create trigger payment_v1_wake_on_outbox_insert
  after insert on payment_sync.outbox
  for each statement execute function payment_sync.wake_on_outbox_insert();

-- Only this named job is managed; other jobs in either project are untouched.
select cron.schedule('payment-sync-v1-dispatch','* * * * *',
  'select payment_sync.wake_bridge()');
