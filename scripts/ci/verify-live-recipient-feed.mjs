import {chromium,expect} from '@playwright/test';
const base=new URL(process.env.TAXPAY_LIVE_URL);
if(base.protocol!=='https:'||base.hostname!=='shihab-tech04.github.io'||!base.pathname.startsWith('/nbr-taxpay/'))throw Error('Unexpected Pages origin');
const url=action=>{const u=new URL(base);u.searchParams.set('action',action);u.searchParams.set('lang','en');return u.toString();};
const browser=await chromium.launch({headless:true});
let verified=false;
try{
 for(const id of ['user2','user3','user4','user30','user1']){
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  try{
   await page.goto(url('taxpayer_login'),{waitUntil:'domcontentloaded',timeout:45000});
   const sign=page.getByRole('dialog',{name:'Sign In To Your Sohojkor Account'});
   await sign.getByRole('textbox',{name:'User ID'}).fill(id);
   await sign.getByLabel('Password',{exact:true}).fill(id);
   const unread=page.waitForResponse(r=>{try{return r.ok()&&r.url().includes('/taxpay-guest-beneficiaries')&&r.request().postDataJSON()?.action==='received-notices-unread';}catch{return false;}},{timeout:45000});
   // Attach rejection handling immediately: a failed login must not leave a rejected listener unhandled.
   unread.catch(()=>{});
   await sign.getByRole('button',{name:'Sign In',exact:true}).click();
   const otp=sign.getByTestId('demo-otp-input');
   await expect.poll(async()=>await otp.isVisible().catch(()=>false)||/action=taxpayer_home/.test(page.url()),{timeout:15000}).toBe(true);
   if(await otp.isVisible().catch(()=>false)){await otp.fill('111111');await sign.getByRole('button',{name:'Verify code'}).click();}
   await expect(page).toHaveURL(/action=taxpayer_home/,{timeout:30000});
   const data=(await (await unread).json()).data;
   if(!Array.isArray(data?.items))throw Error('Invalid live unread response');
   if(!data.items.length)continue;
   const popup=page.getByTestId('received-payment-notice');
   if(!await popup.isVisible().catch(()=>false)){
    try{await popup.waitFor({state:'visible',timeout:10000});}catch{continue;}
   }
   const reference=data.items[0].receiptReference;
   if(!reference)throw Error('Live record lacks receipt reference');
   await expect(popup.locator('dt')).toHaveCount(7);
   await expect(popup).toContainText(reference);
   const dialog=page.getByRole('dialog').filter({has:popup});
   await expect(dialog.getByRole('button',{name:/^(Report Payment|পেমেন্ট রিপোর্ট করুন)$/})).toBeVisible();
   await dialog.getByRole('button',{name:/^(Report Payment|পেমেন্ট রিপোর্ট করুন)$/}).click();
   const form=page.getByRole('dialog',{name:/^(Report Payment|পেমেন্ট রিপোর্ট করুন)$/});
   await expect(form.getByRole('textbox')).toBeVisible({timeout:30000});
   await expect(form).toContainText(reference);
   await expect(page).toHaveURL(/action=corrections/);
   // No report submission or acknowledgement; leave all production notices intact.
   await page.goto(url('history'),{waitUntil:'domcontentloaded',timeout:45000});
   await expect(page.getByTestId('recipient-activity-payments')).toContainText(reference,{timeout:30000});
   verified=true;console.log('PASS real fictional recipient popup, seven fields, exact report target and Activity readback; no acknowledgement or report write');break;
  }finally{await page.close();}
 }
 if(!verified)throw Error('No available unread fictional recipient popup could be verified');
}finally{await browser.close();}
