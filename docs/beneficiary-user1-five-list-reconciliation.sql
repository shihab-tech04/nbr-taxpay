-- USER1 ONLY: REVIEW / TEST CANDIDATE, NOT AN APPLIED MIGRATION.
-- Original: 9 groups / 27 memberships / 25 unique TINs.
-- Replacement: 9 groups / 26 memberships / 24 unique TINs.
-- Read-only preview found zero destination/TIN collisions on both 25 Nov 2026.
-- Keep the existing five lists named below. Do not merge across owner sessions
-- or reconcile distinct cross-database records by overwriting either dataset.
-- Prerequisite: exact private row backup independently restored, cap/RLS tests,
-- current session identity and hosted constraints verified, release controller approval.
-- Run the following preview again under the same transaction locks before any DML.
WITH owner_session AS (
  SELECT s.id FROM taxpay_guest_private.demo_profiles p
  JOIN taxpay_guest_private.sessions s
    ON s.capability_hash=encode(extensions.digest(p.capability_token,'sha256'),'hex')
  WHERE p.demo_id='user1'
), records AS (
  SELECT l.name,b.tin,b.tag,b.relationship
  FROM owner_session o
  JOIN taxpay_guest_private.lists l ON l.session_id=o.id
  JOIN taxpay_guest_private.beneficiaries b ON b.list_id=l.id AND b.session_id=o.id
), planned AS (
  SELECT *,CASE WHEN lower(name)='family' THEN 'Parents & Siblings'
    WHEN name='Professional Contacts' THEN 'Corporate Clients'
    WHEN name='client' THEN 'Other Contacts' ELSE name END AS destination
  FROM records
), collisions AS (
  SELECT destination,tin FROM planned GROUP BY destination,tin HAVING count(*)>1
)
SELECT (SELECT count(*) FROM records) memberships,
       (SELECT count(DISTINCT tin) FROM records) unique_tins,
       (SELECT count(*) FROM planned WHERE name<>destination) moving,
       (SELECT count(*) FROM collisions) destination_collisions;

-- Survivors: Corporate Clients, Friends, Other Contacts,
-- Parents & Siblings, Spouse & Children.
-- Original: client -> Other Contacts; Family -> Parents & Siblings;
-- Professional Contacts -> Corporate Clients; Kuddus empty.
-- Replacement: family -> Parents & Siblings; Professional Contacts ->
-- Corporate Clients; customer and QA-User1-20261121 empty.
-- Move rows by immutable ID, same session, no reclassification; verify every
-- original ID and classification before deleting empty source groups.
-- Preserve all original duplicate memberships in different lists.
-- Reset stale selected_list_id to All or the mapped surviving destination.
-- Do not delete a group unless it is empty within the locked transaction.
-- Fail closed on missing/extra group, owner ambiguity, changed counts,
-- collisions, orphan rows or unexpected selected-list references.
