import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import test from 'node:test';
import { ORIGINAL, TARGET, OFFICE, SIMULATION_SCOPE, validateCutover } from './hybrid-cutover-gate.mjs';

const treeSha = 'a'.repeat(40);
const now = Date.parse('2026-11-15T15:00:00Z');
const evidenceNames = [
  'originalSqlAuthRestore','targetSqlAuthRestore','officeSqlAuthRestore',
  'originalStorageRestore','targetStorageRestore','originalAccountIdentity',
  'originalPaymentOwnerScope','paymentIdempotency','officeAuthorizedReadback',
  'storageByteIntegrity','rollbackRehearsal','protectedReleaseApproval',
];
function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort()
    .map(key => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
const keys = generateKeyPairSync('ed25519');
const pub = keys.publicKey.export({ format: 'pem', type: 'spki' });
function fixture(modify = x => x) {
  const payload = {
    schema: 'sohojkor-hybrid-cutover-v1',
    source: ORIGINAL, target: TARGET, office: OFFICE, treeSha,
    issuedAt: '2026-11-15T14:50:00Z', expiresAt: '2026-11-15T16:00:00Z',
    evidence: Object.fromEntries(evidenceNames.map(name => [name, {
      passed: true, sha256: 'b'.repeat(64), verifiedAt: '2026-11-15T14:50:00Z',
    }])),
  };
  modify(payload);
  return JSON.stringify({ payload, signature: sign(null, Buffer.from(canonicalJson(payload)), keys.privateKey).toString('base64') });
}
test('preserves original hosted backend without requiring new proof', () => {
  assert.deepEqual(validateCutover({ url: ORIGINAL }), { mode: 'original' });
});
test('blocks unknown/Office/hostile projects as production primary', () => {
  for (const url of ['', 'https://ihbtabrvmyiwikqqbhrf.supabase.co',
    'https://evil.supabase.co', TARGET + '/extra']) {
    assert.throws(() => validateCutover({ url }), /Unknown production/);
  }
});
test('blocks Taxpayer-v2 without signed verified recovery evidence', () => {
  assert.throws(() => validateCutover({ url: TARGET }), /signed recovery evidence/);
});
test('accepts signed, fresh, exact-tree release evidence in isolated tests only', () => {
  assert.deepEqual(validateCutover({ url: TARGET, proofJson: fixture(), verifierKey: pub, treeSha, now }),
    { mode: 'v2-approved', treeSha });
});
test('permits no-history only with signed legacy and nonfinancial proofs', () => {
  const verified = fixture(p => {
    p.historyMode = 'no-settled-payments';
    delete p.evidence.originalPaymentOwnerScope;
    for (const k of ['legacyNonFinancialEvidence', 'legacyRecordsRetainedReadOnly']) {
      p.evidence[k] = { passed:true, sha256:'b'.repeat(64), verifiedAt:'2026-11-15T14:50:00Z' };
    }
  });
  assert.deepEqual(validateCutover({ url:TARGET, proofJson:verified, verifierKey:pub, treeSha, now }),
    { mode:'v2-approved', treeSha });
  assert.throws(() => validateCutover({ url:TARGET, proofJson:fixture(p => {
    p.historyMode = 'no-settled-payments';
    delete p.evidence.originalPaymentOwnerScope;
  }), verifierKey:pub, treeSha, now }), /legacyNonFinancialEvidence/);
  assert.throws(() => validateCutover({ url:TARGET, proofJson:fixture(p => {
    p.historyMode = 'unsupported';
  }), verifierKey:pub, treeSha, now }), /unsupported historical payment policy/);
  const edited = JSON.parse(verified);
  edited.payload.evidence.legacyRecordsRetainedReadOnly.passed = false;
  assert.throws(() => validateCutover({ url:TARGET, proofJson:JSON.stringify(edited), verifierKey:pub, treeSha, now }), /legacyRecordsRetainedReadOnly/);
});
test('blocks a different source tree even with a genuine signature', () => {
  assert.throws(() => validateCutover({ url: TARGET, proofJson: fixture(), verifierKey: pub, treeSha: 'c'.repeat(40), now }), /wrong scope/);
});
test('blocks expired, stale and invalid backup/ownership evidence', () => {
  assert.throws(() => validateCutover({ url: TARGET, proofJson: fixture(p => { p.expiresAt = '2026-11-15T14:00:00Z'; }), verifierKey: pub, treeSha, now }), /wrong scope/);
  assert.throws(() => validateCutover({ url: TARGET, proofJson: fixture(p => { p.evidence.originalAccountIdentity.passed = false; }), verifierKey: pub, treeSha, now }), /originalAccountIdentity/);
  assert.throws(() => validateCutover({ url: TARGET, proofJson: fixture(p => { delete p.evidence.officeAuthorizedReadback; }), verifierKey: pub, treeSha, now }), /officeAuthorizedReadback/);
});
test('blocks forged or modified approvals', () => {
  const proof = JSON.parse(fixture());
  proof.payload.evidence.originalAccountIdentity.sha256 = 'c'.repeat(64);
  assert.throws(() => validateCutover({ url: TARGET, proofJson: JSON.stringify(proof), verifierKey: pub, treeSha, now }), /signature verification failed/);
});
test('backend-disabled test builds remain disabled', () => {
  assert.deepEqual(validateCutover({ url: '', disabled: true }), { mode: 'disabled' });
});


test('simulation-only V2 release requires actual hosted login smoke, not matching managed Auth UUIDs', () => {
  assert.deepEqual(validateCutover({
    url: TARGET, releaseScope: SIMULATION_SCOPE, originalUrl: ORIGINAL,
    officeUrl: 'https://' + OFFICE + '.supabase.co',
  }), { mode: 'v2-simulation-hosted-smoke-required' });
});
test('simulated V2 release cannot substitute either original or Office database', () => {
  assert.throws(() => validateCutover({
    url: TARGET, releaseScope: SIMULATION_SCOPE, originalUrl: TARGET,
    officeUrl: 'https://' + OFFICE + '.supabase.co',
  }), /original or Office project identity changed/);
  assert.throws(() => validateCutover({
    url: TARGET, releaseScope: SIMULATION_SCOPE, originalUrl: ORIGINAL,
    officeUrl: ORIGINAL,
  }), /original or Office project identity changed/);
});
test('invalid scope cannot bypass signed full cutover safeguards', () => {
  assert.throws(() => validateCutover({
    url: TARGET, releaseScope: 'real-payments',
    originalUrl: ORIGINAL, officeUrl: 'https://' + OFFICE + '.supabase.co',
  }), /signed recovery evidence is missing/);
});
