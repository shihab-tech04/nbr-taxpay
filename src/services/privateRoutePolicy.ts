import type { UserRole } from '../types/tax';

const accountRoutes = new Set([
  'taxpayer_home', 'dashboard', 'wizard', 'history', 'ledger', 'journey',
  'certificates', 'corrections', 'notifications', 'account_notifications',
  'account_profile', 'account_settings', 'services'
]);
const reviewOnlySampleRoles = new Set<UserRole>([
  'TAXPAYER_INDIVIDUAL', 'TAXPAYER_CORPORATE', 'WITHHOLDING_AGENT'
]);
// Development's existing account-center screens already render an explicitly
// signed-out empty state. Retain that tested state for visual regression runs.
// In a published build every one of these URLs needs a real account session.
const developmentGuestAccountRoutes = new Set([
  'notifications', 'account_notifications', 'account_profile', 'account_settings'
]);

export function isPrivateTaxpayerRoute(route: string, officerRoute: boolean): boolean {
  return (!officerRoute && route === 'payment_details') || accountRoutes.has(route);
}

/** An application account must exist before a published site shows account pages.
 * Local development preserves historical synthetic workflows for UX regression.
 * Neither a URL nor a saved browser-history role grants published-site access.
 */
export function requiresTaxpayerSignIn(
  route: string,
  officerRoute: boolean,
  verifiedApplicationUser: boolean,
  localReviewMode: boolean,
  selectedRole: UserRole
): boolean {
  if (localReviewMode && developmentGuestAccountRoutes.has(route)) return false;
  return !officerRoute && isPrivateTaxpayerRoute(route, false) &&
    !verifiedApplicationUser && !(localReviewMode && reviewOnlySampleRoles.has(selectedRole));
}
