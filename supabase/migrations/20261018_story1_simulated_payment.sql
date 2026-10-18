-- User story 1: synthetic payment only, no gateway or official tax credit.
-- SQL mirrors the deployed 2026-10-18 Supabase definitions.
create schema if not exists demo_payment;
create table if not exists demo_payment.story_payments (id uuid primary key default gen_random_uuid(),idempotency_key uuid not null unique,
 session_id uuid not null,service_code text not null,amount_minor bigint not null,
 data jsonb not null,status text not null default 'SIMULATED_SUCCESS',
 created_at timestamptz not null default now(),
 check (amount_minor>0),check (jsonb_typeof(data)='object'),check (status='SIMULATED_SUCCESS'));
create table if not exists demo_payment.story_notifications (
 id bigint generated always as identity primary key,
 payment_id uuid not null references demo_payment.story_payments(id),
 session_id uuid not null,event_type text not null,created_at timestamptz not null default now(),
 unique(payment_id,event_type)
);
alter table demo_payment.story_payments enable row level security;
alter table demo_payment.story_notifications enable row level security;
revoke all on schema demo_payment from public,anon,authenticated;
revoke all on all tables in schema demo_payment from public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.demo_story1_get(p_id uuid, p_session uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v demo_payment.story_payments%rowtype;
begin
 select * into v from demo_payment.story_payments where id=p_id and session_id=p_session;
 if not found then raise exception 'NOT_FOUND';end if;
 return jsonb_build_object('id',v.id,'data',v.data,'status',v.status,'createdAt',v.created_at);
end;$function$


CREATE OR REPLACE FUNCTION public.demo_story1_list(p_session uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 return coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'service',x.service_code,
  'amountMinor',x.amount_minor,'status',x.status,'createdAt',x.created_at) order by x.created_at desc)
  from (select * from demo_payment.story_payments where session_id=p_session order by created_at desc limit 100) x),'[]'::jsonb);
end;$function$


CREATE OR REPLACE FUNCTION public.demo_story1_notices(p_session uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 return coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'paymentId',n.payment_id,
  'type',n.event_type,'createdAt',n.created_at) order by n.id desc)
  from (select * from demo_payment.story_notifications where session_id=p_session order by id desc limit 100) n),'[]'::jsonb);
end;$function$


CREATE OR REPLACE FUNCTION public.demo_story1_submit(p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid;v_key uuid;v_session uuid;v_old demo_payment.story_payments%rowtype;v_new demo_payment.story_payments%rowtype;
begin
 if p_input is null or jsonb_typeof(p_input)<>'object' then raise exception 'INVALID_INPUT';end if;
 if coalesce(p_input->>'idempotencyKey','') !~ '^[0-9a-fA-F-]{36}$' or
 coalesce(p_input->>'sessionId','') !~ '^[0-9a-fA-F-]{36}$' then raise exception 'INVALID_IDS';end if;
 if coalesce(p_input->>'service','') not in
 ('TAX_WITH_RETURN','ADVANCE_TAX','ASSESSED_DEMAND','PENALTY','SOURCE_TAX_DEPOSIT',
 'APPELLATE_TRIBUNAL','OTHER_TAX_PAYMENT','TRAVEL_TAX') then raise exception 'INVALID_SERVICE';end if;
 if coalesce(p_input->>'amountMinor','') !~ '^[1-9][0-9]{0,11}$' then raise exception 'INVALID_AMOUNT';end if;
 if length(p_input::text)>12000 or jsonb_typeof(p_input->'details')<>'object'
 then raise exception 'INVALID_DETAILS';end if;
 v_key:=(p_input->>'idempotencyKey')::uuid;
 v_session:=(p_input->>'sessionId')::uuid;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_key::text,0));
 select * into v_old from demo_payment.story_payments where idempotency_key=v_key;
 if found then
   if v_old.session_id<>v_session or v_old.data<>p_input then raise exception 'IDEMPOTENCY_CONFLICT';end if;
   return jsonb_build_object('id',v_old.id,'status',v_old.status,'replayed',true,'createdAt',v_old.created_at);
 end if;
 insert into demo_payment.story_payments(idempotency_key,session_id,service_code,amount_minor,data,status)
 values(v_key,v_session,p_input->>'service',(p_input->>'amountMinor')::bigint,p_input,'SIMULATED_SUCCESS')
 returning * into v_new;
 insert into demo_payment.story_notifications(payment_id,session_id,event_type)
 values(v_new.id,v_session,'SIMULATED_PAYMENT_SUCCESS');
 return jsonb_build_object('id',v_new.id,'status',v_new.status,'replayed',false,'createdAt',v_new.created_at);
end;$function$

revoke all on function public.demo_story1_submit(jsonb), public.demo_story1_get(uuid,uuid), public.demo_story1_list(uuid), public.demo_story1_notices(uuid) from public;
grant execute on function public.demo_story1_submit(jsonb), public.demo_story1_get(uuid,uuid), public.demo_story1_list(uuid), public.demo_story1_notices(uuid) to anon,authenticated;
