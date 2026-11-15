import { expect, test, type Page, type BrowserContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

type Row = { recipient_preview_id: string; display_name: string; tin_alias: string;
  tag: string; relationship: string | null; other_label: string | null; list_key: string };
type Group = { key: string; display: string; category: string; recipient_numbers: number[] };
const fixture = JSON.parse(readFileSync(new URL('../fixtures/user1-beneficiary-scenarios-v95.json', import.meta.url), 'utf8')) as {
  scope: string; owner_preview_id: string; groups: Group[]; beneficiaries: Row[];
};

/** Nonproduction real Edge/Postgres contract: no hosted writes or real Auth provisioning. */
test('Phase 2 User1 stores 24 unique beneficiaries in six four-person lists with owner-only readback', async ({ browser }, info) => {
  test.setTimeout(180_000);
  const raw = process.env.TAXPAY_LOCAL_SUPABASE_URL;
  const key = process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
  if (!raw || !key) throw Error('Disposable local Supabase required');
  const api = new URL(raw);
  if (api.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(api.hostname)) {
    throw Error('Refusing hosted Phase 2 fixture writes');
  }
  expect(fixture.scope).toBe('NONPROD_ISOLATED_ONLY');
  expect(fixture.owner_preview_id).toBe('user1');
  expect(fixture.groups).toHaveLength(6);
  expect(fixture.beneficiaries).toHaveLength(24);

  const contexts: BrowserContext[] = [];
  const viewport = info.project.name.startsWith('mobile')
    ? { width: 375, height: 812 } : { width: 1280, height: 800 };
  const newPage = async (): Promise<Page> => {
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173', viewport });
    contexts.push(context);
    return context.newPage();
  };
  const login = async (page: Page, userId: 'user1' | 'user2'): Promise<string> => {
    await page.goto('/?action=taxpayer_login');
    await page.getByRole('textbox', { name: 'User ID' }).fill(userId);
    await page.getByLabel('Password', { exact: true }).fill(userId);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page).toHaveURL(/action=taxpayer_home/);
    const session = await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem('korbritto.demo-profile-session.v1') ?? 'null'));
    expect(session.profileId).toBe(userId);
    expect(typeof session.capability).toBe('string');
    return session.capability;
  };
  const action = async (page: Page, capability: string, name: string, fields: Record<string, unknown> = {}) =>
    page.evaluate(async ({ endpoint, key, capability, name, fields }) => {
      const response = await fetch(endpoint + '/functions/v1/taxpay-guest-beneficiaries', {
        method: 'POST', cache: 'no-store',
        headers: { apikey: key, 'content-type': 'application/json', 'x-taxpay-guest-capability': capability },
        body: JSON.stringify({ action: name, ...fields }),
      });
      return { status: response.status, body: await response.json() };
    }, { endpoint: api.origin, key, capability, name, fields });
  const snapshot = async (page: Page, capability: string) => {
    const result = await action(page, capability, 'snapshot');
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    expect(result.body.success).toBe(true);
    return result.body.data as {
      profileId: string; lists: Array<{ id: string; name: string }>;
      people: Array<{ list_id: string; tin: string; display_name: string;
        tag: string; relationship: string | null; other_label: string | null }>;
    };
  };

  try {
    const suffix = randomUUID().slice(0, 8);
    const owner = await newPage();
    const capability = await login(owner, 'user1');
    const createdLists: Array<{ id: string; key: string; name: string }> = [];
    for (const group of fixture.groups) {
      const name = group.display + ' · Phase2 ' + suffix;
      const created = await action(owner, capability, 'create-list', { name });
      expect(created.status, JSON.stringify(created.body)).toBe(200);
      expect(created.body.success).toBe(true);
      const listId = created.body.data?.id as string;
      expect(listId).toMatch(/^[a-f\d-]{36}$/i);
      createdLists.push({ id: listId, key: group.key, name });
      const rows = fixture.beneficiaries.filter(person => person.list_key === group.key).map(person => ({
        tin: person.tin_alias, display_name: person.display_name,
        tag: person.tag, relationship: person.relationship, other_label: person.other_label,
      }));
      expect(rows).toHaveLength(4);
      const inserted = await action(owner, capability, 'add', { listId, rows });
      expect(inserted.status, JSON.stringify(inserted.body)).toBe(200);
      expect(inserted.body.success).toBe(true);
      expect(inserted.body.data).toBe(4);
    }
    const verify = (data: Awaited<ReturnType<typeof snapshot>>) => {
      expect(data.profileId).toBe('user1');
      const all = createdLists.flatMap(list => {
        expect(data.lists).toContainEqual(expect.objectContaining({ id: list.id, name: list.name }));
        const saved = data.people.filter(person => person.list_id === list.id);
        expect(saved).toHaveLength(4);
        const expected = fixture.beneficiaries.filter(person => person.list_key === list.key);
        for (const person of expected) expect(saved).toContainEqual(expect.objectContaining({
          tin: person.tin_alias, display_name: person.display_name, tag: person.tag,
          relationship: person.relationship, other_label: person.other_label,
        }));
        return saved;
      });
      expect(all).toHaveLength(24);
      expect(new Set(all.map(person => person.tin)).size).toBe(24);
    };
    verify(await snapshot(owner, capability));

    const anotherBrowser = await newPage();
    const freshCapability = await login(anotherBrowser, 'user1');
    verify(await snapshot(anotherBrowser, freshCapability));
    await anotherBrowser.goto('/?action=beneficiaries');
    await expect(anotherBrowser.getByTestId('beneficiaries-page')).toBeVisible();
    if (await anotherBrowser.locator('#beneficiary-list').count() === 0) {
      await anotherBrowser.getByRole('button', { name: /^(Filter|ফিল্টার)$/ }).click();
    }
    await anotherBrowser.locator('#beneficiary-list').click();
    await anotherBrowser.locator('#beneficiary-list-menu')
      .getByRole('button', { name: createdLists[0].name, exact: true }).click();
    await expect(anotherBrowser.getByTestId('beneficiary-records'))
      .toContainText(fixture.beneficiaries[0].display_name);
    await anotherBrowser.reload();
    verify(await snapshot(anotherBrowser, freshCapability));

    const otherOwner = await newPage();
    const otherCapability = await login(otherOwner, 'user2');
    const otherData = await snapshot(otherOwner, otherCapability);
    expect(otherData.profileId).toBe('user2');
    for (const list of createdLists) {
      expect(otherData.lists.some(item => item.id === list.id)).toBe(false);
      expect(otherData.people.some(person => person.list_id === list.id)).toBe(false);
    }
    // Does not create payment, receipt, certificate or official TIN records.
  } finally {
    await Promise.all(contexts.map(context => context.close()));
  }
});
