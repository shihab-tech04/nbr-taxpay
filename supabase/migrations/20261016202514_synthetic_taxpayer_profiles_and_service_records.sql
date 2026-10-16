-- Ten deliberately fictional, public taxpayer-preview profiles and eight-service
-- activity examples. This extends existing sim_* data; it never touches TaxPay
-- private drafts, officer decisions, financial ledgers, ACS or Treasury evidence.
-- Browser preview credentials are NOT Supabase Auth identities.

alter table public.sim_payment_users
  add column if not exists role_code text,
  add column if not exists name_en text,
  add column if not exists name_bn text,
  add column if not exists focus_en text,
  add column if not exists focus_bn text,
  add column if not exists tin_stub text,
  add column if not exists jurisdiction_label text;

comment on column public.sim_payment_users.tin_stub is
  'DEMO-only visible stub, NEVER a real eTIN or verified taxpayer identifier';

insert into public.sim_payment_users as u
  (id,role_code,name_en,name_bn,focus_en,focus_bn,tin_stub,jurisdiction_label)
values
  ('user1','TAXPAYER_INDIVIDUAL','Individual Taxpayer 01','ব্যক্তি করদাতা ০১','Personal income-tax payments','ব্যক্তিগত আয়কর পরিশোধ','DEMO-TIN-001','circle-1'),
  ('user2','TAXPAYER_CORPORATE','Company Taxpayer 02','কোম্পানি করদাতা ০২','Corporate payment records','কোম্পানির পেমেন্ট রেকর্ড','DEMO-TIN-002','circle-2'),
  ('user3','WITHHOLDING_AGENT','Withholding Agent 03','উৎসে কর কর্তনকারী ০৩','Source-tax deposits for beneficiaries','প্রাপকের পক্ষে উৎসে কর জমা','DEMO-TIN-003','circle-3'),
  ('user4','TAXPAYER_INDIVIDUAL','Self-employed Taxpayer 04','স্বনিযুক্ত করদাতা ০৪','Business and professional payments','ব্যবসা ও পেশার কর পরিশোধ','DEMO-TIN-004','circle-4'),
  ('user5','TAXPAYER_INDIVIDUAL','Multi-year Taxpayer 05','একাধিক করবর্ষের করদাতা ০৫','Payments across assessment years','একাধিক করবর্ষের পরিশোধ','DEMO-TIN-005','circle-5'),
  ('user6','TAXPAYER_INDIVIDUAL','Advance-tax Taxpayer 06','অগ্রিম করদাতা ০৬','Advance-tax instalments','অগ্রিম করের কিস্তি','DEMO-TIN-006','circle-6'),
  ('user7','TAXPAYER_INDIVIDUAL','Withholding Recipient 07','উৎসে কর কর্তনগ্রহীতা ০৭','Withholding evidence review','উৎসে করের তথ্য পর্যালোচনা','DEMO-TIN-007','circle-7'),
  ('user8','TAXPAYER_INDIVIDUAL','Payment Exception 08','পেমেন্ট ব্যতিক্রম ০৮','Pending, failed and reversed cases','অপেক্ষমাণ, ব্যর্থ ও ফেরত লেনদেন','DEMO-TIN-008','circle-8'),
  ('user9','TAXPAYER_INDIVIDUAL','Adjustment Taxpayer 09','সমন্বয় করদাতা ০৯','Adjustments and refund inquiries','সমন্বয় ও ফেরতের অনুসন্ধান','DEMO-TIN-009','circle-9'),
  ('user10','TAXPAYER_INDIVIDUAL','Correction Taxpayer 10','সংশোধন করদাতা ১০','Correction and reconciliation requests','সংশোধন ও সমন্বয়ের আবেদন','DEMO-TIN-010','circle-10')
on conflict (id) do update set
  role_code=coalesce(u.role_code,excluded.role_code),
  name_en=coalesce(u.name_en,excluded.name_en),
  name_bn=coalesce(u.name_bn,excluded.name_bn),
  focus_en=coalesce(u.focus_en,excluded.focus_en),
  focus_bn=coalesce(u.focus_bn,excluded.focus_bn),
  tin_stub=coalesce(u.tin_stub,excluded.tin_stub),
  jurisdiction_label=coalesce(u.jurisdiction_label,excluded.jurisdiction_label);

create table if not exists public.sim_tax_service_records (
  record_id text primary key check (record_id ~ '^SAMPLE-SRV-[0-9]{3}$'),
  user_id text not null references public.sim_payment_users(id),
  service_code text not null check (service_code in (
    'TAX_WITH_RETURN','ADVANCE_TAX','ASSESSED_DEMAND','PENALTY',
    'SOURCE_TAX_DEPOSIT','APPELLATE_TRIBUNAL','OTHER_TAX_PAYMENT','TRAVEL_TAX'
  )),
  assessment_year text,
  amount_minor bigint not null check (amount_minor between 1 and 1000000000000),
  record_state text not null check (record_state in ('SIMULATED','PENDING','FAILED','REVERSED','REVIEW_REQUIRED')),
  participant_role text not null default 'PAYER' check (participant_role in ('PAYER','BENEFICIARY')),
  related_user_id text references public.sim_payment_users(id),
  recorded_at timestamptz not null,
  simulation_only boolean not null default true check (simulation_only),
  constraint sim_tax_service_assessment_year_check check (
    (service_code='TRAVEL_TAX' and assessment_year is null) or
    (service_code<>'TRAVEL_TAX' and assessment_year ~ '^20[0-9]{2}-[0-9]{2}$')
  )
);
create index if not exists sim_tax_service_user_date_idx
  on public.sim_tax_service_records(user_id,recorded_at desc);
create index if not exists sim_tax_service_category_idx
  on public.sim_tax_service_records(service_code);
comment on table public.sim_tax_service_records is
  'Public fictional service examples only; no government payment, credit, challan, tax entitlement or verified Travel Tax rate';

alter table public.sim_tax_service_records enable row level security;
revoke all on public.sim_tax_service_records from public,anon,authenticated;
grant select on public.sim_tax_service_records to anon,authenticated;
create policy sim_public_sample_service_select on public.sim_tax_service_records
  for select to anon,authenticated using (simulation_only = true);

-- These are purpose-built examples rather than live payments, and statuses are
-- not financial evidence. Travel Tax has its own rows and no assessment year.
insert into public.sim_tax_service_records
  (record_id,user_id,service_code,assessment_year,amount_minor,record_state,participant_role,related_user_id,recorded_at)
values
  ('SAMPLE-SRV-001','user1','TAX_WITH_RETURN','2025-26',4250000,'SIMULATED','PAYER',null,'2026-09-03T09:00:00Z'),
  ('SAMPLE-SRV-002','user1','ADVANCE_TAX','2026-27',750000,'SIMULATED','PAYER',null,'2026-10-06T09:00:00Z'),
  ('SAMPLE-SRV-003','user1','TRAVEL_TAX',null,200000,'SIMULATED','PAYER',null,'2026-10-08T09:00:00Z'),
  ('SAMPLE-SRV-004','user2','TAX_WITH_RETURN','2025-26',25000000,'SIMULATED','PAYER',null,'2026-09-08T10:00:00Z'),
  ('SAMPLE-SRV-005','user2','ADVANCE_TAX','2026-27',8000000,'SIMULATED','PAYER',null,'2026-10-03T10:00:00Z'),
  ('SAMPLE-SRV-006','user2','ASSESSED_DEMAND','2024-25',5600000,'PENDING','PAYER',null,'2026-10-04T10:00:00Z'),
  ('SAMPLE-SRV-007','user2','APPELLATE_TRIBUNAL','2024-25',750000,'REVIEW_REQUIRED','PAYER',null,'2026-10-05T10:00:00Z'),
  ('SAMPLE-SRV-008','user3','SOURCE_TAX_DEPOSIT','2026-27',17500000,'SIMULATED','PAYER',null,'2026-10-01T08:00:00Z'),
  ('SAMPLE-SRV-009','user3','OTHER_TAX_PAYMENT','2025-26',1250000,'REVIEW_REQUIRED','PAYER',null,'2026-10-02T08:00:00Z'),
  ('SAMPLE-SRV-010','user4','TAX_WITH_RETURN','2025-26',3800000,'SIMULATED','PAYER',null,'2026-09-18T11:00:00Z'),
  ('SAMPLE-SRV-011','user4','ASSESSED_DEMAND','2024-25',1500000,'PENDING','PAYER',null,'2026-10-01T11:00:00Z'),
  ('SAMPLE-SRV-012','user4','PENALTY','2024-25',250000,'REVIEW_REQUIRED','PAYER',null,'2026-10-04T11:00:00Z'),
  ('SAMPLE-SRV-013','user4','TRAVEL_TAX',null,120000,'SIMULATED','PAYER',null,'2026-10-07T11:00:00Z'),
  ('SAMPLE-SRV-014','user5','TAX_WITH_RETURN','2024-25',750000,'SIMULATED','PAYER',null,'2025-09-20T08:00:00Z'),
  ('SAMPLE-SRV-015','user5','ADVANCE_TAX','2025-26',850000,'SIMULATED','PAYER',null,'2026-03-20T08:00:00Z'),
  ('SAMPLE-SRV-016','user5','ASSESSED_DEMAND','2026-27',2100000,'PENDING','PAYER',null,'2026-10-09T08:00:00Z'),
  ('SAMPLE-SRV-017','user6','ADVANCE_TAX','2026-27',2500000,'SIMULATED','PAYER',null,'2026-07-15T09:00:00Z'),
  ('SAMPLE-SRV-018','user6','ADVANCE_TAX','2026-27',2500000,'PENDING','PAYER',null,'2026-10-15T09:00:00Z'),
  ('SAMPLE-SRV-019','user6','TAX_WITH_RETURN','2025-26',1750000,'SIMULATED','PAYER',null,'2026-09-10T09:00:00Z'),
  ('SAMPLE-SRV-020','user7','SOURCE_TAX_DEPOSIT','2026-27',2650000,'REVIEW_REQUIRED','BENEFICIARY','user3','2026-10-05T12:00:00Z'),
  ('SAMPLE-SRV-021','user7','TAX_WITH_RETURN','2025-26',1200000,'SIMULATED','PAYER',null,'2026-09-05T12:00:00Z'),
  ('SAMPLE-SRV-022','user7','TRAVEL_TAX',null,90000,'SIMULATED','PAYER',null,'2026-10-08T12:00:00Z'),
  ('SAMPLE-SRV-023','user8','TAX_WITH_RETURN','2026-27',3400000,'FAILED','PAYER',null,'2026-10-09T13:00:00Z'),
  ('SAMPLE-SRV-024','user8','ADVANCE_TAX','2026-27',700000,'PENDING','PAYER',null,'2026-10-10T13:00:00Z'),
  ('SAMPLE-SRV-025','user8','TRAVEL_TAX',null,140000,'REVERSED','PAYER',null,'2026-10-11T13:00:00Z'),
  ('SAMPLE-SRV-026','user9','TAX_WITH_RETURN','2025-26',3000000,'SIMULATED','PAYER',null,'2026-09-14T09:00:00Z'),
  ('SAMPLE-SRV-027','user9','OTHER_TAX_PAYMENT','2025-26',500000,'REVIEW_REQUIRED','PAYER',null,'2026-10-08T09:00:00Z'),
  ('SAMPLE-SRV-028','user9','ASSESSED_DEMAND','2024-25',850000,'PENDING','PAYER',null,'2026-10-10T09:00:00Z'),
  ('SAMPLE-SRV-029','user10','ASSESSED_DEMAND','2025-26',4500000,'REVIEW_REQUIRED','PAYER',null,'2026-10-06T10:00:00Z'),
  ('SAMPLE-SRV-030','user10','PENALTY','2025-26',300000,'PENDING','PAYER',null,'2026-10-09T10:00:00Z'),
  ('SAMPLE-SRV-031','user10','OTHER_TAX_PAYMENT','2025-26',950000,'REVIEW_REQUIRED','PAYER',null,'2026-10-11T10:00:00Z')
on conflict (record_id) do nothing;
