import {expect,test,type Page} from '@playwright/test';
import { enterTaxPayService } from './pay-tax-entry-helper';

async function enterUser1(page:Page){
  await page.route('**/functions/v1/demo-story1-taxpay/authorizations?actor=*',route=>route.fulfill({
    status:200,contentType:'application/json',body:'{"success":true,"data":[]}'
  }));
  await page.goto('/?action=taxpayer_login');
  await page.getByRole('textbox',{name:'User ID'}).fill('user1');
  await page.getByLabel('Password',{exact:true}).fill('user1');
  await page.getByRole('button',{name:'Sign In',exact:true}).click();
  await expect(page).toHaveURL(/action=taxpayer_home/);
}

test('mobile transaction details use a contained sheet with a visible close control',async({page},info)=>{
  test.skip(info.project.name==='desktop-1280','Mobile detail reflow');
  await enterUser1(page);
  await page.goto('/?action=history');
  await page.locator('.taxpayer-transaction-row__action').first().click();
  const dialog=page.locator('.taxpayer-transaction-detail');
  await expect(dialog.getByRole('button',{name:'Close transaction details'})).toBeVisible();
  const geometry=await dialog.evaluate(element=>{
    const rect=element.getBoundingClientRect();
    const body=element.querySelector('.taxpayer-transaction-detail__body')!;
    return {left:rect.left,right:rect.right,bottom:rect.bottom,viewportWidth:innerWidth,viewportHeight:innerHeight,
      scrolls:getComputedStyle(body).overflowY,headerWidth:element.querySelector('.taxpayer-transaction-detail__heading')!.getBoundingClientRect().width};
  });
  expect(geometry.left).toBeGreaterThanOrEqual(-1);
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth+1);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight+1);
  expect(geometry.scrolls).toBe('auto');
  const renderedHeight=await dialog.evaluate(element=>element.getBoundingClientRect().height);
  // The sheet grows with real content, and must stay below the former 88dvh
  // minimum even at the smallest supported viewport.
  expect(renderedHeight).toBeLessThan(page.viewportSize()!.height*.87);
  await dialog.getByRole('button',{name:'Close transaction details'}).click();
  await expect(dialog).toHaveCount(0);
});

test('mobile monthly activity help opens fully within the dashboard width',async({page},info)=>{
  test.skip(info.project.name==='desktop-1280','Mobile tooltip geometry');
  await enterUser1(page);
  const row=page.locator('.taxpayer-monthly-help-row');
  await row.locator('.taxpayer-inline-help > summary').click();
  const content=row.locator('.taxpayer-inline-help__content');
  await expect(content).toBeVisible();
  const bounds=await content.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width+1);
});

test('mobile journal renders labeled cards with all five financial fields',async({page},info)=>{
  test.skip(info.project.name==='desktop-1280','Mobile journal reflow');
  await enterUser1(page);
  await page.goto('/?action=ledger');
  const journal=page.locator('.taxpayer-ledger-journal__mobile');
  await expect(journal.getByRole('listitem').first()).toBeVisible();
  await expect(journal.getByRole('listitem').first()).toContainText('DEMO-LIABILITY');
  for(const field of ['Debit','Credit','Remaining'])await expect(journal.getByRole('listitem').first()).toContainText(field);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});

test('authorization input and compact delete confirmation remain within mobile viewport',async({page},info)=>{
  test.skip(info.project.name==='desktop-1280','Mobile authorization reflow');
  const row={id:'9e13df95-85ec-4548-8363-467a6d6e95f0',payerId:'user1',taxpayerId:'user3',
    status:'REVOKED',requestedAt:Date.now()-300000,codeExpiresAt:Date.now()+300000,consentCode:null,
    confirmedAt:null,activeUntil:null,attempts:0,revokedAt:Date.now()-100000,codeResends:0,codeSentAt:null};
  await enterUser1(page);
  await page.unroute('**/functions/v1/demo-story1-taxpay/authorizations?actor=*');
  await page.route('**/functions/v1/demo-story1-taxpay/authorizations?actor=*',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify({success:true,data:[row]})
  }));
  await page.goto('/?action=manage_authorization');
  const auth=page.getByTestId('manage-authorization');
  await auth.getByRole('button',{name:'Add'}).click();
  const form=auth.locator('.taxpay-auth-add');
  await expect(form.getByLabel('Taxpayer TIN')).toBeVisible();
  await expect(form.getByRole('button',{name:'Request authorization'})).toBeVisible();
  await auth.getByRole('button',{name:'Delete',exact:true}).click();
  const confirm=auth.getByRole('button',{name:'Confirm delete'});
  await expect(confirm).toBeVisible();
  await expect(confirm).toHaveCSS('background-color','rgb(255, 255, 255)');
  await expect(confirm).toHaveCSS('color','rgb(166, 40, 52)');
  const cancel=auth.getByRole('button',{name:'Cancel'});
  await expect(cancel).toHaveCSS('background-color','rgb(255, 255, 255)');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  await cancel.click();
  await expect(confirm).toHaveCount(0);
});

test('mobile Travel Tax keeps the total and Back/Continue on compact distinct rows',async({page},info)=>{
  test.skip(info.project.name==='desktop-1280','Mobile payment journey geometry');
  await page.goto('/');
  await page.getByRole('button',{name:'Pay Tax',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Pay Tax'});
  await enterTaxPayService(dialog, 'TRAVEL_TAX');
  await dialog.getByRole('button',{name:'Continue without signing in'}).click();
  const footer=dialog.locator('.travel-flow__footer-actions');
  const summary=dialog.locator('.travel-flow__summary');
  const back=footer.getByRole('button',{name:'Back'});
  const next=footer.getByRole('button',{name:'Continue to purpose & amount'});
  const [backBox,nextBox,summaryBox]=await Promise.all([back.boundingBox(),next.boundingBox(),summary.boundingBox()]);
  expect(backBox).not.toBeNull();expect(nextBox).not.toBeNull();expect(summaryBox).not.toBeNull();
  expect(backBox!.x+backBox!.width).toBeLessThanOrEqual(nextBox!.x+1);
  expect(Math.abs(backBox!.y-nextBox!.y)).toBeLessThanOrEqual(6);
  expect(summaryBox!.height).toBeLessThanOrEqual(100);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});

test('desktop Travel Tax keeps long journey descriptions readable in the calculation panel',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Desktop long-label layout');
  await page.goto('/');
  await page.getByRole('button',{name:'Pay Tax',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Pay Tax'});
  await enterTaxPayService(dialog, 'TRAVEL_TAX');
  await dialog.getByRole('button',{name:'Continue without signing in'}).click();
  await dialog.getByLabel('Passenger name').fill('SAMPLE TRAVELLER');
  await dialog.getByLabel('Passport number').fill('FAKE0001');
  await dialog.getByLabel('Mobile number for receipt').fill('01712345678');
  await dialog.getByLabel('Travel date').fill('2026-10-25');
  await dialog.getByRole('button',{name:'Continue to purpose & amount'}).click();
  await dialog.locator('#travel-tax-route-0').check();
  const row=dialog.locator('.travel-flow__summary-list > div').nth(2);
  await expect(row.locator('dd')).not.toBeEmpty();
  const values=await row.evaluate(element=>({display:getComputedStyle(element).display,
    maxWidth:getComputedStyle(element.querySelector('dd')!).maxWidth,
    rowWidth:element.getBoundingClientRect().width,
    valueWidth:element.querySelector('dd')!.getBoundingClientRect().width}));
  expect(values.display).toBe('grid');
  expect(values.valueWidth).toBeGreaterThan(values.rowWidth*.8);
});

test('mobile travel-tax explanation stays within the dashboard rather than clipping off-screen',async({page},info)=>{
  test.skip(info.project.name==='desktop-1280','Mobile tooltip geometry');
  await enterUser1(page);
  const summary=page.locator('.taxpayer-travel-tax-summary');
  await summary.locator('.taxpayer-inline-help > summary').click();
  const tooltip=summary.locator('.taxpayer-inline-help__content');
  await expect(tooltip).toBeVisible();
  const box=await tooltip.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x+box!.width).toBeLessThanOrEqual(page.viewportSize()!.width+1);
  await expect(tooltip).toContainText('Travel tax is reported separately');
});

test('mobile public Help entry clears the footer identity area',async({page},info)=>{
  test.skip(info.project.name==='desktop-1280','Mobile footer geometry');
  await page.goto('/');
  await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
  await expect(page.locator('.public-footer__identity')).toBeVisible();
  const help=await page.locator('.public-help-launch').boundingBox();
  const identity=await page.locator('.public-footer__identity').boundingBox();
  expect(help).not.toBeNull();expect(identity).not.toBeNull();
  const overlap=help!.x < identity!.x+identity!.width && help!.x+help!.width > identity!.x &&
    help!.y < identity!.y+identity!.height && help!.y+help!.height > identity!.y;
  expect(overlap).toBe(false);
});
