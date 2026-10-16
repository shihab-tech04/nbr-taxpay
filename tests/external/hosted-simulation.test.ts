import test from 'node:test';
import assert from 'node:assert/strict';
import { formatSimulatedAmount, parseSimulatedAmount } from '../../src/services/simulatedPaymentsApi';

const hostedUrl = process.env.TAXPAY_HOSTED_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const hostedKey = process.env.TAXPAY_HOSTED_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

test('decimal taka conversion uses exact integer paisa', () => {
  assert.equal(parseSimulatedAmount('100.25'), 10025);
  assert.equal(parseSimulatedAmount('0.01'), 1);
  assert.equal(parseSimulatedAmount('1'), 100);
  assert.throws(() => parseSimulatedAmount('-1'));
  assert.throws(() => parseSimulatedAmount('1.234'));
  assert.throws(() => parseSimulatedAmount('0'));
  assert.match(formatSimulatedAmount(10025), /100.25/);
});

test('hosted anonymous history and notice RPCs disclose no rows', {
  skip: !hostedUrl || !hostedKey ? 'Set a hosted Supabase URL and publishable key to run read-only hosted checks' : false,
}, async () => {
  const endpoint = new URL(hostedUrl!);
  assert.equal(endpoint.protocol, 'https:', 'Hosted checks must target HTTPS');
  assert.match(endpoint.hostname, /\.supabase\.(co|com)$/i, 'Hosted checks must target a Supabase project');

  for (const [name, args] of [
    ['sim_payment_history', { p_user_id: 'user1', p_view: 'beneficiary' }],
    ['sim_payment_notices', { p_user_id: 'user1' }],
  ] as const) {
    const response = await fetch(new URL(`/rest/v1/rpc/${name}`, endpoint), {
      method: 'POST',
      cache: 'no-store',
      headers: {
        apikey: hostedKey!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    });
    assert.ok([400, 401, 403, 404].includes(response.status), `Anonymous ${name} was not denied (HTTP ${response.status})`);
    await response.body?.cancel();
  }
});
