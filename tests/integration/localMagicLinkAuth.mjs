import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// Disposable local Supabase + Mailpit only. Never send mail or Auth data to a hosted project.
const rawUrl = process.env.TAXPAY_LOCAL_SUPABASE_URL;
const key = process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
if (!rawUrl || !key) throw new Error('BLOCKED: missing isolated loopback Auth configuration');
const api = new URL(rawUrl);
const allowed = host => ['127.0.0.1', 'localhost', '[::1]'].includes(host);
if (api.protocol !== 'http:' || !allowed(api.hostname) || api.pathname !== '/' || api.search || api.hash) {
  throw new Error('Refusing to test magic-link authentication against a non-loopback endpoint');
}
const mail = new URL('http://127.0.0.1:54324');
const callback = 'http://127.0.0.1:4173/?action=secure_workspace';
const email = 'taxpay-synthetic-' + randomUUID() + '@example.invalid';

const otp = await fetch(new URL('/auth/v1/otp?redirect_to=' + encodeURIComponent(callback), api.origin), {
  method: 'POST',
  headers: { apikey: key, 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify({ email, create_user: true }),
});
assert.equal(otp.status, 200, 'A real local Supabase email sign-in link was not issued');
console.log('PASS local Auth accepted an emailed sign-in request');

let detail;
for (let tries = 0; tries < 30 && !detail; tries++) {
  const listResponse = await fetch(new URL('/api/v1/messages?limit=30', mail.origin));
  assert.equal(listResponse.status, 200, 'Disposable Mailpit is not running');
  const messages = (await listResponse.json()).messages ?? [];
  for (const item of messages) {
    const recipient = JSON.stringify(item.To ?? item.to ?? item.Recipients ?? []);
    if (!recipient.toLowerCase().includes(email)) continue;
    const response = await fetch(new URL('/api/v1/message/' + encodeURIComponent(item.ID), mail.origin));
    assert.equal(response.status, 200);
    detail = await response.json();
    break;
  }
  if (!detail) await new Promise(resolve => setTimeout(resolve, 500));
}
assert.ok(detail, 'No real local Auth email arrived at the disposable Mailpit inbox');
const source = [detail.Text, detail.HTML, detail.TextBody, detail.HtmlBody].filter(Boolean).join('\n')
  .replace(/&amp;/g, '&').replace(/&#38;/g, '&');
const match = source.match(/https?:\/\/[^\s"'<>]+\/auth\/v1\/verify\?[^\s"'<>]+/i);
assert.ok(match, 'Local Auth email did not contain its one-time verification link');
const link = new URL(match[0].replace(/[),.;]+$/, ''));
assert.equal(link.origin, api.origin, 'Verification link is not for the same disposable Supabase instance');
assert.ok(link.searchParams.has('token') || link.searchParams.has('token_hash'));
console.log('PASS disposable mail server delivered a real one-time sign-in link');

const confirmed = await fetch(link, { redirect: 'manual' });
assert.ok([302, 303, 307].includes(confirmed.status), 'Real magic-link verification did not redirect');
const location = confirmed.headers.get('location');
assert.ok(location);
const redirected = new URL(location, api.origin);
assert.equal(redirected.origin, new URL(callback).origin);
assert.equal(redirected.pathname, '/');
assert.equal(redirected.searchParams.get('action'), 'secure_workspace',
  'Selected secure workspace was not restored after email verification');
const fragment = new URLSearchParams(redirected.hash.slice(1));
const token = fragment.get('access_token');
assert.ok(token && fragment.get('refresh_token'), 'Email verification did not establish a session');
const identity = await fetch(new URL('/auth/v1/user', api.origin), {
  headers: { apikey: key, Authorization: 'Bearer ' + token },
});
assert.equal(identity.status, 200);
const user = await identity.json();
assert.equal(user.email, email);
assert.ok(user.id);
console.log('PASS verified magic link returned to the selected screen with a real synthetic Auth session');

const replay = await fetch(link, { redirect: 'manual' });
const replayUrl = replay.headers.get('location');
assert.ok(replay.status >= 400 ||
  !replayUrl || !new URLSearchParams(new URL(replayUrl, api.origin).hash.slice(1)).has('access_token'),
  'Consumed magic link unexpectedly issued a second authenticated session');
console.log('PASS consumed sign-in link cannot be reused for a new session');
console.log('RESULT 4 isolated email sign-in acceptance assertions passed; hosted projects untouched');
