import assert from 'node:assert/strict';
import test from 'node:test';
import { V2_URL, publicV2Checks, verifyV2PublicReads } from './v2-public-read-preflight.mjs';

const key = 'sb_publishable_test_key';
function fixture(mutate = () => {}) {
  const requested = [];
  const fetcher = async (url, options) => {
    requested.push({ url, options });
    const item = publicV2Checks.find(x => url === V2_URL + x.path);
    assert.ok(item, 'only the three known public read endpoints are permitted');
    assert.equal(options.method, 'GET');
    assert.equal(options.headers.apikey, key);
    const field = item.name === 'controlled tax-head catalogue' ? 'source_head_id' : 'id';
    const data = Array.from({ length: item.expected }, (_, i) => ({ [field]: String(i + 1) }));
    mutate(item, data);
    return { ok: true, status: 200, json: async () => data };
  };
  return { requested, fetcher };
}
test('verifies only the v2 public CMS and source-head tables', async () => {
  const f = fixture();
  const r = await verifyV2PublicReads({ key, fetcher: f.fetcher });
  assert.equal(r.length, 3);
  assert.deepEqual(r.map(x => x.count), [5, 1, 170]);
  assert.equal(f.requested.length, 3);
  assert.ok(f.requested.every(x => x.url.startsWith(V2_URL + '/rest/v1/')));
});
test('refuses other backend origins and missing API keys', async () => {
  await assert.rejects(verifyV2PublicReads({ key, url: 'https://some-other.supabase.co', fetcher: fixture().fetcher }), /exact URL/);
  await assert.rejects(verifyV2PublicReads({ key: '', fetcher: fixture().fetcher }), /API key/);
});
test('fails on missing/duplicated CMS rows rather than claiming PASS', async () => {
  await assert.rejects(verifyV2PublicReads({ key, fetcher: fixture((item, data) => {
    if (item.name === 'published CMS banners') data.pop();
  }).fetcher }), /expected 5/);
  await assert.rejects(verifyV2PublicReads({ key, fetcher: fixture((item, data) => {
    if (item.name === 'primary CMS logo') data[0].id = undefined;
  }).fetcher }), /duplicate|identifier/);
});
test('fails on non-2xx API responses without falling back to original database', async () => {
  await assert.rejects(verifyV2PublicReads({
    key, fetcher: async () => ({ ok: false, status: 403 }),
  }), /HTTP 403/);
});
