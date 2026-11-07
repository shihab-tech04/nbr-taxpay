-- Idempotent, non-financial 30-persona payment coverage; user1 is primary.
-- 4 examples for each of 8 service groups (32 user1), plus one self-payment per user2..30.
-- Uses approved catalogue heads (skips BLOCKED), existing ACTIVE delegation only.
do $seed$
declare uid int;si int;combo int;li int;lim int;h int;amt bigint;total bigint;
 actor text;sess uuid;chash text;pname text;tin text;svc text;yr text;receiver text;
 heads int[];auth uuid;payment_lines jsonb;passengers jsonb;detail jsonb;inp jsonb;ack jsonb;line jsonb;
 meta constant jsonb:='{"1":{"name":"Tax with Return - Individual Taxpayers (Section 173)","code":"1-1141-0010-0101"},"2":{"name":"Tax with Return - Company & Corporate Taxpayers (Section 173)","code":"1-1141-0010-0102"},"3":{"name":"Tax with Return - Partnership Firms & AOP (Section 173)","code":"1-1141-0010-0103"},"4":{"name":"Tax with Return - Non-Resident Foreign Individuals & Entities","code":"1-1141-0010-0104"},"11":{"name":"Advance Tax - 1st Quarter Installment (Section 154)","code":"1-1141-0015-0201"},"12":{"name":"Advance Tax - 2nd Quarter Installment (Section 154)","code":"1-1141-0015-0202"},"13":{"name":"Advance Tax - 3rd Quarter Installment (Section 154)","code":"1-1141-0015-0203"},"14":{"name":"Advance Tax - 4th Quarter Installment (Section 154)","code":"1-1141-0015-0204"},"26":{"name":"Assessed Demand under Section 214 (Regular Assessment)","code":"1-1141-0020-0301"},"27":{"name":"Assessed Demand under Section 212 (Best Judgment Assessment)","code":"1-1141-0020-0302"},"28":{"name":"Demand from Reopening / Escaped Assessment (Section 216)","code":"1-1141-0020-0303"},"29":{"name":"Demand Arising from Audit Order under Section 213","code":"1-1141-0020-0304"},"41":{"name":"Penalty for Failure to File Tax Return on Time (Section 266)","code":"1-1141-0025-0401"},"42":{"name":"Penalty for Concealment of Income or Assets (Section 269)","code":"1-1141-0025-0402"},"43":{"name":"Penalty for Failure to Pay Advance Tax / Default (Section 267)","code":"1-1141-0025-0403"},"44":{"name":"Penalty for Failure to Maintain Books of Accounts (Section 268)","code":"1-1141-0025-0404"},"56":{"name":"TDS on Salary & Employment Benefits (Section 86)","code":"1-1141-0030-0501"},"57":{"name":"TDS on Remuneration to Foreign Technicians / Expatriates (Section 87)","code":"1-1141-0030-0502"},"58":{"name":"TDS on Interest / Profit on Securities & Bonds (Section 88)","code":"1-1141-0030-0503"},"59":{"name":"TDS on Supply of Goods, Execution of Contracts (Section 89)","code":"1-1141-0030-0504"},"136":{"name":"Appellate Tribunal Statutory Deposit (10% of Assessed Tax - Section 300)","code":"1-1141-0035-0601"},"137":{"name":"Appellate Tribunal Formal Filing Fee (Section 300)","code":"1-1141-0035-0602"},"138":{"name":"Appellate Tribunal Miscellaneous Hearing Petition Fee","code":"1-1141-0035-0603"},"139":{"name":"Appellate Tribunal Certified True Copy Inspection & Paperbook Fee","code":"1-1141-0035-0604"},"149":{"name":"Surcharge on High Net Wealth Individual Taxpayers (Wealth > ৳ 4 Cr)","code":"1-1141-0040-0701"},"151":{"name":"Foreign Travel Tax - Air Passengers (North America / Europe / Oceania)","code":"1-1141-0040-0703"},"152":{"name":"Foreign Travel Tax - Air Passengers (SAARC & Asian Countries)","code":"1-1141-0040-0704"},"153":{"name":"Foreign Travel Tax - Land Border Outposts (India, Myanmar)","code":"1-1141-0040-0705"},"154":{"name":"Foreign Travel Tax - Sea Port & Maritime Departure","code":"1-1141-0040-0706"},"156":{"name":"Tax on Tobacco & Nicotine Marketing Surcharge","code":"1-1141-0040-0708"},"157":{"name":"Special Corporate Social Responsibility (CSR) Non-Compliance Tax","code":"1-1141-0040-0709"},"158":{"name":"Tax on Capital Gains from Transfer of Listed Securities (Section 165)","code":"1-1141-0040-0710"}}'::jsonb;
 names constant text[]:=array['TAX_WITH_RETURN','ADVANCE_TAX','ASSESSED_DEMAND','PENALTY','SOURCE_TAX_DEPOSIT','APPELLATE_TRIBUNAL','OTHER_TAX_PAYMENT','TRAVEL_TAX'];
 batch constant text:='TAXPAY-20261107-30-PROFILE-COVERAGE';
begin
 select id into auth from public.demo_authorization_requests where payer_id='user1' and taxpayer_id='user4' and status='ACTIVE' limit 1;
 if auth is null then raise exception 'No approved user1-to-user4 authorization';end if;
 for uid in 1..30 loop
  actor:='user'||uid;
  select payment_session_id,encode(extensions.digest(convert_to(capability_token,'UTF8'),'sha256'),'hex')
    into sess,chash from taxpay_guest_private.demo_profiles where demo_id=actor;
  select name_en into pname from public.sim_payment_users where id=actor;
  if sess is null or chash is null or pname is null then raise exception 'Missing %',actor;end if;
  tin:=case when uid<=9 then repeat(uid::text,13) when uid=10 then '1010101010101' else '90000000'||lpad(uid::text,5,'0') end;
  for si in 1..8 loop
   if uid>1 and si<>mod(uid-2,8)+1 then continue;end if;
   svc:=names[si];
   heads:=case si when 1 then array[1,2,3,4] when 2 then array[11,12,13,14] when 3 then array[26,27,28,29] when 4 then array[41,42,43,44] when 5 then array[56,57,58,59] when 6 then array[136,137,138,139] when 7 then array[149,156,157,158] when 8 then array[151,152,153,154] end;
   for combo in 0..3 loop
    if uid>1 and combo>0 then exit;end if;
    lim:=combo+1;total:=0;payment_lines:='[]'::jsonb;passengers:='[]'::jsonb;
    for li in 1..lim loop
     h:=heads[li];amt:=60000+si*7100+combo*3400+li*1300+uid*101;total:=total+amt;
     receiver:=case when uid=1 and svc<>'TRAVEL_TAX' and combo>=2 and li=2 then 'user4' else actor end;
     yr:=case when li=2 and svc<>'TRAVEL_TAX' then '2025-26' else '2026-27' end;
     line:=jsonb_build_object('beneficiary',receiver,'category',svc,'assessmentYear',yr,
       'amountMinor',amt,'headId',h,'headNameEn',meta->h::text->>'name',
       'economicCode',meta->h::text->>'code','taxAmount',amt::numeric/100,
       'totalAmount',amt::numeric/100,'penaltyAmount',0,'surchargeAmount',0,'interestAmount',0,
       'note','Synthetic coverage only, no government payment');
     if receiver<>actor then line:=line||jsonb_build_object('authorizationId',auth);end if;
     payment_lines:=payment_lines||jsonb_build_array(line);
     if svc='TRAVEL_TAX' then
      passengers:=passengers||jsonb_build_array(jsonb_build_object('name','SAMPLE TRAVELLER '||li,
        'passportMasked','••••'||lpad((combo*10+li)::text,4,'0'),
        'nationality','BD','country','Bangladesh','age',25+li,'ageBand','ADULT','amount',amt::numeric/100));
     end if;
    end loop;
    detail:=jsonb_build_object('fixtureBatch',batch,'scenario',combo+1,'sampleOnly',true,
     'payerId',actor,'payerName',pname,'taxpayerTin',tin,
     'payerMode',case when uid=1 and svc<>'TRAVEL_TAX' and combo>=2 then 'OTHER' else 'SELF' end,
     'assessmentYear','2026-27','lines',payment_lines,
     'paymentMethod',case combo when 0 then 'BKASH' when 1 then 'NAGAD' when 2 then 'VISA' else 'BANK_BRANCH' end,
     'paymentChannel',case when combo=3 then 'OTC' else 'NOW' end,
     'receiptReference','SAMPLE-'||upper(substr(md5(batch||actor||svc||combo::text),1,16)));
    if svc='TRAVEL_TAX' then
     detail:=detail||jsonb_build_object(
      'travelMode',case combo when 0 then 'LAND' when 1 then 'WATER' else 'AIR' end,
      'travelRoute',case combo when 0 then 'LAND' when 1 then 'WATER' else 'AIR' end,
      'travelDate','2026-11-21','destination',case combo when 0 then 'India' when 1 then 'Sri Lanka' else 'Malaysia' end,
      'departurePort',case combo when 0 then 'Benapole' when 1 then 'Chattogram Seaport' else 'Dhaka Airport' end,
      'passengers',passengers,'passengerName','SAMPLE TRAVELLER 1','passportNumberMasked','••••0001');
    end if;
    inp:=jsonb_build_object('origin','TAXPAY_UI','idempotencyKey',(md5(batch||actor||svc||combo::text)::uuid)::text,
      'sessionId',sess::text,'service',svc,'amountMinor',total,'details',detail);
    ack:=public.taxpay_demo_story1_submit(chash,inp);
    if ack->>'status'<>'SIMULATED_SUCCESS' then raise exception 'Unconfirmed scenario % % %',actor,svc,combo;end if;
   end loop;
  end loop;
 end loop;
 if (select count(*) from demo_payment.story_payments where data->'details'->>'fixtureBatch'=batch)<>61
 then raise exception 'Expected 61 saved scenarios';end if;
end;
$seed$;
