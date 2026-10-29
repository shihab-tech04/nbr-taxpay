/** Parse BDT amounts without losing cents or rejecting valid 11–13 digit entries. */
export function parseGuestMinorUnits(raw: string): bigint | null {
  const value = raw.trim();
  if (!/^(?:0|[1-9]\d{0,13})(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0') || '0');
  if (cents <= 0n || cents > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return cents;
}

export function parseGuestAmount(raw: string): number | null {
  const cents = parseGuestMinorUnits(raw);
  return cents === null ? null : Number(cents) / 100;
}

/** Sum exact minor units and reject totals that cannot be represented safely. */
export function sumGuestMinorUnits(amounts: string[]): bigint | null {
  let cents = 0n;
  for (const raw of amounts) {
    const value = parseGuestMinorUnits(raw);
    if (value === null) return null;
    cents += value;
    if (cents > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  }
  return cents;
}

export function sumGuestAmounts(amounts: string[]): number | null {
  const cents = sumGuestMinorUnits(amounts);
  return cents === null ? null : Number(cents) / 100;
}

/**
 * Keep financial amount text input numeric without enabling browser 'e' or '+'
 * notation (as native type=number would). Return null for an invalid edit so
 * pasted extra precision, extra digits or letters never silently change money.
 * Preserve a trailing decimal while the user is typing.
 */
export function normalizeGuestAmountInput(raw: string): string | null {
  const banglaDigits = '০১২৩৪৫৬৭৮৯';
  const normalized = raw.replace(/[০-৯]/g, digit => String(banglaDigits.indexOf(digit)));
  const withLeadingZero = normalized.startsWith('.') ? '0' + normalized : normalized;
  if (!/^(?:[0-9]{0,14})(?:\.[0-9]{0,2})?$/.test(withLeadingZero)) return null;
  return withLeadingZero.replace(/^0+(?=\d)/, '');
}
