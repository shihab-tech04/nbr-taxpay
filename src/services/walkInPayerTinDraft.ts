/**
 * Form-draft restoration must preserve payer identity independently of which
 * modal reopens the draft. The original tax flow retains its own 12-digit
 * validation; only the parallel flow may accept the approved 13-digit samples.
 * All payer lookups/confirmations must be re-established after restoring.
 */
export function normalizeRestoredWalkInPayerTin(value: string): string {
  return value.replace(/\D/g, '').slice(0, 13);
}
