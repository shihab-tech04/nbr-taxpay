/**
 * Fail-closed Sohojkor public-release backend cutover gate.
 * Original Taxpayer remains the default. A switch to Taxpayer-v2 requires
 * fresh Ed25519-signed evidence bound to the exact release source tree.
 * No signing private key or privileged Supabase key may enter the web bundle.
 */
import { createPublicKey, verify as verifySignature } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { runV2DemoSmoke } from './sohojkor-v2-demo-smoke.mjs';

export const ORIGINAL = 'https://eyqhoavnitkrajvyqvxn.supabase.co';
export const TARGET = 'https://gmuhitmaynfhipcvbvkh.supabase.co';
export const OFFICE = 'ihbtabrvmyiwikqqbhrf';
export const SIMULATION_SCOPE = 'fictional-user1-user30-only';
const SHA256 = /^[a-f0-9]{64}$/;
const TREE = /^[a-f0-9]{40}$/;
const requiredProofs = Object.freeze([
  'originalSqlAuthRestore',
  'targetSqlAuthRestore',
  'officeSqlAuthRestore',
  'originalStorageRestore',
  'targetStorageRestore',
  'originalAccountIdentity',
  'paymentIdempotency',
  'officeAuthorizedReadback',
  'storageByteIntegrity',
  'rollbackRehearsal',
  'protectedReleaseApproval',
]);

function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort()
    .map(key => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
function verifyProofItem(item, timestamp) {
  if (!item || item.passed !== true || !SHA256.test(item.sha256 || '')) return false;
  const checked = Date.parse(item.verifiedAt);
  return Number.isFinite(checked) && checked <= timestamp && checked >= timestamp - 7 * 86400_000;
}
/** Returns approved mode or throws; never fall back across identity boundaries. */
export function validateCutover({ url, disabled = false, proofJson, verifierKey, treeSha, releaseScope, originalUrl, officeUrl, now = Date.now() }) {
  if (disabled) return { mode: 'disabled' };
  if (url === ORIGINAL) return { mode: 'original' };
  if (url !== TARGET) throw new Error('Unknown production Taxpayer backend refused');
  // For the existing fictional user1–user30 simulator, Supabase Auth UUID migration,
  // real financial settlement and Office dispatch are out of scope. This exception
  // still requires independent hosted V2 login/ownership verification by the release job.
  if (releaseScope === SIMULATION_SCOPE) {
    if (originalUrl !== ORIGINAL || officeUrl !== `https://${OFFICE}.supabase.co`)
      throw new Error('V2 simulator cutover refused: original or Office project identity changed');
    return { mode: 'v2-simulation-hosted-smoke-required' };
  }
  if (!proofJson || !verifierKey || !TREE.test(treeSha || ''))
    throw new Error('Taxpayer-v2 cutover blocked: signed recovery evidence is missing');
  let envelope;
  try { envelope = JSON.parse(proofJson); }
  catch { throw new Error('Taxpayer-v2 cutover blocked: invalid approval payload'); }
  const payload = envelope?.payload;
  const expires = Date.parse(payload?.expiresAt);
  const issued = Date.parse(payload?.issuedAt);
  if (payload?.schema !== 'sohojkor-hybrid-cutover-v1' ||
      payload?.source !== ORIGINAL || payload?.target !== TARGET ||
      payload?.office !== OFFICE || payload?.treeSha !== treeSha ||
      !Number.isFinite(expires) || !Number.isFinite(issued) ||
      issued > now || issued < now - 7 * 86400_000 ||
      expires <= now || expires > now + 7 * 86400_000)
    throw new Error('Taxpayer-v2 cutover blocked: wrong scope, source tree or approval window');
  for (const key of requiredProofs) {
    if (!verifyProofItem(payload?.evidence?.[key], now))
      throw new Error('Taxpayer-v2 cutover blocked: missing verified ' + key);
  }
  // The two simulated test payments must not be silently claimed by a taxpayer.
  // Bypass historical owner mapping ONLY with signed no-financial-history proof
  // and separately verified read-only legacy record preservation.
  if (payload.historyMode === 'no-settled-payments') {
    for (const key of ['legacyNonFinancialEvidence', 'legacyRecordsRetainedReadOnly']) {
      if (!verifyProofItem(payload?.evidence?.[key], now))
        throw new Error('Taxpayer-v2 cutover blocked: missing verified ' + key);
    }
  } else if (payload.historyMode === undefined || payload.historyMode === 'reconcile') {
    if (!verifyProofItem(payload?.evidence?.originalPaymentOwnerScope, now))
      throw new Error('Taxpayer-v2 cutover blocked: missing verified originalPaymentOwnerScope');
  } else {
    throw new Error('Taxpayer-v2 cutover blocked: unsupported historical payment policy');
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(envelope.signature || ''))
    throw new Error('Taxpayer-v2 cutover blocked: malformed signature');
  let verifier;
  try { verifier = createPublicKey(verifierKey); }
  catch { throw new Error('Taxpayer-v2 cutover blocked: invalid verifier key'); }
  if (verifier.asymmetricKeyType !== 'ed25519' ||
      !verifySignature(null, Buffer.from(canonicalJson(payload)), verifier,
        Buffer.from(envelope.signature, 'base64')))
    throw new Error('Taxpayer-v2 cutover blocked: signature verification failed');
  return { mode: 'v2-approved', treeSha };
}
function productionTree() {
  try { return execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8', stdio: ['ignore','pipe','ignore'] }).trim(); }
  catch { return ''; }
}
if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  try {
    const result = validateCutover({
      url: process.env.VITE_SUPABASE_URL?.trim() || '',
      disabled: process.env.VITE_SUPABASE_DISABLED === 'true',
      proofJson: process.env.SOHOJKOR_CUTOVER_SIGNED_PROOF,
      verifierKey: process.env.SOHOJKOR_CUTOVER_APPROVER_PUBLIC_KEY,
      treeSha: productionTree(),
      releaseScope: process.env.SOHOJKOR_RELEASE_SCOPE,
      originalUrl: process.env.SOHOJKOR_ORIGINAL_SUPABASE_URL,
      officeUrl: process.env.SOHOJKOR_OFFICE_SUPABASE_URL,
    });
    if (result.mode === 'v2-simulation-hosted-smoke-required') {
      // Never permit local/unreviewed execution to certify a production release.
      if (process.env.GITHUB_ACTIONS !== 'true' ||
          !['pull_request','push','workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME) ||
          (process.env.GITHUB_EVENT_NAME !== 'pull_request' && process.env.GITHUB_REF !== 'refs/heads/main'))
        throw new Error('V2 simulator cutover requires approved GitHub Actions exact-head verification');
      await runV2DemoSmoke(process.env.SOHOJKOR_V2_PUBLISHABLE_KEY);
    }
    console.log('SOHOJKOR_RELEASE_BACKEND=' + result.mode);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
