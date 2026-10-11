/** Browser navigation and application-account protections. Never confers eTIN or tax officer authority. */
export function authRedirectUrl(origin: string, basePath: string): string {
  if (!/^https?:\/\//.test(origin)) throw new Error('Invalid authentication redirect origin');
  if (!basePath.startsWith('/') || basePath.startsWith('//') || basePath.includes('..') ||
      basePath.includes('?') || basePath.includes('#') || !basePath.endsWith('/')) {
    throw new Error('Invalid authentication redirect base path');
  }
  return origin.replace(/\/$/, '') + basePath + '?action=secure_workspace';
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
