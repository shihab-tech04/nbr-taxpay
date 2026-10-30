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

test('signed-out visitors can open Beneficiaries without an email or sample-account gate',async({page})=>{
  await page.goto('/?action=beneficiaries&lang=bn');
  await expect(page.getByRole('heading',{name:'উপকারভোগী'})).toBeVisible();
  await expect(page.getByRole('button',{name:/একজন যোগ করুন/})).toBeVisible();
  await expect(page.getByRole('button',{name:/একাধিক যোগ করুন/})).toBeVisible();
  await expect(page.getByRole('button',{name:/Pay Tax for Others/})).toHaveCount(0);
  await expect(page.getByRole('link',{name:/সাইন ইন/})).toHaveCount(0);
  await expect(page.getByRole('button',{name:/Use User ID/})).toHaveCount(0);
  await expect(page).toHaveURL(/action=beneficiaries/);
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
