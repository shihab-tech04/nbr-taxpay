-- Private, read-only recovery export. Run in a UTC READ ONLY transaction.
-- Save the exact snapshot_text bytes privately outside the database, verify
-- sha256 and restore every list/member/preference before invoking the apply block.
-- Never put this result (which contains private address-book rows) in GitHub.
with owner_session as (
  select s.id,p.selected_list_id,p.updated_at
    from taxpay_guest_private.demo_profiles p
    join taxpay_guest_private.sessions s
      on s.capability_hash=encode(extensions.digest(convert_to(p.capability_token,'UTF8'),'sha256'),'hex')
   where p.demo_id='user1'
), snapshot as (
  select jsonb_build_object('session_id',o.id,
    'lists',coalesce((select jsonb_agg(to_jsonb(l) order by l.id)
                       from taxpay_guest_private.lists l where l.session_id=o.id),'[]'::jsonb),
    'beneficiaries',coalesce((select jsonb_agg(to_jsonb(b) order by b.id)
                               from taxpay_guest_private.beneficiaries b where b.session_id=o.id),'[]'::jsonb),
    'selected_list_id',o.selected_list_id,'profile_updated_at',o.updated_at)::text as snapshot_text
  from owner_session o
)
select snapshot_text,encode(extensions.digest(convert_to(snapshot_text,'UTF8'),'sha256'),'hex') as snapshot_sha256
from snapshot;
