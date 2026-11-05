import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

/** Board Meeting table parity: record metadata, headers and counters stay readable. */
test('TaxPay shared table styles never reduce readable text below 14px', () => {
  const css = readFileSync(new URL('../src/styles/taxpay-unified-table.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /font-size:\\s*(?:[0-9]|1[0-3])px\\s*;/,
    'Table typography below 14px breaks the approved readable minimum');
  assert.match(css, /\\.taxpay-table-count\\s*\\{[^}]*font-size:\\s*14px/s,
    'Shared result count must use the approved 14px size');
});
