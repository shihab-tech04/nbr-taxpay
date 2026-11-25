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
  const otherCapability=randomBytes(32).toString('base64url');
  const invoke=(action:string,fields:Record<string,unknown>={})=>request.post(endpoint,{
    headers:{origin:'http://127.0.0.1:4173',apikey:key,'content-type':'application/json','x-taxpay-guest-capability':capability},
    data:{action,...fields},
  });
  const asOther=(action:string,fields:Record<string,unknown>={})=>request.post(endpoint,{
    headers:{origin:'http://127.0.0.1:4173',apikey:key,'content-type':'application/json','x-taxpay-guest-capability':otherCapability},
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

    // A second independent capability cannot see or alter the first owner's
    // tagged records. No production credentials or rows are involved.
    const openedOther=await asOther('open');
    expect(openedOther.status()).toBe(200);
    const otherPeople=await asOther('people',{offset:0,limit:500});
    expect(otherPeople.status()).toBe(200);
    expect((await otherPeople.json()).data).toEqual([]);
    const forbidden=await asOther('add',{listId,rows:[{
      tin:'012345678905',display_name:'Other owner attempt',tag:'clients',relationship:null,
    }]});
    expect([400,403,404]).toContain(forbidden.status());

    const readback=await invoke('people',{offset:0,limit:500});
    expect(readback.status()).toBe(200);
    const rows=(await readback.json()).data as Array<{list_id:string;tin:string;tag:string|null;relationship:string|null}>;
    expect(rows.filter(row=>row.list_id===listId)).toEqual(expect.arrayContaining([
      expect.objectContaining({tin:'012345678903',tag:'clients',relationship:null}),
      expect.objectContaining({tin:'012345678904',tag:null,relationship:null}),
    ]));
    expect(rows.some(row=>row.list_id===listId&&row.tin==='012345678901')).toBe(false);
    expect(rows.some(row=>row.list_id===listId&&row.tin==='012345678905')).toBe(false);
    const denied=await invoke('delete-list',{id:listId});
    expect(denied.status()).toBe(409);
    expect((await denied.json()).code).toBe('BENEFICIARY_GROUP_NOT_EMPTY');
    const preserved=await invoke('people',{offset:0,limit:500});
    expect(preserved.status()).toBe(200);
    expect((await preserved.json()).data).toEqual(rows);
  }finally{
    if(listId){
      const readback=await invoke('people',{offset:0,limit:500});
      expect(readback.status()).toBe(200);
      const fixtures=(await readback.json()).data as Array<{id:string;list_id:string}>;
      for(const row of fixtures.filter(row=>row.list_id===listId)){
        const removedPerson=await invoke('remove',{id:row.id});
        expect(removedPerson.status()).toBe(200);
      }
      const removed=await invoke('delete-list',{id:listId});
      expect(removed.status()).toBe(200);
    }
  }
});


test('F-058 US-010 tagged beneficiary survives a fresh browser context and stays private',async({browser})=>{
  test.setTimeout(120_000);
  const raw=process.env.TAXPAY_LOCAL_SUPABASE_URL;
  const key=process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
  if(!raw||!key)throw new Error('Disposable local Supabase credentials required');
  const api=new URL(raw);
  if(api.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(api.hostname))
    throw new Error('Refusing hosted beneficiary acceptance');
  const {randomBytes}=await import('node:crypto');
  const capA=randomBytes(32).toString('base64url');
  const capB=randomBytes(32).toString('base64url');
  const endpoint=new URL('/functions/v1/taxpay-guest-beneficiaries',api.origin).href;
  const first=await browser.newContext();
  const fresh=await browser.newContext();
  const other=await browser.newContext();
  let listId='';
  const invoke=(context:typeof first,capability:string,action:string,fields:Record<string,unknown>={})=>
    context.request.post(endpoint,{
      headers:{origin:'http://127.0.0.1:4173',apikey:key,'content-type':'application/json',
        'x-taxpay-guest-capability':capability},
      data:{action,...fields},
    });
  const people=async(context:typeof first,capability:string)=>{
    const response=await invoke(context,capability,'people',{offset:0,limit:500});
    expect(response.status()).toBe(200);
    return (await response.json()).data as Array<{
      id:string;list_id:string;tin:string;display_name:string;tag:string;relationship:string|null
    }>;
  };
  try{
    const openA=await invoke(first,capA,'open');
    const openB=await invoke(other,capB,'open');
    expect(openA.status()).toBe(200);
    expect(openB.status()).toBe(200);

    const created=await invoke(first,capA,'create-list',{name:'Isolated fictional client list'});
    expect(created.status()).toBe(200);
    listId=(await created.json()).data.id;
    expect(listId).toMatch(/^[0-9a-f-]{36}$/i);

    const saved=await invoke(first,capA,'add',{listId,rows:[{
      tin:'012345678905',display_name:'Isolated fictional client',
      tag:'clients',relationship:null,
    }]});
    expect(saved.status()).toBe(200);
    expect((await saved.json()).success).toBe(true);

    const owned=(await people(first,capA)).filter(row=>row.list_id===listId);
    expect(owned).toEqual(expect.arrayContaining([
      expect.objectContaining({tin:'012345678905',tag:'clients',relationship:null}),
    ]));

    // A second independent browser context with the same authorized private
    // capability must read the persisted SQL row, not a local browser cache.
    const persisted=(await people(fresh,capA)).filter(row=>row.list_id===listId);
    expect(persisted).toEqual(expect.arrayContaining([
      expect.objectContaining({tin:'012345678905',tag:'clients'}),
    ]));

    // The other fictional owner cannot enumerate the list or its contents.
    const foreign=(await people(other,capB));
    expect(foreign.some(row=>row.list_id===listId||row.tin==='012345678905')).toBe(false);
    // Empty owner snapshots are not required here: the real private people
    // endpoint above is the precise row-level read boundary for this test.

    // A failed cross-owner attempt must not alter the first owner's stored row.
    const attempted=await invoke(other,capB,'add',{listId,rows:[{
      tin:'012345678906',display_name:'Unauthorized fictional write',
      tag:'clients',relationship:null,
    }]});
    expect(attempted.ok()).toBe(false);
    const after=(await people(fresh,capA)).filter(row=>row.list_id===listId);
    expect(after).toEqual(owned);
    const denied=await invoke(first,capA,'delete-list',{id:listId});
    expect(denied.status()).toBe(409);
    expect((await denied.json()).code).toBe('BENEFICIARY_GROUP_NOT_EMPTY');
    expect((await people(fresh,capA)).filter(row=>row.list_id===listId)).toEqual(owned);
  }finally{
    try{
      if(listId){
        for(const row of (await people(first,capA)).filter(row=>row.list_id===listId)){
          const removedPerson=await invoke(first,capA,'remove',{id:row.id});
          expect(removedPerson.status()).toBe(200);
        }
        const removed=await invoke(first,capA,'delete-list',{id:listId});
        expect(removed.status()).toBe(200);
      }
    }finally{
      await Promise.all([first.close(),fresh.close(),other.close()]);
    }
  }
});
