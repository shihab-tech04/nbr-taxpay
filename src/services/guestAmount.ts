/** Validate the one amount collected by the v11 guest payment journey. */
export function parseGuestAmount(raw: string): number | null {
  const value = raw.trim();
  if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value)) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}
