import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const rawUrl = process.env.TAXPAY_LOCAL_SUPABASE_URL;
const anonKey = process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
if (!rawUrl || !anonKey) {
  throw new Error('Set TAXPAY_LOCAL_SUPABASE_URL and TAXPAY_LOCAL_SUPABASE_ANON_KEY from the local Supabase CLI status output.');
}

/** This integration must not count an HTTP read as proof of direct PostgreSQL persistence.
 * The DSN must target the SAME loopback Supabase PostgreSQL process as PostgREST.
 * The test fails rather than silently passing if that independent SQL channel is absent.
 */
const directDsn = process.env.TAXPAY_LOCAL_PG_DSN;
if (!directDsn) throw new Error('BLOCKED: set TAXPAY_LOCAL_PG_DSN to the local stack PostgreSQL URI. Direct SQL verification is mandatory.');
const directPgUrl = new URL(directDsn);
if (!['postgresql:', 'postgres:'].includes(directPgUrl.protocol) ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(directPgUrl.hostname) ||
    !directPgUrl.pathname || directPgUrl.pathname === '/') {
  throw new Error('Refusing direct SQL verification: DSN must reference a loopback PostgreSQL database.');
}
function directSqlDraft(id, amountMinor) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid synthetic draft UUID');
  const query = `select json_build_object('database', current_database(), 'id', id, 'amount_minor', amount_minor, 'status', record_status)
    from public.taxpay_payment_drafts where id = '${id}'::uuid;`;
  const result = spawnSync('psql', ['--no-psqlrc', '--no-align', '--tuples-only', '--set=ON_ERROR_STOP=1', '--command', query], {
    env: { ...process.env, PGHOST: directPgUrl.hostname, PGPORT: directPgUrl.port || '5432',
      PGDATABASE: decodeURIComponent(directPgUrl.pathname.slice(1)),
      PGUSER: decodeURIComponent(directPgUrl.username), PGPASSWORD: decodeURIComponent(directPgUrl.password),
      PGCONNECT_TIMEOUT: '5' },
    encoding: 'utf8', timeout: 12000, input: undefined,
    // Pass DSN through PG* environment rather than as a command-line argument.
  });
  if (result.error || result.status !== 0) throw new Error('BLOCKED: direct loopback PostgreSQL query failed; verify local psql, connection target and credentials.');
  const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean);
  assert.equal(lines.length, 1, 'HTTP draft not found in independently queried PostgreSQL; inspect connection targets and migration history');
  const row = JSON.parse(lines[0]);
  assert.equal(row.id, id);
  assert.equal(row.amount_minor, amountMinor);
  assert.equal(row.status, 'DRAFT');
  return row.database;
}

const base = new URL(rawUrl);
if (base.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)) {
  throw new Error('Refusing to run: the configured Supabase URL is not an HTTP loopback address.');
}
if (base.pathname !== '/' || base.search || base.hash) {
  throw new Error('Refusing to run: expected a root Supabase API URL without a path, query, or fragment.');
}

function endpoint(path) {
  return new URL(path.replace(/^\/+/, ''), `${base.origin}/`);
}

function authHeaders(token) {
  return {
    apikey: anonKey,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    Accept: 'application/json',
  };
}

async function request(path, { method = 'GET', token, body, prefer } = {}) {
  const headers = authHeaders(token);
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  const response = await fetch(endpoint(path), {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  return { response, data };
}

function pass(label) {
  console.log(`PASS ${label}`);
}

async function expectDenied(path, options = {}) {
  const { response } = await request(path, options);
  assert.ok([401, 403].includes(response.status), `Expected 401/403, received ${response.status}`);
}

async function createAuthUser() {
  const nonce = randomUUID();
  const email = `taxpay-synthetic-${nonce}@example.invalid`;
  const password = randomBytes(32).toString('base64url');
  const response = await fetch(endpoint('/auth/v1/signup'), {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const payload = await response.json();
  assert.ok(response.ok, `Local Auth signup failed with HTTP ${response.status}`);
  const user = payload.user ?? payload;
  assert.ok(user?.id, 'Local Auth did not return a synthetic user');
  let session = payload.session ?? payload;
  if (!session.access_token) {
    const tokenResponse = await fetch(endpoint('/auth/v1/token?grant_type=password'), {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    session = await tokenResponse.json();
    assert.ok(tokenResponse.ok && session.access_token, `Local Auth password session failed with HTTP ${tokenResponse.status}`);
  }
  assert.ok(session.refresh_token, 'Local Auth did not return a refresh token');
  return { id: user.id, email, password, access_token: session.access_token, refresh_token: session.refresh_token };
}

const source = await request(
  '/rest/v1/taxpay_head_source_candidates?select=source_head_id,verification_status,executable,source_map&source_key=eq.V11-HTML-20261010&order=source_head_id.asc&limit=170',
);
assert.equal(source.response.status, 200, `Public unverified catalogue read returned HTTP ${source.response.status}`);
assert.equal(source.data.length, 170);
assert.deepEqual(source.data.map(row => row.source_head_id), Array.from({ length: 170 }, (_, index) => index + 1));
assert.ok(source.data.every(row => row.verification_status === 'UNVERIFIED' && row.executable === false));
assert.deepEqual(source.data.filter(row => row.source_map === 'OWNER_REVIEW').map(row => row.source_head_id), [5, 150]);
pass('loopback PostgREST exposes only the 170 non-executable reference candidates');

await expectDenied('/rest/v1/taxpay_payment_drafts?select=id');
await expectDenied('/rest/v1/taxpay_payment_drafts', {
  method: 'POST',
  body: {
    owner_uid: randomUUID(), purpose: 'TAX_LIABILITY_PAYMENT', category: 'TAX_WITH_RETURN',
    assessment_year: '2026-27', amount_minor: 100,
  },
});
await expectDenied('/rest/v1/taxpay_head_change_proposals?select=proposal_id');
await expectDenied('/rest/v1/taxpay_correction_inquiries?select=inquiry_id');
await expectDenied('/rest/v1/taxpay_correction_inquiries', {
  method: 'POST',
  body: {
    requester_uid: randomUUID(), original_reference: 'SYN-REF-001',
    reason: 'Synthetic anonymous request', requested_outcome: 'Review this synthetic reference',
  },
});
pass('anonymous HTTP reads and writes remain denied on private tables');

const ownerA = await createAuthUser();
const ownerB = await createAuthUser();
const refreshed = await fetch(endpoint('/auth/v1/token?grant_type=refresh_token'), {
  method: 'POST',
  headers: { apikey: anonKey, 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify({ refresh_token: ownerA.refresh_token }),
});
const refreshedSession = await refreshed.json();
assert.ok(refreshed.ok && refreshedSession.access_token, `Synthetic Auth refresh returned HTTP ${refreshed.status}`);
ownerA.access_token = refreshedSession.access_token;
pass('local Supabase Auth issues and refreshes two synthetic owner sessions');

async function createDraft(owner, amountMinor, memo) {
  const result = await request('/rest/v1/taxpay_payment_drafts?select=id,owner_uid,amount_minor,memo,record_status', {
    method: 'POST', token: owner.access_token, prefer: 'return=representation',
    body: {
      owner_uid: owner.id, purpose: 'TAX_LIABILITY_PAYMENT', category: 'TAX_WITH_RETURN',
      assessment_year: '2026-27', amount_minor: amountMinor, memo,
    },
  });
  assert.equal(result.response.status, 201, `Authenticated synthetic draft insert returned HTTP ${result.response.status}`);
  assert.equal(result.data.length, 1);
  return result.data[0];
}

const draftA = await createDraft(ownerA, 1250, 'Synthetic owner A');
const draftB = await createDraft(ownerB, 2400, 'Synthetic owner B');
const databaseA = directSqlDraft(draftA.id, 1250);
const databaseB = directSqlDraft(draftB.id, 2400);
assert.equal(databaseA, databaseB, 'Synthetic owners must connect to the same direct PostgreSQL database');
pass('HTTP insert verified by independent loopback PostgreSQL read-back for both owners');
for (const [owner, ownDraft, otherDraft] of [[ownerA, draftA, draftB], [ownerB, draftB, draftA]]) {
  const rows = await request('/rest/v1/taxpay_payment_drafts?select=id,owner_uid,amount_minor,memo,record_status', { token: owner.access_token });
  assert.equal(rows.response.status, 200);
  assert.deepEqual(rows.data.map(row => row.id), [ownDraft.id]);
  assert.equal(rows.data[0].owner_uid, owner.id);
  const otherOwnerRead = await request(`/rest/v1/taxpay_payment_drafts?select=id&id=eq.${otherDraft.id}`, { token: owner.access_token });
  assert.equal(otherOwnerRead.response.status, 200);
  assert.deepEqual(otherOwnerRead.data, []);
}
await expectDenied('/rest/v1/taxpay_payment_drafts', {
  method: 'POST', token: ownerA.access_token,
  body: {
    owner_uid: ownerB.id, purpose: 'TAX_LIABILITY_PAYMENT', category: 'TAX_WITH_RETURN',
    assessment_year: '2026-27', amount_minor: 100,
  },
});
pass('authenticated PostgREST draft persistence is isolated between real Auth owners');

const update = await request(`/rest/v1/taxpay_payment_drafts?id=eq.${draftA.id}&select=id,amount_minor,memo,record_status`, {
  method: 'PATCH', token: ownerA.access_token, prefer: 'return=representation',
  body: { amount_minor: 1350, memo: 'Synthetic owner A resumed edit' },
});
assert.equal(update.response.status, 200);
assert.deepEqual(update.data, [{ id: draftA.id, amount_minor: 1350, memo: 'Synthetic owner A resumed edit', record_status: 'DRAFT' }]);
directSqlDraft(draftA.id, 1350);
pass('HTTP resumed update read back independently from PostgreSQL');
await expectDenied(`/rest/v1/taxpay_payment_drafts?id=eq.${draftA.id}`, {
  method: 'PATCH', token: ownerA.access_token, body: { record_status: 'SETTLED' },
});
const deleteOther = await request(`/rest/v1/taxpay_payment_drafts?id=eq.${draftB.id}&select=id`, {
  method: 'DELETE', token: ownerA.access_token, prefer: 'return=representation',
});
assert.ok(deleteOther.response.ok, `Cross-owner delete returned HTTP ${deleteOther.response.status}`);
if (Array.isArray(deleteOther.data)) assert.deepEqual(deleteOther.data, []);
const stillOwnedByB = await request(`/rest/v1/taxpay_payment_drafts?select=id&id=eq.${draftB.id}`, { token: ownerB.access_token });
assert.deepEqual(stillOwnedByB.data.map(row => row.id), [draftB.id]);
pass('allowed owner draft edits work; status/settlement writes and cross-owner deletes fail closed');

const proposal = await request('/rest/v1/taxpay_head_change_proposals?select=proposal_id,proposer_uid,proposal_state,financial_execution_enabled,authority_reviewed', {
  method: 'POST', token: ownerA.access_token, prefer: 'return=representation',
  body: {
    proposer_uid: ownerA.id, source_key: 'V11-HTML-20261010', source_head_id: 1,
    source_document_sha256: 'a'.repeat(64), proposed_patch: { label: 'synthetic review only' },
    submission_reason: 'Synthetic authenticated proposal for local RLS verification',
  },
});
assert.equal(proposal.response.status, 201, `Authenticated proposal insert returned HTTP ${proposal.response.status}`);
assert.equal(proposal.data[0].proposal_state, 'PROPOSED_UNVERIFIED');
assert.equal(proposal.data[0].financial_execution_enabled, false);
assert.equal(proposal.data[0].authority_reviewed, false);
const proposalHidden = await request(`/rest/v1/taxpay_head_change_proposals?select=proposal_id&proposal_id=eq.${proposal.data[0].proposal_id}`, { token: ownerB.access_token });
assert.equal(proposalHidden.response.status, 200);
assert.deepEqual(proposalHidden.data, []);
await expectDenied(`/rest/v1/taxpay_head_change_proposals?proposal_id=eq.${proposal.data[0].proposal_id}`, {
  method: 'PATCH', token: ownerA.access_token,
  body: { proposal_state: 'APPROVED', financial_execution_enabled: true, authority_reviewed: true },
});

const inquiry = await request('/rest/v1/taxpay_correction_inquiries?select=inquiry_id,requester_uid,evidence_state,claimant_verified,original_receipt_verified,may_change_financial_records,change_kind,old_value,new_value', {
  method: 'POST', token: ownerA.access_token, prefer: 'return=representation',
  body: {
    requester_uid: ownerA.id, original_reference: `SYN-${randomUUID()}`,
    reason: 'Synthetic evidence-pending inquiry for local integration verification',
    requested_outcome: 'Please review this synthetic reference only',
    change_kind: 'ASSESSMENT_YEAR', old_value: '2024-25', new_value: '2025-26',
  },
});
assert.equal(inquiry.response.status, 201, `Authenticated correction inquiry insert returned HTTP ${inquiry.response.status}`);
assert.deepEqual({
  evidence_state: inquiry.data[0].evidence_state,
  claimant_verified: inquiry.data[0].claimant_verified,
  original_receipt_verified: inquiry.data[0].original_receipt_verified,
  may_change_financial_records: inquiry.data[0].may_change_financial_records,
}, { evidence_state: 'PENDING_EVIDENCE', claimant_verified: false, original_receipt_verified: false, may_change_financial_records: false });
const inquiryHidden = await request(`/rest/v1/taxpay_correction_inquiries?select=inquiry_id&inquiry_id=eq.${inquiry.data[0].inquiry_id}`, { token: ownerB.access_token });
assert.equal(inquiryHidden.response.status, 200);
assert.deepEqual(inquiryHidden.data, []);
await expectDenied(`/rest/v1/taxpay_correction_inquiries?inquiry_id=eq.${inquiry.data[0].inquiry_id}`, {
  method: 'PATCH', token: ownerA.access_token, body: { may_change_financial_records: true },
});
await expectDenied('/rest/v1/taxpay_correction_inquiries', {
  method: 'POST', token: ownerA.access_token,
  body: {
    requester_uid: ownerB.id, original_reference: `SYN-${randomUUID()}`,
    reason: 'Synthetic cross-owner correction inquiry', requested_outcome: 'Not allowed for another owner',
  },
});
pass('owner-only proposals and evidence-pending corrections cannot approve or mutate finances');

console.log('RESULT 6 local Auth/PostgREST integration groups passed; no service-role key or non-loopback endpoint used.');
