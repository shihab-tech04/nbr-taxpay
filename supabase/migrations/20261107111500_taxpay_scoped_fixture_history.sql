-- TaxPay verified SQL-only fixtures: allow exactly owner-matched, registered and
-- payload-locked fictional payments into the private 30-persona history view.
-- No changes to general TAXPAY_UI receipt behavior, approvals, or legal status.
create table if not exists taxpay_guest_private.approved_story1_qa_fixtures (
 payment_id uuid primary key references demo_payment.story_payments(id) on delete cascade,
 owner_demo_id text not null references public.sim_payment_users(id),
 owner_session_id uuid not null,
 fixture_batch text not null check (fixture_batch in
  ('TAXPAY-20261107-30-PROFILE-COVERAGE','TAXPAY-20261107-ACTIVE-HEAD-CATALOGUE')),
 immutable_payload_sha256 text not null check (immutable_payload_sha256 ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default now()
);
revoke all on table taxpay_guest_private.approved_story1_qa_fixtures from public,anon,authenticated;
alter table taxpay_guest_private.approved_story1_qa_fixtures enable row level security;
insert into taxpay_guest_private.approved_story1_qa_fixtures
 (payment_id,owner_demo_id,owner_session_id,fixture_batch,immutable_payload_sha256)
select p.id,owner.demo_id,p.session_id,p.data->'details'->>'fixtureBatch',
 encode(extensions.digest(convert_to(p.data::text,'UTF8'),'sha256'),'hex')
from demo_payment.story_payments p
join taxpay_guest_private.demo_profiles owner
 on owner.payment_session_id=p.session_id and owner.demo_id=p.data->'details'->>'payerId'
where p.data->>'origin'='TAXPAY_SQL_FIXTURE'
 and p.data->'details'->>'fixtureBatch' in
 ('TAXPAY-20261107-30-PROFILE-COVERAGE','TAXPAY-20261107-ACTIVE-HEAD-CATALOGUE')
 and p.data->'details'->>'sampleOnly'='true'
 and p.status='SIMULATED_SUCCESS'
on conflict (payment_id) do nothing;

-- Modify only the immutable, already capability-scoped history read.
do $qa_history$
declare original text;revised text;
begin
 original:=pg_get_functiondef('public.taxpay_demo_story1_history_page(text,text,timestamp with time zone,uuid,integer)'::regprocedure);
 if strpos(original,'where x.data->>''origin''=''TAXPAY_UI''')=0
  then raise exception 'History function origin guard changed: no unsafe replacement'; end if;
 if strpos(original,'approved_story1_qa_fixtures')>0
  then raise exception 'History fixture allowlist already applied: refusing duplicate patch'; end if;
 revised:=replace(original,
   'where x.data->>''origin''=''TAXPAY_UI''',
   'where (x.data->>''origin''=''TAXPAY_UI''
     or (x.data->>''origin''=''TAXPAY_SQL_FIXTURE''
       and exists (
         select 1 from taxpay_guest_private.approved_story1_qa_fixtures allowlisted
         where allowlisted.payment_id=x.id
           and allowlisted.owner_demo_id=x.data->''details''->>''payerId''
           and allowlisted.owner_session_id=x.session_id
           and allowlisted.fixture_batch=x.data->''details''->>''fixtureBatch''
           and allowlisted.immutable_payload_sha256=encode(extensions.digest(convert_to(x.data::text,''UTF8''),''sha256''),''hex'')
       )
     ))');
 execute revised;
end;
$qa_history$;
