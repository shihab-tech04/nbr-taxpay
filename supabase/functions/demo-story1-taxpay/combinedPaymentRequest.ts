/** Respect the legacy 12k limit while accepting the canonical SQL combined
 * contract up to 750k. This helper has no secret or network dependencies. */
export const MAX_LEGACY_PAYMENT_PAYLOAD_CHARS = 12_000;
export const MAX_COMBINED_PAYMENT_PAYLOAD_CHARS = 750_000;

export function acceptPaymentRequestSize(rawLength: number,input: unknown): boolean {
  if (!Number.isSafeInteger(rawLength) || rawLength < 1 ||
      rawLength > MAX_COMBINED_PAYMENT_PAYLOAD_CHARS) return false;
  if (rawLength <= MAX_LEGACY_PAYMENT_PAYLOAD_CHARS) return true;
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const payload = input as Record<string, unknown>;
  if (!payload.details || typeof payload.details !== 'object' ||
      Array.isArray(payload.details)) return false;
  return payload.service === 'OTHER_TAX_PAYMENT' &&
    (payload.details as Record<string, unknown>).combinedPayment === true;
}

/** Office validates signed proof, then independently fetches authoritative SQL. */
export const officeMirrorIdentity = (id: string,sessionId: string) => ({id,sessionId});
