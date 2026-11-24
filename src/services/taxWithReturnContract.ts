/** Exclusive one-recipient, one-assessment-year Tax with Return input contract.
 * Re-validate restored drafts: hidden stale fields must never change who gets
 * the payment, its head, or its year. No new financial authority is created. */
import { PAY_AGAIN_YEAR_OPTIONS } from './payAgain';
export const RETURN_HEAD_ID = 125;
export const RETURN_YEARS: readonly string[] = PAY_AGAIN_YEAR_OPTIONS;
export type ReturnIssue = 'recipient' | 'head' | 'year';
type ReturnSelection = {
  assessmentYear?: unknown;
  additionalTaxpayers?: unknown;
  oneTimeTaxpayer?: unknown;
  otherTaxLines?: unknown;
  selectedHeadIds?: unknown;
  sourceAllocationIds?: unknown;
};
const isEmptyArray = (value: unknown) => value === undefined ||
  (Array.isArray(value) && value.length === 0);
export function returnOnlyIssue(value: ReturnSelection, allowBlankYear = false): ReturnIssue | null {
  if (!isEmptyArray(value.additionalTaxpayers) ||
      (value.oneTimeTaxpayer !== undefined && value.oneTimeTaxpayer !== null) ||
      (value.sourceAllocationIds !== undefined &&
       (!Array.isArray(value.sourceAllocationIds) || value.sourceAllocationIds.length > 1)))
    return 'recipient';
  if (!isEmptyArray(value.otherTaxLines) ||
      (value.selectedHeadIds !== undefined &&
       (!Array.isArray(value.selectedHeadIds) ||
        value.selectedHeadIds.some(id => id !== RETURN_HEAD_ID))))
    return 'head';
  if (!RETURN_YEARS.includes(value.assessmentYear as string) &&
      !(allowBlankYear && value.assessmentYear === ''))
    return 'year';
  return null;
}
export function assertReturnDraftExclusive(saved: Record<string, unknown>): void {
  if (saved.category !== 'TAX_WITH_RETURN') return;
  const issue = returnOnlyIssue(saved, true);
  if (issue) throw Error(issue === 'recipient'
    ? 'Tax with Return supports exactly one taxpayer. Start a fresh Return payment.'
    : issue === 'head'
    ? 'Tax with Return cannot contain another payment head. Start a fresh Return payment.'
    : 'The saved Return assessment year is invalid. Start again and choose one year.');
  const amounts = saved.amountInputs;
  if (amounts !== undefined &&
      (!amounts || typeof amounts !== 'object' || Array.isArray(amounts) ||
       Object.keys(amounts).some(key => key !== String(RETURN_HEAD_ID))))
    throw Error('Tax with Return has conflicting saved payment amounts. Start a fresh Return payment.');
}
