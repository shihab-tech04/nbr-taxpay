import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';


test('downloaded Beneficiaries Excel template opens in the supported import parser',async({page})=>{
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

test('signed-out Beneficiaries action leads to existing real email authentication instead of preview login',async({page})=>{
  await page.goto('/?action=beneficiaries&lang=bn');
  await expect(page.getByRole('heading',{name:'উপকারভোগী'})).toBeVisible();
  await page.getByRole('link',{name:'ইমেইলে সাইন ইন'}).click();
  await expect(page).toHaveURL(/action=secure_workspace/);
  await expect(page).toHaveURL(/returnTo=beneficiaries/);
  await expect(page).toHaveURL(/lang=bn/);
  await expect(page.getByRole('dialog',{name:/Sign In To Your Korbritto Account/})).toHaveCount(0);
});

test('genuine compressed Excel with text TINs parses both rows without losing leading zeros',async({page})=>{
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
