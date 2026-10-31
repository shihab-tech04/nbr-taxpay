import { createClient } from 'npm:@supabase/supabase-js@2.57.0';

const allowedOrigins = new Set([
  'https://shihab-tech04.github.io',
  'http://localhost:3000', 'http://127.0.0.1:3000',
  'http://localhost:4173', 'http://127.0.0.1:4173',
]);
const encoder = new TextEncoder();
const capabilityPattern = /^[A-Za-z0-9_-]{43}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RpcName =
  | 'taxpay_guest_beneficiary_open'
  | 'taxpay_guest_beneficiary_lists'
  | 'taxpay_guest_beneficiary_rows'
  | 'taxpay_guest_beneficiary_create_list'
  | 'taxpay_guest_beneficiary_add'
  | 'taxpay_guest_beneficiary_update'
  | 'taxpay_guest_beneficiary_remove'
  | 'taxpay_guest_beneficiary_rename_list'
  | 'taxpay_guest_beneficiary_delete_list';

function response(value: unknown, status: number, origin: string): Response {
  return new Response(status === 204 ? null : JSON.stringify(value), {
    status,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'apikey, content-type, x-client-info, x-taxpay-guest-capability',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Max-Age': '600',
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'Vary': 'Origin',
    },
  });
}

function publicError(error: unknown): { status: number; code: string } {
  const message = error instanceof Error ? error.message : '';
  if (/INVALID_BODY|INVALID_CONTENT_TYPE|INVALID_CAPABILITY|INVALID_PAGE|INVALID_LIST_NAME|INVALID_ROWS|INVALID_BENEFICIARY/.test(message))
    return { status: 400, code: message.split(':')[0] };
  if (/GUEST_SESSION_UNAVAILABLE/.test(message)) return { status: 410, code: 'GUEST_SESSION_UNAVAILABLE' };
  if (/23505|duplicate key value|already exists/.test(message)) return { status: 409, code: 'LIST_NAME_TAKEN' };
  if (/NOT_FOUND/.test(message)) return { status: 404, code: 'NOT_FOUND' };
  return { status: 503, code: 'SERVICE_UNAVAILABLE' };
}

async function parseBody(request: Request): Promise<Record<string, unknown>> {
  const declaredSize = Number(request.headers.get('content-length') ?? '0');
  if (declaredSize > 512_000) throw new Error('INVALID_BODY');
  const raw = await request.text();
  if (raw.length > 512_000) throw new Error('INVALID_BODY');
  let body: unknown;
  try { body = JSON.parse(raw); } catch { throw new Error('INVALID_BODY'); }
  if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error('INVALID_BODY');
  return body as Record<string, unknown>;
}

function validateName(value: unknown, limit: number, code: string): string {
  if (typeof value !== 'string') throw new Error(code);
  const name = value.trim();
  if (!name || name.length > limit) throw new Error(code);
  return name;
}

async function capabilityHash(value: string): Promise<string> {
  if (!capabilityPattern.test(value)) throw new Error('INVALID_CAPABILITY');
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function adminClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS');
  const serviceKey = (raw && (JSON.parse(raw) as Record<string, string>).default) ||
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) throw new Error('SERVICE_UNAVAILABLE');
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function rpc(client: ReturnType<typeof adminClient>, name: RpcName, args: Record<string, unknown> = {}) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin') ?? '';
  if (!allowedOrigins.has(origin)) return new Response(null, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  if (request.method === 'OPTIONS') return response({}, 204, origin);
  if (request.method !== 'POST') return response({ success: false, code: 'METHOD_NOT_ALLOWED' }, 405, origin);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
    return response({ success: false, code: 'INVALID_CONTENT_TYPE' }, 415, origin);

  try {
    const token = request.headers.get('x-taxpay-guest-capability') ?? '';
    const p_capability_hash = await capabilityHash(token);
    const body = await parseBody(request);
    const client = adminClient();
    const action = body.action;
    let data: unknown;

    if (action === 'open') {
      data = await rpc(client, 'taxpay_guest_beneficiary_open', { p_capability_hash });
    } else if (action === 'lists') {
      data = await rpc(client, 'taxpay_guest_beneficiary_lists', { p_capability_hash });
    } else if (action === 'people') {
      const offset = body.offset ?? 0;
      const limit = body.limit ?? 500;
      if (!Number.isSafeInteger(Number(offset)) || Number(offset) < 0 ||
          !Number.isSafeInteger(Number(limit)) || Number(limit) < 1 || Number(limit) > 500)
        throw new Error('INVALID_PAGE');
      data = await rpc(client, 'taxpay_guest_beneficiary_rows', {
        p_capability_hash, p_offset: offset, p_limit: limit,
      });
    } else if (action === 'create-list') {
      data = await rpc(client, 'taxpay_guest_beneficiary_create_list', {
        p_capability_hash, p_name: validateName(body.name, 80, 'INVALID_LIST_NAME'),
      });
    } else if (action === 'rename-list') {
      if (!uuidPattern.test(String(body.id ?? ''))) throw new Error('NOT_FOUND');
      data = await rpc(client, 'taxpay_guest_beneficiary_rename_list', {
        p_capability_hash, p_list_id: body.id,
        p_name: validateName(body.name, 80, 'INVALID_LIST_NAME'),
      });
    } else if (action === 'delete-list') {
      if (!uuidPattern.test(String(body.id ?? ''))) throw new Error('NOT_FOUND');
      data = await rpc(client, 'taxpay_guest_beneficiary_delete_list', {
        p_capability_hash, p_list_id: body.id,
      });
    } else if (action === 'add') {
      if (!uuidPattern.test(String(body.listId ?? '')) || !Array.isArray(body.rows) || body.rows.length > 1000)
        throw new Error('INVALID_ROWS');
      const rows = body.rows.map((row) => {
        if (!row || Array.isArray(row) || typeof row !== 'object') throw new Error('INVALID_BENEFICIARY');
        const value = row as Record<string, unknown>;
        const tin = value.tin;
        const display_name = validateName(value.display_name, 160, 'INVALID_BENEFICIARY');
        if (typeof tin !== 'string' || !/^\d{12}$/.test(tin)) throw new Error('INVALID_BENEFICIARY');
        return { tin, display_name };
      });
      data = await rpc(client, 'taxpay_guest_beneficiary_add', {
        p_capability_hash, p_list_id: body.listId, p_rows: rows,
      });
    } else if (action === 'update') {
      if (!uuidPattern.test(String(body.id ?? ''))) throw new Error('NOT_FOUND');
      data = await rpc(client, 'taxpay_guest_beneficiary_update', {
        p_capability_hash, p_beneficiary_id: body.id,
        p_name: validateName(body.name, 160, 'INVALID_BENEFICIARY_NAME'),
      });
    } else if (action === 'remove') {
      if (!uuidPattern.test(String(body.id ?? ''))) throw new Error('NOT_FOUND');
      data = await rpc(client, 'taxpay_guest_beneficiary_remove', {
        p_capability_hash, p_beneficiary_id: body.id,
      });
    } else {
      return response({ success: false, code: 'NOT_FOUND' }, 404, origin);
    }
    return response({ success: true, data }, 200, origin);
  } catch (error) {
    const failure = publicError(error);
    return response({ success: false, code: failure.code }, failure.status, origin);
  }
});
