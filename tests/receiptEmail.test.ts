import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { isOptionalReceiptEmailValid, normaliseReceiptEmail } from '../src/services/receiptEmail';


test('permits blank email and trims the stored value', () => {
    assert.equal(isOptionalReceiptEmailValid(''), true);
    assert.equal(isOptionalReceiptEmailValid('  '), true);
    assert.equal(normaliseReceiptEmail(''), undefined);
    assert.equal(normaliseReceiptEmail('  payer@example.com  '), 'payer@example.com');
  });

test('accepts typical addresses and rejects malformed or excessive input', () => {
    assert.equal(isOptionalReceiptEmailValid('payer+tax@example.com'), true);
    for (const email of ['payer', 'payer@', '@example.com', 'payer@example', 'payer @example.com', 'payer@example.com\nBCC:test@example.com', 'a'.repeat(250) + '@example.com']) {
      assert.equal(isOptionalReceiptEmailValid(email), false, email);
    }
  });

