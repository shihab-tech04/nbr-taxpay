import { test } from 'node:test';
import assert from 'node:assert/strict';
import { persistSimulatedPayment, type StoryPaymentInput } from '../src/services/simulatedPaymentStory';

test('confirmed payment invalidates mounted SQL history; rejected payment does not', async t => {
  const events = new EventTarget();
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: events });
  t.after(() => {
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  });
  const input: StoryPaymentInput = {
    idempotencyKey: '11111111-1111-4111-8111-111111111111',
    sessionId: '22222222-2222-4222-8222-222222222222',
    service: 'OTHER_TAX_PAYMENT',
    amountMinor: 10000,
    details: {},
  };
  const id = '33333333-3333-4333-8333-333333333333';
  let refreshes = 0;
  events.addEventListener('taxpay:story-payments-recovered', () => { refreshes++; });
  let accepted = false;
  let readbacks = 0;
  t.mock.method(globalThis, 'fetch', async (url: RequestInfo | URL, options?: RequestInit) => {
    if (options?.method === 'POST') return accepted
      ? Response.json({success: true, id, status: 'SIMULATED_SUCCESS', mirrored: true, simulationOnly: true})
      : Response.json({error: 'SUBMISSION_FAILED'}, {status: 400});
    if (String(url).includes('/payments/' + id + '?sessionId=')) {
      readbacks++;
      return Response.json({success: true, simulationOnly: true, data: {
        id, status: 'SIMULATED_SUCCESS', data: input,
      }});
    }
    throw new Error('Unexpected payment test request: ' + String(url));
  });
  await assert.rejects(persistSimulatedPayment(input), /SUBMISSION_FAILED/);
  assert.equal(refreshes, 0);
  assert.equal(readbacks, 0);
  accepted = true;
  const result = await persistSimulatedPayment(input);
  assert.equal(result.id, id);
  assert.equal(readbacks, 1, 'mirrored success must verify the exact source SQL readback');
  assert.equal(refreshes, 1);
});
