import assert from 'node:assert/strict';
import { test } from 'node:test';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

test('guest beneficiary client persists one opaque capability per browser and keeps TIN/name out of URLs', async () => {
  process.env.VITE_SUPABASE_URL = 'https://guest-test.supabase.co';
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_guest_test';
  const originalWindow = (globalThis as { window?: unknown }).window;
  const originalFetch = globalThis.fetch;
  const sessions = new Map<string, { lists: any[]; people: any[] }>();
  const requests: Array<{ url: string; headers: Record<string, string>; body: Record<string, any> }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, any>;
    requests.push({ url, headers, body });
    const capability = headers['x-taxpay-guest-capability'];
    if (!capability) return new Response(JSON.stringify({ success: false, code: 'INVALID_CAPABILITY' }), { status: 400 });
    if (body.action === 'open') sessions.set(capability, sessions.get(capability) ?? { lists: [], people: [] });
    const session = sessions.get(capability);
    if (!session) return new Response(JSON.stringify({ success: false, code: 'GUEST_SESSION_UNAVAILABLE' }), { status: 410 });
    let data: unknown;
    if (body.action === 'lists') data = session.lists;
    else if (body.action === 'people') data = session.people.slice(body.offset, body.offset + body.limit);
    else if (body.action === 'create-list') {
      const list = session.lists.find(value => value.name.toLowerCase() === body.name.toLowerCase()) ?? {
        id: crypto.randomUUID(), name: body.name, created_at: new Date().toISOString(),
      };
      if (!session.lists.includes(list)) session.lists.push(list);
      data = list;
    } else if (body.action === 'add') {
      const added = body.rows.filter((row: any) => !session.people.some(value => value.list_id === body.listId && value.tin === row.tin));
      for (const row of added) session.people.push({ ...row, id: crypto.randomUUID(), list_id: body.listId,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      data = added.length;
    } else if (body.action === 'update') {
      const person = session.people.find(value => value.id === body.id);
      if (!person) return new Response(JSON.stringify({ success: false, code: 'NOT_FOUND' }), { status: 404 });
      person.display_name = body.name;
      data = person;
    } else if (body.action === 'remove') {
      session.people = session.people.filter(value => value.id !== body.id);
      data = { deleted: true };
    } else data = { active: true };
    return new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  try {
    const storageA = new MemoryStorage();
    (globalThis as any).window = { localStorage: storageA };
    const guest = await import('../src/services/guestBeneficiaries');
    const listA = await guest.createGuestBeneficiaryList('Family');
    assert.equal(await guest.addGuestBeneficiaries(listA.id, [
      { tin: '012345678901', display_name: 'Synthetic Guest A' },
    ]), 1);
    const capabilityA = storageA.getItem('korbritto.guest-beneficiaries.capability.v1');
    assert.match(capabilityA ?? '', /^[A-Za-z0-9_-]{43}$/);

    // Replacing the page's JS context while retaining localStorage models a reload/reopen.
    (globalThis as any).window = { localStorage: storageA };
    const restored = await guest.loadGuestBeneficiaries();
    assert.equal(restored.people[0]?.display_name, 'Synthetic Guest A');
    assert.equal(storageA.getItem('korbritto.guest-beneficiaries.capability.v1'), capabilityA);

    const storageB = new MemoryStorage();
    (globalThis as any).window = { localStorage: storageB };
    assert.deepEqual(await guest.loadGuestBeneficiaries(), { lists: [], people: [] });
    assert.notEqual(storageB.getItem('korbritto.guest-beneficiaries.capability.v1'), capabilityA);

    (globalThis as any).window = { localStorage: storageA };
    const person = (await guest.loadGuestBeneficiaries()).people[0];
    assert.ok(person);
    await guest.updateGuestBeneficiary(person.id, 'Renamed Guest A');
    assert.equal((await guest.loadGuestBeneficiaries()).people[0]?.display_name, 'Renamed Guest A');
    await guest.removeGuestBeneficiary(person.id);
    assert.deepEqual((await guest.loadGuestBeneficiaries()).people, []);

    assert.ok(requests.every(request => request.url === 'https://guest-test.supabase.co/functions/v1/taxpay-guest-beneficiaries'));
    assert.ok(requests.every(request => !('authorization' in request.headers)));
    assert.ok(requests.every(request => !request.url.includes('012345678901') && !request.url.includes('Synthetic Guest')));
    assert.ok(requests.some(request => request.body.action === 'add' && request.body.rows[0].tin === '012345678901'));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) delete (globalThis as any).window;
    else (globalThis as any).window = originalWindow;
  }
});
