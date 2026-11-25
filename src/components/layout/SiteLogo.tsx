import { useEffect, useSyncExternalStore, useState, type ImgHTMLAttributes } from 'react';
import defaultWordmark from '../../assets/korbritto-brand-locked.svg';
import { supabase } from '../../services/supabaseClient';
import { brandingReadsAllowed, noteBrandingResponse } from '../../services/brandingCmsHealth';

// One shared logo source for the public header/footer and taxpayer navigation.
// A static bundled image keeps every shell usable while the CMS is offline.
const lastPublishedLogo = `${import.meta.env.BASE_URL}branding/published/sohojkor-logo-v18.jpg`;
let logoUrl = lastPublishedLogo;
let latestVersion = -1;
let refreshSerial = 0;
const FOREGROUND_REFRESH_MS = 60_000;
const OFFLINE_POLL_MS = 5 * 60_000;
let lastRefreshAttempt = 0;
let activeRefresh: Promise<void> | null = null;
let refreshAfterCurrent = false;
const subscribers = new Set<() => void>();
let stopListening: (() => void) | null = null;

function snapshot() { return logoUrl; }

// Share a single metadata read between all logo slots. Realtime publications
// always get an authoritative refresh, even if they land during an in-flight read.
async function refreshLogo(force = false): Promise<void> {
  if (!supabase || !brandingReadsAllowed()) return;
  if (activeRefresh) {
    if (force) refreshAfterCurrent = true;
    return activeRefresh;
  }
  if (!force && Date.now() - lastRefreshAttempt < FOREGROUND_REFRESH_MS) return;
  lastRefreshAttempt = Date.now();
  const serial = ++refreshSerial;
  const request = (async () => {
    try {
      const { data, error, status } = await supabase.from('taxpay_site_logo')
        .select('image_path,version').eq('id', 'primary').maybeSingle();
      noteBrandingResponse(status, Boolean(error));
      if (error || !data || serial < refreshSerial) return;
      const version = Number(data.version);
      if (!Number.isFinite(version) || version < latestVersion) return;
      latestVersion = version;
      // A version bump must replace an image even when an Office upload reuses
      // the same object path. Existing versioned asset paths still work.
      const url = data.image_path
        ? data.image_path === 'logos/04d6e79e-ab94-4303-97b7-0faa0d945362.jpg'
          ? lastPublishedLogo
          : supabase.storage.from('taxpay-branding').getPublicUrl(data.image_path).data.publicUrl
        : defaultWordmark;
      const next = data.image_path
        ? url + (url.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(String(version))
        : defaultWordmark;
      if (next !== logoUrl) {
        logoUrl = next;
        subscribers.forEach(subscriber => subscriber());
      }
    } catch {
      noteBrandingResponse(undefined, true);
      // Keep the last approved image on a transient CMS/network failure.
    }
  })();
  activeRefresh = request;
  try {
    await request;
  } finally {
    activeRefresh = null;
    if (refreshAfterCurrent) {
      refreshAfterCurrent = false;
      void refreshLogo(true);
    }
  }
}

function subscribe(subscriber: () => void) {
  subscribers.add(subscriber);
  // Poll the authoritative CMS instead of starting a WebSocket. The former
  // Realtime channel retried rapidly when the gateway returned HTTP 402.
  // The five-minute refresh and focus throttle keep Office edits dynamic.
  if (subscribers.size === 1 && supabase) {
    void refreshLogo();
    const onForeground = () => {
      if (document.visibilityState === 'visible') void refreshLogo();
    };
    document.addEventListener('visibilitychange', onForeground);
    window.addEventListener('focus', onForeground);
    window.addEventListener('online', onForeground);
    const interval = window.setInterval(onForeground, OFFLINE_POLL_MS);
    stopListening = () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onForeground);
      window.removeEventListener('focus', onForeground);
      window.removeEventListener('online', onForeground);
    };
  }
  return () => {
    subscribers.delete(subscriber);
    if (subscribers.size === 0) {
      stopListening?.();
      stopListening = null;
    }
  };
}

/** Preserves each existing logo slot's responsive dimensions and class names. */
export function SiteLogo(props: ImgHTMLAttributes<HTMLImageElement>) {
  const selectedUrl = useSyncExternalStore(subscribe, snapshot, snapshot);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  // A temporarily unavailable uploaded image must not be stuck on the bundled
  // fallback forever if Storage connectivity returns without a new version.
  useEffect(() => {
    if (!failedUrl) return;
    const retry = () => setFailedUrl(null);
    window.addEventListener('online', retry);
    window.addEventListener('focus', retry);
    return () => {
      window.removeEventListener('online', retry);
      window.removeEventListener('focus', retry);
    };
  }, [failedUrl]);
  const src = failedUrl === selectedUrl
    ? (selectedUrl === lastPublishedLogo ? defaultWordmark : lastPublishedLogo)
    : selectedUrl;
  return <img {...props} src={src} onError={event => {
    if (src !== defaultWordmark) setFailedUrl(selectedUrl);
    props.onError?.(event);
  }} />;
}
