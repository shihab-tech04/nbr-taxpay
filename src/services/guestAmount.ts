/** Parse BDT amounts without losing cents or rejecting valid 11–13 digit entries. */
function parseGuestMinorUnits(raw: string): bigint | null {
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
export function sumGuestAmounts(amounts: string[]): number | null {
  let cents = 0n;
  for (const raw of amounts) {
    const value = parseGuestMinorUnits(raw);
    if (value === null) return null;
    cents += value;
    if (cents > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  }
  return Number(cents) / 100;
}
