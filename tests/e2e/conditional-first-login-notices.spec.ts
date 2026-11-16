import {expect,test,type Page} from '@playwright/test';

/** Synthetic preview identity only: these tests never write hosted notices. */
async function installPreviewWelcome(page:Page, language:'en'|'bn') {
  await page.addInitScript(({language}) => {
    sessionStorage.setItem('taxpay-taxpayer-preview-user','user1');
    sessionStorage.setItem('korbritto.demo-profile-session.v1',JSON.stringify({
      profileId:'user1',
      capability:'A'.repeat(43),
      paymentSessionId:'00000000-0000-4000-8000-000000000099',
      selectedListId:null,language,
    }));
    sessionStorage.setItem('sohojkor.preview-first-login-welcome.v1','user1');
  },{language});
  await page.route('**/functions/v1/taxpay-guest-beneficiaries', async route => {
    const data=route.request().postDataJSON() as {action?:string};
    if(data?.action==='received-notices-unread') {
      await route.fulfill({status:200,contentType:'application/json',
        body:JSON.stringify({success:true,data:[]})});
      return;
    }
    await route.continue();
  });
}

for(const language of ['en','bn'] as const) {
  for(const project of ['desktop-1280','mobile-375','mobile-320'] as const) {
    test(`no welcome popup without pending notices (${language}, ${project})`,async({page},info)=>{
      test.skip(info.project.name!==project,'Bilingual desktop and mobile first-login conditional');
      await installPreviewWelcome(page,language);
      let noticeReads=0;
      await page.route('**/functions/v1/demo-story1-taxpay/authorizations?**',async route=>{
        noticeReads++;
        await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data:[]})});
      });
      await page.goto('/?action=taxpayer_home'+(language==='bn'?'&lang=bn':''));
      await expect.poll(()=>noticeReads).toBeGreaterThan(0);
      await expect(page.getByTestId('first-login-welcome')).toHaveCount(0);
      await expect(page.getByRole('heading',{name:language==='bn'?'সহজকরে স্বাগতম':'Welcome to Sohojkor'})).toHaveCount(0);
    });

    test(`welcome button fits and advances to pending notice (${language}, ${project})`,async({page},info)=>{
      test.skip(info.project.name!==project,'Bilingual desktop and mobile first-login modal');
      await installPreviewWelcome(page,language);
      await page.route('**/functions/v1/demo-story1-taxpay/authorizations?**',async route=>{
        await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
          success:true,data:[{id:'pending-1',payerId:'user2',taxpayerId:'user1',status:'PENDING',
            requestedAt:1794797107000,codeResends:0}]
        })});
      });
      await page.goto('/?action=taxpayer_home'+(language==='bn'?'&lang=bn':''));
      const welcome=page.getByTestId('first-login-welcome');
      await expect(welcome).toBeVisible();
      const dialog=page.getByRole('dialog');
      const button=dialog.getByRole('button',{name:language==='bn'?'বিজ্ঞপ্তি দেখুন':'Continue to notifications'});
      await expect(button).toBeVisible();
      // The modal animates scale(.99) -> scale(1). Measure the settled
      // hit target, not a fractional bounding box mid-transition.
      await dialog.evaluate(async element=>{
        await Promise.all(element.getAnimations().map(animation=>animation.finished.catch(()=>undefined)));
      });
      const dimensions=await button.evaluate(element=>{
        const bounds=element.getBoundingClientRect();
        const style=getComputedStyle(element);
        return {height:bounds.height,width:bounds.width,scrollWidth:element.scrollWidth,
          clientWidth:element.clientWidth,whiteSpace:style.whiteSpace};
      });
      expect(dimensions.height).toBeGreaterThanOrEqual(44);
      expect(dimensions.width).toBeGreaterThan(110);
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth+1);
      expect(dimensions.whiteSpace).toBe('normal');
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
      await button.click();
      await expect(welcome).toHaveCount(0);
      await expect(page.getByRole('heading',{name:language==='bn'?'পেমেন্ট অনুমোদনের অনুরোধ':'Payment authorization request'})).toBeVisible();
    });
  }
}
