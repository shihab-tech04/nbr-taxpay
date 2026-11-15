/**
 * Temporary production branding-CMS isolation (16 November 2026).
 *
 * Supabase cached-egress quota restrictions are returning HTTP 402.
 * Keep public branding fully local in deployed builds until a separately
 * verified production restoration is authorized. Development/tests still
 * exercise the real CMS contract against their configured synthetic backend.
 *
 * Re-enable only in a reviewed release after the original project's service,
 * publication status, EN/BN banners and Office CMS refresh have been verified.
 * This does NOT disable Supabase for payments, login, drafts or other modules.
 */
export const BRANDING_CMS_CONNECTION_ENABLED =
  import.meta.env.DEV && import.meta.env.VITE_BRANDING_CMS_DISABLED !== 'true';
