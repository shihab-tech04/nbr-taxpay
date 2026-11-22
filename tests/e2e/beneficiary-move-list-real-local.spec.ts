import {chooseBeneficiaryOption} from './beneficiarySearchableSelect';
import {expect,test} from '@playwright/test';
import {randomBytes,randomUUID} from 'node:crypto';

/** Real disposable Auth/PostgREST: moving an owned contact must never edit its TIN or name. */
test('beneficiary Edit supports tags, relationships, optional list moves, preserves identity and rejects collisions',async({browser})=>{
  test.setTimeout(120_000);
  const raw=process.env.TAXPAY_LOCAL_SUPABASE_URL, key=process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
  if(!raw||!key)throw new Error('BLOCKED: disposable local Supabase credentials required');
  const api=new URL(raw);
  if(api.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(api.hostname))
    throw new Error('Refusing hosted database for beneficiary move acceptance');
  const account=async()=>{
    const email='move-'+randomUUID()+'@example.invalid';
    const password=randomBytes(32).toString('base64url');
    const response=await fetch(new URL('/auth/v1/signup',api.origin),{
      method:'POST',headers:{apikey:key,'Content-Type':'application/json'},
      body:JSON.stringify({email,password}),
    });
    expect(response.status).toBe(200);
    const result=await response.json(),session=result.session??result;
    expect(session.access_token).toBeTruthy();
    return {id:result.user.id as string,token:session.access_token as string,session,email,password};
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
    await page.getByRole('button',{name:'Filter',exact:true}).click();
    await page.getByRole('button',{name:'Selected list'}).click();
    await page.getByRole('dialog',{name:'Choose beneficiary list'}).getByRole('button',{name:'Family',exact:true}).click();
    const recordRows=()=>page.getByTestId('beneficiary-records').locator('table.taxpay-unified-table tbody tr:visible, ul.taxpay-mobile-table-cards:visible > li');
    const row=recordRows().filter({hasText:'012*********'});
    await expect(row).toContainText('Immutable Beneficiary');
    await row.getByRole('button',{name:'Edit',exact:true}).click();
    let dialog=page.getByRole('dialog',{name:'Edit beneficiary'});
    await expect(dialog.getByText('Immutable Beneficiary')).toBeVisible();
    await expect(dialog.getByText('012*********')).toBeVisible();
    await expect(dialog.locator('#beneficiary-edit-name')).toHaveCount(0);
    await expect(dialog.getByRole('textbox')).toHaveCount(0);
    await dialog.locator('#beneficiary-edit-list').click();
    await expect(dialog.locator('#beneficiary-edit-list-options [role="option"]')).toHaveCount(2);
    await dialog.locator('#beneficiary-edit-list').click();
    await expect(dialog.locator('#beneficiary-edit-list')).toHaveAttribute('data-value',family);
    await expect(dialog.getByRole('button',{name:'Save changes'})).toBeDisabled();
    await chooseBeneficiaryOption(dialog,'beneficiary-edit-tag','friends_family:father');
    await expect(dialog.getByRole('button',{name:'Save changes'})).toBeEnabled();
    await chooseBeneficiaryOption(dialog,'beneficiary-edit-list',clients);
    await dialog.getByRole('button',{name:'Save changes'}).click();
    await expect(page.getByText('Beneficiary details updated.')).toBeVisible();
    await expect(page.getByRole('button',{name:'Selected list'})).toContainText('Clients');
    await expect(page.getByRole('list',{name:'Saved beneficiaries'}).getByText('Immutable Beneficiary')).toBeVisible();
    // Edit the classification WITHOUT a list move; neither name nor TIN may change.
    const movedRow=recordRows().filter({hasText:'012*********'});
    await movedRow.getByRole('button',{name:'Edit',exact:true}).click();
    dialog=page.getByRole('dialog',{name:'Edit beneficiary'});
    await expect(dialog.locator('#beneficiary-edit-tag')).toHaveAttribute('data-value','friends_family:father');
    await expect(dialog.locator('#beneficiary-edit-list')).toHaveAttribute('data-value',clients);
    await chooseBeneficiaryOption(dialog,'beneficiary-edit-tag','others');
    await expect(dialog.getByRole('button',{name:'Save changes'})).toBeDisabled();
    await dialog.locator('#beneficiary-edit-other-label').fill('Neighbour representative');
    await expect(dialog.getByRole('button',{name:'Save changes'})).toBeEnabled();
    await dialog.getByRole('button',{name:'Save changes'}).click();
    // Mobile shows only the leaf tag; the persisted SQL classification remains 'others'.
    await expect(movedRow).toContainText('Immutable Beneficiary · Neighbour representative');
    await expect(movedRow).toContainText('012*********');
    await expect(movedRow).not.toContainText('Others · Neighbour representative');
    await page.reload();
    await page.getByRole('button',{name:'Filter',exact:true}).click();
    await expect(page.getByRole('button',{name:'Selected list'})).toContainText('Clients');
    await expect(page.getByRole('list',{name:'Saved beneficiaries'}).getByText('Immutable Beneficiary')).toBeVisible();

    let read=await request(first.token,'taxpay_beneficiaries?id=eq.'+id+'&select=id,owner_uid,list_id,tin,display_name,tag,relationship,other_label');
    expect(read.body).toEqual([{id,owner_uid:first.id,list_id:clients,tin:'012345678901',
      display_name:'Immutable Beneficiary',tag:'others',relationship:null,other_label:'Neighbour representative'}]);
    const denied=await request(second.token,'taxpay_beneficiaries?id=eq.'+id+'&select=id','PATCH',{list_id:foreign});
    expect(denied.status).toBe(200);
    expect(denied.body).toEqual([]);
    read=await request(first.token,'taxpay_beneficiaries?id=eq.'+id+'&select=list_id');
    expect(read.body).toEqual([{list_id:clients}]);

    // Reauthenticate the same owner into a new session and browser context.
    // Both the exact SQL row and the approved UI must recover the edited classification.
    const passwordGrant=await fetch(new URL('/auth/v1/token?grant_type=password',api.origin),{
      method:'POST',headers:{apikey:key,'Content-Type':'application/json'},
      body:JSON.stringify({email:first.email,password:first.password}),
    });
    expect(passwordGrant.status).toBe(200);
    const fresh=await passwordGrant.json() as {
      access_token:string;refresh_token:string;user:{id:string};
    };
    expect(fresh.user.id).toBe(first.id);
    expect(fresh.access_token).toBeTruthy();
    const freshRead=await request(fresh.access_token,
      'taxpay_beneficiaries?id=eq.'+id+'&select=id,owner_uid,list_id,tin,display_name,tag,relationship,other_label');
    expect(freshRead.status).toBe(200);
    expect(freshRead.body).toEqual([{
      id,owner_uid:first.id,list_id:clients,tin:'012345678901',
      display_name:'Immutable Beneficiary',tag:'others',relationship:null,other_label:'Neighbour representative',
    }]);
    const freshLogin='/\x3faction=beneficiaries#access_token='+encodeURIComponent(fresh.access_token)+
      '&refresh_token='+encodeURIComponent(fresh.refresh_token)+
      '&token_type=bearer&expires_in=3600&expires_at='+(Math.floor(Date.now()/1000)+3600);
    const freshContext=await browser.newContext({baseURL:'http://127.0.0.1:4173',viewport:{width:375,height:812}});
    try{
      const freshPage=await freshContext.newPage();
      await freshPage.goto(freshLogin);
      await expect(freshPage.getByTestId('beneficiaries-page')).toBeVisible({timeout:15000});
      await freshPage.getByRole('button',{name:'Filter',exact:true}).click();
      await freshPage.getByRole('button',{name:'Selected list'}).click();
      await freshPage.getByRole('dialog',{name:'Choose beneficiary list'}).getByRole('button',{name:'Clients',exact:true}).click();
      const freshRows=()=>freshPage.getByTestId('beneficiary-records').locator('table.taxpay-unified-table tbody tr:visible, ul.taxpay-mobile-table-cards:visible > li');
      const freshRow=freshRows().filter({hasText:'012*********'});
      await expect(freshRow).toContainText('Immutable Beneficiary · Neighbour representative');
      await expect(freshRow).toContainText('012*********');
    }finally{await freshContext.close();}

    const collision=await request(first.token,'taxpay_beneficiaries?select=id','POST',{
      owner_uid:first.id,list_id:family,tin:'012345678901',display_name:'Separate Saved Copy',
    });
    expect(collision.status).toBe(201);
    await page.setViewportSize({width:1440,height:900});
    const desktopRow=recordRows().filter({hasText:'012*********'});
    await desktopRow.getByRole('button',{name:'Edit',exact:true}).click();
    dialog=page.getByRole('dialog',{name:'Edit beneficiary'});
    await expect(dialog.locator('#beneficiary-edit-other-label')).toHaveValue('Neighbour representative');
    await chooseBeneficiaryOption(dialog,'beneficiary-edit-list',family);
    await dialog.getByRole('button',{name:'Save changes'}).click();
    await expect(dialog.getByRole('alert')).toContainText('already saved in the destination list');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button',{name:'Cancel'}).click();
    read=await request(first.token,'taxpay_beneficiaries?id=eq.'+id+'&select=list_id,tin,display_name');
    expect(read.body).toEqual([{list_id:clients,tin:'012345678901',display_name:'Immutable Beneficiary'}]);
  }finally{await context.close();}
});
