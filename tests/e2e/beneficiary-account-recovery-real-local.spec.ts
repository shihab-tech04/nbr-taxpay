import { expect, test } from '@playwright/test';
import { randomBytes, randomUUID } from 'node:crypto';

// Requires disposable, loopback-only Auth + PostgREST + guest Edge Function.
// Never sign up accounts or write beneficiary data in hosted production.
test('copy browser guest lists into real account, survive reload/device and isolate a second owner', async ({browser}) => {
  test.setTimeout(150_000);
  const raw = process.env.TAXPAY_LOCAL_SUPABASE_URL;
  const key = process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
  if (!raw || !key) throw new Error('BLOCKED: disposable local Supabase credentials required');
  const api = new URL(raw);
  if (api.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(api.hostname))
    throw new Error('Refusing non-loopback beneficiary recovery acceptance');

  const makeUser = async () => {
    const email = 'recovery-' + randomUUID() + '@example.invalid';
    const password = randomBytes(32).toString('base64url');
    const response = await fetch(new URL('/auth/v1/signup', api.origin), {
      method: 'POST', headers: {apikey:key, 'Content-Type':'application/json'},
      body: JSON.stringify({email,password}),
    });
    expect(response.status).toBe(200);
    const value = await response.json();
    const session = value.session ?? value;
    expect(value.user?.id).toBeTruthy();
    expect(session.access_token).toBeTruthy();
    return {id: value.user.id as string, session};
  };

  const guestCapability = randomBytes(32).toString('base64url');
  const guestPost = async (action: string, extra: Record<string,unknown> = {}) => {
    const response = await fetch(new URL('/functions/v1/taxpay-guest-beneficiaries',api.origin), {
      method: 'POST',
      headers: {apikey:key, 'Content-Type':'application/json',
        Origin:'http://127.0.0.1:4173', 'x-taxpay-guest-capability':guestCapability},
      body: JSON.stringify({action,...extra}),
    });
    const result = await response.json();
    expect(response.status, action+': '+JSON.stringify(result)).toBe(200);
    expect(result.success, action+': '+JSON.stringify(result)).toBe(true);
    return result.data;
  };

  await guestPost('open');
  const guestList = await guestPost('create-list',{name:'Family from this browser'}) as {id:string};
  await guestPost('add',{listId:guestList.id, rows:[
    {tin:'012345678901', display_name:'Browser Contact One'},
  ]});
  expect((await guestPost('people',{offset:0,limit:500})).length).toBe(1);

  const ownerA = await makeUser(), ownerB = await makeUser();
  const loginPath=(session:{access_token:string;refresh_token:string;expires_at?:number})=>
    '/?action=beneficiaries#access_token='+encodeURIComponent(session.access_token)+
    '&refresh_token='+encodeURIComponent(session.refresh_token)+
    '&token_type=bearer&expires_in=3600&expires_at='+
    (session.expires_at??Math.floor(Date.now()/1000)+3600);
  const context = await browser.newContext({baseURL:'http://127.0.0.1:4173',viewport:{width:375,height:812}});
  await context.addInitScript(capability => {
    localStorage.setItem('korbritto.guest-beneficiaries.capability.v1',capability);
    localStorage.setItem('korbritto.guest-beneficiaries.initialized.v1','1');
  },guestCapability);
  const page = await context.newPage();
  await page.goto(loginPath(ownerA.session));
  await expect(page.getByTestId('beneficiaries-page')).toBeVisible({timeout:15_000});
  await expect(page.getByRole('button',{name:'Copy to my account'})).toBeVisible();
  await page.getByRole('button',{name:'Copy to my account'}).click();
  await expect(page.getByRole('status').filter({hasText:'Verified 1 lists and 1 contacts'})).toBeVisible({timeout:20_000});
  await expect(page.getByTestId('beneficiary-records')).toContainText('012345678901');
  await expect(page.getByTestId('beneficiary-records')).toContainText('Browser Contact One');

  const getSaved = async (token:string) => {
    const response = await fetch(new URL('/rest/v1/taxpay_beneficiaries?select=owner_uid,tin,display_name',api.origin),{
      headers:{apikey:key,Authorization:'Bearer '+token},
    });
    expect(response.status).toBe(200);
    return await response.json() as Array<{owner_uid:string;tin:string;display_name:string}>;
  };
  expect(await getSaved(ownerA.session.access_token)).toEqual([
    {owner_uid:ownerA.id,tin:'012345678901',display_name:'Browser Contact One'},
  ]);
  expect(await getSaved(ownerB.session.access_token)).toEqual([]);
  expect((await guestPost('people',{offset:0,limit:500})).length).toBe(1); // original preserved

  await page.reload();
  await expect(page.getByTestId('beneficiary-records')).toContainText('012345678901');
  await page.getByRole('button',{name:'Copy to my account'}).click();
  await expect(page.getByRole('status').filter({hasText:'Newly copied: 0 lists and 0 contacts'})).toBeVisible({timeout:20_000});
  expect(await getSaved(ownerA.session.access_token)).toHaveLength(1);

  const secondBrowser = await browser.newContext({baseURL:'http://127.0.0.1:4173',viewport:{width:320,height:720}});
  const secondPage = await secondBrowser.newPage();
  await secondPage.goto(loginPath(ownerA.session));
  await expect(secondPage.getByTestId('beneficiary-records')).toContainText('Browser Contact One',{timeout:15_000});
  await expect(secondPage.getByRole('button',{name:'Copy to my account'})).toHaveCount(0);
  await secondBrowser.close();

  const anotherOwnerBrowser = await browser.newContext({baseURL:'http://127.0.0.1:4173',viewport:{width:375,height:812}});
  const anotherOwnerPage = await anotherOwnerBrowser.newPage();
  await anotherOwnerPage.goto(loginPath(ownerB.session));
  await expect(anotherOwnerPage.getByTestId('beneficiaries-page')).toBeVisible({timeout:15_000});
  await expect(anotherOwnerPage.getByText('Browser Contact One')).toHaveCount(0);
  await anotherOwnerBrowser.close();
  await context.close();
});
