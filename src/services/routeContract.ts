/** Registered app destinations. An unknown ?action= must never masquerade as a valid screen. */
export const ROUTES = [
  'landing', 'user_guide', 'secure_workspace', 'head_catalogue', 'guest', 'guestwh',
  'travel', 'verify', 'incident', 'architecture', 'taxpayer_home', 'dashboard',
  'wizard', 'history', 'payment_details', 'ledger', 'journey', 'certificates',
  'corrections', 'notifications', 'account_notifications', 'account_profile',
  'account_settings', 'services', 'office_login', 'officer_home', 'taxpayer_360',
  'payment_search', 'correction_queue', 'case_management', 'incident_investigation',
  'offline_evidence', 'audit_trail', 'intelligence', 'monitoring', 'ontology',
  'glossary', 'guidance'
] as const;

const registered = new Set<string>(ROUTES);
export const validRoute = (value: string | null | undefined): string =>
  value && registered.has(value) ? value : 'landing';

/** Only navigation context, never payment fields or taxpayer identity, belongs in the URL. */
const routeQueryKeys = ['category', 'initialCategory', 'draftCategory', 'categoryFilter', 'reviewStatuses'] as const;
const reviewStatuses = new Set(['PENDING', 'FAILED', 'REVERSED', 'DISPUTED', 'REQUESTED']);

export function routeContextFromUrl(route: string, search: URLSearchParams): Record<string, unknown> {
  if (route === 'user_guide' && search.has('category')) return {category: search.get('category')};
  if ((route === 'guest' || route === 'wizard') && search.has('initialCategory'))
    return {initialCategory: search.get('initialCategory')};
  if (route === 'secure_workspace' && search.has('draftCategory')) return {draftCategory: search.get('draftCategory')};
  if (route !== 'history') return {};
  const result: Record<string, unknown> = {};
  if (search.has('categoryFilter')) result.categoryFilter = search.get('categoryFilter');
  const statuses = search.get('reviewStatuses')?.split(',').filter(value => reviewStatuses.has(value));
  if (statuses?.length) result.reviewStatuses = statuses;
  return result;
}

export function writeRouteContext(route: string, params: Record<string, any>, search: URLSearchParams) {
  routeQueryKeys.forEach(key => search.delete(key));
  const put = (name: typeof routeQueryKeys[number], value: unknown) => {
    if (typeof value === 'string' && /^[\w-]{1,40}$/.test(value)) search.set(name, value);
  };
  if (route === 'user_guide') put('category', params.category);
  if (route === 'guest' || route === 'wizard') put('initialCategory', params.initialCategory);
  if (route === 'secure_workspace') put('draftCategory', params.draftCategory);
  if (route === 'history') {
    put('categoryFilter', params.categoryFilter);
    if (Array.isArray(params.reviewStatuses)) {
      const statuses = params.reviewStatuses.filter((value: unknown) => typeof value === 'string' && reviewStatuses.has(value));
      if (statuses.length) search.set('reviewStatuses', statuses.join(','));
    }
  }
}
