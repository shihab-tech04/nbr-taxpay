import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsxCopySignature } from './release-mode.mjs';

const good = "<section><h1>{bn ? 'সমস্যা জানান' : 'Report a problem'}</h1><p>Describe an issue</p></section>";
const translated = "<section><h1>{bn ? 'নতুন বিবরণ' : 'Contact support'}</h1><p>Describe your concern</p></section>";
test('literal-only JSX wording normalizes to the identical source structure', () => {
  const a = jsxCopySignature(good), b = jsxCopySignature(translated);
  assert.ok(a && b);
  assert.equal(a.normalized,b.normalized);
});
test('attributes, conditions and event handlers remain protected from the copy-only lane', () => {
  const a = jsxCopySignature(good);
  assert.notEqual(a.normalized,jsxCopySignature(good.replace('bn ?', 'enabled ?')).normalized);
  assert.notEqual(a.normalized,jsxCopySignature(good.replace('<section>', '<section className="changed">')).normalized);
  assert.notEqual(a.normalized,jsxCopySignature(good.replace('<p>', '<p onClick={send}>')).normalized);
});
test('unparseable JSX is not safe copy', () => {
  assert.equal(jsxCopySignature('<section><h1>broken</section>'),null);
});
