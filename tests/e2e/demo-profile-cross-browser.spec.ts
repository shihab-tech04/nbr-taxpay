import {expect,test,type BrowserContext,type Page} from '@playwright/test';

/** Cross-browser regression for PUBLIC fictional user1-user10. All network calls
 * are intercepted; never touches a hosted account or external taxpayer records.
 */
test('same demo user restores its SQL-scoped beneficiaries, selected list, language and payment session across browsers; other user remains separate',async({browser})=>{
  test.setTimeout(90_000);
  const base='http://127.0.0.1:4173';
  const now='2026-11-05T09:00:00Z';
  const uuid=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
  type Person={id:string;list_id:string;tin:string;display_name:string;tag:string;relationship:null;other_label:null;created_at:string;updated_at:string};
  type List={id:string;name:string;created_at:string};
  const records=new Map<string,{capability:string;paymentSessionId:string;language:'en'|'bn';selectedListId:string|null;lists:List[];people:Person[]}>();
  for(let n=1;n<=2;n++){
    const list={id:uuid(n*100+1),name:n===1?'Family':'Other account',created_at:now};
    const extra={id:uuid(n*100+2),name:'Clients',created_at:now};
    records.set('user'+n,{
      capability:(n===1?'A':'B').repeat(43),paymentSessionId:uuid(n*10000),
      language:'en',selectedListId:list.id,
      lists:n===1?[list,extra]:[list],
      people:[{id:uuid(n*100+10),list_id:list.id,tin:String(n).repeat(12),
        display_name:n===1?'Sajid Khan':'Different profile',tag:'clients',
        relationship:null,other_label:null,created_at:now,updated_at:now}],
    });
  }
  let nextList=1000;
  async function setup(context:BrowserContext){
    await context.route('**/auth/v1/user',route=>route.fulfill({
      status:401,contentType:'application/json',body:'{"message":"No verified Auth session"}'
    }));
    await context.route('**/functions/v1/taxpay-guest-beneficiaries',async route=>{
      const body=route.request().postDataJSON() as Record<string,unknown>;
      const action=String(body.action);
      let id:string|undefined;
      if(action==='demo-login'){
        const named=String(body.userId);
        if(body.password!==named||!records.has(named))
          return route.fulfill({status:401,contentType:'application/json',body:'{"success":false,"code":"INVALID_DEMO_LOGIN"}'});
        id=named;
      }else{
        const cap=route.request().headers()['x-taxpay-guest-capability'];
        id=[...records].find(([,value])=>value.capability===cap)?.[0];
      }
      if(!id)throw Error('Unexpected missing profile capability for '+action);
      const profile=records.get(id)!;
      let data:unknown=null;
      if(action==='demo-login')data={profileId:id,...profile};
      else if(action==='demo-settings'){
        if(body.key==='language'&&['en','bn'].includes(String(body.value)))
          profile.language=body.value as 'en'|'bn';
        if(body.key==='selected-list'&&profile.lists.some(list=>list.id===body.value))
          profile.selectedListId=body.value as string;
        data={language:profile.language,selectedListId:profile.selectedListId,paymentSessionId:profile.paymentSessionId};
      }else if(action==='lists')data=profile.lists;
      else if(action==='people')data=profile.people.slice(Number(body.offset??0),Number(body.offset??0)+Number(body.limit??500));
      else if(action==='create-list'){
        const list={id:uuid(nextList++),name:String(body.name),created_at:now};
        profile.lists.push(list);
        data=list;
      }else if(action==='open')data={active:true};
      else throw Error('Unexpected action '+action);
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data})});
    });
  }
  async function login(page:Page,id:'user1'|'user2'){
    await page.goto('/?action=taxpayer_login');
    await page.getByRole('textbox',{name:'User ID'}).fill(id);
    await page.getByLabel('Password',{exact:true}).fill(id);
    await page.getByRole('button',{name:'Sign In',exact:true}).click();
    await expect(page).toHaveURL(/action=taxpayer_home/);
    await page.goto('/?action=beneficiaries');
    await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
  }
  const first=await browser.newContext({baseURL:base});
  const second=await browser.newContext({baseURL:base});
  const third=await browser.newContext({baseURL:base});
  try{
    await Promise.all([setup(first),setup(second),setup(third)]);
    const a=await first.newPage();
    await login(a,'user1');
    await expect(a.locator('#beneficiary-list')).toContainText('Family');
    await expect(a.getByTestId('beneficiary-records')).toContainText('Sajid Khan');
    await a.locator('#beneficiary-list').click();
    await a.locator('#beneficiary-list-menu').getByRole('button',{name:'Clients',exact:true}).click();
    await expect.poll(()=>records.get('user1')!.selectedListId).toBe(uuid(102));
    await a.locator('button.citizen-language.citizen-desktop-control').click();
    await expect.poll(()=>records.get('user1')!.language).toBe('bn');
    const b=await second.newPage();
    await login(b,'user1');
    await expect(b.locator('.taxpay-citizen-shell')).toHaveAttribute('lang','bn');
    await expect(b.locator('#beneficiary-list')).toContainText('Clients');
    expect((await a.evaluate(()=>JSON.parse(sessionStorage.getItem('korbritto.demo-profile-session.v1')!))).paymentSessionId)
      .toBe((await b.evaluate(()=>JSON.parse(sessionStorage.getItem('korbritto.demo-profile-session.v1')!))).paymentSessionId);
    const c=await third.newPage();
    await login(c,'user2');
    await expect(c.locator('#beneficiary-list')).toContainText('Other account');
    await expect(c.getByTestId('beneficiary-records')).toContainText('Different profile');
    await expect(c.getByTestId('beneficiary-records')).not.toContainText('Sajid Khan');
    await expect(c.locator('.taxpay-citizen-shell')).toHaveAttribute('lang','en');
    // A write from the first browser must be reloaded by the second.
    await a.getByRole('button',{name:'তালিকা তৈরি',exact:true}).first().click();
    const modal=a.getByRole('dialog',{name:'তালিকা তৈরি'});
    await modal.locator('#beneficiary-create-list-name').fill('Office Clients');
    await modal.getByRole('button',{name:'তালিকা তৈরি',exact:true}).click();
    await expect(modal).toBeHidden();
    await b.reload();
    await b.locator('#beneficiary-list').click();
    await expect(b.locator('#beneficiary-list-menu')).toContainText('Office Clients');
  }finally{
    await Promise.all([first.close(),second.close(),third.close()]);
  }
});
