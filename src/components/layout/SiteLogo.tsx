import { useSyncExternalStore, useState, type ImgHTMLAttributes } from 'react';
import defaultWordmark from '../../assets/amar-kor-wordmark-no-wave-20261018.png';
import { supabase } from '../../services/supabaseClient';

// One shared logo source for the public header/footer and taxpayer navigation.
// A static bundled image keeps every shell usable while the CMS is offline.
let logoUrl = defaultWordmark;
let latestVersion = -1;
let refreshSerial = 0;
const subscribers = new Set<() => void>();
let stopListening: (() => void) | null = null;

function snapshot() { return logoUrl; }

async function refreshLogo() {
  if (!supabase) return;
  const serial = ++refreshSerial;
  const { data, error } = await supabase.from('taxpay_site_logo')
    .select('image_path,version').eq('id', 'primary').maybeSingle();
  if (error || !data || serial < refreshSerial) return;
  const version = Number(data.version);
  if (!Number.isFinite(version) || version < latestVersion) return;
  latestVersion = version;
  const next = data.image_path
    ? supabase.storage.from('taxpay-branding').getPublicUrl(data.image_path).data.publicUrl
    : defaultWordmark;
  if (next !== logoUrl) {
    logoUrl = next;
    subscribers.forEach(subscriber => subscriber());
  }
}

function subscribe(subscriber: () => void) {
  subscribers.add(subscriber);
  const client = supabase;
  if (subscribers.size === 1 && client) {
    void refreshLogo();
    const channel = client.channel('taxpay-site-logo-public')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'taxpay_site_logo' },
        () => { void refreshLogo(); })
      .subscribe();
    const onForeground = () => { if (document.visibilityState === 'visible') void refreshLogo(); };
    document.addEventListener('visibilitychange', onForeground);
    window.addEventListener('focus', onForeground);
    const interval = window.setInterval(() => { void refreshLogo(); }, 30_000);
    stopListening = () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onForeground);
      window.removeEventListener('focus', onForeground);
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
