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

/** HTTP success is not enough: insertion needs exactly one newly returned draft identity. */
export function confirmPrivateDraftInsert(rows: unknown): boolean {
  if (!Array.isArray(rows) || rows.length !== 1) return false;
  const row = rows[0];
  return Boolean(row && typeof row === 'object' && 'id' in row &&
    typeof row.id === 'string' && row.id.trim().length > 0);
}
