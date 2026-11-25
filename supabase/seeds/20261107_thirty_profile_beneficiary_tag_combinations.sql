-- Non-destructive, repeatable scenario-only beneficiary coverage for all 30
-- already registered TaxPay preview profiles. Never touches public Auth users
-- or guest sessions unrelated to taxpay_guest_private.demo_profiles.
-- All TINs are fictional 12-digit lookup aliases matching sampleTinSuggestions.ts.
DO $seed$
DECLARE
  profile RECORD;
  owner_no INTEGER;
  target_no INTEGER;
  item_no INTEGER;
  category_no INTEGER;
  offset_no INTEGER;
  item_count INTEGER;
  current_list UUID;
  beneficiary_session UUID;
  v_capability_hash TEXT;
  list_name TEXT;
  source_tin TEXT;
  source_name TEXT;
  source_tag TEXT;
  source_relation TEXT;
  source_other TEXT;
  family_relations CONSTANT TEXT[] := ARRAY['father','mother','siblings','son','daughter','spouse'];
  other_labels CONSTANT TEXT[] := ARRAY['Colleague','Neighbor','Vendor','Community'];
BEGIN
  IF (SELECT count(*) FROM taxpay_guest_private.demo_profiles) <> 30 THEN
    RAISE EXCEPTION 'Expected exactly 30 existing demo profiles before seeding';
  END IF;
  FOR profile IN SELECT demo_id,capability_token
    FROM taxpay_guest_private.demo_profiles ORDER BY demo_id LOOP
    owner_no := substring(profile.demo_id FROM 5)::INTEGER;
    -- Story payment session IDs are not valid beneficiary-list FK targets.
    -- Use this preview profile's hashed capability and existing guest open RPC.
    v_capability_hash := encode(extensions.digest(convert_to(profile.capability_token,'UTF8'),'sha256'),'hex');
    PERFORM public.taxpay_guest_beneficiary_open(v_capability_hash);
    SELECT guest_session.id INTO beneficiary_session
      FROM taxpay_guest_private.sessions AS guest_session
      WHERE guest_session.capability_hash=v_capability_hash AND guest_session.expires_at>now();
    IF beneficiary_session IS NULL THEN
      RAISE EXCEPTION 'Missing authorized beneficiary session for %',profile.demo_id;
    END IF;
    FOR category_no IN 1..4 LOOP
      list_name := CASE category_no WHEN 1 THEN 'Family'
        WHEN 2 THEN 'Friends' WHEN 3 THEN 'Clients' ELSE 'Others' END;
      offset_no := CASE category_no WHEN 1 THEN 0
        WHEN 2 THEN 6 WHEN 3 THEN 9 ELSE 15 END;
      item_count := CASE category_no WHEN 1 THEN 6
        WHEN 2 THEN 3 WHEN 3 THEN 6 ELSE 4 END;
      SELECT id INTO current_list
      FROM taxpay_guest_private.lists
      WHERE session_id=beneficiary_session AND name=list_name
      ORDER BY created_at,id LIMIT 1;
      IF current_list IS NULL THEN
        INSERT INTO taxpay_guest_private.lists(session_id,name)
        VALUES(beneficiary_session,list_name) RETURNING id INTO current_list;
      END IF;
      FOR item_no IN 1..item_count LOOP
        target_no := ((owner_no + offset_no + item_no - 1) % 30) + 1;
        source_tin := CASE
          WHEN target_no=10 THEN repeat('0',12)
          WHEN target_no<10 THEN repeat(target_no::TEXT,12)
          ELSE '9090000000' || lpad(target_no::TEXT,2,'0') END;
        source_tag := CASE category_no WHEN 1 THEN 'friends_family'
          WHEN 2 THEN 'friends_family' WHEN 3 THEN 'clients' ELSE 'others' END;
        source_relation := CASE category_no WHEN 1 THEN family_relations[item_no]
          WHEN 2 THEN 'friends' ELSE NULL END;
        source_other := CASE WHEN category_no=4 THEN other_labels[item_no] ELSE NULL END;
        IF target_no<=10 THEN
          source_name := 'User '||target_no::TEXT;
        ELSE
          SELECT name_en INTO source_name FROM public.sim_payment_users
          WHERE id='user'||target_no::TEXT;
        END IF;
        IF length(source_tin)<>12 OR source_name IS NULL THEN
          RAISE EXCEPTION 'Invalid seeded beneficiary %',target_no;
        END IF;
        INSERT INTO taxpay_guest_private.beneficiaries
          (session_id,list_id,tin,display_name,tag,relationship,other_label)
        VALUES(beneficiary_session,current_list,source_tin,source_name,
          source_tag,source_relation,source_other)
        ON CONFLICT (list_id,tin) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
  IF (SELECT count(*) FROM taxpay_guest_private.lists l
        JOIN taxpay_guest_private.sessions gs ON gs.id=l.session_id
        JOIN taxpay_guest_private.demo_profiles d
          ON gs.capability_hash=encode(extensions.digest(convert_to(d.capability_token,'UTF8'),'sha256'),'hex')
        WHERE l.name IN ('Family','Friends','Clients','Others'))<120 THEN
    RAISE EXCEPTION 'Beneficiary scenario list coverage incomplete';
  END IF;
  IF (SELECT count(*) FROM taxpay_guest_private.beneficiaries b
        JOIN taxpay_guest_private.sessions gs ON gs.id=b.session_id
        JOIN taxpay_guest_private.demo_profiles d
          ON gs.capability_hash=encode(extensions.digest(convert_to(d.capability_token,'UTF8'),'sha256'),'hex')
        JOIN taxpay_guest_private.lists l ON l.id=b.list_id
        WHERE l.name IN ('Family','Friends','Clients','Others'))<570 THEN
    RAISE EXCEPTION 'Beneficiary scenario relationship coverage incomplete';
  END IF;
END;
$seed$;