/**
 * Hosted V2 simulation-only smoke. This does NOT settle payments or migrate Auth.
 * It uses fictional user1/user30 credentials and may refresh demo guest sessions.
 * No capability, personal data, or secret/service-role token is logged.
 */
import { pathToFileURL } from 'node:url';

export const V2_URL = 'https://gmuhitmaynfhipcvbvkh.supabase.co';
const ORIGIN = 'https://shihab-tech04.github.io';
const API = '/functions/v1/taxpay-guest-beneficiaries';
const CAP = /^[A-Za-z0-9_-]{43}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateDemoLogin(data, id) {
  return data?.profileId === id && CAP.test(data?.capability ?? '') &&
    UUID.test(data?.paymentSessionId ?? '') &&
    (data?.language === 'en' || data?.language === 'bn');
}

async function request(key, payload, capability) {
  const response = await fetch(V2_URL + API, {
    method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(15000),
    headers: {
      apikey: key, origin: ORIGIN, 'content-type': 'application/json',
      ...(capability ? {'x-taxpay-guest-capability': capability} : {}),
    },
    body: JSON.stringify(payload),
  });
  const json = await response.json().catch(() => null);
  return { status: response.status, success: json?.success,
    code: json?.code, data: json?.data };
}

export async function runV2DemoSmoke(key) {
  if (typeof key !== 'string' || !key.startsWith('sb_publishable_'))
    throw new Error('V2 publishable key is required; refuse secret/service-role keys.');
  const sessions = [];
  for (const userId of ['user1', 'user30']) {
    const login = await request(key, { action: 'demo-login', userId, password: userId });
    if (login.status !== 200 || login.success !== true ||
        !validateDemoLogin(login.data, userId))
      throw new Error(userId + ': hosted V2 login failed verification, HTTP ' + login.status);
    const settings = await request(key, { action: 'demo-settings' }, login.data.capability);
    if (settings.status !== 200 || settings.success !== true ||
        settings.data?.paymentSessionId !== login.data.paymentSessionId)
      throw new Error(userId + ': hosted V2 settings ownership failed, HTTP ' + settings.status);
    sessions.push({ session: login.data.paymentSessionId, capability: login.data.capability });
  }
  if (sessions[0].session === sessions[1].session ||
      sessions[0].capability === sessions[1].capability)
    throw new Error('Distinct fictional accounts share a payment session or capability.');
  for (const payload of [
    { action: 'demo-login', userId: 'user1', password: 'incorrect' },
    // The hosted synthetic backend owns 55 fictional IDs, while the selectable
    // Taxpayer UI remains limited to the approved first 30. Test the actual
    // backend boundary (56), and keep the separate wrong-password 401 case.
    { action: 'demo-login', userId: 'user56', password: 'user56' },
  ]) {
    const denial = await request(key, payload);
    if (denial.status !== 401 || denial.success !== false ||
        denial.code !== 'INVALID_DEMO_LOGIN')
      throw new Error('Hosted V2 accepted an invalid simulation login, HTTP ' + denial.status);
  }
  console.log('PASS: hosted V2 simulation login, session ownership and invalid-login denials.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runV2DemoSmoke(process.env.SOHOJKOR_V2_PUBLISHABLE_KEY).catch(error => {
    console.error('V2 simulation smoke FAILED:', error.message);
    process.exitCode = 1;
  });
}
