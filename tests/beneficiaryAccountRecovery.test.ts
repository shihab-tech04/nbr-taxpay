import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { hasExistingGuestBeneficiaryAccess } from '../src/services/guestBeneficiaries';

test('account recovery detection never provisions a new browser guest session', () => {
  const originalWindow = (globalThis as { window?: unknown }).window;
  const state = new Map<string, string>();
  let writes = 0;
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (key: string) => state.get(key) ?? null,
      setItem: (key: string, value: string) => { writes++; state.set(key, value); },
      removeItem: (key: string) => { writes++; state.delete(key); },
    },
  };
  try {
    assert.equal(hasExistingGuestBeneficiaryAccess(), false);
    const key = 'korbritto.guest-beneficiaries.capability.v1';
    state.set(key, 'invalid');
    assert.equal(hasExistingGuestBeneficiaryAccess(), false);
    state.set(key, 'A'.repeat(43));
    assert.equal(hasExistingGuestBeneficiaryAccess(), true);
    assert.equal(writes, 0, 'Detecting a recoverable address book must not create or modify a capability');
  } finally {
    if (originalWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else (globalThis as { window?: unknown }).window = originalWindow;
  }
});

test('recovery is opt-in, owner-checked, non-destructive and readback verified', () => {
  const service = readFileSync('src/services/beneficiaryAccountRecovery.ts', 'utf8');
  const screen = readFileSync('src/components/screens/BeneficiaryAccountRecovery.tsx', 'utf8');
  const directory = readFileSync('src/components/screens/Beneficiaries.tsx', 'utf8');
  assert.match(service, /client\.auth\.getUser\(\)/);
  assert.match(service, /data\.user\?\.id !== ownerUid/);
  assert.match(service, /await loadBeneficiaries\(ownerUid\)/);
  assert.match(service, /await addBeneficiaries\(/);
  assert.match(service, /savedTins\.has\(person\.tin\)/);
  assert.doesNotMatch(service, /deleteGuest|removeGuest|\.delete\(/);
  assert.match(screen, /onClick=\{\(\) => void recover\(\)\}/);
  assert.match(directory, /\{owner&&!checkingIdentity&&<BeneficiaryAccountRecovery/);
});
