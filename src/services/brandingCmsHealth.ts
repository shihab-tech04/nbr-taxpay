/**
 * Shared public-branding circuit breaker. Only the public logo/banner metadata
 * readers use it; Taxpayer Auth, payments, Office and SQL remain untouched.
 * A shared status avoids each component retrying the same rejected gateway.
 */
export const BRANDING_402_COOLDOWN_MS = 15 * 60_000;
export const BRANDING_ERROR_COOLDOWN_MS = 60_000;
const STATUS_402_STORAGE_KEY = 'sohojkor-public-branding-http-402-until-v2';
let pauseUntil = 0;

function persistedPause(): number {
  try {
    const saved = Number(window.sessionStorage.getItem(STATUS_402_STORAGE_KEY));
    return Number.isSafeInteger(saved) ? saved : 0;
  } catch { return 0; }
}
export function brandingReadsAllowed(now = Date.now()): boolean {
  return now >= Math.max(pauseUntil, persistedPause());
}
export function noteBrandingResponse(status: number | undefined, failed: boolean, now = Date.now()): void {
  if (!failed) {
    if (now >= pauseUntil) pauseUntil = 0;
    return;
  }
  if (status === 402) {
    pauseUntil = Math.max(pauseUntil, now + BRANDING_402_COOLDOWN_MS);
    try { window.sessionStorage.setItem(STATUS_402_STORAGE_KEY, String(pauseUntil)); }
    catch { /* session storage may be unavailable */ }
    return;
  }
  // Network failures, 429 and 5xx are retried only after a short rest period.
  pauseUntil = Math.max(pauseUntil, now + BRANDING_ERROR_COOLDOWN_MS);
}
