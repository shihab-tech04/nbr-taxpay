/** Registered app destinations. An unknown ?action= must never masquerade as a valid screen. */
export const ROUTES = [
  'landing', 'user_guide', 'secure_workspace', 'head_catalogue', 'guest', 'guestwh',
  'travel', 'verify', 'incident', 'architecture', 'taxpayer_home', 'dashboard',
  'wizard', 'history', 'payment_details', 'ledger', 'journey', 'certificates',
  'corrections', 'notifications', 'payment_notifications', 'account_notifications', 'account_profile',
  'account_settings', 'manage_authorization', 'beneficiaries', 'services', 'taxpayer_login', 'office_login', 'ontology', 'glossary', 'guidance'
] as const;

const registered = new Set<string>(ROUTES);
/** Legacy Officer URLs are rejected here because Office Management is a separate product. */
export const OFFICE_MANAGEMENT_ROUTE_ALIASES = [
  'officer_home', 'taxpayer_360', 'payment_search', 'correction_queue', 'case_management',
  'incident_investigation', 'offline_evidence', 'audit_trail', 'intelligence', 'monitoring'
] as const;
const officeManagementAliases = new Set<string>(OFFICE_MANAGEMENT_ROUTE_ALIASES);

export const validRoute = (value: string | null | undefined): string =>
  value && registered.has(value) && !officeManagementAliases.has(value) ? value : 'landing';

/** Only navigation context and public synthetic fixture selectors belong in the URL. */
const routeQueryKeys = ['category', 'initialCategory', 'draftCategory', 'categoryFilter', 'reviewStatuses', 'returnTo', 'demoReceipt', 'transactionId', 'docAction', 'trackPayment'] as const;
const reviewStatuses = new Set(['PENDING', 'FAILED', 'REVERSED', 'DISPUTED', 'REQUESTED']);
const receiptReturnRoutes = new Set(['history', 'dashboard', 'taxpayer_home']);

/** A public deep link can restore *only* a fixed synthetic receipt, never a real payment identifier. */
export const publicDemoReceiptId = (value: unknown): string | null =>
  typeof value === 'string' && /^rcpt-10[1-4]$/.test(value) ? value : null;

/** A receipt may return only to its actual originating record list, never an arbitrary URL. */
export const receiptReturnRoute = (value: unknown): string =>
  typeof value === 'string' && receiptReturnRoutes.has(value) ? value : 'history';

export function routeContextFromUrl(route: string, search: URLSearchParams): Record<string, unknown> {
  if (route === 'user_guide' && search.has('category')) return {category: search.get('category')};
  if ((route === 'guest' || route === 'wizard') && search.has('initialCategory'))
    return {initialCategory: search.get('initialCategory')};
  if (route === 'secure_workspace' && search.has('draftCategory')) return {draftCategory: search.get('draftCategory')};
  if (route === 'payment_details') {
    const demoReceipt = publicDemoReceiptId(search.get('demoReceipt'));
    const transactionId=search.get('transactionId');
    const validId=typeof transactionId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(transactionId);
    const docAction=search.get('docAction');
    return {returnTo:receiptReturnRoute(search.get('returnTo')),
      ...(demoReceipt?{demoReceipt}:{}),
      ...(validId?{transactionId}:{}),
      ...(validId&&(docAction==='print'||docAction==='download')?{docAction}:{})};
  }
  if (route !== 'history') return {};
  const result: Record<string, unknown> = {};
  if (search.get('trackPayment') === '1') result.trackPayment = true;
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
  if (route === 'payment_details') {
    put('returnTo', receiptReturnRoute(params.returnTo));
    const demoReceipt = publicDemoReceiptId(params.demoReceipt);
    if (demoReceipt) put('demoReceipt', demoReceipt);
    if(typeof params.transactionId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.transactionId)){
      put('transactionId',params.transactionId);
      if(params.docAction==='print'||params.docAction==='download')
        put('docAction',params.docAction);
    }
  }
  if (route === 'history') {
    if (params.trackPayment === true) search.set('trackPayment', '1');
    put('categoryFilter', params.categoryFilter);
    if (Array.isArray(params.reviewStatuses)) {
      const statuses = params.reviewStatuses.filter((value: unknown) => typeof value === 'string' && reviewStatuses.has(value));
      if (statuses.length) search.set('reviewStatuses', statuses.join(','));
    }
  }
}
