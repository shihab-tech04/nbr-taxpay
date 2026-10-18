import { DEMO_USERS, getDemoUser, type DemoUserId } from '../data/demoUsers';

/** Only for the ten fictional browser-preview profiles; never an identity or financial permission. */
export type DemoAuthorizationStatus = 'PENDING' | 'ACTIVE' | 'DENIED' | 'REVOKED';
export type DemoAuthorization = {
  id: string;
  payerId: DemoUserId;
  taxpayerId: DemoUserId;
  status: DemoAuthorizationStatus;
  requestedAt: number;
  consentCode: string;
  codeExpiresAt: number;
  confirmedAt: number | null;
  activeUntil: number | null;
  attempts: number;
  revokedAt: number | null;
};

export const AUTH_WINDOW_MS = 15 * 60 * 1000;
export const DEMO_AUTH_STORAGE_KEY = 'taxpay-synthetic-authorizations-v1';
const DEMO_AUTH_EVENT = 'taxpay-demo-authorizations-updated';
const ids = Object.keys(DEMO_USERS) as DemoUserId[];
const isId = (s: unknown): s is DemoUserId => typeof s === 'string' && Boolean(getDemoUser(s));
const isRecord = (v: unknown): v is DemoAuthorization => {
  if (!v || typeof v !== 'object') return false;
  const r = v as Partial<DemoAuthorization>;
  return typeof r.id === 'string' && isId(r.payerId) && isId(r.taxpayerId) && r.payerId !== r.taxpayerId &&
    ['PENDING', 'ACTIVE', 'DENIED', 'REVOKED'].includes(String(r.status)) &&
    typeof r.requestedAt === 'number' && typeof r.codeExpiresAt === 'number' &&
    typeof r.consentCode === 'string' && /^\d{6}$/.test(r.consentCode) &&
    (r.confirmedAt === null || typeof r.confirmedAt === 'number') &&
    (r.activeUntil === null || typeof r.activeUntil === 'number') &&
    typeof r.attempts === 'number' && (r.revokedAt === null || typeof r.revokedAt === 'number');
};

export function effectiveAuthorizationStatus(record: DemoAuthorization, now = Date.now()): DemoAuthorizationStatus | 'EXPIRED' {
  if (record.status === 'PENDING' && now >= record.codeExpiresAt) return 'EXPIRED';
  if (record.status === 'ACTIVE' && (!record.activeUntil || now >= record.activeUntil)) return 'EXPIRED';
  return record.status;
}

export function userIdForDemoTin(raw: string): DemoUserId | null {
  const tin = raw.replace(/\s/g, '');
  return ids.find(id => DEMO_USERS[id].tin === tin) ?? null;
}

export function generateDemoOtp(): string {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(100000 + (values[0] % 900000));
}

function generateDemoRecordId(): string {
  const values = new Uint32Array(2);
  crypto.getRandomValues(values);
  return `sim-auth-${Date.now().toString(36)}-${values[0].toString(36)}${values[1].toString(36)}`;
}

export function requestDemoAuthorization(
  records: DemoAuthorization[], payerId: DemoUserId, taxpayerId: DemoUserId,
  code: string, now = Date.now(), recordId: string = generateDemoRecordId()
): DemoAuthorization[] {
  if (payerId === taxpayerId) throw new Error('You cannot request authorization from yourself.');
  if (!/^\d{6}$/.test(code)) throw new Error('A six-digit code is required.');
  if (records.some(r => r.payerId === payerId && r.taxpayerId === taxpayerId &&
    ['PENDING', 'ACTIVE'].includes(effectiveAuthorizationStatus(r, now)))) {
    throw new Error('An active authorization or pending request already exists for this taxpayer.');
  }
  return [{ id: recordId, payerId, taxpayerId, status: 'PENDING', requestedAt: now,
    consentCode: code, codeExpiresAt: now + AUTH_WINDOW_MS, confirmedAt: null,
    activeUntil: null, attempts: 0, revokedAt: null }, ...records];
}

export function approveDemoAuthorization(
  records: DemoAuthorization[], taxpayerId: DemoUserId, recordId: string,
  inputCode: string, now = Date.now()
): DemoAuthorization[] {
  const record = records.find(r => r.id === recordId);
  if (!record || record.taxpayerId !== taxpayerId || effectiveAuthorizationStatus(record, now) !== 'PENDING')
    throw new Error('This request is no longer available.');
  return records.map(r => r.id !== recordId ? r :
    inputCode.trim() === r.consentCode
      ? {...r, status: 'ACTIVE', confirmedAt: now, activeUntil: now + AUTH_WINDOW_MS, consentCode: '000000'}
      : {...r, attempts: r.attempts + 1, status: r.attempts >= 2 ? 'DENIED' : 'PENDING'});
}

export function revokeDemoAuthorization(
  records: DemoAuthorization[], taxpayerId: DemoUserId, recordId: string, now = Date.now()
): DemoAuthorization[] {
  const record = records.find(r => r.id === recordId);
  if (!record || record.taxpayerId !== taxpayerId || effectiveAuthorizationStatus(record, now) !== 'ACTIVE')
    throw new Error('Only the authorizing taxpayer can remove an active authorization.');
  return records.map(r => r.id === recordId ? {...r, status: 'REVOKED', revokedAt: now} : r);
}

export function declineDemoAuthorization(
  records: DemoAuthorization[], taxpayerId: DemoUserId, recordId: string, now = Date.now()
): DemoAuthorization[] {
  const record = records.find(r => r.id === recordId);
  if (!record || record.taxpayerId !== taxpayerId || effectiveAuthorizationStatus(record, now) !== 'PENDING')
    throw new Error('Only the taxpayer can decline a pending request.');
  return records.map(r => r.id === recordId ? {...r, status: 'DENIED', consentCode: '000000'} : r);
}

// Browser storage is used only to let user1–user10 demonstrate switching roles
// in the same browser. It is never used for SQL/ACS/ledger authorization.
export function loadDemoAuthorizations(): DemoAuthorization[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(DEMO_AUTH_STORAGE_KEY) || '[]');
    return Array.isArray(stored) ? stored.filter(isRecord) : [];
  } catch { return []; }
}
export function saveDemoAuthorizations(records: DemoAuthorization[]): void {
  window.localStorage.setItem(DEMO_AUTH_STORAGE_KEY, JSON.stringify(records));
  window.dispatchEvent(new Event(DEMO_AUTH_EVENT));
}
export function subscribeDemoAuthorizations(update: () => void): () => void {
  window.addEventListener('storage', update);
  window.addEventListener(DEMO_AUTH_EVENT, update);
  return () => { window.removeEventListener('storage', update); window.removeEventListener(DEMO_AUTH_EVENT, update); };
}
