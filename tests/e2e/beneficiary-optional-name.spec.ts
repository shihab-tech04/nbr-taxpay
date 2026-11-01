import {test,expect,type Page} from '@playwright/test';
import {BENEFICIARY_NAME_NOT_PROVIDED} from '../../src/services/beneficiaryNames';
import {setWorkspaceLanguage} from './workspace-language';

type MockGuestPerson={id:string;list_id:string;tin:string;display_name:string;created_at:string;updated_at:string};
type MockGuestList={id:string;name:string;created_at:string};
type MockGuestSession={lists:MockGuestList[];people:MockGuestPerson[]};

async function setupGuestTransport(page:Page){
  const sessions=new Map<string,MockGuestSession>();
  let nextId=1;
  const newId=()=>`00000000-0000-4000-8000-${String(nextId++).padStart(12,'0')}`;
  await page.route('**/auth/v1/user',route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({message:'No session'})}));
  await page.route('**/functions/v1/taxpay-guest-beneficiaries',async route=>{
    const request=route.request();
    const capability=request.headers()['x-taxpay-guest-capability']??'';
    const body=request.postDataJSON() as Record<string,any>;
    if(body.action==='open'){
      sessions.set(capability,sessions.get(capability)??{lists:[],people:[]});
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data:{active:true}})});return;
    }
    const session=sessions.get(capability);
    if(!session){await route.fulfill({status:410,contentType:'application/json',body:JSON.stringify({success:false,code:'GUEST_SESSION_UNAVAILABLE'})});return;}
    const now=new Date().toISOString();
    let data:unknown;
    if(body.action==='lists')data=session.lists;
    else if(body.action==='people')data=session.people.slice(Number(body.offset)||0,(Number(body.offset)||0)+(Number(body.limit)||500));
    else if(body.action==='create-list'){
      const list={id:newId(),name:String(body.name),created_at:now};session.lists.push(list);data=list;
    }else if(body.action==='add'){
      let inserted=0;
      for(const row of body.rows as Array<{tin:string;display_name:string}>){
        if(session.people.some(person=>person.list_id===body.listId&&person.tin===row.tin))continue;
        session.people.push({id:newId(),list_id:String(body.listId),tin:row.tin,display_name:row.display_name,created_at:now,updated_at:now});inserted++;
      }
      data=inserted;
    }else if(body.action==='move'){
      const person=session.people.find(value=>value.id===body.id&&value.list_id===body.sourceListId);
      const destination=session.lists.find(list=>list.id===body.listId);
      if(!person||!destination){await route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({success:false,code:'NOT_FOUND'})});return;}
      if(session.people.some(value=>value.list_id===destination.id&&value.tin===person.tin)){
        await route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({success:false,code:'BENEFICIARY_ALREADY_IN_LIST'})});return;
      }
      person.list_id=destination.id;person.updated_at=now;data=person;
    }else if(body.action==='update'){
      const person=session.people.find(value=>value.id===body.id);
      if(!person){await route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({success:false,code:'NOT_FOUND'})});return;}
      person.display_name=String(body.name);person.updated_at=now;data=person;
    }else if(body.action==='remove'){
      session.people=session.people.filter(person=>person.id!==body.id);data={deleted:true};
    }else data={active:true};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data})});
  });
  return {saved:()=>Array.from(sessions.values()).flatMap(session=>session.people)};
}

test('local sample taxpayer preserves names when moving beneficiaries across lists, importing and prefilling',async({page})=>{
  const transport=await setupGuestTransport(page);
  await page.goto('/?action=beneficiaries&demoUser=user1');

  await page.getByRole('button',{name:'Create list',exact:true}).click();
  let dialog=page.getByRole('dialog',{name:'Create list'});
  await dialog.locator('#beneficiary-create-list-name').fill('Optional names');
  await dialog.getByRole('button',{name:'Create list',exact:true}).click();
  await page.getByRole('button',{name:'Create list',exact:true}).click();
  dialog=page.getByRole('dialog',{name:'Create list'});
  await dialog.locator('#beneficiary-create-list-name').fill('Clients');
  await dialog.getByRole('button',{name:'Create list',exact:true}).click();
  await page.getByRole('button',{name:'Selected list'}).click();
  await page.getByRole('dialog',{name:'Choose beneficiary list'}).getByRole('button',{name:'Optional names',exact:true}).click();

  await page.getByRole('button',{name:'Add beneficiary',exact:true}).click();
  await page.getByRole('dialog',{name:'Choose how to add beneficiaries'}).getByRole('button',{name:'Add one beneficiary'}).click();
  dialog=page.getByRole('dialog',{name:'Beneficiary entry'});
  await dialog.locator('#beneficiary-tin').fill('012345678901');
  await expect(dialog.locator('#beneficiary-name')).not.toHaveAttribute('required','');
  await dialog.getByRole('button',{name:'Add beneficiary',exact:true}).click();
  const visibleRecords=page.getByTestId('beneficiary-records').locator('ul');
  await expect(visibleRecords.getByText('Name not provided',{exact:true})).toHaveCount(1);
  expect(transport.saved().find(person=>person.tin==='012345678901')?.display_name).toBe(BENEFICIARY_NAME_NOT_PROVIDED);

  await page.getByRole('button',{name:'Add beneficiary',exact:true}).click();
  await page.getByRole('dialog',{name:'Choose how to add beneficiaries'}).getByRole('button',{name:'Add one beneficiary'}).click();
  dialog=page.getByRole('dialog',{name:'Beneficiary entry'});
  await dialog.locator('#beneficiary-tin').fill('987654321098');
  await dialog.locator('#beneficiary-name').fill('Editable Contact');
  await dialog.getByRole('button',{name:'Add beneficiary',exact:true}).click();
  const secondRecord=visibleRecords.getByRole('listitem').filter({hasText:'987654321098'});
  await secondRecord.getByRole('button',{name:'Edit',exact:true}).click();
  dialog=page.getByRole('dialog',{name:'Edit beneficiary'});
  await expect(dialog.locator('#beneficiary-edit-name')).toHaveCount(0);
  await expect(dialog.getByText('Editable Contact')).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Save changes'})).toBeDisabled();
  await dialog.locator('#beneficiary-edit-list').selectOption({label:'Clients'});
  await dialog.getByRole('button',{name:'Save changes'}).click();
  await expect(page.getByText('Beneficiary moved to the selected list.')).toBeVisible();
  await expect(page.getByRole('button',{name:'Selected list'})).toContainText('Clients');
  await expect(visibleRecords.getByText('Editable Contact',{exact:true})).toBeVisible();
  expect(transport.saved().find(person=>person.tin==='987654321098')?.display_name).toBe('Editable Contact');
  await page.reload();
  await page.getByRole('button',{name:'Selected list'}).click();
  await page.getByRole('dialog',{name:'Choose beneficiary list'}).getByRole('button',{name:'Optional names',exact:true}).click();

  await page.getByRole('button',{name:'Add beneficiary',exact:true}).click();
  await page.getByRole('dialog',{name:'Choose how to add beneficiaries'}).getByRole('button',{name:'Import from Excel'}).click();
  await page.locator('#beneficiary-file').setInputFiles('tests/fixtures/beneficiary-no-name.xlsx');
  dialog=page.getByRole('dialog',{name:'Beneficiary entry'});
  await dialog.getByRole('button',{name:'Next',exact:true}).click();
  await expect(dialog.getByText('1 valid, 0 needing attention')).toBeVisible();
  await dialog.getByRole('button',{name:'Next',exact:true}).click();
  await dialog.getByRole('button',{name:'Finish import',exact:true}).click();
  await expect(visibleRecords.getByText('Name not provided',{exact:true})).toHaveCount(2);
  expect(transport.saved().find(person=>person.tin==='123456789012')?.display_name).toBe(BENEFICIARY_NAME_NOT_PROVIDED);

  const intendedRecord=visibleRecords.getByRole('listitem').filter({hasText:'012345678901'});
  await intendedRecord.getByRole('checkbox',{name:'Select Name not provided',exact:true}).check();
  await intendedRecord.getByRole('button',{name:'Pay Tax for Others',exact:true}).click();
  const payment=page.getByRole('dialog',{name:'Pay Tax'});
  await expect(payment.locator('[data-payer-relationship="OTHER"]')).toHaveAttribute('aria-pressed','true');
  await expect(payment.locator('[data-payment-entry="OTHER_TAX"]')).toHaveAttribute('aria-pressed','true');
  await payment.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(payment.locator('#other-tax-primary-name')).toHaveValue('');
  await expect(payment.locator('#guest-tin')).toHaveValue('012345678901');
});

test('Bengali Beneficiaries labels the optional-name fallback in Bengali',async({page})=>{
  const transport=await setupGuestTransport(page);
  await page.goto('/?action=beneficiaries&demoUser=user1&lang=bn');
  await page.getByRole('button',{name:'তালিকা তৈরি',exact:true}).click();
  let dialog=page.getByRole('dialog',{name:'তালিকা তৈরি'});
  await dialog.locator('#beneficiary-create-list-name').fill('নাম ঐচ্ছিক');
  await dialog.getByRole('button',{name:'তালিকা তৈরি',exact:true}).click();
  await page.getByRole('button',{name:'উপকারভোগী যোগ',exact:true}).click();
  await page.getByRole('dialog',{name:'কীভাবে উপকারভোগী যোগ করবেন'}).getByRole('button',{name:'একজন উপকারভোগী যোগ'}).click();
  dialog=page.getByRole('dialog',{name:'উপকারভোগী যোগ'});
  await dialog.locator('#beneficiary-tin').fill('123450987654');
  await dialog.getByRole('button',{name:'উপকারভোগী যোগ',exact:true}).click();
  const visibleRecords=page.getByTestId('beneficiary-records').locator('ul');
  await expect(visibleRecords.getByText('নাম দেওয়া হয়নি',{exact:true})).toHaveCount(1);
  expect(transport.saved().find(person=>person.tin==='123450987654')?.display_name).toBe(BENEFICIARY_NAME_NOT_PROVIDED);
});


test('Excel import success notice updates immediately when the user changes language',async({page})=>{
  await setupGuestTransport(page);
  await page.goto('/?action=beneficiaries&demoUser=user1');

  await page.getByRole('button',{name:'Create list',exact:true}).click();
  let dialog=page.getByRole('dialog',{name:'Create list'});
  await dialog.locator('#beneficiary-create-list-name').fill('Notice localization');
  await dialog.getByRole('button',{name:'Create list',exact:true}).click();

  await page.getByRole('button',{name:'Add beneficiary',exact:true}).click();
  await page.getByRole('dialog',{name:'Choose how to add beneficiaries'}).getByRole('button',{name:'Import from Excel'}).click();
  await page.locator('#beneficiary-file').setInputFiles('tests/fixtures/beneficiary-no-name.xlsx');
  dialog=page.getByRole('dialog',{name:'Beneficiary entry'});
  await dialog.getByRole('button',{name:'Next',exact:true}).click();
  await dialog.getByRole('button',{name:'Next',exact:true}).click();
  await dialog.getByRole('button',{name:'Finish import',exact:true}).click();

  const notice=page.locator('[data-testid="beneficiaries-page"] > p[role="status"]');
  await expect(notice).toHaveText('1 beneficiaries added to the list.');

  await setWorkspaceLanguage(page,'bn');
  await expect(notice).toHaveText('1 জন উপকারভোগী তালিকায় যুক্ত হয়েছেন।');
  await expect(page.getByText('1 beneficiaries added to the list.',{exact:true})).toHaveCount(0);

  await setWorkspaceLanguage(page,'en');
  await expect(notice).toHaveText('1 beneficiaries added to the list.');
});
