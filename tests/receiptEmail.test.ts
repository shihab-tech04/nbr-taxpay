import test from 'node:test';
import assert from 'node:assert/strict';
import {isOptionalReceiptEmailValid,normaliseReceiptEmail} from '../src/services/receiptEmail';

test('optional receipt email remains optional and trims before persistence',()=>{
  assert.equal(isOptionalReceiptEmailValid(''),true);
  assert.equal(isOptionalReceiptEmailValid('  '),true);
  assert.equal(normaliseReceiptEmail('  '),undefined);
  assert.equal(isOptionalReceiptEmailValid('person@example.com'),true);
  assert.equal(normaliseReceiptEmail(' person@example.com '),'person@example.com');
  for(const input of ['no-at-sign','a@b','a@@b.com','a b@example.com','a@example.com '.repeat(20)])
    assert.equal(isOptionalReceiptEmailValid(input),false);
  assert.equal(isOptionalReceiptEmailValid('a'.repeat(245)+'@x.com'),true);
  assert.equal(isOptionalReceiptEmailValid('a'.repeat(246)+'@x.com'),false);
});
