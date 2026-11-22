import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { chooseBeneficiaryOption } from './beneficiarySearchableSelect';

type Session = { access_token: string; refresh_token: string; expires_at?: number };
type Owner = { id: string; email: string; password: string; session: Session };
type SavedRow = {
  id: string;
  owner_uid: string;
  list_id: string;
  tin: string;
  display_name: string;
  tag: string | null;
  relationship: string | null;
  other_label: string | null;
  list_owner_uid: string;
  list_name: string;
};

test('F-063 saved beneficiaries persist across owners sessions and resist cross-owner reads and writes', async ({ browser }) => {
  test.setTimeout(120_000);
  const raw = process.env.TAXPAY_LOCAL_SUPABASE_URL;
  const key = process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
  const dsn = process.env.TAXPAY_LOCAL_PG_DSN;
  if (!raw || !key || !dsn) throw new Error('BLOCKED: disposable local Supabase credentials required');

  const api = new URL(raw);
  const database = new URL(dsn);
  if (api.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(api.hostname)) {
    throw new Error('Refusing non-loopback beneficiary acceptance');
  }
  if ((database.protocol !== 'postgres:' && database.protocol !== 'postgresql:') ||
    !['localhost', '127.0.0.1', '[::1]'].includes(database.hostname)) {
    throw new Error('Refusing non-loopback beneficiary SQL fixture');
  }

  const makeOwner = async (): Promise<Owner> => {
    const email = `beneficiary-f063-${randomUUID()}@example.invalid`;
    const password = randomBytes(32).toString('base64url');
    const response = await fetch(new URL('/auth/v1/signup', api.origin), {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = await response.text();
    expect(response.status, body).toBe(200);
    const value = JSON.parse(body);
    const session = value.session ?? value;
    expect(value.user?.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(session.access_token).toBeTruthy();
    expect(session.refresh_token).toBeTruthy();
    return { id: value.user.id, email, password, session };
  };

  const signIn = async (owner: Owner): Promise<Session> => {
    const response = await fetch(new URL('/auth/v1/token?grant_type=password', api.origin), {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: owner.email, password: owner.password }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = await response.text();
    expect(response.status, body).toBe(200);
    const value = JSON.parse(body);
    expect(value.user?.id).toBe(owner.id);
    expect(value.access_token).toBeTruthy();
    expect(value.refresh_token).toBeTruthy();
    return value;
  };

  const loginUrl = (session: Session) =>
    '/?action=beneficiaries#access_token=' + encodeURIComponent(session.access_token) +
    '&refresh_token=' + encodeURIComponent(session.refresh_token) +
    '&token_type=bearer&expires_in=3600&expires_at=' +
    (session.expires_at ?? Math.floor(Date.now() / 1000) + 3600);

  const sqlRows = (ownerUid: string, tin: string): SavedRow[] => {
    expect(ownerUid).toMatch(/^[0-9a-f-]{36}$/i);
    expect(tin).toMatch(/^\d{12}$/);
    const query = `select coalesce(json_agg(to_jsonb(q) order by q.tin)::text,'[]') from (
      select b.id::text,b.owner_uid::text,b.list_id::text,b.tin,b.display_name,b.tag,
        b.relationship,b.other_label,l.owner_uid::text as list_owner_uid,l.name as list_name
      from public.taxpay_beneficiaries b
      join public.taxpay_beneficiary_lists l on l.id=b.list_id
      where b.owner_uid='${ownerUid}'::uuid and b.tin='${tin}'
    ) q;`;
    const result = spawnSync('psql', ['-X', '-Atq', '-v', 'ON_ERROR_STOP=1', '-c', query], {
      encoding: 'utf8',
      timeout: 10_000,
      env: {
        ...process.env,
        PGHOST: database.hostname,
        PGPORT: database.port || '5432',
        PGUSER: decodeURIComponent(database.username),
        PGPASSWORD: decodeURIComponent(database.password),
        PGDATABASE: database.pathname.slice(1),
      },
    });
    expect(result.status, result.stderr).toBe(0);
    return JSON.parse(result.stdout.trim()) as SavedRow[];
  };

  const directReadByTin = async (token: string, tin: string) => {
    const url = new URL('/rest/v1/taxpay_beneficiaries', api.origin);
    url.searchParams.set('select', 'id,owner_uid,list_id,tin,display_name,tag,relationship,other_label');
    url.searchParams.set('tin', `eq.${tin}`);
    const response = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    const body = await response.text();
    expect(response.status, body).toBe(200);
    return JSON.parse(body) as Array<Record<string, unknown>>;
  };

  const projectUse = test.info().project.use as { viewport?: { width: number; height: number } };
  const viewport = projectUse.viewport ?? { width: 1280, height: 800 };
  const rowLocator = (page: import('@playwright/test').Page) => viewport.width < 768
    ? page.getByTestId('beneficiary-directory-mobile').locator('li')
    : page.getByTestId('beneficiary-directory-desktop').locator('tbody tr');
  const contexts: Array<Awaited<ReturnType<typeof browser.newContext>>> = [];

  try {
    const ownerA = await makeOwner();
    const ownerB = await makeOwner();
    const ownerIds = [ownerA.id, ownerB.id];
    for (const ownerId of ownerIds) expect(ownerId).toMatch(/^[0-9a-f-]{36}$/i);
    const tin = randomBytes(12).reduce((value, byte) => value + String(byte % 10), '');
    const displayName = `F063 owner record ${randomUUID().slice(0, 8)}`;
    const listName = `F063 private list ${randomUUID().slice(0, 8)}`;

    const ownerAContext = await browser.newContext({
      baseURL: 'http://127.0.0.1:4173', viewport, storageState: { cookies: [], origins: [] },
    });
    contexts.push(ownerAContext);
    const ownerAPage = await ownerAContext.newPage();
    await ownerAPage.goto(loginUrl(ownerA.session));
    await expect(ownerAPage.getByTestId('beneficiaries-page')).toBeVisible({ timeout: 15_000 });
    await ownerAPage.getByRole('button', { name: 'Create list', exact: true }).first().click();
    const createList = ownerAPage.getByRole('dialog', { name: 'Create list' });
    await createList.locator('#beneficiary-create-list-name').fill(listName);
    await createList.getByRole('button', { name: 'Create list', exact: true }).click();
    await ownerAPage.getByRole('button', { name: 'Add beneficiary', exact: true }).click();
    const add = ownerAPage.getByRole('dialog', { name: 'Beneficiary entry' });
    await expect(add).toBeVisible();
    await add.locator('#beneficiary-tin').fill(tin);
    await add.locator('#beneficiary-name').fill(displayName);
    await chooseBeneficiaryOption(add, 'beneficiary-tag', 'friends_family:father');
    await add.getByRole('button', { name: 'Add beneficiary', exact: true }).click();
    await expect(ownerAPage.getByText('Beneficiary saved.')).toBeVisible({ timeout: 15_000 });
    await expect(rowLocator(ownerAPage).filter({ hasText: displayName })).toHaveCount(1);

    const authoritative = sqlRows(ownerA.id, tin);
    expect(authoritative).toHaveLength(1);
    const saved = authoritative[0];
    expect(saved).toMatchObject({
      owner_uid: ownerA.id,
      tin,
      display_name: displayName,
      tag: 'friends_family',
      relationship: 'father',
      other_label: null,
      list_owner_uid: ownerA.id,
      list_name: listName,
    });
    expect(await directReadByTin(ownerA.session.access_token, tin)).toEqual([{
      id: saved.id,
      owner_uid: saved.owner_uid,
      list_id: saved.list_id,
      tin: saved.tin,
      display_name: saved.display_name,
      tag: saved.tag,
      relationship: saved.relationship,
      other_label: saved.other_label,
    }]);

    // A distinct browser session for B must not see A's known TIN in UI or API.
    const ownerBContext = await browser.newContext({
      baseURL: 'http://127.0.0.1:4173', viewport, storageState: { cookies: [], origins: [] },
    });
    contexts.push(ownerBContext);
    const ownerBPage = await ownerBContext.newPage();
    const ownerBSession = await signIn(ownerB);
    await ownerBPage.goto(loginUrl(ownerBSession));
    await expect(ownerBPage.getByTestId('beneficiaries-page')).toBeVisible({ timeout: 15_000 });
    await ownerBPage.getByPlaceholder('Name or TIN').fill(tin);
    await expect(rowLocator(ownerBPage).filter({ hasText: displayName })).toHaveCount(0);
    expect(await directReadByTin(ownerBSession.access_token, tin)).toEqual([]);

    const knownRecord = new URL('/rest/v1/taxpay_beneficiaries', api.origin);
    knownRecord.searchParams.set('id', `eq.${saved.id}`);
    knownRecord.searchParams.set('owner_uid', `eq.${ownerA.id}`);
    knownRecord.searchParams.set('tin', `eq.${tin}`);
    const writeHeaders = {
      apikey: key,
      Authorization: `Bearer ${ownerBSession.access_token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    };
    for (const [method, body] of [
      ['PATCH', { display_name: `${displayName} altered by B` }],
      ['DELETE', undefined],
    ] as const) {
      const response = await fetch(knownRecord, {
        method,
        headers: writeHeaders,
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(15_000),
      });
      expect([200, 204, 401, 403], `${method} must be denied or return no affected row`).toContain(response.status);
      if (response.status === 200) expect(await response.json()).toEqual([]);
      expect(sqlRows(ownerA.id, tin)).toEqual(authoritative);
    }

    // Sign A out in its original browser, then switch that same browser to B.
    // No stale A row may survive the session boundary.
    await ownerAPage.goto('/?action=account_profile');
    const signOut = ownerAPage.getByRole('button', { name: /Sign out|সাইন আউট/ }).last();
    await expect(signOut).toBeVisible();
    await signOut.click();
    await expect(ownerAPage).toHaveURL(/(?:[?&]action=landing|\/$)/);
    await expect.poll(() => ownerAPage.evaluate(() => localStorage.getItem('sb-nbr-taxpay-test-auth-token'))).toBeNull();
    await expect(ownerAPage.getByText(displayName, { exact: false })).toHaveCount(0);
    const switchedBSession = await signIn(ownerB);
    await ownerAPage.goto(loginUrl(switchedBSession));
    await expect(ownerAPage.getByTestId('beneficiaries-page')).toBeVisible({ timeout: 15_000 });
    await ownerAPage.getByPlaceholder('Name or TIN').fill(tin);
    await expect(rowLocator(ownerAPage).filter({ hasText: displayName })).toHaveCount(0);

    // A's fresh authenticated browser still reads the unchanged SQL-owned row.
    const ownerAReturnContext = await browser.newContext({
      baseURL: 'http://127.0.0.1:4173', viewport, storageState: { cookies: [], origins: [] },
    });
    contexts.push(ownerAReturnContext);
    const ownerAReturnPage = await ownerAReturnContext.newPage();
    const ownerAReturnSession = await signIn(ownerA);
    await ownerAReturnPage.goto(loginUrl(ownerAReturnSession));
    await expect(ownerAReturnPage.getByTestId('beneficiaries-page')).toBeVisible({ timeout: 15_000 });
    await expect(rowLocator(ownerAReturnPage).filter({ hasText: displayName })).toHaveCount(1);
    await ownerAReturnPage.reload();
    await expect(rowLocator(ownerAReturnPage).filter({ hasText: displayName })).toHaveCount(1);
    expect(sqlRows(ownerA.id, tin)).toEqual(authoritative);
    expect(await directReadByTin(ownerAReturnSession.access_token, tin)).toEqual([{
      id: saved.id,
      owner_uid: saved.owner_uid,
      list_id: saved.list_id,
      tin: saved.tin,
      display_name: saved.display_name,
      tag: saved.tag,
      relationship: saved.relationship,
      other_label: saved.other_label,
    }]);
  } finally {
    for (const context of contexts.reverse()) await context.close();
  }
});
