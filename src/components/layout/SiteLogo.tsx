import { useEffect, useSyncExternalStore, useState, type ImgHTMLAttributes } from 'react';
import defaultWordmark from '../../assets/korbritto-brand-locked.svg';
import { supabase } from '../../services/supabaseClient';
import { brandingRequestsAllowed, noteBrandingHttpStatus } from '../../services/brandingRequestGuard';
import { BRANDING_CMS_CONNECTION_ENABLED } from '../../config/brandingCmsConnection';

// One shared logo source for the public header/footer and taxpayer navigation.
// A static bundled image keeps every shell usable while the CMS is offline.
let logoUrl = defaultWordmark;
let latestVersion = -1;
let refreshSerial = 0;
const FOREGROUND_REFRESH_MS = 60_000;
const OFFLINE_POLL_MS = 5 * 60_000;
let lastRefreshAttempt = 0;
let activeRefresh: Promise<boolean> | null = null;
let refreshAfterCurrent = false;
const subscribers = new Set<() => void>();
let stopListening: (() => void) | null = null;

function snapshot() { return logoUrl; }

// Share a single metadata read between all logo slots. Realtime publications
// always get an authoritative refresh, even if they land during an in-flight read.
async function refreshLogo(force = false): Promise<boolean> {
  if (!supabase || !brandingRequestsAllowed()) return false;
  if (activeRefresh) {
    if (force) refreshAfterCurrent = true;
    return activeRefresh;
  }
  if (!force && Date.now() - lastRefreshAttempt < FOREGROUND_REFRESH_MS) return false;
  lastRefreshAttempt = Date.now();
  const serial = ++refreshSerial;
  const request = (async () => {
    try {
      const { data, error, status } = await supabase.from('taxpay_site_logo')
        .select('image_path,version').eq('id', 'primary').maybeSingle();
      noteBrandingHttpStatus(status);
      if (error || !data) return false;
      if (serial < refreshSerial) return true;
      const version = Number(data.version);
      if (!Number.isFinite(version) || version < latestVersion) return true;
      latestVersion = version;
      // An Office revision can reuse the same image path; bust cache by version.
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
      return true;
    } catch {
      // Keep the most recent verified CMS image or the approved bundled logo.
      return false;
    }
  })();
  activeRefresh = request;
  try {
    return await request;
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
  if (BRANDING_CMS_CONNECTION_ENABLED && subscribers.size === 1 && client) {
    let listening = true;
    let realtimeConnected = false;
    let channel: ReturnType<typeof client.channel> | null = null;
    const disconnect = () => {
      realtimeConnected = false;
      if (!channel) return;
      const previous = channel;
      channel = null;
      void client.removeChannel(previous);
    };
    const connect = () => {
      if (!listening || channel || !brandingRequestsAllowed()) return;
      const nextChannel = client.channel('taxpay-site-logo-public')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'taxpay_site_logo' },
          () => { void refreshAndConnect(true); });
      channel = nextChannel;
      nextChannel.subscribe(status => {
        if (channel !== nextChannel) return;
        if (status === 'SUBSCRIBED') realtimeConnected = true;
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          // Stop the SDK's rapid WebSocket retry after a gateway rejection.
          // The bounded offline refresh will re-establish Realtime after recovery.
          disconnect();
        }
      });
    };
    const refreshAndConnect = (force = false) => {
      void refreshLogo(force).then(ok => {
        if (!listening || subscribers.size === 0) return;
        if (!ok && !brandingRequestsAllowed()) disconnect();
        if (ok) connect();
      });
    };
    // A successful REST read must precede any Realtime socket. If the gateway
    // responds 402 there is nothing to subscribe to and no reconnect storm.
    refreshAndConnect();
    const onForeground = () => {
      if (document.visibilityState === 'visible') refreshAndConnect();
    };
    const onOnline = () => {
      if (document.visibilityState === 'visible') refreshAndConnect(true);
    };
    document.addEventListener('visibilitychange', onForeground);
    window.addEventListener('focus', onForeground);
    window.addEventListener('online', onOnline);
    const interval = window.setInterval(() => {
      if (!realtimeConnected && document.visibilityState === 'visible') refreshAndConnect();
    }, OFFLINE_POLL_MS);
    stopListening = () => {
      listening = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onForeground);
      window.removeEventListener('focus', onForeground);
      window.removeEventListener('online', onOnline);
      disconnect();
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
  const src = failedUrl === selectedUrl ? defaultWordmark : selectedUrl;
  return <img {...props} src={src} onError={event => {
    if (src !== defaultWordmark) setFailedUrl(selectedUrl);
    props.onError?.(event);
  }} />;
}
