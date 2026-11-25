import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css=readFileSync('src/styles/taxpay-unified-table.css','utf8');
const page=readFileSync('src/components/screens/Beneficiaries.tsx','utf8');

test('beneficiary list dropdown escapes the later register overflow rule without affecting other tables',()=>{
  const base=css.indexOf('.taxpay-taxpayer-reference .taxpay-office-register-frame {');
  const exception=css.indexOf('.taxpay-taxpayer-reference .taxpay-office-register-frame:has(.beneficiary-directory__list-toolbar) {');
  assert.ok(base>=0 && exception>base,'picker-specific exception must follow the final register base rule');
  const baseRule=css.slice(base,css.indexOf('}',base)+1);
  const exceptionRule=css.slice(exception,css.indexOf('}',exception)+1);
  assert.match(baseRule,/overflow:hidden/,'ordinary registers preserve clipping');
  assert.match(exceptionRule,/overflow:visible/,'only the beneficiary picker register releases its popover');
  assert.match(page,/beneficiary-list-picker__menu/,'the menu remains in the approved picker');
  assert.match(css,/\.taxpay-table-viewport\s*\{[\s\S]*?overflow-x:\s*auto/,'table viewport still owns horizontal scrolling');
});
