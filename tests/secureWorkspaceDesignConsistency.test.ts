import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('src/components/screens/SecureWorkspace.tsx', 'utf8');

test('SQL-backed authenticated draft workspace respects Korbritto government-blue tokens', () => {
  for (const token of ['text-taxpay-dark', 'bg-taxpay-primary', 'border-taxpay-primary',
    'focus-visible:outline-taxpay-primary']) {
    assert.ok(source.includes(token), `missing Korbritto token: ${token}`);
  }
  assert.doesNotMatch(source, /(?:text|bg|border|outline)-emerald-/,
    'draft workspace must not use an unrelated green palette');
  assert.doesNotMatch(source, /font-serif-fraunces/,
    'authenticated form headings follow the shared Poppins/Noto Sans heading hierarchy');
});

test('draft ownership and SQL readback safeguards survive UI refinement', () => {
  for (const safeguard of ['sameAuthenticatedOwner(', 'confirmPrivateDraftReadBack(',
    'confirmPrivateDraftUpdate(', 'confirmDraftDeletion(']) {
    assert.ok(source.includes(safeguard), `missing draft safeguard: ${safeguard}`);
  }
});
