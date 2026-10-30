import { enterLocalTaxpayerSample } from './local-taxpayer-sample';
import {expect,test} from '@playwright/test';
import { enterTaxPayService } from './pay-tax-entry-helper';

const publicRoutes=['landing','guest','guestwh','travel','verify','incident','guidance','head_catalogue'] as const;
const privateRoutes={
  taxpayer_home: {kind:'home',button:''},
  dashboard: {kind:'home',button:''},
  wizard: {kind:'pay',button:'Pay — select payment type'},
  history: {kind:'button',button:'Open transaction history'},
  ledger: {kind:'button',button:'Review tax ledger'},
  journey: {kind:'button',button:'Full payment journey'},
  certificates: {kind:'activity-tab',button:'Receipts & certificates'},
  corrections: {kind:'activity-tab',button:'Issues & corrections'},
  notifications: {kind:'menu',button:'Notifications'},
  services: {kind:'button',button:'View payment services'}
} as const;

const visualAudit=async(page:import('@playwright/test').Page,key:string,viewport:string) => {
  const main=page.locator('main');
  await expect(main).toBeVisible();
  const headingCount=await main.locator('h1,h2').count();
  expect(headingCount,key+' must have a visible page heading').toBeGreaterThan(0);
  const width=page.viewportSize()!.width;
  const actualWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
  expect(actualWidth, key+' has page-wide horizontal overflow').toBeLessThanOrEqual(width+2);
  await page.screenshot({path:'test-results/screenshots/matrix-'+key+'-'+viewport+'.png',fullPage:false});
};
test.describe('read-only citizen screen matrix',()=>{
  for(const route of publicRoutes) {
    test('guest '+route+' responsive route',async({page},info)=>{
      const networkCalls:string[]=[];
      page.on('request',request=>{
        if(new URL(request.url()).hostname.endsWith('.supabase.co'))networkCalls.push(request.url());
      });
      await page.goto('/?action='+route);
      await visualAudit(page,'guest-'+route,info.project.name);
      await expect.poll(()=>networkCalls).toEqual([]);
    });
  }
  for(const [route,choice] of Object.entries(privateRoutes)) {
    test('sample taxpayer '+route+' responsive route',async({page},info)=>{
      await page.goto('/?action=taxpayer_home');
      await enterLocalTaxpayerSample(page);
      if(choice.kind==='menu'){
        await page.getByRole('button',{name:'Open menu'}).click();
        await page.getByRole('dialog',{name:'Services & menu'}).getByRole('button',{name:choice.button,exact:true}).click();
      } else if(choice.kind==='activity-tab') {
        await page.getByRole('button',{name:'Open transaction history'}).click();
        await page.getByRole('navigation',{name:'Activity sections'}).getByRole('button',{name:choice.button,exact:true}).click();
      } else if(choice.kind==='pay'){
        await page.getByRole('button',{name:'Pay — select payment type'}).click();
        const services=page.getByRole('dialog',{name:'Pay Tax'});
        await enterTaxPayService(services, 'TAX_WITH_RETURN');
      } else if(choice.kind==='button'){
        await page.getByRole('button',{name:new RegExp(choice.button)}).first().click();
      }
      await visualAudit(page,'taxpayer-'+route,info.project.name);
    });
  }
  test('legacy Office deep link resolves to the public TaxPay entry at this viewport',async({page})=>{
    await page.goto('/?action=officer_home');
    await expect(page).toHaveURL(/action=landing/);
    await expect(page.locator('.taxpay-citizen-shell')).toBeVisible();
    await expect(page.locator('#public-home-title')).toBeVisible();
    await expect(page.locator('header.bg-emerald-950')).toHaveCount(0);
  });
});
