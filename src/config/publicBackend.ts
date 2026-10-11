/** Public browser configuration. No hosted endpoint or key is embedded by default.
 * Configure an explicitly approved local/test backend with environment variables.
 * NEVER place Supabase secret/service-role keys in this module or Vite output.
 */
const viteEnvironment = import.meta.env ?? {};
const runtimeEnvironment = typeof process === 'undefined' ? {} : process.env;
const configuredUrl = viteEnvironment.VITE_SUPABASE_URL?.trim() || runtimeEnvironment.VITE_SUPABASE_URL?.trim();
const configuredPublishableKey = viteEnvironment.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || runtimeEnvironment.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
const backendDisabled = (viteEnvironment.VITE_SUPABASE_DISABLED ?? runtimeEnvironment.VITE_SUPABASE_DISABLED)?.trim().toLowerCase() === 'true';

export const TAXPAY_PUBLIC_ENDPOINT = Object.freeze({
  url: backendDisabled ? '' : configuredUrl || '',
  publishableKey: backendDisabled ? '' : configuredPublishableKey || '',
  databasePurpose: 'Private payment planning drafts; not ACS/eLedger/payment settlement',
} as const);
