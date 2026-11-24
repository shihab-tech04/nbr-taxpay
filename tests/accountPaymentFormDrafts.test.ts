import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(path, 'utf8');

test('account SQL payment drafts require Auth owner RLS and deny anonymous direct writes', () => {
  const sql = read('supabase/migrations/20261107143000_taxpay_account_payment_form_drafts.sql');
  assert.match(sql, /ALTER TABLE public\.taxpay_account_payment_form_drafts FORCE ROW LEVEL SECURITY/);
  assert.match(sql, /FOR SELECT TO authenticated USING \(\(SELECT auth\.uid\(\)\) = owner_uid\)/);
  assert.match(sql, /FOR INSERT TO authenticated WITH CHECK \(\(SELECT auth\.uid\(\)\) = owner_uid\)/);
  assert.match(sql, /FOR UPDATE TO authenticated USING \(\(SELECT auth\.uid\(\)\) = owner_uid\)/);
  assert.match(sql, /REVOKE ALL ON public\.taxpay_account_payment_form_drafts FROM PUBLIC,anon,authenticated/);
  assert.doesNotMatch(sql, /GRANT [^;]+ TO anon;/);
});

test('preview drafts use only existing Edge capability and SQL-verified owner identity', () => {
  const sql = read('supabase/migrations/20261107143000_taxpay_account_payment_form_drafts.sql');
  const edge = read('supabase/functions/taxpay-guest-beneficiaries/index.ts');
  assert.match(sql, /taxpay_guest_private\.touch_session\(p_capability_hash\)/);
  assert.match(sql, /WHERE encode\(extensions\.digest\(convert_to\(capability_token,'UTF8'\),'sha256'\),'hex'\) = p_capability_hash/);
  assert.match(sql, /WHERE id = p_draft_id AND demo_id = v_owner/);
  assert.match(sql, /AND service = p_service AND revision = p_revision/);
  assert.match(sql, /WHERE demo_id = v_owner AND id = p_draft_id AND revision = p_revision/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.taxpay_demo_payment_form_drafts\([\s\S]*?FROM PUBLIC,anon,authenticated/);
  assert.match(edge, /const p_capability_hash = await capabilityHash\(token\)/);
  assert.match(edge, /action\.startsWith\('payment-draft-'\)/);
  assert.match(edge, /p_capability_hash, p_action: draftAction/);
});

test('actual signed-in payment and Travel Tax form state is saved, reloaded and revalidated', () => {
  const guest = read('src/components/screens/GuestPayment.tsx');
  const travel = read('src/components/screens/TravelTax.tsx');
  const controls = read('src/components/ui/AccountPaymentDraftControls.tsx');
  const api = read('src/services/accountPaymentFormDrafts.ts');

  assert.match(guest, /<AccountPaymentDraftControls service=\{category\}/);
  assert.match(guest, /snapshotAccountDraft/);
  assert.match(guest, /restoreAccountDraft/);
  assert.match(guest, /\{backendConfigured && !signedInAccount && \(/);
  assert.match(travel, /<AccountPaymentDraftControls service="TRAVEL_TAX"/);
  assert.match(travel, /snapshotTravelDraft/);
  assert.match(travel, /restoreTravelDraft/);
  assert.match(travel, /setConfirmedPassengerIds\(\[\]\)/);
  assert.match(guest, /setVerifiedReference\(null\)/);
  assert.match(guest, /setAuthorizedTaxpayerIds\(\{\}\)/);
  assert.match(controls, /'Save Draft'/);
  assert.match(controls, /'Continue Draft'/);
  assert.match(controls, /'Confirm delete'/);
  assert.match(api, /await readBackDraft\(actor, result\.id\)/);
  assert.match(api, /await checkActorStillSignedIn\(actor\)/);
  assert.match(api, /canonical\(reread\.form_payload\) !== canonical\(payload\)/);
  assert.match(api, /eq\('revision', previous\.revision\)/);
});

test('account payment draft snapshots and restores exact multiline challan remarks', () => {
  const guest = read('src/components/screens/GuestPayment.tsx');
  const snapshotStart = guest.indexOf('const snapshotAccountDraft =');
  const restoreStart = guest.indexOf('const restoreAccountDraft =');
  const restoreEnd = guest.indexOf('\n  };', restoreStart);
  assert.ok(snapshotStart >= 0 && restoreStart > snapshotStart && restoreEnd > restoreStart,
    'account draft snapshot and restore functions exist in the live payment form');
  const snapshot = guest.slice(snapshotStart, restoreStart);
  const restore = guest.slice(restoreStart, restoreEnd);
  assert.match(snapshot, /noticeReference,\s*paymentRemarks/,
    'the saved payload includes the complete optional remarks string');
  assert.match(restore, /setPaymentRemarks\(stringField\('paymentRemarks'\)\)/,
    'resume restores exact remarks without trimming or truncating them');
});

test('draft status never confirms a tax payment, receipt or Office notification', () => {
  const sql = read('supabase/migrations/20261107143000_taxpay_account_payment_form_drafts.sql');
  const ui = read('src/components/ui/AccountPaymentDraftControls.tsx');
  assert.doesNotMatch(sql, /\bINSERT INTO demo_payment\.story_payments\b/i);
  assert.doesNotMatch(ui, /persistSimulatedPayment|addPaymentReceipt|insertPayment/);
});

test('switching draft owner invalidates a selected draft and ignores stale refresh callbacks', () => {
  const ui = read('src/components/ui/AccountPaymentDraftControls.tsx');
  const dashboard = read('src/components/screens/DashboardPaymentDrafts.tsx');
  // The parent form can stay mounted across a new Auth or preview capability.
  // A former owner's selection must not be supplied as a draft UPDATE.
  assert.match(ui, /const selectionScope = ownerKey \+ ':' \+ service/);
  assert.match(ui, /const selectedOwnerRef = useRef\(selectionScope\)/);
  assert.match(ui, /window\.addEventListener\('storage', onGuestStorage\)/);
  assert.match(ui, /guestReadyOwnerKey !== renderScope/);
  assert.match(ui, /if \(rethrowFailure\) throw new Error\(bn[\s\S]*?Account changed during save/);
  assert.match(ui, /if \(rethrowFailure\) throw cause;/);
  assert.match(ui, /setGuestReadyOwnerKey\(renderScope\)/);
  assert.match(ui, /window\.removeEventListener\('storage', onGuestStorage\)/);
  assert.match(ui, /if \(paymentDraftOwnerScope\(\{kind:'guest'\}\) !== ownerKey\)/);
  assert.match(ui, /selectedOwnerRef\.current === selectionScope \? selectedDraft : null/);
  assert.match(ui, /if \(selectedOwnerRef\.current === selectionScope\) return;[\s\S]*?onSelectedDraft\(null\)/);
  assert.match(ui, /const existing = !asNewDraft && ownedSelectedDraft\?\.service === service/);
  assert.match(ui, /if \(ownedSelectedDraft\?\.id === draft\.id\) onSelectedDraft\(null\)/);
  assert.match(ui, /await refresh\(\);[\s\S]*?if \(!ownerStillCurrent\(\)\) return;[\s\S]*?setPendingDelete\(null\)/);
  // Both rejection and completion of an older refresh must leave the current
  // account's loading/error state untouched. SQL already checks its own actor.
  assert.match(ui, /void refresh\(\)\.catch\(\(\) => \{\s*if \(ownerStillCurrent\(\)\) setError/);
  assert.match(ui, /\.finally\(\(\) => \{ if \(ownerStillCurrent\(\)\) setLoading\(false\); \}\)/);
  assert.match(ui, /currentOwnerRef = useRef\(\{ key: requestOwnerKey, generation: 0 \}\)/);
  assert.match(ui, /currentOwnerRef\.current\.generation === requestGeneration/);
  assert.match(dashboard, /latestOwner = useRef\(\{key:ownerKey,generation:0\}\)/);
  assert.match(dashboard, /latestOwner\.current\.generation===requestGeneration/);
  assert.match(dashboard, /if \(sameOwner\(\)\) setCatalog/);
});

test('authenticated draft catalog paginates every owner-scoped assessment-year record without silent truncation', () => {
  const api = read('src/services/accountPaymentFormDrafts.ts');
  assert.match(api, /const pageSize = 100/);
  assert.match(api, /const maxPages = 50/);
  assert.match(api, /\.eq\('owner_uid', actor\.userId\)/);
  assert.match(api, /\.order\('updated_at', \{ ascending: false \}\)/);
  assert.match(api, /\.order\('id', \{ ascending: true \}\)/);
  assert.match(api, /\.range\(page \* pageSize, \(page \+ 1\) \* pageSize - 1\)/);
  assert.match(api, /await checkActorStillSignedIn\(actor\)/);
  assert.match(api, /if \(seen\.has\(row\.id\)\) throw new Error/);
  assert.match(api, /if \(data\.length < pageSize\) return rows/);
  assert.match(api, /throw new Error\('Saved draft list exceeds the supported retrieval limit/);
  assert.doesNotMatch(api, /\.limit\(100\)/);
});

test('new same-tab guest capability invalidates a mounted payment draft owner without revealing the token',()=>{
  const guest=read('src/services/guestBeneficiaries.ts');
  const controls=read('src/components/ui/AccountPaymentDraftControls.tsx');
  assert.match(guest,/export const GUEST_DRAFT_OWNER_CHANGED_EVENT = 'taxpay-guest-draft-owner-changed'/);
  assert.match(guest,/storage\.setItem\(capabilityKey, created\)/);
  assert.match(guest,/window\.dispatchEvent\(new Event\(GUEST_DRAFT_OWNER_CHANGED_EVENT\)\)/);
  assert.match(controls,/import \{ GUEST_DRAFT_OWNER_CHANGED_EVENT \} from '\.\.\/\.\.\/services\/guestBeneficiaries'/);
  assert.match(controls,/window\.addEventListener\(GUEST_DRAFT_OWNER_CHANGED_EVENT, onGuestStorage\)/);
  assert.match(controls,/window\.removeEventListener\(GUEST_DRAFT_OWNER_CHANGED_EVENT, onGuestStorage\)/);
  assert.match(controls,/paymentDraftOwnerScope\(\{kind:'guest'\}\) !== ownerKey/);
  assert.doesNotMatch(guest,/new CustomEvent\(GUEST_DRAFT_OWNER_CHANGED_EVENT,[^\n]*detail/);
});

test('switching payment service under one owner cannot display drafts from the previous service',()=>{
  const ui=read('src/components/ui/AccountPaymentDraftControls.tsx');
  assert.match(ui,/const selectionScope = ownerKey \+ ':' \+ service/);
  assert.match(ui,/const visibleRows = rowsOwnerKey === renderScope \? rows : \[\]/);
  assert.match(ui,/setRowsOwnerKey\(renderScope\)/);
  assert.doesNotMatch(ui,/setRowsOwnerKey\(ownerKey\)/);
  assert.doesNotMatch(ui,/rowsOwnerKey === ownerKey \? rows : \[\]/);
});

test('A to B to A draft catalog and guest readiness reject stale owner generations',()=>{
  const ui=read('src/components/ui/AccountPaymentDraftControls.tsx');
  assert.match(ui,/const renderScope = selectionScope \+ ':' \+ requestGeneration/);
  assert.match(ui,/const visibleRows = rowsOwnerKey === renderScope \? rows : \[\]/);
  assert.match(ui,/if \(active && ownerStillCurrent\(\)\) \{\s*setRows\(result\)/);
  assert.match(ui,/if \(active && ownerStillCurrent\(\) && actor\.kind !== 'guest'\)/);
  assert.match(ui,/if \(active && ownerStillCurrent\(\)\) setLoading\(false\)/);
  assert.match(ui,/setGuestReadyOwnerKey\(renderScope\)/);
  assert.match(ui,/guestReadyOwnerKey !== renderScope/);
  assert.match(ui,/\}, \[ownerKey, service, requestGeneration\]\)/);
});
