// A service-level 402 is not a missing logo or a transient table error.
// Suppress background CMS retries across the public logo and banner components
// while an organization-wide Supabase restriction is in effect.
export const BRANDING_402_COOLDOWN_MS = 15 * 60_000;
const MANUAL_RETRY_COOLDOWN_MS = 60_000;
let pausedUntil = 0;
let nextManualRetryAt = 0;

export function brandingRequestsAllowed(now = Date.now()): boolean {
  return now >= pausedUntil;
}

export function noteBrandingHttpStatus(status: number, now = Date.now()): void {
  if (status === 402) pausedUntil = Math.max(pausedUntil, now + BRANDING_402_COOLDOWN_MS);
}

// The existing banner Retry button may probe earlier, at most once a minute.
// It never clears an active 402 without a direct visitor action.
export function allowBrandingManualRetry(now = Date.now()): boolean {
  if (now < nextManualRetryAt) return false;
  nextManualRetryAt = now + MANUAL_RETRY_COOLDOWN_MS;
  pausedUntil = 0;
  return true;
}
