-- Idempotent immutable synthetic fixture snapshot from src/data/demoPaymentTransactions.ts
-- 9 grouped transactions; 16 allocations; 27 event steps; affected users 1-5 ONLY
insert into public.sim_payment_transactions(id,public_ref,payer_id,idempotency_key,request_fingerprint,total_minor,state,created_at)
values (pg_catalog.md5('simulation-tx-DEMO-TX-001')::uuid,'DEMO-TX-001','user1',pg_catalog.md5('simulation-idem-DEMO-TX-001')::uuid,pg_catalog.md5('fixture-DEMO-TX-001'),450000,'SIMULATED','2026-10-08T09:15:00Z'::timestamptz)
on conflict (public_ref) do nothing;
insert into public.sim_payment_allocations(transaction_id,line_no,beneficiary_id,category,assessment_year,amount_minor)
values(pg_catalog.md5('simulation-tx-DEMO-TX-001')::uuid,1,'user1','ADVANCE_TAX','2026-27',450000)
on conflict(transaction_id,line_no) do nothing;
insert into public.sim_payment_events(transaction_id,seq,action,note,occurred_at)
values(pg_catalog.md5('simulation-tx-DEMO-TX-001')::uuid,1,'CREATED','Synthetic payment intent created; no external submission','2026-10-08T09:15:00Z'::timestamptz)
on conflict(transaction_id,seq) do nothing;
insert into public.sim_payment_events(transaction_id,seq,action,note,occurred_at)
values(pg_catalog.md5('simulation-tx-DEMO-TX-001')::uuid,2,'REVIEWED','Allocations validated in simulation','2026-10-08T09:15:00Z'::timestamptz)
on conflict(transaction_id,seq) do nothing;
insert into public.sim_payment_events(transaction_id,seq,action,note,occurred_at)
values(pg_catalog.md5('simulation-tx-DEMO-TX-001')::uuid,3,'SIMULATION_RECORDED','Simulation recorded; no money moved','2026-10-08T09:15:00Z'::timestamptz)
on conflict(transaction_id,seq) do nothing;
insert into public.sim_payment_notifications(user_id,transaction_id,event_id)
select recipients.user_id,pg_catalog.md5('simulation-tx-DEMO-TX-001')::uuid,e.id
from (select 'user1' as user_id union select distinct a.beneficiary_id from public.sim_payment_allocations a where a.transaction_id=pg_catalog.md5('simulation-tx-DEMO-TX-001')::uuid) recipients
cross join lateral (select id from public.sim_payment_events where transaction_id=pg_catalog.md5('simulation-tx-DEMO-TX-001')::uuid and seq=3) e
on conflict(user_id,event_id) do nothing;
insert into public.sim_payment_transactions(id,public_ref,payer_id,idempotency_key,request_fingerprint,total_minor,state,created_at)
values (pg_catalog.md5('simulation-tx-DEMO-TX-002')::uuid,'DEMO-TX-002','user2',pg_catalog.md5('simulation-idem-DEMO-TX-002')::uuid,pg_catalog.md5('fixture-DEMO-TX-002'),1070000,'SIMULATED','2026-10-08T10:35:00Z'::timestamptz)
on conflict (public_ref) do nothing;
insert into public.sim_payment_allocations(transaction_id,line_no,beneficiary_id,category,assessment_year,amount_minor)
values(pg_catalog.md5('simulation-tx-DEMO-TX-002')::uuid,1,'user2','TAX_WITH_RETURN','2026-27',820000)
on conflict(transaction_id,line_no) do nothing;
insert into public.sim_payment_allocations(transaction_id,line_no,beneficiary_id,category,assessment_year,amount_minor)
values(pg_catalog.md5('simulation-tx-DEMO-TX-002')::uuid,2,'user2','ADVANCE_TAX','2026-27',250000)
on conflict(transaction_id,line_no) do nothing;
insert into public.sim_payment_events(transaction_id,seq,action,note,occurred_at)
values(pg_catalog.md5('simulation-tx-DEMO-TX-002')::uuid,1,'CREATED','Synthetic payment intent created; no external submission','2026-10-08T10:35:00Z'::timestamptz)
on conflict(transaction_id,seq) do nothing;
insert into public.sim_payment_events(transaction_id,seq,action,note,occurred_at)
values(pg_catalog.md5('simulation-tx-DEMO-TX-002')::uuid,2,'REVIEWED','Allocations validated in simulation','2026-10-08T10:35:00Z'::timestamptz)
on conflict(transaction_id,seq) do nothing;
insert into public.sim_payment_events(transaction_id,seq,action,note,occurred_at)
values(pg_catalog.md5('simulation-tx-DEMO-TX-002')::uuid,3,'SIMULATION_RECORDED','Simulation recorded; no money moved','2026-10-08T10:35:00Z'::timestamptz)
on conflict(transaction_id,seq) do nothing;
insert into public.sim_payment_notifications(user_id,transaction_id,event_id)
select recipients.user_id,pg_catalog.md5('simulation-tx-DEMO-TX-002')::uuid,e.id
from (select 'user2' as user_id union select distinct a.beneficiary_id from public.sim_payment_allocations a where a.transaction_id=pg_catalog.md5('simulation-tx-DEMO-TX-002')::uuid) recipients
cross join lateral (select id from public.sim_payment_events where transaction_id=pg_catalog.md5('simulation-tx-DEMO-TX-002')::uuid and seq=3) e
on conflict(user_id,event_id) do nothing;
insert into public.sim_payment_transactions(id,public_ref,payer_id,idempotency_key,request_fingerprint,total_minor,state,created_at)
values (pg_catalog.md5('simulation-tx-DEMO-TX-003')::uuid,'DEMO-TX-003','user1',pg_catalog.md5('simulation-idem-DEMO-TX-003')::uuid,pg_catalog.md5('fixture-DEMO-TX-003'),330000,'SIMULATED','2026-10-09T11:20:00Z'::timestamptz)
on conflict (public_ref) do nothing;
insert into public.sim_payment_allocations(transaction_id,line_no,beneficiary_id,category,assessment_year,amount_minor)
values(pg_catalog.md5('simulation-tx-DEMO-TX-003')::uuid,1,'user3','TAX_WITH_RETURN','2026-27',330000)
on conflict(transaction_id,line_no) do nothing;
insert into public.sim_payment_events(transaction_id,seq,action,note,occurred_at)
values(pg_catalog.md5('simulation-tx-DEMO-TX-003')::uuid,1,'CREATED','Synthetic payment intent created; no external submission','2026-10-09T11:20:00Z'::timestamptz)
on conflict(transaction_id,seq) do nothing;
insert into public.sim_payment_events(transaction_id,seq,action,note,occurred_at)
values(pg_catalog.md5('simulation-tx-DEMO-TX-003')::uuid,2,'REVIEWED','Allocations validated in simulation','2026-10-09T11:20:00Z'::timestamptz)
on conflict(transaction_id,seq) do nothing;
insert into public.sim_payment_events(transaction_id,seq,action,note,occurred_at)
values(pg_catalog.md5('simulation-tx-DEMO-TX-003')::uuid,3,'SIMULATION_RECORDED','Simulation recorded; no money moved','2026-10-09T11:20:00Z'::timestamptz)
on conflict(transaction_id,seq) do nothing;
insert into public.sim_payment_notifications(user_id,transaction_id,event_id)
select recipients.user_id,pg_catalog.md5('simulation-tx-DEMO-TX-003')::uuid,e.id
from (select 'user1' as user_id union select distinct a.beneficiary_id from public.sim_payment_allocations a where a.transaction_id=pg_catalog.md5('simulation-tx-DEMO-TX-003')::uuid) recipients
cross join lateral (select id from public.sim_payment_events where transaction_id=pg_catalog.md5('simulation-tx-DEMO-TX-003')::uuid and seq=3) e
on conflict(user_id,event_id) do nothing;
insert into public.sim_payment_transactions(id,public_ref,payer_id,idempotency_key,request_fingerprint,total_minor,state,created_at)
values (pg_catalog.md5('simulation-tx-DEMO-TX-004')::uuid,'DEMO-TX-004','user3',pg_catalog.md5('simulation-idem-DEMO-TX-004')::uuid,pg_catalog.md5('fixture-DEMO-TX-004'),640000,'SIMULATED','2026-10-10T04:25:00Z'::timestamptz)
on conflict (public_ref) do nothing;
insert into public.sim_payment_allocations(transaction_id,line_no,beneficiary_id,category,assessment_year,amount_minor)
values(pg_catalog.md5('simulation-tx-DEMO-TX-004')::uuid,1,'user4','ASSESSED_DEMAND','2025-26',600000)
on conflict(transaction_id,line_no) do nothing;
insert into public.sim_payment_allocations(transaction_id,line_no,beneficiary_id,category,assessment_year,amount_minor)
values(pg_catalog.md5('simulation-tx-DEMO-TX-004')::uuid,2,'user4','PENALTY','2025-26',40000)
on conflict(transaction_id,line_no) do nothing;
insert into public.sim_payment_events(transaction_id,seq,action,note,occurred_at)
values(pg_catalog.md5('simulation-tx-DEMO-TX-004')::uuid,1,'CREATED','Synthetic payment intent created; no external submission','2026-10-10T04:25:00Z'::timestamptz)
on conflict(transaction_id,seq) do nothing;
insert into public.sim_payment_events(transaction_id,seq,action,note,occurred_at)
values(pg_catalog.md5('simulation-tx-DEMO-TX-004')::uuid,2,'REVIEWED','Allocations validated in simulation','2026-10-10T04:25:00Z'::timestamptz)
on conflict(transaction_id,seq) do nothing;
insert into public.sim_payment_events(transaction_id,seq,action,note,occurred_at)
values(pg_catalog.md5('simulation-tx-DEMO-TX-004')::uuid,3,'SIMULATION_RECORDED','Simulation recorded; no money moved','2026-10-10T04:25:00Z'::timestamptz)
on conflict(transaction_id,seq) do nothing;
insert into public.sim_payment_notifications(user_id,transaction_id,event_id)
select recipients.user_id,pg_catalog.md5('simulation-tx-DEMO-TX-004')::uuid,e.id
from (select 'user3' as user_id union select distinct a.beneficiary_id from public.sim_payment_allocations a where a.transaction_id=pg_catalog.md5('simulation-tx-DEMO-TX-004')::uuid) recipients
cross join lateral (select id from public.sim_payment_events where transaction_id=pg_catalog.md5('simulation-tx-DEMO-TX-004')::uuid and seq=3) e
on conflict(user_id,event_id) do nothing;
insert into public.sim_payment_transactions(id,public_ref,payer_id,idempotency_key,request_fingerprint,total_minor,state,created_at)
values (pg_catalog.md5('simulation-tx-DEMO-TX-005')::uuid,'DEMO-TX-005','user4',pg_catalog.md5('simulation-idem-DEMO-TX-005')::uuid,pg_catalog.md5('fixture-DEMO-TX-005'),1140000,'SIMULATED','2026-10-10T13:40:00Z'::timestamptz)
on conflict (public_ref) do nothing;
insert into public.sim_payment_allocations(transaction_id,line_no,beneficiary_id,category,assessment_year,amount_minor)
values(pg_catalog.md5('simulation-tx-DEMO-TX-005')::uuid,1,'user4','TAX_WITH_RETURN','2026-27',920000)
on conflict(transaction_id,line_no) do nothing;
insert into public.sim_payment_allocations(transaction_id,line_no,beneficiary_id,category,assessment_year,amount_minor)
values(pg_catalog.md5('simulation-tx-DEMO-TX-005')::uuid,2,'user1','ADVANCE_TAX','2026-27',120000)
on conflict(transaction_id,line_no) do nothing;
insert into public.sim_payment_allocations(transaction_id,line_no,beneficiary_id,category,assessment_year,amount_minor)
values(pg_catalog.md5('simulation-tx-DEMO-TX-005')::uuid,3,'user5','OTHER_TAX_PAYMENT','2025-26',85000)
on conflict(transaction_id,line_no) do nothing;
insert into public.sim_payment_allocations(transaction_id,line_no,beneficiary_id,category,assessment_year,amount_minor)
values(pg_catalog.md5('simulation-tx-DEMO-TX-005')::uuid,4,'user5','PENALTY','2025-26',15000)
on conflict(transaction_id,line_no) do nothing;
insert into public.sim_payment_events(transaction_id,seq,action,note,occurred_at)
values(pg_catalog.md5('simulation-tx-DEMO-TX-005')::uuid,1,'CREATED','Synthetic payment intent created; no external submission','2026-10-10T13:40:00Z'::timestamptz)
on conflict(transaction_id,seq) do nothing;
insert into public.sim_payment_events(transaction_id,seq,action,note,occurred_at)
values(pg_catalog.md5('simulation-tx-DEMO-TX-005')::uuid,2,'REVIEWED','Allocations validated in simulation','2026-10-10T13:40:00Z'::timestamptz)
on conflict(transaction_id,seq) do nothing;
insert into public.sim_payment_events(transaction_id,seq,action,note,occurred_at)
values(pg_catalog.md5('simulation-tx-DEMO-TX-005')::uuid,3,'SIMULATION_RECORDED','Simulation recorded; no money moved','2026-10-10T13:40:00Z'::timestamptz)
on conflict(transaction_id,seq) do nothing;
insert into public.sim_payment_notifications(user_id,transaction_id,event_id)
select recipients.user_id,pg_catalog.md5('simulation-tx-DEMO-TX-005')::uuid,e.id
from (select 'user4' as user_id union select distinct a.beneficiary_id from public.sim_payment_allocations a where a.transaction_id=pg_catalog.md5('simulation-tx-DEMO-TX-005')::uuid) recipients
cross join lateral (select id from public.sim_payment_events where transaction_id=pg_catalog.md5('simulation-tx-DEMO-TX-005')::uuid and seq=3) e
on conflict(user_id,event_id) do nothing;
insert into public.sim_payment_transactions(id,public_ref,payer_id,idempotency_key,request_fingerprint,total_minor,state,created_at)
values (pg_catalog.md5('simulation-tx-DEMO-TX-006')::uuid,'DEMO-TX-006','user5',pg_catalog.md5('simulation-idem-DEMO-TX-006')::uuid,pg_catalog.md5('fixture-DEMO-TX-006'),1120000,'SIMULATED','2026-10-11T15:10:00Z'::timestamptz)
on conflict (public_ref) do nothing;
insert into public.sim_payment_allocations(transaction_id,line_no,beneficiary_id,category,assessment_year,amount_minor)
values(pg_catalog.md5('simulation-tx-DEMO-TX-006')::uuid,1,'user2','APPELLATE_TRIBUNAL','2025-26',340000)
on conflict(transaction_id,line_no) do nothing;
insert into public.sim_payment_allocations(transaction_id,line_no,beneficiary_id,category,assessment_year,amount_minor)
values(pg_catalog.md5('simulation-tx-DEMO-TX-006')::uuid,2,'user3','SOURCE_TAX_DEPOSIT','2026-27',780000)
on conflict(transaction_id,line_no) do nothing;
insert into public.sim_payment_events(transaction_id,seq,action,note,occurred_at)
values(pg_catalog.md5('simulation-tx-DEMO-TX-006')::uuid,1,'CREATED','Synthetic payment intent created; no external submission','2026-10-11T15:10:00Z'::timestamptz)
on conflict(transaction_id,seq) do nothing;
insert into public.sim_payment_events(transaction_id,seq,action,note,occurred_at)
values(pg_catalog.md5('simulation-tx-DEMO-TX-006')::uuid,2,'REVIEWED','Allocations validated in simulation','2026-10-11T15:10:00Z'::timestamptz)
on conflict(transaction_id,seq) do nothing;
insert into public.sim_payment_events(transaction_id,seq,action,note,occurred_at)
values(pg_catalog.md5('simulation-tx-DEMO-TX-006')::uuid,3,'SIMULATION_RECORDED','Simulation recorded; no money moved','2026-10-11T15:10:00Z'::timestamptz)
on conflict(transaction_id,seq) do nothing;
insert into public.sim_payment_notifications(user_id,transaction_id,event_id)
select recipients.user_id,pg_catalog.md5('simulation-tx-DEMO-TX-006')::uuid,e.id
from (select 'user5' as user_id union select distinct a.beneficiary_id from public.sim_payment_allocations a where a.transaction_id=pg_catalog.md5('simulation-tx-DEMO-TX-006')::uuid) recipients
cross join lateral (select id from public.sim_payment_events where transaction_id=pg_catalog.md5('simulation-tx-DEMO-TX-006')::uuid and seq=3) e
on conflict(user_id,event_id) do nothing;
insert into public.sim_payment_transactions(id,public_ref,payer_id,idempotency_key,request_fingerprint,total_minor,state,created_at)
values (pg_catalog.md5('simulation-tx-DEMO-TX-007')::uuid,'DEMO-TX-007','user2',pg_catalog.md5('simulation-idem-DEMO-TX-007')::uuid,pg_catalog.md5('fixture-DEMO-TX-007'),150000,'FAILED','2026-10-12T08:05:00Z'::timestamptz)
on conflict (public_ref) do nothing;
insert into public.sim_payment_allocations(transaction_id,line_no,beneficiary_id,category,assessment_year,amount_minor)
values(pg_catalog.md5('simulation-tx-DEMO-TX-007')::uuid,1,'user2','ADVANCE_TAX','2026-27',100000)
on conflict(transaction_id,line_no) do nothing;
insert into public.sim_payment_allocations(transaction_id,line_no,beneficiary_id,category,assessment_year,amount_minor)
values(pg_catalog.md5('simulation-tx-DEMO-TX-007')::uuid,2,'user5','ASSESSED_DEMAND','2025-26',50000)
on conflict(transaction_id,line_no) do nothing;
insert into public.sim_payment_events(transaction_id,seq,action,note,occurred_at)
values(pg_catalog.md5('simulation-tx-DEMO-TX-007')::uuid,1,'CREATED','Synthetic payment intent created; no external submission','2026-10-12T08:05:00Z'::timestamptz)
on conflict(transaction_id,seq) do nothing;
insert into public.sim_payment_events(transaction_id,seq,action,note,occurred_at)
values(pg_catalog.md5('simulation-tx-DEMO-TX-007')::uuid,2,'REVIEWED','Allocations validated in simulation','2026-10-12T08:05:00Z'::timestamptz)
on conflict(transaction_id,seq) do nothing;
insert into public.sim_payment_events(transaction_id,seq,action,note,occurred_at)
values(pg_catalog.md5('simulation-tx-DEMO-TX-007')::uuid,3,'FAILED','Simulated failed','2026-10-12T08:05:00Z'::timestamptz)
on conflict(transaction_id,seq) do nothing;
insert into public.sim_payment_notifications(user_id,transaction_id,event_id)
select recipients.user_id,pg_catalog.md5('simulation-tx-DEMO-TX-007')::uuid,e.id
from (select 'user2' as user_id union select distinct a.beneficiary_id from public.sim_payment_allocations a where a.transaction_id=pg_catalog.md5('simulation-tx-DEMO-TX-007')::uuid) recipients
cross join lateral (select id from public.sim_payment_events where transaction_id=pg_catalog.md5('simulation-tx-DEMO-TX-007')::uuid and seq=3) e
on conflict(user_id,event_id) do nothing;
insert into public.sim_payment_transactions(id,public_ref,payer_id,idempotency_key,request_fingerprint,total_minor,state,created_at)
values (pg_catalog.md5('simulation-tx-DEMO-TX-008')::uuid,'DEMO-TX-008','user5',pg_catalog.md5('simulation-idem-DEMO-TX-008')::uuid,pg_catalog.md5('fixture-DEMO-TX-008'),80000,'PENDING','2026-10-12T09:50:00Z'::timestamptz)
on conflict (public_ref) do nothing;
insert into public.sim_payment_allocations(transaction_id,line_no,beneficiary_id,category,assessment_year,amount_minor)
values(pg_catalog.md5('simulation-tx-DEMO-TX-008')::uuid,1,'user1','TAX_WITH_RETURN','2026-27',80000)
on conflict(transaction_id,line_no) do nothing;
insert into public.sim_payment_events(transaction_id,seq,action,note,occurred_at)
values(pg_catalog.md5('simulation-tx-DEMO-TX-008')::uuid,1,'CREATED','Synthetic payment intent created; no external submission','2026-10-12T09:50:00Z'::timestamptz)
on conflict(transaction_id,seq) do nothing;
insert into public.sim_payment_events(transaction_id,seq,action,note,occurred_at)
values(pg_catalog.md5('simulation-tx-DEMO-TX-008')::uuid,2,'REVIEWED','Allocations validated in simulation','2026-10-12T09:50:00Z'::timestamptz)
on conflict(transaction_id,seq) do nothing;
insert into public.sim_payment_events(transaction_id,seq,action,note,occurred_at)
values(pg_catalog.md5('simulation-tx-DEMO-TX-008')::uuid,3,'PENDING','Simulated pending','2026-10-12T09:50:00Z'::timestamptz)
on conflict(transaction_id,seq) do nothing;
insert into public.sim_payment_notifications(user_id,transaction_id,event_id)
select recipients.user_id,pg_catalog.md5('simulation-tx-DEMO-TX-008')::uuid,e.id
from (select 'user5' as user_id union select distinct a.beneficiary_id from public.sim_payment_allocations a where a.transaction_id=pg_catalog.md5('simulation-tx-DEMO-TX-008')::uuid) recipients
cross join lateral (select id from public.sim_payment_events where transaction_id=pg_catalog.md5('simulation-tx-DEMO-TX-008')::uuid and seq=3) e
on conflict(user_id,event_id) do nothing;
insert into public.sim_payment_transactions(id,public_ref,payer_id,idempotency_key,request_fingerprint,total_minor,state,created_at)
values (pg_catalog.md5('simulation-tx-DEMO-TX-009')::uuid,'DEMO-TX-009','user1',pg_catalog.md5('simulation-idem-DEMO-TX-009')::uuid,pg_catalog.md5('fixture-DEMO-TX-009'),60000,'REVERSED','2026-10-12T12:25:00Z'::timestamptz)
on conflict (public_ref) do nothing;
insert into public.sim_payment_allocations(transaction_id,line_no,beneficiary_id,category,assessment_year,amount_minor)
values(pg_catalog.md5('simulation-tx-DEMO-TX-009')::uuid,1,'user4','OTHER_TAX_PAYMENT','2026-27',60000)
on conflict(transaction_id,line_no) do nothing;
insert into public.sim_payment_events(transaction_id,seq,action,note,occurred_at)
values(pg_catalog.md5('simulation-tx-DEMO-TX-009')::uuid,1,'CREATED','Synthetic payment intent created; no external submission','2026-10-12T12:25:00Z'::timestamptz)
on conflict(transaction_id,seq) do nothing;
insert into public.sim_payment_events(transaction_id,seq,action,note,occurred_at)
values(pg_catalog.md5('simulation-tx-DEMO-TX-009')::uuid,2,'REVIEWED','Allocations validated in simulation','2026-10-12T12:25:00Z'::timestamptz)
on conflict(transaction_id,seq) do nothing;
insert into public.sim_payment_events(transaction_id,seq,action,note,occurred_at)
values(pg_catalog.md5('simulation-tx-DEMO-TX-009')::uuid,3,'REVERSED','Simulated reversed','2026-10-12T12:25:00Z'::timestamptz)
on conflict(transaction_id,seq) do nothing;
insert into public.sim_payment_notifications(user_id,transaction_id,event_id)
select recipients.user_id,pg_catalog.md5('simulation-tx-DEMO-TX-009')::uuid,e.id
from (select 'user1' as user_id union select distinct a.beneficiary_id from public.sim_payment_allocations a where a.transaction_id=pg_catalog.md5('simulation-tx-DEMO-TX-009')::uuid) recipients
cross join lateral (select id from public.sim_payment_events where transaction_id=pg_catalog.md5('simulation-tx-DEMO-TX-009')::uuid and seq=3) e
on conflict(user_id,event_id) do nothing;