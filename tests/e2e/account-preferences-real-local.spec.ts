import {expect,test} from '@playwright/test';
import {randomBytes,randomUUID} from 'node:crypto';

// Only disposable loopback Auth + PostgREST. Never run against a hosted project.
test('real account restores its own language and selected beneficiary list in a fresh browser, without leaking to another account',async({browser})=>{
  test.setTimeout(120_000);
  const raw=process.env.TAXPAY_LOCAL_SUPABASE_URL;
  const key=process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
  if(!raw||!key)throw new Error('Disposable Supabase credentials required.');
  const api=new URL(raw);
  if(api.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(api.hostname))
    throw new Error('Refusing a non-loopback preferences test.');

  const signUp=async()=>{
    const email='preferences-'+randomUUID()+'@example.invalid';
    const password=randomBytes(32).toString('base64url');
    const response=await fetch(new URL('/auth/v1/signup',api.origin),{
      method:'POST',headers:{apikey:key,'content-type':'application/json'},
      body:JSON.stringify({email,password}),
    });
    expect(response.status).toBe(200);
    const body=await response.json();
    const session=body.session??body;
    expect(session.access_token).toBeTruthy();
    return {email,password,session};
  };
  const signIn=async(email:string,password:string)=>{
    const response=await fetch(new URL('/auth/v1/token?grant_type=password',api.origin),{
      method:'POST',headers:{apikey:key,'content-type':'application/json'},
      body:JSON.stringify({email,password}),
    });
    expect(response.status).toBe(200);
    const body=await response.json();
    expect(body.access_token).toBeTruthy();
    return body;
  };
  const url=(session:{access_token:string;refresh_token:string;expires_at?:number})=>
    '/?action=beneficiaries#access_token='+encodeURIComponent(session.access_token)+
    '&refresh_token='+encodeURIComponent(session.refresh_token)+
    '&token_type=bearer&expires_in=3600&expires_at='+
    (session.expires_at??Math.floor(Date.now()/1000)+3600);
  const authUser=async(token:string)=>{
    const response=await fetch(new URL('/auth/v1/user',api.origin),{
      headers:{apikey:key,Authorization:'Bearer '+token}
    });
    expect(response.status).toBe(200);
    return response.json() as Promise<{user_metadata?:Record<string,unknown>}>;
  };

  const a=await signUp();
  const first=await browser.newContext({baseURL:'http://127.0.0.1:4173'});
  const page=await first.newPage();
  await page.goto(url(a.session));
  await expect(page.getByTestId('beneficiaries-page')).toBeVisible({timeout:15000});

  async function addList(name:string){
    await page.getByRole('button',{name:'Create list',exact:true}).first().click();
    const dialog=page.getByRole('dialog',{name:'Create list'});
    await dialog.locator('#beneficiary-create-list-name').fill(name);
    await dialog.getByRole('button',{name:'Create list',exact:true}).click();
    await expect(dialog).toBeHidden();
  }
  await addList('Family');
  await addList('Clients');
  await expect(page.locator('#beneficiary-list')).toContainText('Clients');
  const ownedLists=await fetch(new URL('/rest/v1/taxpay_beneficiary_lists?select=id,name',api.origin),{
    headers:{apikey:key,Authorization:'Bearer '+a.session.access_token}
  });
  expect(ownedLists.status).toBe(200);
  const own=(await ownedLists.json()) as {id:string;name:string}[];
  const clientsId=own.find(list=>list.name==='Clients')?.id;
  const familyId=own.find(list=>list.name==='Family')?.id;
  expect(clientsId).toBeTruthy();expect(familyId).toBeTruthy();
  await expect.poll(async()=>(await authUser(a.session.access_token)).user_metadata?.taxpay_last_beneficiary_list_id,
    {timeout:10000}).toBe(clientsId);
  await page.locator('#beneficiary-list').click();
  await page.locator('#beneficiary-list-menu').getByRole('button',{name:'Family',exact:true}).click();
  await expect(page.locator('#beneficiary-list')).toContainText('Family');
  // Verify latest selected list was saved to SQL-backed Auth, not just React state.
  await expect.poll(async()=>(await authUser(a.session.access_token)).user_metadata?.taxpay_last_beneficiary_list_id,
    {timeout:10000}).toBe(familyId);

  // Verify an actual tagged contact is owner-scoped SQL data, not a browser
  // preview capability, before starting the second browser session.
  const savedPerson=await fetch(new URL('/rest/v1/taxpay_beneficiaries',api.origin),{
    method:'POST',
    headers:{apikey:key,Authorization:'Bearer '+a.session.access_token,
      'content-type':'application/json',Prefer:'return=representation'},
    body:JSON.stringify({owner_uid:(await (await fetch(new URL('/auth/v1/user',api.origin),{
      headers:{apikey:key,Authorization:'Bearer '+a.session.access_token}
    })).json()).id,list_id:familyId,tin:'000000000047',
      display_name:'Sajid Khan',tag:'friends_family',relationship:'friends'})
  });
  expect(savedPerson.status).toBe(201);

  await page.goto('/?action=account_settings');
  await expect(page.locator('#taxpay-profile-language')).toBeVisible();
  await page.locator('#taxpay-profile-language').selectOption('bn');
  await page.locator('form.taxpayer-account-fields button[type="submit"]').click();
  await expect(page.locator('.taxpay-citizen-shell')).toHaveAttribute('lang','bn');
  // Sign out immediately after selecting Bangla. The owner preference must
  // finish saving before the session is revoked: no waiting for SQL here.
  await page.locator('.citizen-mobile-menu-trigger').click();
  await page.locator('.citizen-dialog-signout').click();
  await expect(page).toHaveURL(/^(?!.*action=account_settings)/,{timeout:15000});
  await first.close();

  const aSession=await signIn(a.email,a.password);
  expect((await authUser(aSession.access_token)).user_metadata?.taxpay_language).toBe('bn');
  const second=await browser.newContext({baseURL:'http://127.0.0.1:4173'});
  const again=await second.newPage();
  await again.goto(url(aSession));
  await expect(again.getByTestId('beneficiaries-page')).toBeVisible({timeout:15000});
  await expect(again.locator('.taxpay-citizen-shell')).toHaveAttribute('lang','bn');
  await expect(again.locator('#beneficiary-list')).toContainText('Family');
  await expect(again.getByTestId('beneficiary-records')).toContainText('Sajid Khan');
  await expect(again.getByTestId('beneficiary-records')).toContainText('000000000047');
  await expect(again.getByTestId('beneficiary-records')).toContainText('বন্ধু');

  expect((await authUser(aSession.access_token)).user_metadata?.taxpay_last_beneficiary_list_id).toBe(familyId);
  await second.close();

  const b=await signUp();
  const third=await browser.newContext({baseURL:'http://127.0.0.1:4173'});
  const another=await third.newPage();
  await another.goto(url(b.session));
  await expect(another.getByTestId('beneficiaries-page')).toBeVisible({timeout:15000});
  await expect(another.locator('.taxpay-citizen-shell')).toHaveAttribute('lang','en');
  await expect(another.locator('#beneficiary-list')).toHaveCount(0);
  await expect(another.getByText('Sajid Khan')).toHaveCount(0);

  await third.close();
});
