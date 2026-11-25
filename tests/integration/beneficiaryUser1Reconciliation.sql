-- Disposable-only fixture. Called before installing the new five-list trigger.
-- No private hosted data, no account credentials, no payment writes.
begin;
set local time zone 'UTC';
select set_config('taxpay.test_user1_variant', :'user1_variant', true);
do $fixture$
declare
 v_session uuid;
 v_variant text:=current_setting('taxpay.test_user1_variant');
 v_family text;
 v_extra text;
 v_empty text;
begin
 if v_variant not in ('original','v2') then raise exception 'Invalid fixture variant'; end if;
 v_family:=case when v_variant='original' then 'Family' else 'family' end;
 v_extra:=case when v_variant='original' then 'client' else 'QA-User1-20261121' end;
 v_empty:=case when v_variant='original' then 'Kuddus' else 'customer' end;
 insert into taxpay_guest_private.sessions(capability_hash)
  select encode(extensions.digest(convert_to(capability_token,'UTF8'),'sha256'),'hex')
    from taxpay_guest_private.demo_profiles where demo_id='user1'
 on conflict(capability_hash) do nothing;
 select s.id into strict v_session from taxpay_guest_private.sessions s
 join taxpay_guest_private.demo_profiles p on s.capability_hash=
    encode(extensions.digest(convert_to(p.capability_token,'UTF8'),'sha256'),'hex')
 where p.demo_id='user1';
 if exists(select 1 from taxpay_guest_private.lists where session_id=v_session) then
    raise exception 'Fixture must start with empty disposable User1 book';
 end if;
 insert into taxpay_guest_private.lists(session_id,name)
 select v_session,unnest(array['Corporate Clients','Friends','Other Contacts','Parents & Siblings','Spouse & Children',
  v_family,'Professional Contacts',v_extra,v_empty]);
 insert into taxpay_guest_private.beneficiaries(session_id,list_id,tin,display_name,tag,relationship,other_label)
 select v_session,l.id,x.tin,x.name,x.tag,x.relationship,x.other_label
 from (values
   (v_family,'012345678901','Synthetic family','friends_family','father',null),
   ('Professional Contacts','222222222222','Synthetic client','clients',null,null),
   (v_extra,'333333333333','Synthetic extra','others',null,'Neighbour'),
   ('Friends','222222222222','Duplicate in distinct list','friends_family','friend',null)
 ) x(listname,tin,name,tag,relationship,other_label)
 join taxpay_guest_private.lists l on l.session_id=v_session and l.name=x.listname;
 update taxpay_guest_private.demo_profiles set selected_list_id=(select id from taxpay_guest_private.lists
    where session_id=v_session and name=v_extra) where demo_id='user1';
end;
$fixture$;
-- Obtain the exact private-export digest in the same UTC fixture transaction.
-- gset consumes the rows rather than emitting private JSON in CI logs.
\ir ../../docs/beneficiary-user1-recovery-snapshot-gset.sql
select set_config('taxpay.user1_recovery_sha256', :'snapshot_sha256', true);
\ir ../../docs/beneficiary-user1-five-list-apply.sql
do $assert$
declare v_session uuid;
begin
 select s.id into strict v_session from taxpay_guest_private.sessions s
 join taxpay_guest_private.demo_profiles p on s.capability_hash=
  encode(extensions.digest(convert_to(p.capability_token,'UTF8'),'sha256'),'hex')
 where p.demo_id='user1';
 if (select count(*) from taxpay_guest_private.lists where session_id=v_session)<>5
    or (select count(*) from taxpay_guest_private.beneficiaries where session_id=v_session)<>4
    or (select count(distinct tin) from taxpay_guest_private.beneficiaries where session_id=v_session)<>3
    or not exists(select 1 from taxpay_guest_private.beneficiaries b join taxpay_guest_private.lists l on l.id=b.list_id
      where b.session_id=v_session and b.tin='333333333333' and b.tag='others' and b.other_label='Neighbour' and l.name='Other Contacts')
    or not exists(select 1 from taxpay_guest_private.beneficiaries b join taxpay_guest_private.lists l on l.id=b.list_id
      where b.session_id=v_session and b.tin='012345678901' and b.relationship='father' and l.name='Parents & Siblings')
    or not exists(select 1 from taxpay_guest_private.demo_profiles p join taxpay_guest_private.lists l on l.id=p.selected_list_id
      where p.demo_id='user1' and l.session_id=v_session and l.name='Other Contacts') then
   raise exception 'User1 reconciliation fixture readback mismatch';
 end if;
end;
$assert$;
rollback;
\echo 'PASS: User1 snapshot-bound consolidation fixture, owner/identity/classification preserved'
