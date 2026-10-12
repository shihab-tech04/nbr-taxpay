import { DRAFT_CATEGORIES, type DraftCategory } from './draftValidation';

/** Browser navigation and application-account protections. Never confers eTIN or tax officer authority. */
/** Only approved planning categories may cross the auth redirect. Do not put amount, TIN or payer details in a URL. */
export function verifiedDraftCategory(routeValue: unknown, callbackValue: unknown): DraftCategory | null {
  for (const input of [callbackValue, routeValue]) {
    if (typeof input === 'string' && Object.prototype.hasOwnProperty.call(DRAFT_CATEGORIES, input)) {
      return input as DraftCategory;
    }
  }
  return null;
}
export function draftSeedForCategory(category: DraftCategory | null) {
  return category ? {
    purpose: category === 'SOURCE_TAX_DEPOSIT' ? 'WITHHOLDING_TAX_DEPOSIT' as const : 'TAX_LIABILITY_PAYMENT' as const,
    category,
    assessmentYear: '', amount: '', memo: ''
  } : null;
}

export function authRedirectUrl(origin: string, basePath: string, category?: DraftCategory): string {
  if (!/^https?:\/\//.test(origin)) throw new Error('Invalid authentication redirect origin');
  if (!basePath.startsWith('/') || basePath.startsWith('//') || basePath.includes('..') ||
      basePath.includes('?') || basePath.includes('#') || !basePath.endsWith('/')) {
    throw new Error('Invalid authentication redirect base path');
  }
  const redirect = new URL(origin.replace(/\/$/, '') + basePath + '?action=secure_workspace');
  if (category && Object.prototype.hasOwnProperty.call(DRAFT_CATEGORIES, category)) {
    redirect.searchParams.set('draftCategory', category);
  }
  return redirect.toString();
}
export function sameAuthenticatedOwner(actualUserId: string | null | undefined, expectedUserId: string): boolean {
  return typeof actualUserId === 'string' && actualUserId.length > 0 &&
    actualUserId === expectedUserId;
}

/** A delayed startup identity check must not replace auth state observed after it began. */
export function shouldApplyInitialAuthResolution(startedAtRevision: number, currentRevision: number): boolean {
  return startedAtRevision === currentRevision;
}

/** Never report a deletion as successful without one exact RETURNING id.
 * A successful HTTP response with zero affected rows is not deletion evidence.
 */
export function confirmDraftDeletion(requestedId: string, returned: unknown): boolean {
  return Array.isArray(returned) && returned.length === 1 &&
    returned[0] !== null && typeof returned[0] === 'object' &&
    returned[0].id === requestedId;
}
