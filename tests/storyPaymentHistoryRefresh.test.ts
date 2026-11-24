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
  t.mock.method(globalThis, 'fetch', async () => accepted
    ? new Response(JSON.stringify({ success: true, id, status: 'SIMULATED_SUCCESS', mirrored: true, simulationOnly: true }), { status: 200 })
    : new Response(JSON.stringify({ error: 'SUBMISSION_FAILED' }), { status: 400 }));
  await assert.rejects(persistSimulatedPayment(input), /SUBMISSION_FAILED/);
  assert.equal(refreshes, 0);
  accepted = true;
  const result = await persistSimulatedPayment(input);
  assert.equal(result.id, id);
  assert.equal(refreshes, 1);
});

import {initialActivityYear,compareActivityNewestFirst} from '../src/services/activityYearScope';

test('ordinary signed-in Activity includes all years; explicit filters and dashboard scope survive',()=>{
  assert.equal(initialActivityYear(null,'2025-2026',true,false),'all');
  assert.equal(initialActivityYear('2026-2027','2025-2026',true,false),'2026-2027');
  assert.equal(initialActivityYear('all','2025-2026',true,false),'all');
  assert.equal(initialActivityYear(null,'2025-2026',true,true),'2025-2026');
  assert.equal(initialActivityYear(null,'2025-2026',false,false),'2025-2026');
  assert.equal(initialActivityYear('garbage','2025-2026',true,false),'all');
});
test('latest recorded payment wins within the same calendar day',()=>{
  const older={date:'2026-11-24',occurredAt:'2026-11-24T05:40:17Z'};
  const newest={date:'2026-11-24',occurredAt:'2026-11-24T05:47:29Z'};
  const example={date:'2026-10-12'};
  assert.deepEqual([older,example,newest].sort(compareActivityNewestFirst),[newest,older,example]);
});
