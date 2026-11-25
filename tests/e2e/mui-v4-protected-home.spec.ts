import {expect,test} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {mockPublishedBannerCms} from './mock-published-banners';
const homes=[
 {name:'default',query:'',root:'.public-record-discovery'},
 {name:'landing',query:'action=landing&',root:'.public-record-discovery'},
 {name:'home2',query:'action=home-2&',root:'[data-testid="home2-root"]'},
 {name:'home3',query:'action=home-3&',root:'[data-testid="home3-root"]'},
];
const baseline='http://127.0.0.1:4174';
const candidate='http://127.0.0.1:4173';
const screenshotOptions={fullPage:true,animations:'disabled' as const,caret:'hide' as const};
for(const lang of ['en','bn'] as const)
for(const theme of ['light','dark'] as const)
for(const signedIn of [false,true])
test('frozen homepage '+lang+' '+theme+' '+(signedIn?'local-account':'guest'),async({page},info)=>{
 await page.clock.setFixedTime(new Date('2026-11-25T10:00:00+06:00'));
 await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});
 await page.route('**/*.supabase.co/**',route=>route.abort());
 await mockPublishedBannerCms(page);
 const dir=join(process.env.MUI_SNAPSHOT_DIR!,info.project.name);
 mkdirSync(dir,{recursive:true});
 async function signIn(origin:string) {
  await page.goto(origin+'/?action=landing&lang='+lang);
  if(signedIn && !(await page.evaluate(()=>sessionStorage.getItem('taxpay-taxpayer-preview-user')))){
   await page.goto(origin+'/?action=taxpayer_login&lang='+lang);
   const login=page.getByRole('dialog');
   await login.locator('#taxpayer-login-user-id').fill('user1');
   await login.locator('#taxpayer-login-password').fill('user1');
   await login.getByTestId('taxpayer-login-submit').click();
   await expect(page).toHaveURL(/action=taxpayer_home/);
  }
  expect(await page.evaluate(()=>sessionStorage.getItem('taxpay-taxpayer-preview-user'))).toBe(signedIn?'user1':null);
 }
 async function visit(origin:string,h:typeof homes[number]){
  await page.goto(origin+'/?'+h.query+'lang='+lang,{waitUntil:'domcontentloaded'});
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
 }
 // Keep the two builds in the same Chromium process, page, viewport and software renderer.
 // Baselines are written only from the exact Main server. Both A/A and A/B must pass zero tolerance.
 await signIn(baseline);
 for(const h of homes){
  const name=h.name+'-'+lang+'-'+theme+'-'+(signedIn?'local-account':'guest')+'.png';
  await visit(baseline,h);
  let previous=await page.screenshot(screenshotOptions),stable:Buffer|undefined;
  for(let attempt=0;attempt<8;attempt++){
   const next=await page.screenshot(screenshotOptions);
   if(previous.equals(next)){stable=next;break;}
   previous=next;
  }
  expect(stable,'Unchanged Main screenshot did not settle to an identical frame: '+name).toBeDefined();
  writeFileSync(join(dir,name),stable!);
  await visit(baseline,h);
  await expect(page,'Unchanged Main self-control '+name).toHaveScreenshot(name,{...screenshotOptions,maxDiffPixels:0,threshold:0});
  await signIn(candidate);
  await visit(candidate,h);
  await expect(page,'MUI candidate versus exact Main '+name).toHaveScreenshot(name,{...screenshotOptions,maxDiffPixels:0,threshold:0});
 }
});
