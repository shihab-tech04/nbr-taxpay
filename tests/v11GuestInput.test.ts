import test from 'node:test';
import assert from 'node:assert/strict';
import { findV11GuestNotice, isV11GuestTin, V11_GUEST_NOTICES, V11_GUEST_TINS } from '../src/services/v11GuestInput.ts';

test('v11 guest TIN form has the original six fictional taxpayer identities', () => {
  assert.deepEqual([...V11_GUEST_TINS], [
    '123456789012', '987654321098', '554487213600',
    '445566778899', '112233445566', '667788990011',
  ]);
  for (const tin of V11_GUEST_TINS) assert.equal(isV11GuestTin(tin), true);
  assert.equal(isV11GuestTin('999999999999'), false);
});

test('guest notice prefill follows the v11 outstanding recommendation, not just notice face value', () => {
  assert.equal(V11_GUEST_NOTICES.length, 3);
  assert.deepEqual(findV11GuestNotice('123456789012', ' dn-2026-001187 '), {
    tin: '123456789012', reference: 'DN-2026-001187', category: 'ASSESSED_DEMAND',
    assessmentYear: '2025-26', amount: 80000, defaultHeadId: 145,
  });
  assert.deepEqual(findV11GuestNotice('123456789012', 'pn-2026-000392'), {
    tin: '123456789012', reference: 'PN-2026-000392', category: 'PENALTY',
    assessmentYear: '2025-26', amount: 10000, defaultHeadId: null,
  });
  assert.equal(findV11GuestNotice('123456789012', 'DN-2026-004512'), null);
  assert.equal(findV11GuestNotice('987654321098', 'DN-2026-001187'), null);
  assert.equal(findV11GuestNotice('123456789012', 'RTN-2026-5521907'), null);
});
