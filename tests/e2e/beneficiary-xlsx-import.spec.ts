import {test,expect,type Page} from '@playwright/test';
import {mkdirSync,readFileSync} from 'node:fs';

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
    }else if(body.action==='update'){
      const person=session.people.find(value=>value.id===body.id);
      if(!person){await route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({success:false,code:'NOT_FOUND'})});return;}
      person.display_name=String(body.name);person.updated_at=now;data=person;
    }else if(body.action==='remove'){
      session.people=session.people.filter(person=>person.id!==body.id);data={deleted:true};
    }else data={active:true};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data})});
  });
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

test('signed-out visitors can open Beneficiaries without an email or sample-account gate',async({page})=>{
  await setupGuestTransport(page);
  await page.goto('/?action=beneficiaries&lang=bn');
  await expect(page.getByRole('heading',{name:'উপকারভোগী',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:/তালিকা তৈরি/}).first()).toBeVisible();
  await expect(page.getByRole('button',{name:/উপকারভোগী যোগ/}).first()).toBeVisible();
  await expect(page.getByRole('button',{name:/এক্সেল আমদানি/}).first()).toBeVisible();
  await expect(page.getByRole('button',{name:/Pay Tax for Others/})).toHaveCount(0);
  await expect(page.getByRole('link',{name:/সাইন ইন/})).toHaveCount(0);
  await expect(page.getByRole('button',{name:/Use User ID/})).toHaveCount(0);
  await expect(page).toHaveURL(/action=beneficiaries/);
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

test('guest Beneficiaries supports independent lists, Excel import, responsive CRUD, recovery and multi-taxpayer prefill',async({page,browser},info)=>{
  await setupGuestTransport(page);
  await page.goto('/?action=beneficiaries');
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

  await page.getByRole('button',{name:'Create list',exact:true}).first().click();
  dialog=page.getByRole('dialog',{name:'Create list'});
  await dialog.locator('#beneficiary-create-list-name').fill('Guest Work');
  await dialog.getByRole('button',{name:'Create list',exact:true}).click();
  await expect(page.getByText(/Guest Work.*is empty/)).toBeVisible();
  await page.locator('#beneficiary-list').selectOption({label:'Guest Family'});

  await page.getByRole('button',{name:'Add beneficiary',exact:true}).first().click();
  dialog=page.getByRole('dialog',{name:'Beneficiary entry'});
  await dialog.locator('#beneficiary-tin').fill('012345678901');
  await dialog.locator('#beneficiary-name').fill('Synthetic Guest One');
  await dialog.getByRole('button',{name:'Add beneficiary',exact:true}).click();
  await expectRecord('Synthetic Guest One');

  const workbook=readFileSync('tests/fixtures/beneficiary-two-rows.xlsx.base64','utf8').trim();
  await page.getByRole('button',{name:'Import Excel',exact:true}).first().click();
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
  await payment.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(payment.locator('[data-payment-entry="OTHER_TAX"]')).toHaveAttribute('aria-pressed','true');
  await payment.getByRole('button',{name:'Continue',exact:true}).click();
  await payment.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(payment.locator('#guest-tin')).toHaveValue('012345678901');
  await expect(payment.locator('#other-tax-primary-name')).toHaveValue('Synthetic Guest One');
  await expect(payment.getByTestId('other-tax-taxpayer').locator('input[id^="other-tax-tin-"]')).toHaveValue('987654321098');
  await payment.getByRole('button',{name:'Close payment services'}).click();

  const isDesktop=await page.locator('table').isVisible();
  const firstRecord=isDesktop?page.getByRole('row').filter({hasText:'012345678901'}):page.locator('ul[aria-label="Saved beneficiaries"] li').filter({hasText:'012345678901'});
  await firstRecord.getByRole('button',{name:'Edit'}).click();
  dialog=page.getByRole('dialog',{name:'Edit beneficiary'});
  await dialog.locator('#beneficiary-edit-name').fill('Synthetic Guest Renamed');
  await dialog.getByRole('button',{name:'Save changes'}).click();
  await expectRecord('Synthetic Guest Renamed');

  const secondRecord=isDesktop?page.getByRole('row').filter({hasText:'987654321098'}):page.locator('ul[aria-label="Saved beneficiaries"] li').filter({hasText:'987654321098'});
  await secondRecord.getByRole('button',{name:isDesktop?'Remove Local Beneficiary Two':'Remove beneficiary'}).click();
  dialog=page.getByRole('dialog',{name:'Confirm beneficiary removal'});
  await dialog.getByRole('button',{name:'Remove',exact:true}).click();
  await expect(page.getByText('Local Beneficiary Two')).toHaveCount(0);

  await page.reload();
  await expectRecord('Synthetic Guest Renamed');
  await expect(page.getByText('Local Beneficiary Two')).toHaveCount(0);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow,'Beneficiaries viewport overflow').toBeLessThanOrEqual(2);

  mkdirSync('test-results/screenshots',{recursive:true});
  await page.screenshot({path:`test-results/screenshots/beneficiaries-${info.project.name}-en.png`,fullPage:true});
  await page.goto('/?action=beneficiaries&lang=bn');
  await expect(page.getByRole('heading',{name:'উপকারভোগী',exact:true})).toBeVisible();
  await expectRecord('Synthetic Guest Renamed');
  await page.screenshot({path:`test-results/screenshots/beneficiaries-${info.project.name}-bn.png`,fullPage:true});

  const otherContext=await browser.newContext({baseURL:'http://127.0.0.1:4173'});
  try{
    const other=await otherContext.newPage();await setupGuestTransport(other);await other.goto('/?action=beneficiaries');
    await expect(other.getByRole('heading',{name:'Create your first list'})).toBeVisible();
    await expect(other.getByText('Synthetic Guest Renamed')).toHaveCount(0);
  }finally{await otherContext.close();}
});

test('saved-beneficiary picker uses shared TaxPay controls in the standalone guest route in English and Bengali',async({page})=>{
  await setupGuestTransport(page);
  await page.goto('/?action=beneficiaries');

  await page.getByRole('button',{name:'Create list',exact:true}).first().click();
  let dialog=page.getByRole('dialog',{name:'Create list'});
  await dialog.locator('#beneficiary-create-list-name').fill('Guest Family');
  await dialog.getByRole('button',{name:'Create list',exact:true}).click();

  await page.getByRole('button',{name:'Add beneficiary',exact:true}).first().click();
  dialog=page.getByRole('dialog',{name:'Beneficiary entry'});
  await dialog.locator('#beneficiary-tin').fill('012345678901');
  await dialog.locator('#beneficiary-name').fill('Saved Guest Taxpayer');
  await dialog.getByRole('button',{name:'Add beneficiary',exact:true}).click();
  await expect(page.getByText('Beneficiary saved.')).toBeVisible();

  const verifyPicker=async(language:'en'|'bn')=>{
    await page.goto(`/?action=guest${language==='bn'?'&lang=bn':''}`);
    await page.locator('#guest-payer-other').check();
    const picker=page.getByTestId('saved-beneficiary-picker');
    await expect(picker).toContainText('Saved Guest Taxpayer');
    await expect(picker).toContainText(language==='bn'?'সংরক্ষিত উপকারভোগী':'Saved beneficiaries');
    const useButton=picker.getByRole('button',{name:language==='bn'?'নির্বাচিত উপকারভোগী ব্যবহার':'Use selected beneficiary'});
    await expect(useButton).toBeDisabled();
    await expect(useButton).toHaveClass(/bg-taxpay-surface/);
    await expect(useButton).toHaveCSS('min-height','44px');
    await expect(useButton).toHaveCSS('border-top-width','1px');
    await expect(useButton).toHaveCSS('border-top-style','solid');
    await expect(useButton).toHaveCSS('background-color','rgb(255, 255, 255)');
    await expect(useButton).toHaveCSS('color','rgb(44, 94, 173)');
    await picker.locator('label').filter({hasText:'Saved Guest Taxpayer'}).locator('input').check();
    await expect(useButton).toBeEnabled();
    await useButton.click();
    await expect(page.locator('#guest-tin')).toHaveValue('012345678901');
    await expect(page.locator('#other-tax-primary-name')).toHaveValue('Saved Guest Taxpayer');
  };

  await verifyPicker('en');
  await verifyPicker('bn');
});
