import { DRAFT_CATEGORIES, validateDraft, type DraftCategory, type DraftInput, type DraftPurpose } from './draftValidation';

export type PrivateDraftRecord = {
  id: string;
  purpose: string;
  category: string;
  assessment_year: string;
  amount_minor: number;
  memo: string | null;
};

/** Convert a stored private planning draft back into editable form without rounding cents. */
export function privateDraftToInput(row: PrivateDraftRecord): DraftInput | null {
  if (!row.id || !Number.isSafeInteger(row.amount_minor) || row.amount_minor <= 0) return null;
  if (row.purpose !== 'TAX_LIABILITY_PAYMENT' && row.purpose !== 'WITHHOLDING_TAX_DEPOSIT') return null;
  if (!Object.prototype.hasOwnProperty.call(DRAFT_CATEGORIES, row.category)) return null;
  if (row.memo !== null && typeof row.memo !== 'string') return null;

  const minor = BigInt(row.amount_minor);
  const input: DraftInput = {
    purpose: row.purpose as DraftPurpose,
    category: row.category as DraftCategory,
    assessmentYear: row.assessment_year,
    amount: `${minor / 100n}.${String(minor % 100n).padStart(2, '0')}`,
    memo: row.memo ?? '',
  };
  return validateDraft(input).error === null ? input : null;
}

/** RLS may return no rows for a stale or non-owned update; require one exact returned ID. */
export function confirmPrivateDraftUpdate(expectedId: string, rows: unknown): boolean {
  if (!expectedId || !Array.isArray(rows) || rows.length !== 1) return false;
  const row = rows[0];
  return Boolean(row && typeof row === 'object' && 'id' in row && row.id === expectedId);
}

/** Evidence must come from a subsequent authenticated SELECT, not the HTTP INSERT/PATCH acknowledgement.
 * Every financial field and row ownership must match. This is still not proof of disk persistence
 * after a database restart; the isolated integration suite tests that separately.
 */
export type DraftReadBackExpectation = {
  id: string;
  owner_uid: string;
  purpose: string;
  category: string;
  assessment_year: string;
  amount_minor: number;
  memo: string | null;
};
export function confirmPrivateDraftReadBack(expected: DraftReadBackExpectation, rows: unknown): boolean {
  if (!expected.id || !expected.owner_uid || !Array.isArray(rows)) return false;
  const matches = rows.filter(row => row && typeof row === 'object' &&
    (row as Record<string, unknown>).id === expected.id);
  if (matches.length !== 1) return false;
  const row = matches[0] as Record<string, unknown>;
  return row.owner_uid === expected.owner_uid &&
    row.record_status === 'DRAFT' &&
    row.purpose === expected.purpose &&
    row.category === expected.category &&
    row.assessment_year === expected.assessment_year &&
    Number.isSafeInteger(expected.amount_minor) && expected.amount_minor > 0 &&
    row.amount_minor === expected.amount_minor &&
    row.memo === expected.memo;
}
