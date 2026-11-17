import {test,expect} from '@playwright/test';

// Saved beneficiaries are shown after the approved taxpayer sign-in, not anonymous
// browser capability. The private route protects the screen before data loads.
test('signed-out Beneficiaries deep links open the approved taxpayer sign-in',async({page})=>{
  for(const language of ['en','bn'] as const){
    const suffix=language==='bn'?'&lang=bn':'';
    await page.goto('/?action=beneficiaries'+suffix);
    const modal=page.locator('.taxpay-modal.taxpayer-login-modal');
    await expect(modal).toBeVisible();
    await expect(page.getByRole('heading',{name:language==='bn'?'করদাতার ব্যক্তিগত তথ্য':'Private taxpayer workspace'})).toHaveCount(0);
    const loginId=modal.getByRole('textbox',{name:language==='bn'?'ইউজার আইডি':'User ID'});
    await expect(loginId).toBeVisible();
    await expect(modal.getByLabel(language==='bn'?'পাসওয়ার্ড':'Password',{exact:true})).toBeVisible();
    await expect(page.getByTestId('beneficiaries-page')).toHaveCount(0);
    await expect(page.locator('.taxpayer-reference-rail')).toHaveCount(0);
    await expect(page.getByRole('navigation',{name:language==='bn'?'প্রধান নেভিগেশন':'Main navigation'}).getByRole('button',{name:language==='bn'?'উপকারভোগী':'Beneficiaries'})).toHaveCount(0);
    await expect(page.getByTestId('beneficiaries-page')).toHaveCount(0);
  }
});


test('guest beneficiary API rejects untagged adds and permits only explicit legacy recovery',async({request})=>{
  test.setTimeout(30_000);
  const raw=process.env.TAXPAY_LOCAL_SUPABASE_URL;
  const key=process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
  if(!raw||!key)throw new Error('Disposable local Supabase credentials are required.');
  const url=new URL(raw);
  if(url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname))
    throw new Error('Refusing hosted guest-beneficiary acceptance.');
  const endpoint=new URL('/functions/v1/taxpay-guest-beneficiaries',url.origin).href;
  const {randomBytes}=await import('node:crypto');
  const capability=randomBytes(32).toString('base64url');
  const invoke=(action:string,fields:Record<string,unknown>={})=>request.post(endpoint,{
    headers:{origin:'http://127.0.0.1:4173',apikey:key,'content-type':'application/json','x-taxpay-guest-capability':capability},
    data:{action,...fields},
  });
  let listId='';
  try{
    const opened=await invoke('open');
    expect(opened.status()).toBe(200);
    expect((await opened.json()).success).toBe(true);

    const created=await invoke('create-list',{name:'Tag boundary acceptance'});
    expect(created.status()).toBe(200);
    const createdBody=await created.json();
    expect(createdBody.success).toBe(true);
    listId=createdBody.data.id;

    const untagged=await invoke('add',{listId,rows:[{tin:'012345678901',display_name:'Untagged new contact'}]});
    expect(untagged.status()).toBe(400);
    expect((await untagged.json()).code).toBe('INVALID_BENEFICIARY');

    const invalidRelation=await invoke('add',{listId,rows:[{
      tin:'012345678902',display_name:'Invalid family contact',tag:'friends_family',relationship:null,
    }]});
    expect(invalidRelation.status()).toBe(400);
    expect((await invalidRelation.json()).code).toBe('INVALID_BENEFICIARY');

    const tagged=await invoke('add',{listId,rows:[{
      tin:'012345678903',display_name:'Tagged new contact',tag:'clients',relationship:null,
    }]});
    expect(tagged.status()).toBe(200);
    expect((await tagged.json()).success).toBe(true);

    const restored=await invoke('restore-legacy-add',{listId,rows:[{
      tin:'012345678904',display_name:'Recovered legacy contact',tag:null,relationship:null,other_label:null,
    }]});
    expect(restored.status()).toBe(200);
    expect((await restored.json()).success).toBe(true);

    const readback=await invoke('people',{offset:0,limit:500});
    expect(readback.status()).toBe(200);
    const rows=(await readback.json()).data as Array<{list_id:string;tin:string;tag:string|null;relationship:string|null}>;
    expect(rows.filter(row=>row.list_id===listId)).toEqual(expect.arrayContaining([
      expect.objectContaining({tin:'012345678903',tag:'clients',relationship:null}),
      expect.objectContaining({tin:'012345678904',tag:null,relationship:null}),
    ]));
    expect(rows.some(row=>row.list_id===listId&&row.tin==='012345678901')).toBe(false);
  }finally{
    if(listId){
      const removed=await invoke('delete-list',{id:listId});
      expect(removed.status()).toBe(200);
    }
  }
});
