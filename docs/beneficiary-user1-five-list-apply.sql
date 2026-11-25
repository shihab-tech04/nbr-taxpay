-- Controller-only transaction block. NOT an automatic migration.
-- First obtain and independently restore the private recovery export from
-- beneficiary-user1-recovery-snapshot.sql, then begin a READ COMMITTED transaction
-- with SET LOCAL TIME ZONE 'UTC'; SET LOCAL lock_timeout='5s';
-- set_config('taxpay.user1_recovery_sha256', '<restored snapshot digest>', true).
-- Review all gates; run this block in that transaction; commit only on success.
-- A missing/incorrect digest, unexpected group set, stale preference or collision
-- fails closed before any delete. Never reuse one DB's digest for the other DB.
do $reconcile$
declare
  v_expected text:=current_setting('taxpay.user1_recovery_sha256',true);
  v_session uuid;
  v_selected uuid;
  v_profile_updated timestamptz;
  v_snapshot jsonb;
  v_before_members jsonb;
  v_before_survivors jsonb;
  v_after_members jsonb;
  v_after_survivors jsonb;
  v_survivors constant text[]:=array['Corporate Clients','Friends','Other Contacts','Parents & Siblings','Spouse & Children'];
  v_sources text[];
  v_source_ids uuid[];
  v_targets jsonb;
  v_moved int;
  v_planned int;
  v_deleted int;
begin
  if coalesce(v_expected,'') !~ '^[0-9a-f]{64}$' or
     current_setting('transaction_isolation') <> 'read committed' or
     current_setting('TimeZone') <> 'UTC' then
    raise exception 'USER1_RECONCILIATION_RECOVERY_REQUIRED';
  end if;
  perform set_config('lock_timeout','5s',true);
  -- Guest RPCs lock/touch the owning session before accessing lists or profile
  -- settings. Lock the same row first, then verify the profile still owns it.
  select s.id into strict v_session
    from taxpay_guest_private.demo_profiles p
    join taxpay_guest_private.sessions s on s.capability_hash=
      encode(extensions.digest(convert_to(p.capability_token,'UTF8'),'sha256'),'hex')
    where p.demo_id='user1';
  perform 1 from taxpay_guest_private.sessions where id=v_session for update;
  if not found then raise exception 'USER1_SESSION_CHANGED'; end if;
  select p.selected_list_id,p.updated_at into strict v_selected,v_profile_updated
    from taxpay_guest_private.demo_profiles p
    join taxpay_guest_private.sessions s on s.capability_hash=
      encode(extensions.digest(convert_to(p.capability_token,'UTF8'),'sha256'),'hex')
   where p.demo_id='user1' and s.id=v_session for update of p;
  perform 1 from taxpay_guest_private.lists where session_id=v_session order by id for update;
  perform 1 from taxpay_guest_private.beneficiaries where session_id=v_session order by id for update;
  select jsonb_build_object('session_id',v_session,
    'lists',coalesce((select jsonb_agg(to_jsonb(l) order by l.id)
                       from taxpay_guest_private.lists l where l.session_id=v_session),'[]'::jsonb),
    'beneficiaries',coalesce((select jsonb_agg(to_jsonb(b) order by b.id)
                               from taxpay_guest_private.beneficiaries b where b.session_id=v_session),'[]'::jsonb),
    'selected_list_id',v_selected,'profile_updated_at',v_profile_updated)
    into v_snapshot;
  if encode(extensions.digest(convert_to(v_snapshot::text,'UTF8'),'sha256'),'hex')<>v_expected then
    raise exception 'USER1_RECOVERY_SNAPSHOT_CHANGED';
  end if;
  -- Require the exact original or V2 list set, never infer a target for a
  -- new name. Keep both databases' identities and duplicate memberships.
  if exists(select 1 from taxpay_guest_private.lists where session_id=v_session and name='Family') then
    v_sources:=array['Family','Professional Contacts','client','Kuddus'];
  else
    v_sources:=array['family','Professional Contacts','customer','QA-User1-20261121'];
  end if;
  if (select count(*) from taxpay_guest_private.lists where session_id=v_session)<>9
     or (select count(*) from taxpay_guest_private.lists where session_id=v_session and name=any(v_survivors))<>5
     or (select count(*) from taxpay_guest_private.lists where session_id=v_session and name=any(v_sources))<>4
     or (v_selected is not null and not exists(select 1 from taxpay_guest_private.lists where session_id=v_session and id=v_selected)) then
    raise exception 'USER1_GROUP_SET_OR_PREFERENCE_CHANGED';
  end if;
  select array_agg(src.id order by src.id),jsonb_object_agg(src.id::text,dst.id)
    into v_source_ids,v_targets
    from taxpay_guest_private.lists src
    left join taxpay_guest_private.lists dst on dst.session_id=v_session and dst.name=
      case when lower(src.name)='family' then 'Parents & Siblings'
        when src.name='Professional Contacts' then 'Corporate Clients'
        when src.name in ('client','QA-User1-20261121') then 'Other Contacts' end
   where src.session_id=v_session and src.name=any(v_sources);
  if exists(select 1 from taxpay_guest_private.beneficiaries b
       join taxpay_guest_private.lists src on src.id=b.list_id and src.session_id=b.session_id
       where b.session_id=v_session and b.list_id=any(v_source_ids)
         and ((v_targets->>b.list_id::text) is null or
           (src.name='QA-User1-20261121' and b.tag is distinct from 'others'))) then
    raise exception 'USER1_UNMAPPED_MEMBERSHIP';
  end if;
  if exists(select 1 from taxpay_guest_private.beneficiaries b where b.session_id=v_session
      group by coalesce((v_targets->>b.list_id::text)::uuid,b.list_id),b.tin having count(*)>1) then
    raise exception 'USER1_DESTINATION_COLLISION';
  end if;
  select coalesce(jsonb_agg(to_jsonb(b)-'list_id' order by b.id),'[]'::jsonb)
    into v_before_members from taxpay_guest_private.beneficiaries b where b.session_id=v_session;
  select coalesce(jsonb_agg(to_jsonb(l) order by l.id),'[]'::jsonb)
    into v_before_survivors from taxpay_guest_private.lists l where l.session_id=v_session and l.name=any(v_survivors);
  select count(*) into v_planned from taxpay_guest_private.beneficiaries b
    where b.session_id=v_session and b.list_id=any(v_source_ids);
  update taxpay_guest_private.beneficiaries b
    set list_id=(v_targets->>b.list_id::text)::uuid
    where b.session_id=v_session and b.list_id=any(v_source_ids)
      and (v_targets->>b.list_id::text) is not null;
  get diagnostics v_moved=row_count;
  if v_moved<>v_planned then raise exception 'USER1_TRANSFER_COUNT_MISMATCH'; end if;
  if v_selected=any(v_source_ids) then
    update taxpay_guest_private.demo_profiles set selected_list_id=(v_targets->>v_selected::text)::uuid,updated_at=now()
      where demo_id='user1';
  end if;
  delete from taxpay_guest_private.lists l where l.session_id=v_session and l.id=any(v_source_ids)
    and not exists(select 1 from taxpay_guest_private.beneficiaries b where b.session_id=v_session and b.list_id=l.id);
  get diagnostics v_deleted=row_count;
  select coalesce(jsonb_agg(to_jsonb(b)-'list_id' order by b.id),'[]'::jsonb)
    into v_after_members from taxpay_guest_private.beneficiaries b where b.session_id=v_session;
  select coalesce(jsonb_agg(to_jsonb(l) order by l.id),'[]'::jsonb)
    into v_after_survivors from taxpay_guest_private.lists l where l.session_id=v_session;
  if v_deleted<>4 or v_after_members<>v_before_members or v_after_survivors<>v_before_survivors
     or (select count(*) from taxpay_guest_private.lists where session_id=v_session)<>5
     or exists(select 1 from taxpay_guest_private.demo_profiles p where p.demo_id='user1'
         and p.selected_list_id is not null and not exists(select 1 from taxpay_guest_private.lists l where l.id=p.selected_list_id and l.session_id=v_session))
     or exists(select 1 from jsonb_array_elements(v_snapshot->'beneficiaries') oldrow
         where not exists(select 1 from taxpay_guest_private.beneficiaries b where b.session_id=v_session
          and b.id=(oldrow->>'id')::uuid and b.list_id=coalesce((v_targets->>(oldrow->>'list_id'))::uuid,(oldrow->>'list_id')::uuid))) then
    raise exception 'USER1_RECONCILIATION_PRESERVATION_FAILED';
  end if;
  raise notice 'PASS: User1 scoped reconciliation, % moved, % empty groups removed, % memberships preserved',
    v_moved,v_deleted,jsonb_array_length(v_before_members);
end;
$reconcile$;
