import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

/**
 * Read-only acceptance of the REAL, published Sohojkor walk-in Tax Head editor.
 * This deliberately does not use fixture routing, API mocking, financial writes
 * or user-owned sessions. A failure here is a real-production investigation
 * trigger, not proof that the independently tested source component is broken.
 */
const target = process.env.TAXPAY_LIVE_URL;
if (!target) throw new Error('TAXPAY_LIVE_URL is required');
const base = new URL(target);
if (base.protocol !== 'https:' || base.hostname !== 'shihab-tech04.github.io' ||
    base.pathname !== '/nbr-taxpay/') {
  throw new Error('Run the live Tax Head acceptance on the Sohojkor production URL only');
}
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const sample of [
    { name: 'desktop-en', width: 1280, height: 900, lang: 'en' },
    { name: 'mobile-375-en', width: 375, height: 812, lang: 'en' },
    { name: 'mobile-320-bn', width: 320, height: 720, lang: 'bn' },
  ]) {
    const bn = sample.lang === 'bn';
    const mobile = sample.width < 650;
    const page = await browser.newPage({
      viewport: { width: sample.width, height: sample.height },
      isMobile: mobile, hasTouch: mobile,
    });
    const financialWrites = [];
    page.on('request', request => {
      if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) return;
      try {
        const url = new URL(request.url());
        if (url.hostname.endsWith('.supabase.co') &&
          /\/rpc\/(?:sim_submit_payment|.*payment_confirm|.*settle_payment)|\/(?:transactions|credit_postings)\b/i.test(url.pathname)) {
          financialWrites.push(request.method() + ' ' + url.pathname);
        }
      } catch {}
    });
    try {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const url = new URL(base);
      url.searchParams.set('action', 'landing');
      url.searchParams.set('lang', sample.lang);
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 45000 });
      // The exact supported public v5 entry. Never bypass TIN lookup.
      await page.locator('.public-benefits__item[data-benefit="payments"]').click();
      const login = page.locator('.taxpay-modal[data-public-service="login"]');
      await expect(login).toBeVisible({ timeout: 20000 });
      await login.getByRole('button', {
        name: bn ? 'ওয়াক-ইন পেমেন্ট' : 'Walk-in Payment',
      }).click();

      const tin = page.getByTestId('unified-tin-input');
      const modal = page.locator('[role="dialog"]').filter({ has: tin });
      await expect(tin).toBeVisible({ timeout: 20000 });
      await tin.fill('111111111111'); // publicly approved fictional demo TIN
      await modal.getByRole('button', {
        name: bn ? 'করদাতার টিআইএন অনুসন্ধান' : 'Search taxpayer TIN',
      }).click();
      await expect(modal.getByTestId('unified-taxpayer-search-result'))
        .toBeVisible({ timeout: 20000 });
      await modal.getByRole('button', {
        name: bn ? 'করদাতা যোগ করুন' : 'Add taxpayer',
      }).click();
      await modal.getByRole('button', {
        name: bn ? 'পেমেন্ট খাতে এগিয়ে যান' : 'Continue to Payment Head',
      }).click();

      // The TIN input unmounts on stage transition; anchor to the stable Payment Head editor.
      const editor = page.getByTestId('other-tax-batch');
      const catalogue = editor.getByTestId('other-tax-head-catalogue');
      const groups = catalogue.locator('[data-head-group]');
      await expect(groups).toHaveCount(7);
      const heading = editor.locator('h3.other-tax-category-heading');
      await expect(heading).toHaveText(bn ? 'করের শ্রেণি নির্বাচন করুন' : 'Choose a tax category');
      await expect(heading).toHaveCSS('font-size', '16px');
      await expect(editor.locator('.other-tax-selection-status')).toHaveCSS('font-size', '14px');
      await expect(catalogue).toHaveCSS('row-gap', '6px');

      const advance = catalogue.locator('[data-head-group="Advance Tax"]');
      const advanceSummary = advance.locator('summary');
      await expect(advanceSummary).toHaveCSS('font-size', '16px');
      await expect(advance.locator('.other-tax-category-trigger__count')).toHaveCSS('font-size', '14px');
      const summaryBounds = await advanceSummary.boundingBox();
      if (!summaryBounds || summaryBounds.height < 43.5 || summaryBounds.height > 49) {
        throw new Error('Approved 44px Advance Tax row height drift: ' + JSON.stringify(summaryBounds));
      }
      await page.screenshot({
        path: 'test-results/live-tax-head-closed-' + sample.name + '.png',
        animations: 'disabled',
      });
      await advanceSummary.click();
      await expect(advance.locator('[data-head-row]')).toHaveCount(3);
      await expect(advance.locator('[data-head-row] > label > span.text-sm').first())
        .toHaveCSS('font-size', '16px');
      await expect(advance.locator('[data-head-row] span.text-xs').first())
        .toHaveCSS('font-size', '14px');
      await page.screenshot({
        path: 'test-results/live-tax-head-open-' + sample.name + '.png',
        animations: 'disabled',
      });
      await advanceSummary.click();

      const returnGroup = catalogue.locator('[data-head-group="Tax with Return"]');
      await returnGroup.locator('summary').click();
      await returnGroup.getByTestId('unified-v5-return-checkbox').check();
      await expect(returnGroup.locator('.other-tax-category-trigger__selected'))
        .toContainText(bn ? '1' : '1 selected');
      const allocation = returnGroup.getByTestId('other-tax-line');
      await expect(allocation).toHaveCount(1);
      await expect(allocation.locator('select[id^="other-tax-year-"]'))
        .toHaveValue('2026-27');
      await expect(allocation.locator('input[id^="other-tax-amount-"]')).toBeVisible();
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 2) throw new Error('Live Payment Head horizontal viewport overflow: ' + overflow);
      if (financialWrites.length) throw new Error(
        'Tax Head selection attempted financial writes: ' + financialWrites.join(', '));
      console.log('PASS: REAL Sohojkor Tax Head ' + sample.name +
        ' 7 groups, 44px compact rows, 16/14 typography, year/amount editor, no overflow or financial writes');
    } catch (error) {
      await page.screenshot({
        path: 'test-results/live-tax-head-failure-' + sample.name + '.png',
        animations: 'disabled',
      }).catch(() => {});
      throw error;
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
console.log('PASS: production seven-category walk-in Tax Head at desktop, mobile EN and mobile BN');


// Additional read-only production acceptance. Never save or submit a payment.
const multiBrowser = await chromium.launch({headless:true});
try {
  for (const width of [320,375,1280]) for (const signedIn of [false,true]) {
    const page=await multiBrowser.newPage({viewport:{width,height:900},serviceWorkers:'block'});
    const denied=[];
    // Fail closed: allow only the existing demo-session and read operations.
    await page.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url());
      if(!url.hostname.endsWith('.supabase.co')||['GET','HEAD','OPTIONS'].includes(req.method()))return route.continue();
      let body;try{body=req.postDataJSON()}catch{}
      const action=body?.action;
      const reads=['demo-login','open','lists','people','snapshot','demo-registration','payment-draft-list','payment-draft-get','guest-payment-draft-list','guest-payment-draft-get','received-notices-list','received-notices-unread'];
      if(req.method()==='POST' && url.pathname==='/functions/v1/taxpay-guest-beneficiaries' && (reads.includes(action)||(action==='demo-settings'&&body.key==null&&body.value==null)))return route.continue();
      if(req.method()==='POST'&&/\/auth\/v1\/(token|verify)$/.test(url.pathname))return route.continue();
      denied.push(req.method()+' '+url.pathname);
      await route.abort('blockedbyclient');
    });
    try {
      const to=action=>{const u=new URL(base);u.searchParams.set('action',action);u.searchParams.set('lang','en');return u.toString()};
      if(signedIn){
        await page.goto(to('taxpayer_login'),{waitUntil:'domcontentloaded'});
        const login=page.getByRole('dialog',{name:'Sign In To Your Sohojkor Account'});
        await login.getByRole('textbox',{name:'User ID'}).fill('user1');
        await login.getByLabel('Password',{exact:true}).fill('user1');
        await login.getByRole('button',{name:'Sign In',exact:true}).click();
        const otp=login.getByTestId('demo-otp-input');
        await expect.poll(async()=>await otp.isVisible().catch(()=>false)||/action=taxpayer_home/.test(page.url()),{timeout:30000}).toBe(true);
        if(await otp.isVisible()){await otp.fill('111111');await login.getByRole('button',{name:'Verify code'}).click()}
        await expect(page).toHaveURL(/action=taxpayer_home/,{timeout:30000});
        await expect(page.getByTestId('user1-synthetic-workspace')).toBeVisible();
        const pay=page.getByRole('button',{name:'Pay — select payment type'});
        if(width>900&&!(await pay.isVisible()))await page.setViewportSize({width:900,height:900});
        await pay.click();
        await page.getByRole('menu',{name:'Payment options'}).getByRole('menuitem',{name:'Pay Tax',exact:true}).click();
        await page.setViewportSize({width,height:900});
      }else{
        await page.goto(to('landing'),{waitUntil:'domcontentloaded'});
        await page.locator('.public-benefits__item[data-benefit="payments"]').click();
        await page.locator('.taxpay-modal[data-public-service="login"]').getByRole('button',{name:'Walk-in Payment'}).click();
      }
      const modal=page.getByRole('dialog',{name:'Pay Tax'});
      const workspace=modal.getByTestId('unified-taxpayer-workspace');
      const footer=async()=>{
        const bar=modal.locator('.taxpay-modal__footer');
        const save=bar.locator('.payment-form-draft-controls__save');
        const next=bar.locator('.payment-flow-embedded__footer-actions > .tax-service-choice__continue');
        await expect(save).toBeVisible();await expect(next).toBeVisible();
        await expect(modal.locator('.taxpay-modal__body .payment-form-draft-controls__actions')).toHaveCount(0);
        await expect(bar.locator('.payment-form-draft-controls__open')).toHaveCount(0);
        await expect.poll(async()=>{
          const [a,b,c]=await Promise.all([save.boundingBox(),next.boundingBox(),bar.boundingBox()]);
          return !!(a&&b&&c&&Math.abs(a.y-b.y)<=2&&Math.abs(a.height-b.height)<=2&&a.x+a.width+3<=b.x&&a.x-c.x<=36&&c.x+c.width-b.x-b.width<=36&&a.height>=44&&b.height>=44&&b.width<c.width*.75&&a.x>=c.x&&b.x+b.width<=c.x+c.width+1);
        }).toBe(true);
        await expect(save).toHaveCSS('border-top-width','1px');
        expect(await bar.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(2);
        for(const action of [save,next])expect(await action.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(14);
      };
      if(signedIn){
        const start=modal.getByRole('button',{name:'Start new Tax payment'});
        await expect.poll(async()=>await start.isVisible().catch(()=>false)||await workspace.isVisible().catch(()=>false),{timeout:30000}).toBe(true);
        if(await start.isVisible())await start.click();
        await expect(workspace).toBeVisible();
        await footer();
        await modal.getByTestId('unified-account-own').getByRole('checkbox').check();
        const accordion=modal.getByTestId('saved-beneficiary-picker').getByTestId('beneficiary-list-accordion');
        await expect(accordion).toBeVisible({timeout:30000});
        let contact=accordion.getByRole('checkbox').first();
        if(!(await contact.isVisible())){
          for(const summary of await accordion.locator('button[aria-expanded="false"]').all()){
            await summary.click();if(await contact.isVisible())break;
          }
        }
        await expect(contact).toBeVisible();await contact.check();
      }else{
        await expect(workspace).toBeVisible();
        for(const tin of ['222222222222','333333333333']){
          await modal.getByTestId('unified-tin-input').fill(tin);
          await modal.getByRole('button',{name:'Search taxpayer TIN'}).click();
          await expect(modal.getByTestId('unified-taxpayer-search-result')).toBeVisible();
          await modal.getByRole('button',{name:'Add taxpayer'}).click();
        }
      }
      await expect(modal.getByTestId('unified-taxpayer-count')).toHaveText('2');
      await modal.getByRole('button',{name:'Continue to Payment Head'}).click();
      const batch=modal.getByTestId('other-tax-batch');
      await expect(batch).toBeVisible();
      if(signedIn)await footer();
      const tabs=batch.getByTestId('other-tax-taxpayer-tabs').locator('button[data-taxpayer-id]');
      await expect(tabs).toHaveCount(2);
      const advance=batch.locator('[data-head-group="Advance Tax"]');
      const selection=batch.getByRole('checkbox',{name:/Select 68A/});
      const open=async()=>{if(await advance.getAttribute('open')===null)await advance.locator('summary').click();await expect(selection).toBeVisible()};
      for(const [i,year,amount] of [[0,'2026-27','125'],[1,'2025-26','75']]){
        await tabs.nth(i).click();await open();await selection.check();
        const line=batch.getByTestId('other-tax-line');
        await expect(line).toHaveCount(1);
        await line.locator('select[id^="other-tax-year-"]').selectOption(year);
        await line.locator('input[id^="other-tax-amount-"]').fill(amount);
      }
      for(const [i,year,amount] of [[0,'2026-27','125'],[1,'2025-26','75']]){
        await tabs.nth(i).click();await open();
        const line=batch.getByTestId('other-tax-line');
        await expect(line).toHaveCount(1);
        await expect(line.locator('select[id^="other-tax-year-"]')).toHaveValue(year);
        await expect(line.locator('input[id^="other-tax-amount-"]')).toHaveValue(amount);
      }
      const mobile=modal.getByTestId('mobile-payment-calculation');
      if(await mobile.count()&&await mobile.getAttribute('open')===null)await mobile.getByTestId('mobile-payment-calculation-toggle').click();
      const cards=modal.getByTestId('v5-compact-taxpayer-summary').locator('details.payment-form-summary__compact-owner');
      await expect(cards).toHaveCount(2);
      await expect(cards.nth(0)).toContainText('125');await expect(cards.nth(1)).toContainText('75');
      await expect(modal.locator('.payment-form-summary__total')).toContainText('200');
      for(const card of await cards.all())if(await card.getAttribute('open')===null)await card.locator('summary').click();
      await expect(cards.nth(0).getByTestId('selected-taxpayer-head-list')).toContainText('2026-27');
      await expect(cards.nth(1).getByTestId('selected-taxpayer-head-list')).toContainText('2025-26');
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
      expect(denied,'No blocked financial, beneficiary or draft write attempted').toEqual([]);
      console.log('PASS: real '+(signedIn?'signed-in':'walk-in')+' '+width+'px independent two-taxpayer heads, years, amounts, total'+(signedIn?' and Save Draft footer':''));
    } finally {await page.close()}
  }
}finally{await multiBrowser.close()}
