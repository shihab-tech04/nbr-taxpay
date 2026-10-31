import { expect, test } from '@playwright/test';
import {randomBytes, randomUUID} from 'node:crypto';

/** Disposable local Supabase only: validates owner-scoped list rename/delete end-to-end. */
test('beneficiary list custom dropdown, owner-scoped rename, delete and reload', async ({browser})=>{
  test.setTimeout(120_000);
  const raw=process.env.TAXPAY_LOCAL_SUPABASE_URL, key=process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
  if(!raw||!key)throw new Error('BLOCKED: disposable local Supabase credentials required');
  const api=new URL(raw);
  if(api.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(api.hostname))
    throw new Error('Refusing hosted database for list-management acceptance');
  const account=async()=>{
    const email=`list-management-${randomUUID()}@example.invalid`;
    const response=await fetch(new URL('/auth/v1/signup',api.origin),{
      method:'POST',headers:{apikey:key,'Content-Type':'application/json'},
      body:JSON.stringify({email,password:randomBytes(32).toString('base64url')}),
    });
    expect(response.status).toBe(200);
    const result=await response.json();
    return {id:result.user.id as string,token:result.session.access_token as string,session:result.session};
  };
  const first=await account(),second=await account();
  const loginUrl=(session:{access_token:string;refresh_token:string;expires_at?:number})=>
    '/?action=beneficiaries#access_token='+encodeURIComponent(session.access_token)+
    '&refresh_token='+encodeURIComponent(session.refresh_token)+'&token_type=bearer&expires_in=3600&expires_at='+
    (session.expires_at??Math.floor(Date.now()/1000)+3600);
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4173',viewport:{width:320,height:720}});
  try{
    const page=await context.newPage();
    await page.goto(loginUrl(first.session));
    await expect(page.getByTestId('beneficiaries-page')).toBeVisible({timeout:15000});
    await page.getByRole('button',{name:'Create list',exact:true}).click();
    const create=page.getByRole('dialog',{name:'Create list'});
    await create.locator('#beneficiary-create-list-name').fill('Family');
    await create.getByRole('button',{name:'Create list',exact:true}).click();
    await expect(page.getByRole('button',{name:'Selected list'})).toContainText('Family');

    await page.getByRole('button',{name:'Selected list'}).click();
    const chooser=page.getByRole('dialog',{name:'Choose beneficiary list'});
    await expect(chooser.getByRole('button',{name:'Edit Family'})).toBeVisible();
    await chooser.getByRole('button',{name:'Edit Family'}).click();
    const editor=page.getByRole('dialog',{name:'Edit beneficiary list'});
    await expect(editor.locator('#beneficiary-edit-list-name')).toHaveValue('Family');
    await expect(editor.getByRole('button',{name:'Delete list'})).toBeVisible();
    await editor.locator('#beneficiary-edit-list-name').fill('Family & Friends');
    await editor.getByRole('button',{name:'Save changes'}).click();
    await expect(page.getByRole('button',{name:'Selected list'})).toContainText('Family & Friends');
    await page.reload();
    await expect(page.getByRole('button',{name:'Selected list'})).toContainText('Family & Friends');

    const listsResponse=await fetch(new URL('/rest/v1/taxpay_beneficiary_lists?select=id,name',api.origin),{
      headers:{apikey:key,Authorization:'Bearer '+first.token},
    });
    const lists=await listsResponse.json() as {id:string;name:string}[];
    const selected=lists.find(list=>list.name==='Family & Friends');
    expect(selected).toBeTruthy();
    const unauthorizedRename=await fetch(new URL(`/rest/v1/taxpay_beneficiary_lists?id=eq.${selected!.id}`,api.origin),{
      method:'PATCH',headers:{apikey:key,Authorization:'Bearer '+second.token,'Content-Type':'application/json',Prefer:'return=representation'},
      body:JSON.stringify({name:'Stolen'}),
    });
    expect(unauthorizedRename.status).toBe(200);
    expect(await unauthorizedRename.json()).toEqual([]);
    const unauthorizedDelete=await fetch(new URL(`/rest/v1/taxpay_beneficiary_lists?id=eq.${selected!.id}`,api.origin),{
      method:'DELETE',headers:{apikey:key,Authorization:'Bearer '+second.token,Prefer:'return=representation'},
    });
    expect(unauthorizedDelete.status).toBe(200);
    expect(await unauthorizedDelete.json()).toEqual([]);

    await page.getByRole('button',{name:'Selected list'}).click();
    await page.getByRole('dialog',{name:'Choose beneficiary list'}).getByRole('button',{name:'Edit Family & Friends'}).click();
    const editAgain=page.getByRole('dialog',{name:'Edit beneficiary list'});
    await editAgain.getByRole('button',{name:'Delete list'}).click();
    const confirm=page.getByRole('dialog',{name:'Confirm list deletion'});
    await expect(confirm).toContainText('cannot be undone');
    await confirm.getByRole('button',{name:'Cancel'}).click();
    await expect(page.getByRole('dialog',{name:'Edit beneficiary list'})).toBeVisible();
    await page.getByRole('dialog',{name:'Edit beneficiary list'}).getByRole('button',{name:'Delete list'}).click();
    await page.getByRole('dialog',{name:'Confirm list deletion'}).getByRole('button',{name:'Delete list'}).click();
    await expect(page.getByRole('button',{name:'Selected list'})).toHaveCount(0);
    await page.reload();
    await expect(page.getByText('Create your first list')).toBeVisible();
  }finally{await context.close();}
});
