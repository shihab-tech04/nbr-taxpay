import {expect,test} from '@playwright/test';
import {randomBytes,randomUUID} from 'node:crypto';

/** Real disposable Auth/PostgREST: moving an owned contact must never edit its TIN or name. */
test('beneficiary Edit moves only its list, persists, rejects collisions and cannot cross owners',async({browser})=>{
  test.setTimeout(120_000);
  const raw=process.env.TAXPAY_LOCAL_SUPABASE_URL, key=process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
  if(!raw||!key)throw new Error('BLOCKED: disposable local Supabase credentials required');
  const api=new URL(raw);
  if(api.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(api.hostname))
    throw new Error('Refusing hosted database for beneficiary move acceptance');
  const account=async()=>{
    const response=await fetch(new URL('/auth/v1/signup',api.origin),{
      method:'POST',headers:{apikey:key,'Content-Type':'application/json'},
      body:JSON.stringify({email:'move-'+randomUUID()+'@example.invalid',password:randomBytes(32).toString('base64url')}),
    });
    expect(response.status).toBe(200);
    const result=await response.json(),session=result.session??result;
    expect(session.access_token).toBeTruthy();
    return {id:result.user.id as string,token:session.access_token as string,session};
  };
  const [first,second]=await Promise.all([account(),account()]);
  const request=async(token:string,route:string,method='GET',body?:unknown)=>{
    const response=await fetch(new URL('/rest/v1/'+route,api.origin),{
      method,headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation'},
      body:body===undefined?undefined:JSON.stringify(body),
    });
    return {status:response.status,body:await response.json()};
  };
  const createList=async(token:string,uid:string,name:string)=>{
    const response=await request(token,'taxpay_beneficiary_lists?select=id,name','POST',{owner_uid:uid,name});
    expect(response.status).toBe(201);
    return response.body[0].id as string;
  };
  const family=await createList(first.token,first.id,'Family');
  const clients=await createList(first.token,first.id,'Clients');
  const foreign=await createList(second.token,second.id,'Another account');
  const saved=await request(first.token,'taxpay_beneficiaries?select=id,owner_uid,list_id,tin,display_name','POST',{
    owner_uid:first.id,list_id:family,tin:'012345678901',display_name:'Immutable Beneficiary',
  });
  expect(saved.status).toBe(201);
  const id=saved.body[0].id as string;
  const login='/\x3faction=beneficiaries#access_token='+encodeURIComponent(first.session.access_token)+
    '&refresh_token='+encodeURIComponent(first.session.refresh_token)+
    '&token_type=bearer&expires_in=3600&expires_at='+
    (first.session.expires_at??Math.floor(Date.now()/1000)+3600);
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4173',viewport:{width:320,height:720}});
  try{
    const page=await context.newPage();
    await page.goto(login);
    await expect(page.getByTestId('beneficiaries-page')).toBeVisible({timeout:15000});
    await page.getByRole('button',{name:'Selected list'}).click();
    await page.getByRole('dialog',{name:'Choose beneficiary list'}).getByRole('button',{name:'Family',exact:true}).click();
    const row=page.locator('ul[aria-label="Saved beneficiaries"] li').filter({hasText:'012345678901'});
    await expect(row).toContainText('Immutable Beneficiary');
    await row.getByRole('button',{name:'Edit',exact:true}).click();
    let dialog=page.getByRole('dialog',{name:'Edit beneficiary'});
    await expect(dialog.getByText('Immutable Beneficiary')).toBeVisible();
    await expect(dialog.getByText('012345678901')).toBeVisible();
    await expect(dialog.locator('#beneficiary-edit-name')).toHaveCount(0);
    await expect(dialog.getByRole('textbox')).toHaveCount(0);
    await expect(dialog.locator('#beneficiary-edit-list option')).toHaveCount(2);
    await expect(dialog.getByRole('button',{name:'Save changes'})).toBeDisabled();
    await dialog.locator('#beneficiary-edit-list').selectOption(clients);
    await dialog.getByRole('button',{name:'Save changes'}).click();
    await expect(page.getByText('Beneficiary moved to the selected list.')).toBeVisible();
    await expect(page.getByRole('button',{name:'Selected list'})).toContainText('Clients');
    await expect(page.getByRole('list',{name:'Saved beneficiaries'}).getByText('Immutable Beneficiary')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button',{name:'Selected list'})).toContainText('Clients');
    await expect(page.getByRole('list',{name:'Saved beneficiaries'}).getByText('Immutable Beneficiary')).toBeVisible();

    let read=await request(first.token,'taxpay_beneficiaries?id=eq.'+id+'&select=id,owner_uid,list_id,tin,display_name');
    expect(read.body).toEqual([{id,owner_uid:first.id,list_id:clients,tin:'012345678901',display_name:'Immutable Beneficiary'}]);
    const denied=await request(second.token,'taxpay_beneficiaries?id=eq.'+id+'&select=id','PATCH',{list_id:foreign});
    expect(denied.status).toBe(200);
    expect(denied.body).toEqual([]);
    read=await request(first.token,'taxpay_beneficiaries?id=eq.'+id+'&select=list_id');
    expect(read.body).toEqual([{list_id:clients}]);

    const collision=await request(first.token,'taxpay_beneficiaries?select=id','POST',{
      owner_uid:first.id,list_id:family,tin:'012345678901',display_name:'Separate Saved Copy',
    });
    expect(collision.status).toBe(201);
    await page.setViewportSize({width:1440,height:900});
    const desktopRow=page.getByRole('row').filter({hasText:'012345678901'});
    await desktopRow.getByRole('button',{name:'Edit',exact:true}).click();
    dialog=page.getByRole('dialog',{name:'Edit beneficiary'});
    await dialog.locator('#beneficiary-edit-list').selectOption(family);
    await dialog.getByRole('button',{name:'Save changes'}).click();
    await expect(dialog.getByRole('alert')).toContainText('already saved in the destination list');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button',{name:'Cancel'}).click();
    read=await request(first.token,'taxpay_beneficiaries?id=eq.'+id+'&select=list_id,tin,display_name');
    expect(read.body).toEqual([{list_id:clients,tin:'012345678901',display_name:'Immutable Beneficiary'}]);
  }finally{await context.close();}
});
