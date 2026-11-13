// Real disposable local Edge -> SQL acceptance for unsigned guest form drafts.
// Requires TAXPAY_LOCAL_SUPABASE_ANON_KEY and a local supabase functions serve.
// No hosted Supabase project or production financial records are used.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';

const url = 'http://127.0.0.1:54321/functions/v1/taxpay-guest-beneficiaries';
const key = process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
if (!key) throw new Error('TAXPAY_LOCAL_SUPABASE_ANON_KEY is required');
const first = randomBytes(32).toString('base64url');
const second = randomBytes(32).toString('base64url');
assert.equal(first.length, 43);
assert.equal(second.length, 43);

async function command(capability, action, body = {}, expectedStatus = 200) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': key,
      'origin': 'http://127.0.0.1:4173',
      'content-type': 'application/json',
      'x-taxpay-guest-capability': capability,
    },
    body: JSON.stringify({action, ...body}),
  });
  const result = await response.json();
  assert.equal(response.status, expectedStatus, JSON.stringify({action, result}));
  assert.equal(result.success, expectedStatus === 200, JSON.stringify({action, result}));
  return result;
}

// The existing open action creates/resumes an opaque guest session. No login.
await command(first, 'open');
await command(second, 'open');
const draftPayload = {
  assessmentYear: '2025-26',
  beneficiaries: [{tin: '111111111111', headId: 8, amountMinor: 1500}],
  step: 'details',
};
const created = (await command(first, 'guest-payment-draft-create', {
  service: 'OTHER_TAX_PAYMENT', payload: draftPayload,
})).data;
assert.match(created.id, /^[0-9a-f-]{36}$/i);
assert.equal(created.revision, 1);
assert.deepEqual(created.form_payload, draftPayload);
assert.equal((await command(second, 'guest-payment-draft-list')).data.length, 0);
await command(second, 'guest-payment-draft-get', {id: created.id}, 404);

const updatedPayload = {...draftPayload, step: 'review', draftAmountMinor: 2000};
const updated = (await command(first, 'guest-payment-draft-update', {
  id: created.id, revision: 1, service: 'OTHER_TAX_PAYMENT', payload: updatedPayload,
})).data;
assert.equal(updated.revision, 2);
assert.deepEqual(updated.form_payload, updatedPayload);
await command(first, 'guest-payment-draft-update', {
  id: created.id, revision: 1, service: 'OTHER_TAX_PAYMENT', payload: {step: 'stale'},
}, 409);
await command(second, 'guest-payment-draft-delete', {id: created.id, revision: 2}, 409);

// A new request simulates browser refresh: only the original capability can resume.
const reloaded = (await command(first, 'guest-payment-draft-get', {id: created.id})).data;
assert.equal(reloaded.revision, 2);
assert.deepEqual(reloaded.form_payload, updatedPayload);
const ownList = (await command(first, 'guest-payment-draft-list')).data;
assert.equal(ownList.length, 1);
assert.equal(ownList[0].id, created.id);
assert.equal((await command(first, 'guest-payment-draft-delete', {
  id: created.id, revision: 2,
})).data.deleted, created.id);
assert.deepEqual((await command(first, 'guest-payment-draft-list')).data, []);

console.log('PASS: disposable Edge guest draft create/list/get/update/delete, refresh, conflict and cross-session isolation');
