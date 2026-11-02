import {test,expect} from '@playwright/test';

for(const language of ['en','bn'] as const){
  test(`selected beneficiaries require confirmation before bulk removal (${language})`,async({page})=>{
    const now='2026-11-02T00:00:00Z';
    const listId='00000000-0000-4000-8000-000000000101';
    const lists=[{id:listId,name:'Clients',created_at:now}];
    let records=[
      {id:'00000000-0000-4000-8000-000000000201',list_id:listId,tin:'012345678901',display_name:'Alpha',created_at:now,updated_at:now},
      {id:'00000000-0000-4000-8000-000000000202',list_id:listId,tin:'234567890123',display_name:'Beta',created_at:now,updated_at:now},
    ];
    await page.route('**/auth/v1/user',route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({message:'No session'})}));
    await page.route('**/functions/v1/taxpay-guest-beneficiaries',route=>{
      const body=route.request().postDataJSON() as {action?:string;id?:string;offset?:number;limit?:number};
      let data:unknown=[];
      if(body.action==='open')data={active:true};
      if(body.action==='lists')data=lists;
      if(body.action==='people')data=records.slice(body.offset??0,(body.offset??0)+(body.limit??500));
      if(body.action==='remove'){
        records=records.filter(person=>person.id!==body.id);
        data=true;
      }
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data})});
    });
    await page.goto('/?action=beneficiaries&demoUser=user1&lang='+language);
    const screen=page.getByTestId('beneficiaries-page');
    const directory=screen.getByTestId('beneficiary-records');
    await expect(directory.getByRole('listitem')).toHaveCount(2);
    const bn=language==='bn';
    await screen.getByRole('checkbox',{name:bn?'দেখানো সব উপকারভোগী নির্বাচন':'Select all visible beneficiaries'}).check();
    const bulk=screen.locator('.beneficiary-directory__bulk-actions').getByRole('button',{name:bn?'নির্বাচিতদের সরান':'Remove selected'});
    await expect(bulk).toBeVisible();
    await bulk.click();
    const confirm=page.getByRole('dialog',{name:bn?'একাধিক উপকারভোগী সরানো নিশ্চিত করুন':'Confirm bulk beneficiary removal'});
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText('2');
    await confirm.getByRole('button',{name:bn?'বাতিল':'Cancel'}).click();
    await expect(directory.getByRole('listitem')).toHaveCount(2);
    await bulk.click();
    await confirm.getByRole('button',{name:bn?'নির্বাচিতদের সরান':'Remove selected'}).click();
    await expect(confirm).toHaveCount(0);
    await expect(screen.getByTestId('beneficiary-records')).toHaveCount(0);
    await page.reload();
    await expect(screen.getByTestId('beneficiary-records')).toHaveCount(0);
  });
}
