import type { DemoUserId } from '../data/demoUsers';

/**
 * Seven stable, fictional payment examples for the User1 prototype.
 * Never infer a legal liability or an NBR demand from scenario history.
 * No other user's account receives these figures.
 */
export type SuggestedAmountGroup =
  | 'Tax with Return'
  | 'Advance Tax'
  | 'Tax against Demand'
  | 'Penalty'
  | 'Appellate Tribunal'
  | 'Others';

export type SuggestedPaymentAmount = Readonly<{
  id: string;
  group: SuggestedAmountGroup;
  assessmentYear: string;
  amount: string;
}>;

export const USER1_PAYMENT_AMOUNT_EXAMPLES: readonly SuggestedPaymentAmount[] = Object.freeze([
  { id: 'U1-AMT-01', group: 'Tax with Return', assessmentYear: '2026-27', amount: '12750' },
  { id: 'U1-AMT-02', group: 'Advance Tax', assessmentYear: '2026-27', amount: '4500' },
  { id: 'U1-AMT-03', group: 'Advance Tax', assessmentYear: '2024-25', amount: '3200' },
  { id: 'U1-AMT-04', group: 'Tax against Demand', assessmentYear: '2025-26', amount: '7800' },
  { id: 'U1-AMT-05', group: 'Penalty', assessmentYear: '2025-26', amount: '850' },
  { id: 'U1-AMT-06', group: 'Appellate Tribunal', assessmentYear: '2026-27', amount: '5600' },
  { id: 'U1-AMT-07', group: 'Others', assessmentYear: '2026-27', amount: '1950' },
]);

/** The amount is a user-editable starting value, never a verified payable. */
export function paymentAmountSuggestionFor(
  userId: DemoUserId | null | undefined,
  group: string | null | undefined,
  assessmentYear: string,
): SuggestedPaymentAmount | null {
  if (userId !== 'user1' || !group) return null;
  return USER1_PAYMENT_AMOUNT_EXAMPLES.find(
    item => item.group === group && item.assessmentYear === assessmentYear,
  ) ?? null;
}
