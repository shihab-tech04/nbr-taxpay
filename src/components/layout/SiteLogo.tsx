import { useSyncExternalStore, useState, type ImgHTMLAttributes } from 'react';
import defaultWordmark from '../../assets/korbritto-brand-locked.svg';
import { supabase } from '../../services/supabaseClient';

// One shared logo source for the public header/footer and taxpayer navigation.
// A static bundled image keeps every shell usable while the CMS is offline.
let logoUrl = defaultWordmark;
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
  if (!supabase) return;
  if (activeRefresh) {
    if (force) refreshAfterCurrent = true;
    return activeRefresh;
  }
  if (!force && Date.now() - lastRefreshAttempt < FOREGROUND_REFRESH_MS) return;
  lastRefreshAttempt = Date.now();
  const serial = ++refreshSerial;
  const request = (async () => {
    try {
      const { data, error } = await supabase.from('taxpay_site_logo')
        .select('image_path,version').eq('id', 'primary').maybeSingle();
      if (error || !data || serial < refreshSerial) return;
      const version = Number(data.version);
      if (!Number.isFinite(version) || version < latestVersion) return;
      latestVersion = version;
      // A version bump must replace an image even when an Office upload reuses
      // the same object path. Existing versioned asset paths still work.
      const url = data.image_path
        ? supabase.storage.from('taxpay-branding').getPublicUrl(data.image_path).data.publicUrl
        : defaultWordmark;
      const next = data.image_path
        ? url + (url.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(String(version))
        : defaultWordmark;
      if (next !== logoUrl) {
        logoUrl = next;
        subscribers.forEach(subscriber => subscriber());
      }
    } catch {
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
  const client = supabase;
  if (subscribers.size === 1 && client) {
    void refreshLogo();
    let realtimeConnected = false;
    let previouslyConnected = false;
    const channel = client.channel('taxpay-site-logo-public')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'taxpay_site_logo' },
        () => { void refreshLogo(true); })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          // Reconcile events missed during a disconnected subscription; the
          // first subscription already has its initial metadata read above.
          if (previouslyConnected && !realtimeConnected) void refreshLogo(true);
          previouslyConnected = true;
          realtimeConnected = true;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          realtimeConnected = false;
        }
      });
    const onForeground = () => {
      if (document.visibilityState === 'visible') void refreshLogo();
    };
    const onOnline = () => { if (document.visibilityState === 'visible') void refreshLogo(true); };
    document.addEventListener('visibilitychange', onForeground);
    window.addEventListener('focus', onForeground);
    window.addEventListener('online', onOnline);
    // Fallback only when Realtime is absent; avoid 2,880 redundant logo reads
    // per always-open tab/day while CMS changes still arrive immediately.
    const interval = window.setInterval(() => {
      if (!realtimeConnected && document.visibilityState === 'visible') void refreshLogo();
    }, OFFLINE_POLL_MS);
    stopListening = () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onForeground);
      window.removeEventListener('focus', onForeground);
      window.removeEventListener('online', onOnline);
      void client.removeChannel(channel);
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
  const src = failedUrl === selectedUrl ? defaultWordmark : selectedUrl;
  return <img {...props} src={src} onError={event => {
    if (src !== defaultWordmark) setFailedUrl(selectedUrl);
    props.onError?.(event);
  }} />;
}
