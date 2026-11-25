import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Keep status semantics accurate when preference persistence fails.
// The saved beneficiary rows are not changed by a preference-save error.
const source = readFileSync('src/components/screens/Beneficiaries.tsx','utf8');

test('list preference save failure is not presented as a green success notice', () => {
  const start = source.indexOf('const rememberList=');
  const end = source.indexOf('const initialRequestRef=', start);
  assert.ok(start >= 0 && end > start);
  const handler = source.slice(start, end);
  assert.match(handler, /setPreferenceError\(\{en:'Could not remember/);
  assert.doesNotMatch(handler, /setNotice\(\{en:'Could not remember/);
  assert.match(source, /\{preferenceError&&<p role="alert" className="[^"]*border-red-200/);
  assert.match(source, /\{notice&&<p role="status" aria-live="polite" className="[^"]*border-emerald-200/);
  assert.match(handler, /setPreferenceError\(null\)/);
});
