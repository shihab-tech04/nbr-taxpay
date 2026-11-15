/**
 * Read-only hosted Taxpayer-v2 preflight.
 * Never creates users, payments, drafts, SQL rows, Office notices or credentials.
 * Anon/public read coverage is NOT evidence of Auth or private Office authorization.
 */
export const V2_URL = 'https://gmuhitmaynfhipcvbvkh.supabase.co';
export const publicV2Checks = Object.freeze([
  { name: 'published CMS banners', path: '/rest/v1/taxpay_site_banners?select=id&published=eq.true&order=sort_order.asc&limit=10', expected: 5 },
  { name: 'primary CMS logo', path: '/rest/v1/taxpay_site_logo?select=id&id=eq.primary&limit=2', expected: 1 },
  { name: 'controlled tax-head catalogue', path: '/rest/v1/taxpay_head_source_candidates?select=source_head_id&source_key=eq.V11-HTML-20261010&limit=171', expected: 170 },
]);

export async function verifyV2PublicReads({ key, fetcher = fetch, url = V2_URL }) {
  if (url !== V2_URL || typeof key !== 'string' || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key))
    throw new Error('Taxpayer-v2 preflight requires its exact URL and active publishable API key');
  const results = [];
  for (const item of publicV2Checks) {
    const response = await fetcher(url + item.path, {
      method: 'GET', cache: 'no-store', redirect: 'error',
      headers: { apikey: key, accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(item.name + ': public API HTTP ' + response.status);
    const data = await response.json();
    if (!Array.isArray(data) || data.length !== item.expected)
      throw new Error(item.name + ': expected ' + item.expected + ' public records');
    const ids = data.map(row => row?.id ?? row?.source_head_id);
    if (ids.some(id => (typeof id !== 'string' && typeof id !== 'number') || String(id).trim() === '') ||
        new Set(ids.map(String)).size !== data.length)
      throw new Error(item.name + ': missing or duplicate public record identifiers');
    results.push({ name: item.name, passed: true, count: data.length });
  }
  return results;
}
if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  try {
    const results = await verifyV2PublicReads({ key: process.env.V2_SUPABASE_PUBLISHABLE_KEY });
    console.log('Taxpayer-v2 public read-only preflight PASS ' + JSON.stringify(results));
  } catch (error) {
    console.error('Taxpayer-v2 public preflight FAIL: ' + error.message);
    process.exitCode = 1;
  }
}
