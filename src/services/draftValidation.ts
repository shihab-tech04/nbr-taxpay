export type DraftPurpose = 'TAX_LIABILITY_PAYMENT' | 'WITHHOLDING_TAX_DEPOSIT';
export type DraftCategory = 'TAX_WITH_RETURN' | 'ADVANCE_TAX' | 'ASSESSED_DEMAND' | 'PENALTY' | 'SOURCE_TAX_DEPOSIT' | 'APPELLATE_TRIBUNAL' | 'OTHER_TAX_PAYMENT';
export const DRAFT_CATEGORIES: Record<DraftCategory, string> = {
  TAX_WITH_RETURN: 'Tax with Return',
  ADVANCE_TAX: 'Advance Tax',
  ASSESSED_DEMAND: 'Assessed Demand',
  PENALTY: 'Penalty',
  SOURCE_TAX_DEPOSIT: 'Source Tax Deposit',
  APPELLATE_TRIBUNAL: 'Appellate Tribunal',
  OTHER_TAX_PAYMENT: 'Other Tax Payment (reference required before submission)',
};
export type DraftInput = { purpose: DraftPurpose; category: DraftCategory; assessmentYear: string; amount: string; memo: string };
export function validateDraft(input: DraftInput): { amountMinor: number; error: string | null } {
  if ((input.purpose === 'WITHHOLDING_TAX_DEPOSIT') !== (input.category === 'SOURCE_TAX_DEPOSIT')) {
    return { amountMinor: 0, error: 'Withholding deposits and tax-liability categories cannot be mixed.' };
  }
  const match = /^(20\d{2})-(\d{2})$/.exec(input.assessmentYear);
  if (!match || Number(match[2]) !== ((Number(match[1]) + 1) % 100)) {
    return { amountMinor: 0, error: 'Enter a correctly formatted assessment-year label such as 2026-27. This does not verify its legal applicability.' };
  }
  if (!/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(input.amount)) {
    return { amountMinor: 0, error: 'Enter a positive BDT amount with at most two decimal places.' };
  }
  const [whole, fraction = ''] = input.amount.split('.');
  const amountMinor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || amountMinor > 99999999999999) {
    return { amountMinor: 0, error: 'Amount is outside the permitted draft range.' };
  }
  if (input.memo.length > 300) {
    return { amountMinor: 0, error: 'Notes must be 300 characters or fewer.' };
  }
  return { amountMinor, error: null };
}
