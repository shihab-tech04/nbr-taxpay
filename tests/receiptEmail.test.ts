import { describe, expect, it } from 'vitest';
import { isOptionalReceiptEmailValid, normaliseReceiptEmail } from '../src/services/receiptEmail';

describe('optional receipt contact email', () => {
  it('permits blank email and trims the stored value', () => {
    expect(isOptionalReceiptEmailValid('')).toBe(true);
    expect(isOptionalReceiptEmailValid('  ')).toBe(true);
    expect(normaliseReceiptEmail('')).toBeUndefined();
    expect(normaliseReceiptEmail('  payer@example.com  ')).toBe('payer@example.com');
  });

  it('accepts typical addresses and rejects malformed or excessive input', () => {
    expect(isOptionalReceiptEmailValid('payer+tax@example.com')).toBe(true);
    for (const email of ['payer', 'payer@', '@example.com', 'payer@example', 'payer @example.com', 'payer@example.com\nBCC:test@example.com', 'a'.repeat(250) + '@example.com']) {
      expect(isOptionalReceiptEmailValid(email), email).toBe(false);
    }
  });
});
