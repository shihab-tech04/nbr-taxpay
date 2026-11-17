/**
 * Legacy v11 synthetic handoff API retirement boundary.
 *
 * SECURITY: These deprecated read/write routes used caller-supplied request
 * and session UUIDs without a verified owner capability. The paired WS3
 * migration removes public EXECUTE on the legacy SECURITY DEFINER RPCs.
 *
 * Do not route legacy callers to a service-role client: that would bypass
 * ownership controls. The approved current payment API (demo-story1-taxpay),
 * all payment_v1_* integrations, and signed-in account routes are unaffected.
 *
 * The earlier implementation remains available in Git history for recovery,
 * but must not be re-enabled without a verified owner-scoped replacement.
 * Deploy this Edge change with the privilege migration via WS5 release gates.
 */

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  'Cache-Control': 'no-store',
};

Deno.serve((request: Request): Response => {
  // Retain CORS preflight compatibility while keeping every legacy data route
  // closed, including payment submission, history and notice updates.
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
