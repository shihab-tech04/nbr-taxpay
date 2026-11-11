/**
 * The current application has no connected, owner-verified external NBR
 * assessment + tax-credit response. Never promote local examples, story
 * payments, saved drafts or internally recorded receipts into official credits.
 *
 * When an authorized integration is added, pass its verified, fully fetched
 * per-owner and per-year response through this same fail-closed eligibility gate.
 */
export type VerifiedExternalDashboardState = {
  ownerUid: string;
  assessmentYear: string;
  assessment: {status: 'success' | 'empty' | 'error'; recordCount: number};
  postedCredits: {status: 'success' | 'empty' | 'error'; recordCount: number};
};

export function canShowVerifiedExternalDashboardRow(
  snapshot: VerifiedExternalDashboardState | null,
  ownerUid: string | null,
  assessmentYear: string,
): boolean {
  return Boolean(snapshot && ownerUid && snapshot.ownerUid === ownerUid &&
    snapshot.assessmentYear === assessmentYear &&
    snapshot.assessment.status === 'success' &&
    snapshot.postedCredits.status === 'success' &&
    Number.isSafeInteger(snapshot.assessment.recordCount) && snapshot.assessment.recordCount > 0 &&
    Number.isSafeInteger(snapshot.postedCredits.recordCount) && snapshot.postedCredits.recordCount > 0);
}

/** No verified external endpoint or data contract exists in the current production build. */
export function currentVerifiedExternalDashboard(): VerifiedExternalDashboardState | null {
  return null;
}
