/** Private HMAC command channel: Office officer assertions -> TaxPay intent state.
 * Companion to payment-sync-bridge (event stream in the opposite direction).
 * JWT is intentionally disabled for server-to-server calls: a local dispatch
 * token or a verified HMAC signature authenticates every operation.
 * This bridge never confirms settlement, posts tax credit or issues challans.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.57.0';

type Origin = 'TAXPAY_SQL' | 'OFFICE_SQL';
type Config = {
  origin: Origin; selfUrl: string; peerUrl: string;
  dispatchToken: string; signingKey: string; enabled: boolean;
};
type Command = {
  schemaVersion: '1.0.0'; messageId: string; requestId: string;
  origin: Origin; action: string; officerUid: string;
  officerRole: string; reason: string | null; expectedReviewState: string;
  occurredAt: string;
};
type Claimed = { claimToken: string; command: Command };

const encoder = new TextEncoder();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

function decodeHex(hex: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/.test(hex)) throw new Error('Invalid signing configuration');
  return Uint8Array.from(hex.match(/../g)!, (part) => parseInt(part, 16));
}
async function signingKey(hex: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', decodeHex(hex),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
function toHex(data: ArrayBuffer): string {
  return Array.from(new Uint8Array(data))
    .map((value) => value.toString(16).padStart(2, '0')).join('');
}
async function sign(key: CryptoKey, data: string): Promise<string> {
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(data)));
}
async function verify(key: CryptoKey, data: string, value: unknown): Promise<boolean> {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) return false;
  return crypto.subtle.verify('HMAC', key, decodeHex(value), encoder.encode(data));
}

function adminClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS');
  const secret = (raw && (JSON.parse(raw) as Record<string, string>).default) ||
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !secret) throw new Error('Server credentials unavailable');
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
type Client = ReturnType<typeof adminClient>;
async function rpc<T>(client: Client, name: string,
  args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(`${name}: ${error.message}`);
  return data as T;
}

function commandEndpoint(eventEndpoint: string): string {
  if (!eventEndpoint.endsWith('/payment-sync-bridge'))
    throw new Error('Unrecognized bridge endpoint');
  return eventEndpoint.replace(/\/payment-sync-bridge$/, '/payment-command-bridge');
}

async function dispatch(client: Client, config: Config, key: CryptoKey) {
  if (config.origin !== 'OFFICE_SQL') throw new Error('Only Office can dispatch commands');
  const claimed = await rpc<Claimed[]>(client, 'payment_v1_internal_claim_commands',
    { p_limit: 20 });
  let acknowledged = 0;
  let failed = 0;
  for (const item of claimed) {
    let success = false;
    let failure: string | null = null;
    try {
      if (item.command.origin !== 'OFFICE_SQL') throw new Error('Unexpected origin');
      const commandText = JSON.stringify(item.command);
      const signature = await sign(key, commandText);
      const response = await fetch(commandEndpoint(config.peerUrl), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'ingest', commandText, signature }),
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error(`Receiver HTTP ${response.status}`);
      const result = await response.json();
      if (result?.stored !== true || result.messageId !== item.command.messageId)
        throw new Error('Receiver did not confirm persistence');
      success = true;
    } catch (error) {
      failure = error instanceof Error ? error.message : 'Delivery failed';
    }
    await rpc<boolean>(client, 'payment_v1_internal_ack_command', {
      p_message_id: item.command.messageId, p_claim_token: item.claimToken,
      p_success: success, p_error: failure,
    });
    if (success) acknowledged++;
    else failed++;
  }
  return { claimed: claimed.length, acknowledged, failed };
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (Number(request.headers.get('content-length') || 0) > 24000)
    return json({ error: 'Payload too large' }, 413);
  try {
    const raw = await request.text();
    if (raw.length > 24000) return json({ error: 'Payload too large' }, 413);
    const message = JSON.parse(raw);
    if (typeof message !== 'object' || message === null)
      return json({ error: 'Invalid body' }, 400);
    const client = adminClient();
    const config = await rpc<Config | null>(client, 'payment_v1_internal_bridge_config');
    if (!config?.enabled) return json({ error: 'Bridge disabled' }, 503);
    if (message.mode === 'dispatch') {
      if (message.token !== config.dispatchToken) return json({ error: 'Unauthorized' }, 401);
      return json(await dispatch(client, config, await signingKey(config.signingKey)));
    }
    if (message.mode === 'ingest') {
      if (config.origin !== 'TAXPAY_SQL' ||
          typeof message.commandText !== 'string' || message.commandText.length > 20000 ||
          !await verify(await signingKey(config.signingKey),
            message.commandText, message.signature)) return json({ error: 'Unauthorized' }, 401);
      const command = JSON.parse(message.commandText);
      if (!command || typeof command !== 'object' || command.origin !== 'OFFICE_SQL')
        return json({ error: 'Wrong command origin' }, 400);
      const result = await rpc<{messageId: string; stored: boolean}>(
        client, 'payment_v1_internal_ingest_command', { p_command: command });
      return json(result);
    }
    return json({ error: 'Unknown mode' }, 400);
  } catch (error) {
    console.error('payment-command-bridge failed',
      error instanceof Error ? error.message : 'Unknown error');
    return json({ error: 'Bridge operation failed' }, 500);
  }
});
