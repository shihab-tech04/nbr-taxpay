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
  let transientReadFailures = 0;
  const requests: Array<{ url: string; headers: Record<string, string>; body: Record<string, any> }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, any>;
    requests.push({ url, headers, body });
    if (body.action === 'lists' && transientReadFailures > 0) {
      transientReadFailures--;
      throw new TypeError('Temporary simulated network failure');
    }
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
    } else if (body.action === 'rename-list') {
      const list = session.lists.find(value => value.id === body.id);
      if (!list) return new Response(JSON.stringify({ success: false, code: 'NOT_FOUND' }), { status: 404 });
      list.name = body.name;
      data = list;
    } else if (body.action === 'delete-list') {
      const list = session.lists.find(value => value.id === body.id);
      if (!list) return new Response(JSON.stringify({ success: false, code: 'NOT_FOUND' }), { status: 404 });
      session.lists = session.lists.filter(value => value.id !== body.id);
      session.people = session.people.filter(value => value.list_id !== body.id);
      data = { deleted: true };
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
    } else if (body.action === 'edit-classification') {
      const person = session.people.find(value => value.id === body.id &&
        value.list_id === body.sourceListId);
      if (!person || !session.lists.some(value => value.id === body.listId))
        return new Response(JSON.stringify({ success: false, code: 'NOT_FOUND' }), { status: 404 });
      if (session.people.some(value => value.id !== person.id &&
          value.list_id === body.listId && value.tin === person.tin))
        return new Response(JSON.stringify({ success: false, code: 'BENEFICIARY_ALREADY_IN_LIST' }), { status: 409 });
      Object.assign(person,{list_id:body.listId,tag:body.tag,
        relationship:body.relationship,other_label:body.other_label});
      data=person;
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

    // A transient read outage retries once without replacing the stored
    // capability or duplicating a write. Continued outages must still fail.
    transientReadFailures = 1;
    (globalThis as any).window = { localStorage: storageA };
    const restored = await guest.loadGuestBeneficiaries();
    assert.equal(restored.people[0]?.display_name, 'Synthetic Guest A');
    assert.equal(storageA.getItem('korbritto.guest-beneficiaries.capability.v1'), capabilityA);
    transientReadFailures = 2;
    await assert.rejects(guest.loadGuestBeneficiaries(), /temporarily unavailable/);
    assert.equal(storageA.getItem('korbritto.guest-beneficiaries.capability.v1'), capabilityA);
    transientReadFailures = 0;

    const storageB = new MemoryStorage();
    (globalThis as any).window = { localStorage: storageB };
    assert.deepEqual(await guest.loadGuestBeneficiaries(), { lists: [], people: [] });
    assert.notEqual(storageB.getItem('korbritto.guest-beneficiaries.capability.v1'), capabilityA);
    await assert.rejects(guest.renameGuestBeneficiaryList(listA.id,'Stolen'), /not found/i);
    await assert.rejects(guest.deleteGuestBeneficiaryList(listA.id), /not found/i);

    (globalThis as any).window = { localStorage: storageA };
    const person = (await guest.loadGuestBeneficiaries()).people[0];
    assert.ok(person);
    await guest.updateGuestBeneficiary(person.id, 'Renamed Guest A');
    assert.equal((await guest.loadGuestBeneficiaries()).people[0]?.display_name, 'Renamed Guest A');
    await guest.editGuestBeneficiaryClassification(person.id,listA.id,listA.id,
      {tag:'friends_family',relationship:'father',other_label:null});
    let edited=(await guest.loadGuestBeneficiaries()).people[0];
    assert.equal(edited?.list_id,listA.id);
    assert.equal(edited?.tag,'friends_family');
    assert.equal(edited?.relationship,'father');
    await guest.editGuestBeneficiaryClassification(person.id,listA.id,listA.id,
      {tag:'others',relationship:null,other_label:'Neighbour'});
    edited=(await guest.loadGuestBeneficiaries()).people[0];
    assert.equal(edited?.other_label,'Neighbour');
    assert.equal(edited?.display_name,'Renamed Guest A');
    assert.equal(edited?.tin,'012345678901');
    (globalThis as any).window={localStorage:storageB};
    await assert.rejects(guest.editGuestBeneficiaryClassification(person.id,listA.id,listA.id,
      {tag:'clients',relationship:null,other_label:null}),/not found/i);
    (globalThis as any).window={localStorage:storageA};
    await guest.removeGuestBeneficiary(person.id);
    assert.deepEqual((await guest.loadGuestBeneficiaries()).people, []);
    await guest.renameGuestBeneficiaryList(listA.id, 'Family & Friends');
    assert.equal((await guest.loadGuestBeneficiaries()).lists[0]?.name, 'Family & Friends');
    await guest.addGuestBeneficiaries(listA.id,[{tin:'987654321098',display_name:'Delete with list'}]);
    await guest.deleteGuestBeneficiaryList(listA.id);
    assert.deepEqual(await guest.loadGuestBeneficiaries(), { lists: [], people: [] });
    assert.ok(requests.some(request => request.body.action === 'rename-list' && request.body.id === listA.id));
    assert.ok(requests.some(request => request.body.action === 'delete-list' && request.body.id === listA.id));
    assert.ok(requests.some(request => request.body.action === 'edit-classification' &&
      request.body.tag === 'others' && request.body.other_label === 'Neighbour' &&
      request.body.listId === listA.id));

    // Preview session: parallel callers share one server read, navigation
    // shortly afterward reuses a detached copy, and writes force fresh data.
    const sessionStorage=new MemoryStorage();
    const setPreview=(capability:string)=>{
      sessionStorage.setItem('taxpay-taxpayer-preview-user','user1');
      sessionStorage.setItem('korbritto.demo-profile-session.v1',JSON.stringify({
        profileId:'user1',capability,
        paymentSessionId:'11111111-1111-4111-8111-111111111111',
        language:'en',selectedListId:null
      }));
      (globalThis as any).window={localStorage:storageA,sessionStorage};
    };
    setPreview(capabilityA!);
    let listReads=requests.filter(x=>x.body.action==='lists').length;
    let peopleReads=requests.filter(x=>x.body.action==='people').length;
    const [a,b]=await Promise.all([guest.loadGuestBeneficiaries(),guest.loadGuestBeneficiaries()]);
    assert.deepEqual(a,b);
    assert.equal(requests.filter(x=>x.body.action==='lists').length,listReads+1);
    assert.equal(requests.filter(x=>x.body.action==='people').length,peopleReads+1);
    a.people.push({id:'fake'} as any);
    assert.deepEqual((await guest.loadGuestBeneficiaries()).people,[]);
    assert.equal(requests.filter(x=>x.body.action==='lists').length,listReads+1);
    const previewList=await guest.createGuestBeneficiaryList('Preview');
    assert.ok(previewList.id);
    assert.ok((await guest.loadGuestBeneficiaries()).lists.some(x=>x.id===previewList.id));
    assert.equal(requests.filter(x=>x.body.action==='lists').length,listReads+2);
    // Payment-time verification must re-read even while navigation cache is hot.
    const beforeFresh=requests.filter(x=>x.body.action==='lists').length;
    await guest.loadGuestBeneficiaries({forceFresh:true});
    assert.equal(requests.filter(x=>x.body.action==='lists').length,beforeFresh+1);
    // An outage must not be hidden by a stale successful navigation snapshot.
    transientReadFailures=8;
    await assert.rejects(guest.loadGuestBeneficiaries({forceFresh:true}),/temporarily unavailable/);
    transientReadFailures=0;
    const afterFailure=requests.filter(x=>x.body.action==='lists').length;
    await guest.loadGuestBeneficiaries();
    assert.equal(requests.filter(x=>x.body.action==='lists').length,afterFailure+1);
    // Changing capability cannot expose the previous preview user's lists.
    const capabilityB=storageB.getItem('korbritto.guest-beneficiaries.capability.v1');
    assert.ok(capabilityB);
    setPreview(capabilityB);
    assert.deepEqual(await guest.loadGuestBeneficiaries(),{lists:[],people:[]});
    setPreview(capabilityA!);
    assert.ok((await guest.loadGuestBeneficiaries()).lists.some(x=>x.id===previewList.id));
    await guest.deleteGuestBeneficiaryList(previewList.id);

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
