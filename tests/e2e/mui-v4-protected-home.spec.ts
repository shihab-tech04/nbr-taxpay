import {expect,test} from '@playwright/test';
import {mockPublishedBannerCms} from './mock-published-banners';
const homes=[
 {name:'default',query:'',root:'.public-record-discovery'},
 {name:'landing',query:'action=landing&',root:'.public-record-discovery'},
 {name:'home2',query:'action=home-2&',root:'[data-testid="home2-root"]'},
 {name:'home3',query:'action=home-3&',root:'[data-testid="home3-root"]'},
];
for(const lang of ['en','bn'] as const)
for(const theme of ['light','dark'] as const)
for(const signedIn of [false,true])
test('frozen homepage '+lang+' '+theme+' '+(signedIn?'local-account':'guest'),async({page})=>{
 // Fixed time and software rendering inputs are identical for Main, unchanged control and MUI candidate.
 await page.clock.setFixedTime(new Date('2026-11-25T10:00:00+06:00'));
 await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});
 await page.route('**/*.supabase.co/**',route=>route.abort());
 await mockPublishedBannerCms(page);
 if(signedIn){
  await page.goto('/?action=taxpayer_login&lang='+lang);
  const login=page.getByRole('dialog');
  await login.locator('#taxpayer-login-user-id').fill('user1');
  await login.locator('#taxpayer-login-password').fill('user1');
  await login.getByTestId('taxpayer-login-submit').click();
  await expect(page).toHaveURL(/action=taxpayer_home/);
  expect(await page.evaluate(()=>sessionStorage.getItem('taxpay-taxpayer-preview-user'))).toBe('user1');
 }
 for(const h of homes){
  await page.goto('/?'+h.query+'lang='+lang,{waitUntil:'domcontentloaded'});
  await expect(page.locator(h.root)).toBeVisible();
  await expect(page.locator('.taxpay-citizen-shell')).toHaveAttribute('lang',lang);
  expect(await page.evaluate(()=>sessionStorage.getItem('taxpay-taxpayer-preview-user'))).toBe(signedIn?'user1':null);
  await page.evaluate(async()=>{
    await document.fonts.ready;
    await Promise.all([...document.images].map(image=>image.decode().catch(()=>undefined)));
    await document.fonts.ready;
  });
  await expect(page.locator('[data-mui-citizen-region]')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  await expect(page).toHaveScreenshot(h.name+'-'+lang+'-'+theme+'-'+(signedIn?'local-account':'guest')+'.png',{fullPage:true,animations:'disabled',caret:'hide',maxDiffPixels:0,threshold:0});
 }
});
