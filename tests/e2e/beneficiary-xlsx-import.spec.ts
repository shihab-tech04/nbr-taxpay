import {test,expect,type Page} from '@playwright/test';
import {mkdirSync,readFileSync} from 'node:fs';

type MockGuestPerson={id:string;list_id:string;tin:string;display_name:string;created_at:string;updated_at:string};
type MockGuestList={id:string;name:string;created_at:string};
type MockGuestSession={lists:MockGuestList[];people:MockGuestPerson[]};

async function setupGuestTransport(page:Page){
  const sessions=new Map<string,MockGuestSession>();
  let nextId=1;
  let createListCount=0;
  let failNextAdd=false;
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
      createListCount++;
      const list={id:newId(),name:String(body.name),created_at:now};session.lists.push(list);data=list;
    }else if(body.action==='add'){
      if(failNextAdd){
        failNextAdd=false;
        await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,code:'TEMPORARY_FAILURE'})});return;
      }
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
  return {failNextAdd:()=>{failNextAdd=true;},createListCount:()=>createListCount};
}

test('downloaded Beneficiaries Excel template opens in the supported import parser',async({page})=>{
  await setupGuestTransport(page);
  await page.goto('/');
  const result=await page.evaluate(async()=>{
    const mod=await import(('/src/services/beneficiaryExcel.ts' as string)) as {
      beneficiaryTemplate:()=>Blob;
      parseBeneficiaryWorkbook:(file:File)=>Promise<unknown[]>;
    };
    const blob=mod.beneficiaryTemplate();
    const spreadsheet=new File([blob],'Korbritto_Beneficiaries_Template.xlsx',{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const data=await mod.parseBeneficiaryWorkbook(spreadsheet);
    let unsupported='';
    try{await mod.parseBeneficiaryWorkbook(new File(['TIN,User Name'],'bad.csv',{type:'text/csv'}));}
    catch(error){unsupported=String(error);}
    return {headerOnlyRows:data.length,spreadsheetBytes:blob.size,unsupported};
  });
  expect(result.headerOnlyRows).toBe(0);
  expect(result.spreadsheetBytes).toBeGreaterThan(500);
  expect(result.unsupported).toContain('.xlsx');
});

test('signed-out Beneficiaries deep link requires taxpayer sign-in in Bengali and English',async({page})=>{
  await setupGuestTransport(page);
  await page.goto('/?action=beneficiaries&lang=bn');
  await expect(page.getByRole('heading',{name:'করদাতার ব্যক্তিগত তথ্য'})).toBeVisible();
  await expect(page.getByRole('link',{name:'ইমেইলে সাইন ইন'})).toHaveAttribute('href',/returnTo=beneficiaries/);
  await expect(page.getByTestId('beneficiaries-page')).toHaveCount(0);
  await expect(page.locator('.taxpayer-reference-rail')).toHaveCount(0);
  await page.goto('/?action=beneficiaries');
  await expect(page.getByRole('heading',{name:'Private taxpayer workspace'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Sign in with email'})).toHaveAttribute('href',/returnTo=beneficiaries/);
  await expect(page.getByTestId('beneficiaries-page')).toHaveCount(0);
});

test('genuine compressed Excel with text TINs parses both rows without losing leading zeros',async({page})=>{
  await setupGuestTransport(page);
  const workbookBase64=readFileSync('tests/fixtures/beneficiary-two-rows.xlsx.base64','utf8').trim();
  await page.goto('/');
  const rows=await page.evaluate(async(base64)=>{
    const mod=await import(('/src/services/beneficiaryExcel.ts' as string)) as {
      parseBeneficiaryWorkbook:(file:File)=>Promise<{tin:string;name:string;sourceRow:number}[]>;
    };
    const bytes=Uint8Array.from(atob(base64),value=>value.charCodeAt(0));
    return await mod.parseBeneficiaryWorkbook(new File([bytes],'real-two-rows.xlsx'));
  },workbookBase64);
  expect(rows).toEqual([
    {tin:'012345678901',name:'Local Beneficiary One',sourceRow:2},
    {tin:'987654321098',name:'Local Beneficiary Two',sourceRow:3},
  ]);
});

test('failed new-list import stays recoverable and retries against the same created list',async({page})=>{
  const transport=await setupGuestTransport(page);
  await page.goto('/?action=beneficiaries&demoUser=user1');

  await page.getByRole('button',{name:'Create list',exact:true}).click();
  let dialog=page.getByRole('dialog',{name:'Create list'});
  await dialog.locator('#beneficiary-create-list-name').fill('Existing list');
  await dialog.getByRole('button',{name:'Create list',exact:true}).click();

  await page.getByRole('button',{name:'Add beneficiary',exact:true}).click();
  await page.getByRole('dialog',{name:'Choose how to add beneficiaries'}).getByRole('button',{name:'Import from Excel'}).click();
  const workbook=readFileSync('tests/fixtures/beneficiary-two-rows.xlsx.base64','utf8').trim();
  await page.locator('#beneficiary-file').setInputFiles({
    name:'guest-beneficiaries.xlsx',
    mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer:Buffer.from(workbook,'base64'),
  });
  dialog=page.getByRole('dialog',{name:'Beneficiary entry'});
  await dialog.getByRole('button',{name:'Next',exact:true}).click();
  await dialog.getByRole('button',{name:'Next',exact:true}).click();
  await dialog.locator('#beneficiary-target-list').selectOption('new');
  await dialog.locator('#beneficiary-new-list-name').fill('Imported list');

  transport.failNextAdd();
  await dialog.getByRole('button',{name:'Finish import'}).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  const retryTarget=await dialog.locator('#beneficiary-target-list').inputValue();
  expect(retryTarget).not.toBe('new');
  expect(transport.createListCount()).toBe(2);
  await expect(dialog.getByRole('button',{name:'Back'})).toBeEnabled();
  await expect(dialog.getByRole('button',{name:'Finish import'})).toBeEnabled();

  await dialog.getByRole('button',{name:'Finish import'}).click();
  await expect(page.getByText('2 beneficiaries added to the list.')).toBeVisible();
  expect(transport.createListCount()).toBe(2);
  await expect(page.locator('#beneficiary-list')).toContainText('Imported list');
  const visibleRecords=page.locator('[data-testid="beneficiaries-page"] table:visible, [data-testid="beneficiaries-page"] ul[aria-label="Saved beneficiaries"]:visible');
  await expect(visibleRecords.getByText('Local Beneficiary One',{exact:true})).toBeVisible();
  await expect(visibleRecords.getByText('Local Beneficiary Two',{exact:true})).toBeVisible();
});

test('local sample taxpayer Beneficiaries supports independent lists, Excel import, list-only move, removal, recovery and multi-taxpayer prefill',async({page,browser},info)=>{
  await setupGuestTransport(page);
  await page.goto('/?action=beneficiaries&demoUser=user1');
  const recordList=info.project.name==='desktop-1280'
    ?page.locator('table:visible tbody')
    :page.locator('[data-testid="beneficiaries-page"] ul:visible');
  const expectRecord=async(name:string)=>expect(recordList.getByText(name,{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Create your first list'})).toBeVisible();
  await expect(page.getByRole('link',{name:/Sign in/})).toHaveCount(0);

  await page.getByRole('button',{name:'Create list',exact:true}).first().click();
  let dialog=page.getByRole('dialog',{name:'Create list'});
  await dialog.locator('#beneficiary-create-list-name').fill('Guest Family');
  await dialog.getByRole('button',{name:'Create list',exact:true}).click();
  await expect(page.getByText(/Guest Family.*is empty/)).toBeVisible();
  await expect(page.getByRole('button',{name:'Create list',exact:true})).toHaveCount(1);
  // The Beneficiaries header exposes only these two actions on desktop and mobile.
  await expect(page.locator('[data-testid="beneficiaries-page"] > header button')).toHaveCount(2);
  await expect(page.getByRole('button',{name:'Add beneficiary',exact:true})).toHaveCount(1);
  await expect(page.getByRole('button',{name:'Import Excel',exact:true})).toHaveCount(0);

  await page.getByRole('button',{name:'Create list',exact:true}).first().click();
  dialog=page.getByRole('dialog',{name:'Create list'});
  await dialog.locator('#beneficiary-create-list-name').fill('Guest Work');
  await dialog.getByRole('button',{name:'Create list',exact:true}).click();
  await expect(page.getByText(/Guest Work.*is empty/)).toBeVisible();
  await page.locator('#beneficiary-list').click();
  await page.getByRole('dialog',{name:'Choose beneficiary list'}).getByRole('button',{name:'Guest Family',exact:true}).click();

  await page.getByRole('button',{name:'Add beneficiary',exact:true}).click();
  await page.getByRole('dialog',{name:'Choose how to add beneficiaries'}).getByRole('button',{name:'Add one beneficiary'}).click();
  dialog=page.getByRole('dialog',{name:'Beneficiary entry'});
  await dialog.locator('#beneficiary-tin').fill('012345678901');
  await dialog.locator('#beneficiary-name').fill('Synthetic Guest One');
  await dialog.getByRole('button',{name:'Add beneficiary',exact:true}).click();
  await expectRecord('Synthetic Guest One');

  const workbook=readFileSync('tests/fixtures/beneficiary-two-rows.xlsx.base64','utf8').trim();
  await page.getByRole('button',{name:'Add beneficiary',exact:true}).click();
  await page.getByRole('dialog',{name:'Choose how to add beneficiaries'}).getByRole('button',{name:'Import from Excel'}).click();
  await page.locator('#beneficiary-file').setInputFiles({name:'beneficiaries-two-rows.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(workbook,'base64')});
  dialog=page.getByRole('dialog',{name:'Beneficiary entry'});
  await dialog.getByRole('button',{name:'Next',exact:true}).click();
  await expect(dialog.getByText('Already saved in this list.')).toBeVisible();
  await expect(dialog.getByText('1 valid, 1 needing attention')).toBeVisible();
  await dialog.getByRole('button',{name:'Next',exact:true}).click();
  await dialog.getByRole('button',{name:'Finish import'}).click();
  await expectRecord('Local Beneficiary Two');

  const noMatch=page.getByRole('searchbox',{name:'Search this list'});
  await noMatch.fill('no matching name');
  await expect(page.getByText('No matching beneficiaries')).toBeVisible();
  await noMatch.fill('');

  await page.getByRole('checkbox',{name:'Select Synthetic Guest One'}).check();
  await page.getByRole('checkbox',{name:'Select Local Beneficiary Two'}).check();
  await page.getByRole('button',{name:'Pay Tax for Others'}).first().click();
  const payment=page.getByRole('dialog',{name:'Pay Tax'});
  await expect(payment.locator('[data-payment-entry="OTHER_TAX"]')).toHaveAttribute('aria-pressed','true');
  await payment.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(payment.locator('#guest-tin')).toHaveValue('012345678901');
  await expect(payment.locator('#other-tax-primary-name')).toHaveValue('Synthetic Guest One');
  await expect(payment.getByTestId('other-tax-taxpayer').locator('input[id^="other-tax-tin-"]')).toHaveValue('987654321098');
  await payment.getByRole('button',{name:'Close payment services'}).click();

  const isDesktop=await page.locator('table').isVisible();
  const firstRecord=isDesktop?page.getByRole('row').filter({hasText:'012345678901'}):page.locator('ul[aria-label="Saved beneficiaries"] li').filter({hasText:'012345678901'});
  await firstRecord.getByRole('button',{name:'Edit'}).click();
  dialog=page.getByRole('dialog',{name:'Edit beneficiary'});
  await expect(dialog.locator('#beneficiary-edit-name')).toHaveCount(0);
  await expect(dialog.getByText('Synthetic Guest One')).toBeVisible();
  await dialog.locator('#beneficiary-edit-list').selectOption({label:'Guest Work'});
  await dialog.getByRole('button',{name:'Save changes'}).click();
  await expect(page.getByRole('button',{name:'Selected list'})).toContainText('Guest Work');
  await expectRecord('Synthetic Guest One');
  await page.getByRole('button',{name:'Selected list'}).click();
  await page.getByRole('dialog',{name:'Choose beneficiary list'}).getByRole('button',{name:'Guest Family',exact:true}).click();

  const secondRecord=isDesktop?page.getByRole('row').filter({hasText:'987654321098'}):page.locator('ul[aria-label="Saved beneficiaries"] li').filter({hasText:'987654321098'});
  await secondRecord.getByRole('button',{name:isDesktop?'Remove Local Beneficiary Two':'Remove beneficiary'}).click();
  dialog=page.getByRole('dialog',{name:'Confirm beneficiary removal'});
  await dialog.getByRole('button',{name:'Remove',exact:true}).click();
  await expect(page.getByText('Local Beneficiary Two')).toHaveCount(0);

  await page.reload();
  await page.getByRole('button',{name:'Selected list'}).click();
  await page.getByRole('dialog',{name:'Choose beneficiary list'}).getByRole('button',{name:'Guest Work',exact:true}).click();
  await expectRecord('Synthetic Guest One');
  await expect(page.getByText('Local Beneficiary Two')).toHaveCount(0);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow,'Beneficiaries viewport overflow').toBeLessThanOrEqual(2);

  mkdirSync('test-results/screenshots',{recursive:true});
  await page.screenshot({path:`test-results/screenshots/beneficiaries-${info.project.name}-en.png`,fullPage:true});
  await page.goto('/?action=beneficiaries&demoUser=user1&lang=bn');
  await expect(page.getByRole('heading',{name:'উপকারভোগী',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'নির্বাচিত তালিকা'}).click();
  await page.getByRole('dialog',{name:'উপকারভোগীর তালিকা বাছুন'}).getByRole('button',{name:'Guest Work',exact:true}).click();
  await expectRecord('Synthetic Guest One');
  await page.screenshot({path:`test-results/screenshots/beneficiaries-${info.project.name}-bn.png`,fullPage:true});

  const otherContext=await browser.newContext({baseURL:'http://127.0.0.1:4173'});
  try{
    const other=await otherContext.newPage();await setupGuestTransport(other);await other.goto('/?action=beneficiaries&demoUser=user1');
    await expect(other.getByRole('heading',{name:'Create your first list'})).toBeVisible();
    await expect(other.getByText('Synthetic Guest One')).toHaveCount(0);
  }finally{await otherContext.close();}
});

test('signed-out guest payment hides saved beneficiaries even with stored entries in English and Bengali',async({page})=>{
  await setupGuestTransport(page);
  await page.goto('/?action=beneficiaries&demoUser=user1');

  await page.getByRole('button',{name:'Create list',exact:true}).first().click();
  let dialog=page.getByRole('dialog',{name:'Create list'});
  await dialog.locator('#beneficiary-create-list-name').fill('Guest Family');
  await dialog.getByRole('button',{name:'Create list',exact:true}).click();

  await page.getByRole('button',{name:'Add beneficiary',exact:true}).click();
  await page.getByRole('dialog',{name:'Choose how to add beneficiaries'}).getByRole('button',{name:'Add one beneficiary'}).click();
  dialog=page.getByRole('dialog',{name:'Beneficiary entry'});
  await dialog.locator('#beneficiary-tin').fill('012345678901');
  await dialog.locator('#beneficiary-name').fill('Saved Guest Taxpayer');
  await dialog.getByRole('button',{name:'Add beneficiary',exact:true}).click();
  await expect(page.getByText('Beneficiary saved.')).toBeVisible();

  for (const language of ['en', 'bn'] as const) {
    await page.goto(`/?action=guest${language === 'bn' ? '&lang=bn' : ''}`);
    await page.locator('#guest-payer-other').check();
    // Guest storage may contain saved records, but the account-only picker stays absent.
    await expect(page.getByTestId('saved-beneficiary-picker')).toHaveCount(0);
    await expect(page.locator('#guest-tin')).toBeVisible();
    await expect(page.locator('#guest-tin')).not.toHaveAttribute('readonly', '');
  }
});
