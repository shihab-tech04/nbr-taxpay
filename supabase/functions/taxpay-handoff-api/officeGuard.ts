/** Office-only handoff routes require a separately verified Office identity.
 * Synthetic guest payment/history routes must remain accessible to their
 * existing capability checks; an arbitrary actorCode is not authorization.
 */
export function requiresVerifiedOfficeIdentity(path: string): boolean {
  return path === '/office' || path.startsWith('/office/');
}
