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

test('draft status never confirms a tax payment, receipt or Office notification', () => {
  const sql = read('supabase/migrations/20261107143000_taxpay_account_payment_form_drafts.sql');
  const ui = read('src/components/ui/AccountPaymentDraftControls.tsx');
  assert.doesNotMatch(sql, /\bINSERT INTO demo_payment\.story_payments\b/i);
  assert.doesNotMatch(ui, /persistSimulatedPayment|addPaymentReceipt|insertPayment/);
});
