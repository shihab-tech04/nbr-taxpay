/** Private, symmetric bridge between TaxPay SQL and Office SQL.
 * Deployed separately on each Supabase project with verify_jwt=false;
 * every request is authenticated by either its local dispatch token or HMAC.
 * No user/browser is given the signing key, token or service-role client.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.57.0';

type BridgeConfig = {
  origin: 'TAXPAY_SQL' | 'OFFICE_SQL';
  selfUrl: string;
  peerUrl: string;
  dispatchToken: string;
  signingKey: string;
  enabled: boolean;
};

type Claimed = {
  event: {
    schemaVersion: '1.0.0';
    eventId: string;
    requestId: string;
    origin: string;
    revision: number;
    payload: Record<string, unknown>;
  };
  claimToken: string;
};

const encoder = new TextEncoder();
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

function decodeHex(hex: string): Uint8Array {
  if (!/^[a-f0-9]{64}$/.test(hex)) throw new Error('Invalid bridge signing configuration');
  return Uint8Array.from(hex.match(/../g)!, b => parseInt(b, 16));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', decodeHex(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

function toHex(data: ArrayBuffer): string {
  return Array.from(new Uint8Array(data)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function signed(key: CryptoKey, data: string): Promise<string> {
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(data)));
}

async function validSignature(key: CryptoKey, data: string, signature: unknown): Promise<boolean> {
  if (typeof signature !== 'string' || !/^[0-9a-f]{64}$/.test(signature)) return false;
  return crypto.subtle.verify('HMAC', key, decodeHex(signature), encoder.encode(data));
}

function adminClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS');
  const key = (keys && (JSON.parse(keys) as Record<string, string>).default) ||
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase server credentials unavailable');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

type Client = ReturnType<typeof adminClient>;

async function rpc<T>(client: Client, name: string, parameters: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await client.rpc(name, parameters);
  if (error) throw new Error(`${name}: ${error.message}`);
  return data as T;
}

async function dispatch(client: Client, config: BridgeConfig, key: CryptoKey) {
  const claimed = await rpc<Claimed[]>(client, 'payment_v1_internal_claim', { p_limit: 20 });
  let acknowledged = 0;
  let failed = 0;
  for (const item of claimed) {
    let errorText: string | null = null;
    let success = false;
    try {
      if (item.event.origin !== config.origin) throw new Error('Unexpected outbox origin');
      const eventText = JSON.stringify(item.event);
      const signature = await signed(key, eventText);
      const response = await fetch(config.peerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'ingest', eventText, signature }),
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error(`Receiver HTTP ${response.status}`);
      const received = await response.json();
      if (received?.stored !== true || received.eventId !== item.event.eventId) {
        throw new Error('Receiver persistence not confirmed');
      }
      success = true;
    } catch (error) {
      errorText = error instanceof Error ? error.message : 'Unknown bridge delivery failure';
    }
    await rpc<boolean>(client, 'payment_v1_internal_ack', {
      p_event_id: item.event.eventId, p_claim_token: item.claimToken,
      p_success: success, p_error: errorText,
    });
    if (success) acknowledged += 1;
    else failed += 1;
  }
  return { claimed: claimed.length, acknowledged, failed };
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (Number(request.headers.get('content-length') || 0) > 400000) {
    return json({ error: 'Payload too large' }, 413);
  }
  try {
    const raw = await request.text();
    if (raw.length > 400000) return json({ error: 'Payload too large' }, 413);
    const message = JSON.parse(raw);
    if (typeof message !== 'object' || message === null) return json({ error: 'Invalid body' }, 400);
    const client = adminClient();
    const config = await rpc<BridgeConfig | null>(client, 'payment_v1_internal_bridge_config');
    if (!config?.enabled) return json({ error: 'Bridge disabled' }, 503);
    if (message.mode === 'dispatch') {
      if (message.token !== config.dispatchToken) return json({ error: 'Unauthorized' }, 401);
      return json(await dispatch(client, config, await hmacKey(config.signingKey)));
    }
    if (message.mode === 'ingest') {
      if (typeof message.eventText !== 'string' || message.eventText.length > 350000 ||
          !await validSignature(await hmacKey(config.signingKey), message.eventText, message.signature)) {
        return json({ error: 'Unauthorized' }, 401);
      }
      const event = JSON.parse(message.eventText);
      if (!event || typeof event !== 'object' || event.origin === config.origin) {
        return json({ error: 'Wrong event origin' }, 400);
      }
      const stored = await rpc<{ eventId: string; stored: boolean }>(client,
        'payment_v1_internal_ingest', { p_event: event });
      return json(stored);
    }
    return json({ error: 'Unknown mode' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown bridge error';
    console.error('payment-sync-bridge operation failed', message);
    return json({ error: 'Bridge operation failed' }, 500);
  }
});
