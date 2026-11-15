-- Sohojkor Phase 1: recover missing *fictional preview* identities after the
-- user1-only hosted cleanup. NOT an Auth/TIN issuance or financial migration.
-- Exclusive WS3 SQL scope. Preserve all existing rows/capabilities/session IDs.
-- Depends on previously applied 30-profile guards. The later 55-profile
-- migration may be deployed before/after this repair without being downgraded.
BEGIN;

-- Do not rewrite existing account metadata. These fictional records come from
-- the approved 30-account app preview, not any official identity registry.
INSERT INTO public.sim_payment_users
 (id,role_code,name_en,name_bn,focus_en,focus_bn,tin_stub,jurisdiction_label)
VALUES
 ('user2','TAXPAYER_CORPORATE','Meghna Trading Ltd.','মেঘনা ট্রেডিং লিমিটেড','Corporate payment records','কোম্পানির পেমেন্ট রেকর্ড','DEMO-TIN-002','circle-2'),
 ('user3','WITHHOLDING_AGENT','Rupali Textiles Ltd.','রূপালী টেক্সটাইলস লিমিটেড','Source-tax deposit workflow','উৎসে কর জমার প্রক্রিয়া','DEMO-TIN-003','circle-3'),
 ('user4','TAXPAYER_INDIVIDUAL','Nusrat Jahan','নুসরাত জাহান','Business and professional payment records','ব্যবসা ও পেশার পেমেন্ট রেকর্ড','DEMO-TIN-004','circle-4'),
 ('user5','TAXPAYER_INDIVIDUAL','Mahmud Hasan','মাহমুদ হাসান','Assessment-year tracking','করবর্ষভিত্তিক তথ্য অনুসরণ','DEMO-TIN-005','circle-5'),
 ('user6','TAXPAYER_INDIVIDUAL','Farzana Akter','ফারজানা আক্তার','Advance tax and instalment review','অগ্রিম কর ও কিস্তি পর্যালোচনা','DEMO-TIN-006','circle-6'),
 ('user7','TAXPAYER_INDIVIDUAL','Sadia Islam','সাদিয়া ইসলাম','First-time payment','প্রথমবার পেমেন্ট','DEMO-TIN-007','circle-7'),
 ('user8','TAXPAYER_INDIVIDUAL','Tanvir Ahmed','তানভীর আহমেদ','First-time payment','প্রথমবার পেমেন্ট','DEMO-TIN-008','circle-8'),
 ('user9','TAXPAYER_INDIVIDUAL','Imran Hossain','ইমরান হোসেন','First-time payment','প্রথমবার পেমেন্ট','DEMO-TIN-009','circle-9'),
 ('user10','TAXPAYER_INDIVIDUAL','Shaila Parvin','শায়লা পারভীন','First-time payment','প্রথমবার পেমেন্ট','DEMO-TIN-010','circle-10')
ON CONFLICT (id) DO NOTHING;

-- Keep the established 11–30 role/tag rules, not a second user catalogue.
INSERT INTO public.sim_payment_users
 (id,role_code,name_en,name_bn,focus_en,focus_bn,tin_stub,jurisdiction_label)
SELECT 'user'||n,
 CASE WHEN mod(n,7)=0 THEN 'WITHHOLDING_AGENT'
      WHEN mod(n,5)=0 THEN 'TAXPAYER_CORPORATE'
      ELSE 'TAXPAYER_INDIVIDUAL' END,
 'Taxpayer Account '||n,'করদাতা অ্যাকাউন্ট '||n,
 CASE mod(n,4) WHEN 0 THEN 'Mixed-year payments'
    WHEN 1 THEN 'Travel tax combinations'
    WHEN 2 THEN 'Multiple-beneficiary payments'
    ELSE 'Income tax heads' END,
 'বিভিন্ন কর পরিশোধের বিবরণ',
 'DEMO-TIN-'||lpad(n::text,3,'0'),'circle-'||n
FROM generate_series(11,30) n
ON CONFLICT (id) DO NOTHING;

-- The private table's existing secure defaults generate random capabilities
-- and sessions. Never clone User1 tokens or expose capabilities via this SQL.
INSERT INTO taxpay_guest_private.demo_profiles(demo_id)
SELECT 'user'||n FROM generate_series(2,30) n
ON CONFLICT (demo_id) DO NOTHING;

DO $phase1$
DECLARE missing_public integer; missing_private integer; mismatched_sessions integer;
BEGIN
 SELECT count(*) INTO missing_public
 FROM generate_series(1,30) n
 WHERE NOT EXISTS (
   SELECT 1 FROM public.sim_payment_users p WHERE p.id='user'||n);
 SELECT count(*) INTO missing_private
 FROM generate_series(1,30) n
 WHERE NOT EXISTS (
   SELECT 1 FROM taxpay_guest_private.demo_profiles p WHERE p.demo_id='user'||n);
 SELECT count(*) INTO mismatched_sessions
 FROM taxpay_guest_private.demo_profiles p
 WHERE p.demo_id ~ '^user([1-9]|[12][0-9]|30)$'
   AND (p.capability_token IS NULL OR p.payment_session_id IS NULL);
 IF missing_public<>0 OR missing_private<>0 OR mismatched_sessions<>0 THEN
   RAISE EXCEPTION 'Phase 1 preview registry reconciliation failed: public %, private %, sessions %',
     missing_public,missing_private,mismatched_sessions;
 END IF;
END;
$phase1$;

COMMIT;
