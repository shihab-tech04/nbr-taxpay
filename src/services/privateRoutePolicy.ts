import type { UserRole } from '../types/tax';

const accountRoutes = new Set([
  'taxpayer_home', 'dashboard', 'wizard', 'history', 'ledger', 'journey',
  'certificates', 'corrections', 'notifications', 'account_notifications',
  'account_profile', 'account_settings', 'services'
]);
const reviewOnlySampleRoles = new Set<UserRole>([
  'TAXPAYER_INDIVIDUAL', 'TAXPAYER_CORPORATE', 'WITHHOLDING_AGENT'
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
  return !officerRoute && isPrivateTaxpayerRoute(route, false) &&
    !verifiedApplicationUser && !(localReviewMode && reviewOnlySampleRoles.has(selectedRole));
}
