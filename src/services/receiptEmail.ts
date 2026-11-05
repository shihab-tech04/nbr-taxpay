/** Optional receipt contact, never an authentication identifier. */
export function isOptionalReceiptEmailValid(value: string): boolean {
  const email = value.trim();
  if (!email) return true;
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}
export function normaliseReceiptEmail(value: string): string | undefined {
  return value.trim() || undefined;
}
