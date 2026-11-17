import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../src/styles/taxpay-service-choice.css',import.meta.url),'utf8');

test('Pay Tax modal responsive container is attached to modal body once',()=>{
  const body=/\.taxpay-citizen-shell\s+\.taxpay-modal\[data-public-service="payment-choice"\]\s+\.taxpay-modal__body\s*\{\s*container:\s*taxpay-payment\s*\/\s*inline-size\s*;/g;
  assert.equal([...css.matchAll(body)].length,1,'modal-body scope must remain unique');
  assert.equal((css.match(/@container\s+taxpay-payment\s*\(max-width:\s*860px\)/g)||[]).length,1,
    'duplicate responsive rules reintroduced from older parallel UI branch');
});
test('embedded Pay Tax flow is NOT itself a layout query container',()=>{
  assert.doesNotMatch(css,/\.payment-flow-embedded\s*\{[^}]*container:\s*taxpay-payment\s*\/\s*inline-size\s*;/,
    'self-containing embedded flow expands short Step 1 to 92dvh (828px at 900px height)');
});
