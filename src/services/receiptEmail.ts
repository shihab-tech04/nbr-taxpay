/** Optional receipt-contact email; blank values are permitted. Never infer from a TIN. */
export function isOptionalReceiptEmailValid(value: string): boolean {
  const email = value.trim();
  if (!email) return true;
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function normaliseReceiptEmail(value: string): string | undefined {
  const email = value.trim();
  return email || undefined;
}
