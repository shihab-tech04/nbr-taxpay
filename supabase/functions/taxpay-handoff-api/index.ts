/**
 * Legacy v11 synthetic handoff API retirement boundary.
 *
 * SECURITY: These deprecated read/write routes accepted caller-supplied request
 * and session UUIDs without a verified owner capability. Their SECURITY DEFINER
 * RPCs are service-role-only, so this route must not call them with a public key.
 *
 * Do not replace the public key with a service-role client: that would bypass
 * ownership controls. The approved current Story 1 API (demo-story1-taxpay),
 * payment_v1 integrations, and signed-in account routes remain separate.
 *
 * Keep this route closed until a verified owner-scoped replacement is approved.
 */
const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  'Cache-Control': 'no-store',
};

Deno.serve((request: Request): Response => {
  // Retain non-mutating CORS preflight compatibility.
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: HEADERS });
  }

  return new Response(JSON.stringify({
    success: false,
    code: 'LEGACY_HANDOFF_RETIRED',
    simulationOnly: true,
  }), {
    status: 410,
    headers: {
      ...HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
});
