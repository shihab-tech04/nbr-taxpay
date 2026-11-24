-- Sohojkor WS2 Phase 2. Explicit, reproducible, INSERT-only fictional preview seed.
-- Never interpret these example TIN aliases or relationships as verified taxpayer identities.
-- Never creates financial transactions, payments, receipts, tax credit or real Auth users.
-- Source: tests/fixtures/user1-beneficiary-scenarios-v95.json (fixed seed).
-- Release precondition: independent scoped pre-write snapshot and authorized owner approval.
-- Re-running preserves approved existing records. Mismatched content aborts atomically.
do $phase2$
declare
  owner_session uuid;
  current_list uuid;
  grp record;
  person record;
  missing_count integer;
begin
  perform pg_advisory_xact_lock(hashtext('sohojkor-user1-phase2-v1'));
  if (select count(*) from taxpay_guest_private.demo_profiles where demo_id='user1')<>1
    or (select count(*) from public.sim_payment_users where id='user1')<>1
  then raise exception 'Required fictional user1 source is missing'; end if;
  insert into public.sim_payment_users(
    id,role_code,name_en,name_bn,focus_en,focus_bn,tin_stub,jurisdiction_label)
  values
  ('user2','TAXPAYER_CORPORATE','Meghna Trading Ltd.','মেঘনা ট্রেডিং লিমিটেড','Corporate payment records','কোম্পানির পেমেন্ট রেকর্ড','DEMO-TIN-002','circle-2'),
  ('user3','WITHHOLDING_AGENT','Rupali Textiles Ltd.','রূপালী টেক্সটাইলস লিমিটেড','Source-tax deposit workflow','উৎসে কর জমার প্রক্রিয়া','DEMO-TIN-003','circle-3'),
  ('user4','TAXPAYER_INDIVIDUAL','Nusrat Jahan','নুসরাত জাহান','Business and professional payment records','ব্যবসা ও পেশার পেমেন্ট রেকর্ড','DEMO-TIN-004','circle-4'),
  ('user5','TAXPAYER_INDIVIDUAL','Mahmud Hasan','মাহমুদ হাসান','Assessment-year tracking','করবর্ষভিত্তিক তথ্য অনুসরণ','DEMO-TIN-005','circle-5'),
  ('user6','TAXPAYER_INDIVIDUAL','Farzana Akter','ফারজানা আক্তার','Advance tax and instalment review','অগ্রিম কর ও কিস্তি পর্যালোচনা','DEMO-TIN-006','circle-6'),
  ('user7','TAXPAYER_INDIVIDUAL','Sadia Islam','সাদিয়া ইসলাম','First-time payment','প্রথমবার পেমেন্ট','DEMO-TIN-007','circle-7'),
  ('user8','TAXPAYER_INDIVIDUAL','Tanvir Ahmed','তানভীর আহমেদ','First-time payment','প্রথমবার পেমেন্ট','DEMO-TIN-008','circle-8'),
  ('user9','TAXPAYER_INDIVIDUAL','Imran Hossain','ইমরান হোসেন','First-time payment','প্রথমবার পেমেন্ট','DEMO-TIN-009','circle-9'),
  ('user10','TAXPAYER_INDIVIDUAL','Shaila Parvin','শায়লা পারভীন','First-time payment','প্রথমবার পেমেন্ট','DEMO-TIN-010','circle-10'),
  ('user11','TAXPAYER_INDIVIDUAL','Taxpayer Account 11','করদাতা অ্যাকাউন্ট 11','Income tax heads','বিভিন্ন কর পরিশোধের বিবরণ','DEMO-TIN-011','circle-11'),
  ('user12','TAXPAYER_INDIVIDUAL','Taxpayer Account 12','করদাতা অ্যাকাউন্ট 12','Mixed-year payments','বিভিন্ন কর পরিশোধের বিবরণ','DEMO-TIN-012','circle-12'),
  ('user13','TAXPAYER_INDIVIDUAL','Taxpayer Account 13','করদাতা অ্যাকাউন্ট 13','Travel tax combinations','বিভিন্ন কর পরিশোধের বিবরণ','DEMO-TIN-013','circle-13'),
  ('user14','WITHHOLDING_AGENT','Taxpayer Account 14','করদাতা অ্যাকাউন্ট 14','Multiple-beneficiary payments','বিভিন্ন কর পরিশোধের বিবরণ','DEMO-TIN-014','circle-14'),
  ('user15','TAXPAYER_CORPORATE','Taxpayer Account 15','করদাতা অ্যাকাউন্ট 15','Income tax heads','বিভিন্ন কর পরিশোধের বিবরণ','DEMO-TIN-015','circle-15'),
  ('user16','TAXPAYER_INDIVIDUAL','Taxpayer Account 16','করদাতা অ্যাকাউন্ট 16','Mixed-year payments','বিভিন্ন কর পরিশোধের বিবরণ','DEMO-TIN-016','circle-16'),
  ('user17','TAXPAYER_INDIVIDUAL','Taxpayer Account 17','করদাতা অ্যাকাউন্ট 17','Travel tax combinations','বিভিন্ন কর পরিশোধের বিবরণ','DEMO-TIN-017','circle-17'),
  ('user18','TAXPAYER_INDIVIDUAL','Taxpayer Account 18','করদাতা অ্যাকাউন্ট 18','Multiple-beneficiary payments','বিভিন্ন কর পরিশোধের বিবরণ','DEMO-TIN-018','circle-18'),
  ('user19','TAXPAYER_INDIVIDUAL','Taxpayer Account 19','করদাতা অ্যাকাউন্ট 19','Income tax heads','বিভিন্ন কর পরিশোধের বিবরণ','DEMO-TIN-019','circle-19'),
  ('user20','TAXPAYER_CORPORATE','Taxpayer Account 20','করদাতা অ্যাকাউন্ট 20','Mixed-year payments','বিভিন্ন কর পরিশোধের বিবরণ','DEMO-TIN-020','circle-20'),
  ('user21','WITHHOLDING_AGENT','Taxpayer Account 21','করদাতা অ্যাকাউন্ট 21','Travel tax combinations','বিভিন্ন কর পরিশোধের বিবরণ','DEMO-TIN-021','circle-21'),
  ('user22','TAXPAYER_INDIVIDUAL','Taxpayer Account 22','করদাতা অ্যাকাউন্ট 22','Multiple-beneficiary payments','বিভিন্ন কর পরিশোধের বিবরণ','DEMO-TIN-022','circle-22'),
  ('user23','TAXPAYER_INDIVIDUAL','Taxpayer Account 23','করদাতা অ্যাকাউন্ট 23','Income tax heads','বিভিন্ন কর পরিশোধের বিবরণ','DEMO-TIN-023','circle-23'),
  ('user24','TAXPAYER_INDIVIDUAL','Taxpayer Account 24','করদাতা অ্যাকাউন্ট 24','Mixed-year payments','বিভিন্ন কর পরিশোধের বিবরণ','DEMO-TIN-024','circle-24'),
  ('user25','TAXPAYER_CORPORATE','Taxpayer Account 25','করদাতা অ্যাকাউন্ট 25','Travel tax combinations','বিভিন্ন কর পরিশোধের বিবরণ','DEMO-TIN-025','circle-25'),
  ('user26','TAXPAYER_INDIVIDUAL','Taxpayer Account 26','করদাতা অ্যাকাউন্ট 26','Multiple-beneficiary payments','বিভিন্ন কর পরিশোধের বিবরণ','DEMO-TIN-026','circle-26'),
  ('user27','TAXPAYER_INDIVIDUAL','Taxpayer Account 27','করদাতা অ্যাকাউন্ট 27','Income tax heads','বিভিন্ন কর পরিশোধের বিবরণ','DEMO-TIN-027','circle-27'),
  ('user28','WITHHOLDING_AGENT','Taxpayer Account 28','করদাতা অ্যাকাউন্ট 28','Mixed-year payments','বিভিন্ন কর পরিশোধের বিবরণ','DEMO-TIN-028','circle-28'),
  ('user29','TAXPAYER_INDIVIDUAL','Taxpayer Account 29','করদাতা অ্যাকাউন্ট 29','Travel tax combinations','বিভিন্ন কর পরিশোধের বিবরণ','DEMO-TIN-029','circle-29'),
  ('user30','TAXPAYER_CORPORATE','Taxpayer Account 30','করদাতা অ্যাকাউন্ট 30','Multiple-beneficiary payments','বিভিন্ন কর পরিশোধের বিবরণ','DEMO-TIN-030','circle-30')
  on conflict (id) do nothing;
  insert into taxpay_guest_private.demo_profiles(demo_id)
  select 'user'||n from generate_series(2,30) n
  on conflict (demo_id) do nothing;

  if (select count(*) from taxpay_guest_private.demo_profiles
       where demo_id ~ '^user([1-9]|[12][0-9]|30)$')<>30
     or (select count(*) from public.sim_payment_users
       where id ~ '^user([1-9]|[12][0-9]|30)$')<>30
  then raise exception 'Expected exactly thirty fictional profiles'; end if;

  select s.id into strict owner_session
  from taxpay_guest_private.demo_profiles d
  join taxpay_guest_private.sessions s
    on s.capability_hash=encode(
      extensions.digest(convert_to(d.capability_token,'UTF8'),'sha256'),'hex')
  where d.demo_id='user1' and s.expires_at>now();

  for grp in select * from jsonb_to_recordset(
    '[{"key":"clients","display":"Corporate Clients","category":"clients","recipient_numbers":[30,2,20,25]},{"key":"professional_contacts","display":"Professional Contacts","category":"clients","recipient_numbers":[15,21,3,28]},{"key":"parents_siblings","display":"Parents & Siblings","category":"friends_family","recipient_numbers":[16,26,17,11]},{"key":"spouse_children","display":"Spouse & Children","category":"friends_family","recipient_numbers":[27,19,13,7]},{"key":"friends","display":"Friends","category":"friends_family","recipient_numbers":[18,8,5,23]},{"key":"other_contacts","display":"Other Contacts","category":"others","recipient_numbers":[9,29,4,22]}]'::jsonb
  ) as x(key text,display text,category text,recipient_numbers jsonb)
  loop
    select li.id into current_list
    from taxpay_guest_private.lists li
    where li.session_id=owner_session and li.name=grp.display
    order by li.id limit 1;
    if current_list is null then
      insert into taxpay_guest_private.lists(session_id,name)
      values(owner_session,grp.display) returning id into current_list;
    end if;
    for person in select * from jsonb_to_recordset(
      '[{"recipient_preview_id":"user30","display_name":"Taxpayer Account 30","tin_alias":"909000000030","tag":"clients","relationship":null,"other_label":null,"list_key":"clients"},{"recipient_preview_id":"user2","display_name":"Meghna Trading Ltd.","tin_alias":"222222222222","tag":"clients","relationship":null,"other_label":null,"list_key":"clients"},{"recipient_preview_id":"user20","display_name":"Taxpayer Account 20","tin_alias":"909000000020","tag":"clients","relationship":null,"other_label":null,"list_key":"clients"},{"recipient_preview_id":"user25","display_name":"Taxpayer Account 25","tin_alias":"909000000025","tag":"clients","relationship":null,"other_label":null,"list_key":"clients"},{"recipient_preview_id":"user15","display_name":"Taxpayer Account 15","tin_alias":"909000000015","tag":"clients","relationship":null,"other_label":null,"list_key":"professional_contacts"},{"recipient_preview_id":"user21","display_name":"Taxpayer Account 21","tin_alias":"909000000021","tag":"clients","relationship":null,"other_label":null,"list_key":"professional_contacts"},{"recipient_preview_id":"user3","display_name":"Rupali Textiles Ltd.","tin_alias":"333333333333","tag":"clients","relationship":null,"other_label":null,"list_key":"professional_contacts"},{"recipient_preview_id":"user28","display_name":"Taxpayer Account 28","tin_alias":"909000000028","tag":"clients","relationship":null,"other_label":null,"list_key":"professional_contacts"},{"recipient_preview_id":"user16","display_name":"Taxpayer Account 16","tin_alias":"909000000016","tag":"friends_family","relationship":"father","other_label":null,"list_key":"parents_siblings"},{"recipient_preview_id":"user26","display_name":"Taxpayer Account 26","tin_alias":"909000000026","tag":"friends_family","relationship":"mother","other_label":null,"list_key":"parents_siblings"},{"recipient_preview_id":"user17","display_name":"Taxpayer Account 17","tin_alias":"909000000017","tag":"friends_family","relationship":"siblings","other_label":null,"list_key":"parents_siblings"},{"recipient_preview_id":"user11","display_name":"Taxpayer Account 11","tin_alias":"909000000011","tag":"friends_family","relationship":"siblings","other_label":null,"list_key":"parents_siblings"},{"recipient_preview_id":"user27","display_name":"Taxpayer Account 27","tin_alias":"909000000027","tag":"friends_family","relationship":"spouse","other_label":null,"list_key":"spouse_children"},{"recipient_preview_id":"user19","display_name":"Taxpayer Account 19","tin_alias":"909000000019","tag":"friends_family","relationship":"son","other_label":null,"list_key":"spouse_children"},{"recipient_preview_id":"user13","display_name":"Taxpayer Account 13","tin_alias":"909000000013","tag":"friends_family","relationship":"daughter","other_label":null,"list_key":"spouse_children"},{"recipient_preview_id":"user7","display_name":"Sadia Islam","tin_alias":"777777777777","tag":"friends_family","relationship":"spouse","other_label":null,"list_key":"spouse_children"},{"recipient_preview_id":"user18","display_name":"Taxpayer Account 18","tin_alias":"909000000018","tag":"friends_family","relationship":"friends","other_label":null,"list_key":"friends"},{"recipient_preview_id":"user8","display_name":"Tanvir Ahmed","tin_alias":"888888888888","tag":"friends_family","relationship":"friends","other_label":null,"list_key":"friends"},{"recipient_preview_id":"user5","display_name":"Mahmud Hasan","tin_alias":"555555555555","tag":"friends_family","relationship":"friends","other_label":null,"list_key":"friends"},{"recipient_preview_id":"user23","display_name":"Taxpayer Account 23","tin_alias":"909000000023","tag":"friends_family","relationship":"friends","other_label":null,"list_key":"friends"},{"recipient_preview_id":"user9","display_name":"Imran Hossain","tin_alias":"999999999999","tag":"others","relationship":null,"other_label":"Neighbor","list_key":"other_contacts"},{"recipient_preview_id":"user29","display_name":"Taxpayer Account 29","tin_alias":"909000000029","tag":"others","relationship":null,"other_label":"Colleague","list_key":"other_contacts"},{"recipient_preview_id":"user4","display_name":"Nusrat Jahan","tin_alias":"444444444444","tag":"others","relationship":null,"other_label":"Community contact","list_key":"other_contacts"},{"recipient_preview_id":"user22","display_name":"Taxpayer Account 22","tin_alias":"909000000022","tag":"others","relationship":null,"other_label":"Professional contact","list_key":"other_contacts"}]'::jsonb
    ) as p(recipient_preview_id text,display_name text,tin_alias text,
           tag text,relationship text,other_label text,list_key text)
      where p.list_key=grp.key
    loop
      insert into taxpay_guest_private.beneficiaries(
        session_id,list_id,tin,display_name,tag,relationship,other_label)
      values(owner_session,current_list,person.tin_alias,
             person.display_name,person.tag,person.relationship,person.other_label)
      on conflict(list_id,tin) do nothing;
      if not exists (
        select 1 from taxpay_guest_private.beneficiaries saved
        where saved.list_id=current_list and saved.session_id=owner_session
          and saved.tin=person.tin_alias
          and saved.display_name=person.display_name
          and saved.tag=person.tag
          and saved.relationship is not distinct from person.relationship
          and saved.other_label is not distinct from person.other_label
      ) then raise exception 'Phase2 mismatch: %',person.recipient_preview_id; end if;
    end loop;
    if (select count(*) from taxpay_guest_private.beneficiaries
         where session_id=owner_session and list_id=current_list)<>4
    then raise exception 'Expected four in list %',grp.display; end if;
  end loop;

  select count(*) into missing_count
  from taxpay_guest_private.beneficiaries saved
  join taxpay_guest_private.lists li on saved.list_id=li.id
  where li.session_id=owner_session and li.name=any(array[
    'Corporate Clients','Professional Contacts','Parents & Siblings',
    'Spouse & Children','Friends','Other Contacts']);
  if missing_count<>24 then raise exception 'Expected 24, found %',missing_count; end if;
end
$phase2$;
