/**
 * Gift Tax display estimate only, based on the client-supplied Gift Tax flow
 * and its progressive bracket table. Never use this calculation to initiate
 * payment, issue a government challan, or post a tax credit.
 *
 * The Tk 20,000 allowance is annual; other statutory exemptions and prior
 * gifts cannot be verified from the approved four-field form.
 */
export function parseGiftValue(input: string): number | null {
  const value = input.replace(/,/g, '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(Math.round(amount * 100))) return null;
  return amount;
}

export function estimateGiftTax(giftValue: number): number | null {
  if (!Number.isFinite(giftValue) || giftValue < 0 || !Number.isSafeInteger(Math.round(giftValue * 100))) return null;
  let remainingPaisa = Math.max(0, Math.round(giftValue * 100) - 20000 * 100);
  let totalPaisa = 0;
  const brackets = [
    {limit: 500000 * 100, rate: 5},
    {limit: 1000000 * 100, rate: 10},
    {limit: 2000000 * 100, rate: 15},
    {limit: Number.MAX_SAFE_INTEGER, rate: 20},
  ];
  for (const bracket of brackets) {
    if (remainingPaisa <= 0) break;
    const taxable = Math.min(remainingPaisa, bracket.limit);
    totalPaisa += Math.round(taxable * bracket.rate / 100);
    remainingPaisa -= taxable;
  }
  return totalPaisa / 100;
}
