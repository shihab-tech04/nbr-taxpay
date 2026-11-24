import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

// Exercise the actual retired handler in a disposable Request/Response harness.
// It has no network, API keys, hosted SQL, or financial writes.
const source = await readFile(
  new URL('../../supabase/functions/taxpay-handoff-api/index.ts', import.meta.url),
  'utf8',
);

test('retired legacy Edge contains no public or privileged database client', () => {
  assert.doesNotMatch(source, /createClient|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_ANON_KEY|SUPABASE_PUBLISHABLE_KEY|\.rpc\(/);
  assert.match(source, /LEGACY_HANDOFF_RETIRED/);
  assert.match(source, /status:\s*410/);
});

test('current approved Story1 payment service stays on its separate capability API', async () => {
  const current = await readFile(
    new URL('../../src/services/simulatedPaymentStory.ts', import.meta.url),
    'utf8',
  );
  assert.match(current, /functions\/v1\/demo-story1-taxpay/);
  assert.doesNotMatch(current, /taxpay-handoff-api/);
});

const rewrittenForNode = source.replace(
  '(request: Request): Response',
  '(request)',
);
assert.notEqual(rewrittenForNode, source, 'Unexpected Edge handler signature');

let handler;
runInNewContext(rewrittenForNode, {
  Deno: { serve: (fn) => { handler = fn; } },
  Response,
  JSON,
});
assert.equal(typeof handler, 'function');

for (const [method, path] of [
  ['GET', '/payments'],
  ['GET', '/payments/00000000-0000-0000-0000-000000000001'],
  ['GET', '/payments/00000000-0000-0000-0000-000000000001/summary'],
  ['GET', '/notifications'],
  ['GET', '/office/inbox'],
  ['POST', '/payments'],
  ['POST', '/office/payments/00000000-0000-0000-0000-000000000001/review'],
  ['POST', '/office/payments/00000000-0000-0000-0000-000000000001/state'],
  ['PATCH', '/notifications/1'],
]) {
  test(`legacy ${method} ${path} fails closed without SQL`, async () => {
    const req = new Request(
      `https://example.invalid/taxpay-handoff-api${path}`,
      { method, ...(method === 'GET' ? {} : { body: '{}' }) },
    );
    const response = handler(req);
    assert.equal(response.status, 410);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.code, 'LEGACY_HANDOFF_RETIRED');
    assert.equal(body.simulationOnly, true);
    assert.deepEqual(Object.keys(body).sort(), [
      'code', 'simulationOnly', 'success',
    ]);
  });
}

test('CORS preflight remains non-mutating and compatible', () => {
  const response = handler(
    new Request('https://example.invalid/taxpay-handoff-api/payments', {
      method: 'OPTIONS',
    }),
  );
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
  assert.match(response.headers.get('Access-Control-Allow-Methods'), /OPTIONS/);
});
