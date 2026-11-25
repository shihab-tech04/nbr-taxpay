import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const pageUrl = process.env.TAXPAY_LIVE_URL;
if (!pageUrl) throw new Error('TAXPAY_LIVE_URL is required');
const base = new URL(pageUrl);
if (base.protocol !== 'https:' || base.hostname !== 'shihab-tech04.github.io' || !base.pathname.startsWith('/nbr-taxpay/')) {
  throw new Error('Travel Tax acceptance must run against the actual production GitHub Pages URL');
}
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const [name, viewport, mobile] of [
    ['desktop', { width: 1280, height: 800 }, false],
    ['short-desktop', { width: 1280, height: 520 }, false],
    ['mobile', { width: 375, height: 812 }, true],
    ['desktop-bn', { width: 1280, height: 800 }, false],
    ['mobile-bn', { width: 375, height: 812 }, true],
  ]) {
    const bn = name.endsWith('-bn');
    const tr = (en, bangla) => bn ? bangla : en;
    const amountText = tr('1,000','১,০০০');
    const page = await browser.newPage({ viewport, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block' });
    // The deployed app is real; the payment acknowledgement and detail readback
    // below are isolated browser fixtures. Never send payment or other mutation
    // requests to a hosted service. Unknown mutation endpoints fail closed.
    let submitted = null;
    let posts = 0;
    let reads = 0;
    const fixtureId = '2bd0a21e-4a7c-4c89-9664-0ae1f7f336a8';
    const headers = {'access-control-allow-origin':'*',
      'access-control-allow-methods':'GET, POST, OPTIONS',
      'access-control-allow-headers':'*'};
    await page.route('**/*', async route => {
      if (!['GET','HEAD','OPTIONS'].includes(route.request().method())) return route.abort('blockedbyclient');
      await route.fallback();
    });
    await page.route(/\/functions\/v1\/demo-story1-taxpay\/payments(?:\/[^?]+)?(?:\?.*)?$/, async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() === 'OPTIONS') return route.fulfill({status:204,headers});
      if (request.method() === 'POST' && url.pathname.endsWith('/payments')) {
        submitted = request.postDataJSON();
        posts++;
        expect(submitted.service).toBe('TRAVEL_TAX');
        expect(submitted.amountMinor).toBe(100000);
        expect(submitted.details.passengers).toHaveLength(1);
        return route.fulfill({status:200,headers,json:{success:true,id:fixtureId,
          status:'SIMULATED_SUCCESS',mirrored:true,simulationOnly:true}});
      }
      if (request.method() === 'GET') {
        if (url.pathname.endsWith('/'+fixtureId)) {
          if (!submitted || url.searchParams.get('sessionId') !== submitted.sessionId)
            return route.fulfill({status:403,headers,json:{success:false,error:'SESSION_NOT_AUTHORIZED'}});
          reads++;
          return route.fulfill({status:200,headers,json:{success:true,simulationOnly:true,
            data:{id:fixtureId,status:'SIMULATED_SUCCESS',createdAt:new Date().toISOString(),
              data:{...submitted,origin:'TAXPAY_UI'}}}});
        }
        return route.fulfill({status:200,headers,json:{success:true,simulationOnly:true,data:{items:[],total:0}}});
      }
      return route.abort('blockedbyclient');
    });
    // Keep this browser check independent from remote CMS storage bytes.
    await page.route('https://eyqhoavnitkrajvyqvxn.supabase.co/storage/v1/object/public/**', route => route.abort('blockedbyclient'));
    const url = new URL(base);
    url.searchParams.set('action', 'landing');
    url.searchParams.set('lang', tr('en','bn'));
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 45_000 });
    // PR #985 routes Home > Other Tax through the approved sign-in/walk-in
    // access modal. Keep that journey intact. Enter the separate Travel Tax
    // flow through its existing public Guide action (also tested in EN/BN).
    if (bn) {
      const carousel = page.locator('.public-hero-carousel');
      await expect(carousel).toBeVisible();
      await carousel.getByRole('button',{name:'অন্যান্য কর',exact:true}).click();
      const access = page.locator('.taxpay-modal[data-public-service="login"]');
      await access.getByRole('button',{name:'ওয়াক-ইন পেমেন্ট',exact:true}).click();
      await page.getByTestId('other-tax-chooser').getByRole('button',{name:/^ভ্রমণ কর/}).click();
    } else {
    url.searchParams.set('action', 'user_guide');
    url.searchParams.set('lang', 'en');
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.getByRole('searchbox', { name: 'Search the guide' }).fill('Travel tax');
    const result = page.locator('.public-guide-result-group').filter({
      has: page.getByRole('heading', { name: 'Travel tax', exact: true }),
    });
    await expect(result).toBeVisible({ timeout: 15_000 });
    await result.getByRole('button', { name: 'Pay Travel Tax' }).click();

    }
    const modal = bn ? page.locator('.taxpay-modal:visible').first() : page.getByRole('dialog', { name: 'Travel tax' });
    await expect(modal).toBeVisible();
    // Approved parallel Travel Tax journey (PR #955): passenger first, travel
    // details second, final preview third, checkout a separate subsequent view.
    if (bn) {
      await expect(modal.locator('.travel-flow')).toHaveAttribute('lang','bn');
      await expect(modal.locator('.taxpay-modal__title')).toHaveText('যাত্রীর তথ্য');
      await modal.locator('#travel-passport-first').fill('TEST230001');
      await modal.locator('#travel-lookup-first').click();
      await expect(modal.getByTestId('travel-passenger-name-first')).toHaveText('SAMPLE PASSENGER TWO');
      await modal.getByRole('button',{name:'যাত্রী যোগ করুন',exact:true}).click();
      await modal.getByRole('button',{name:'ভ্রমণের তথ্য দিতে এগিয়ে যান'}).click();
      await modal.locator('#travel-port').selectOption('Benapole');
      await modal.locator('#travel-destination').fill('India');
      await modal.locator('#travel-departure-date').fill(new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Dhaka'}).format(new Date(Date.now()+86_400_000)));
      await modal.getByRole('button',{name:'পেমেন্ট পর্যালোচনায় যান'}).click();
      await expect(modal.locator('.taxpay-modal__title')).toHaveText('চূড়ান্ত পর্যালোচনা');
      await expect(modal.getByTestId('travel-preview-total')).toContainText(amountText);
      await expect(modal.getByTestId('travel-preview-total-in-words')).toBeVisible();
      await expect(modal.getByRole('heading',{name:'পরিশোধকারী ও রসিদের তথ্য'})).toBeVisible();
      await modal.locator('#travel-mobile').fill('01712345678');
      await modal.screenshot({path:`test-results/live-travel-passport-${name}-final-preview.png`,animations:'disabled'});
      await modal.getByRole('button',{name:'পেমেন্ট করুন'}).click();
    } else {
    await expect(modal.locator('.taxpay-modal__title')).toHaveText('Passenger Information');
    if (!mobile) {
      const expectedWidth = Math.min(1160, viewport.width - 32);
      await expect.poll(async () => {
        const bounds = await modal.boundingBox();
        return Math.abs((bounds?.width ?? 0) - expectedWidth);
      }, { timeout: 7_000 }).toBeLessThanOrEqual(2);
      const bounds = await modal.boundingBox();
      if (!bounds || bounds.height > viewport.height * 0.95) {
        throw new Error('Passenger Information extends outside the desktop viewport');
      }
    }
    await expect(modal.getByRole('button', {name:'Save Draft', exact:true})).toHaveCount(0);
    await expect(modal.getByRole('button', {name:'Continue Draft', exact:true})).toHaveCount(0);
    await expect(modal.locator('#travel-tax-route-results')).toHaveCount(0);
    await expect(modal.locator('#travel-mobile')).toHaveCount(0);
    const addPassenger = modal.getByRole('button', { name: 'Add passenger', exact: true });
    const continueToTravel = modal.getByRole('button', { name: 'Continue to travel details' });
    const first = modal.locator('.travel-passenger-workspace__entry[data-passenger-id="first"]');
    await expect(first).toBeVisible();
    await expect(addPassenger).toHaveCount(0);
    await expect(continueToTravel).toBeDisabled();
    await expect(modal.locator('#travel-lookup-first')).toBeDisabled();

    await expect(first.getByTestId('travel-passenger-medical-control')).toHaveCount(0);
    await expect(first.locator('.travel-flow__identity-card')).toHaveCount(0);

    const geometry = () => modal.evaluate(el => {
      const nodes=[el,...['.taxpay-modal__header','.taxpay-modal__body','.taxpay-modal__footer',
        '.travel-flow__passport-row','#travel-passport-first','.travel-passenger-workspace__rail'].map(s=>el.querySelector(s))];
      return nodes.flatMap(node=>{if(!node)throw new Error('Missing stable modal section');
        const b=node.getBoundingClientRect();return [b.x,b.y,b.width,b.height,node.scrollTop,node.scrollHeight];});
    });
    await modal.evaluate(async el=>{await Promise.all(el.getAnimations({subtree:true}).filter(a=>a.playState==='running').map(a=>a.finished.catch(()=>undefined)));});
    const baseline=await geometry();
    await page.screenshot({path:`test-results/live-travel-passport-${name}-closed.png`});
    await modal.locator('#travel-passport-first').click();
    const options = modal.locator('#travel-passport-suggestions-first [role="option"]');
    await expect(options).toHaveCount(10);
    await expect(options.first()).toBeVisible();
    await expect.poll(()=>modal.locator('#travel-passport-suggestions-first').evaluate(el=>{
      const b=el.getBoundingClientRect(); const first=el.querySelector('[role="option"]')?.getBoundingClientRect();
      if(!first||!el.matches(':popover-open')||b.height<90||b.top<0||b.bottom>window.innerHeight+1)return false;
      const hit=document.elementFromPoint(first.x+12,first.y+first.height/2);
      return Boolean(hit?.closest('[role="option"]')&&el.contains(hit));
    })).toBe(true);
    await modal.locator('#travel-passport-suggestions-first').evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>undefined)));});
    const opened=await geometry();
    const assertStable=async()=>{const current=await geometry();if(Math.max(...current.map((n,i)=>Math.abs(n-baseline[i])))>1)throw new Error('Passport dropdown changed modal layout or scroll position by more than one pixel');};
    if(Math.max(...opened.map((n,i)=>Math.abs(n-baseline[i])))>1)throw new Error('Passport dropdown changed modal layout or scroll position by more than one pixel');
    await page.waitForTimeout(350);
    await assertStable();
    await page.screenshot({path:`test-results/live-travel-passport-${name}-dropdown.png`});
    const optionScroll = await modal.locator('#travel-passport-suggestions-first')
      .evaluate(element => ({ scroll: element.scrollHeight, visible: element.clientHeight }));
    if (optionScroll.scroll <= optionScroll.visible) throw new Error('Ten sample passport suggestions should scroll independently');
    await modal.locator('#travel-passport-first').press('Escape');
    await expect(options).toHaveCount(0);
    await assertStable();
    await modal.locator('#travel-passport-first').click();
    await expect(options).toHaveCount(10);
    await modal.locator('#travel-passport-suggestions-first').evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>undefined)));});
    await assertStable();
    await options.filter({ hasText: 'TEST230005' }).click();
    await expect(modal.locator('#travel-lookup-first')).toBeEnabled();
    await expect(addPassenger).toHaveCount(0);
    await modal.getByRole('button', { name: 'Check Passport' }).click();
    await expect(addPassenger).toBeEnabled();
    await expect(modal.getByTestId('travel-passenger-name-first')).toHaveText('SAMPLE PASSENGER SIX');
    await expect(modal.getByTestId('travel-passenger-birth-first')).toHaveText('2017-08-10');
    const checkedCard = first.locator('.travel-flow__identity-card');
    const medical = checkedCard.getByTestId('travel-passenger-medical-control');
    await expect(medical).toBeVisible();
    await expect(checkedCard.getByRole('button', {name:'Add passenger', exact:true})).toBeVisible();
    // Medical referral is attached to this passport and cannot be confirmed for online payment.
    await medical.getByRole('checkbox').check();
    await expect(addPassenger).toBeEnabled();
    await addPassenger.click();
    await expect(modal.locator('#travel-passenger-issue-first')).toContainText('medical exemption requires assessment at the departure port');
    await expect(continueToTravel).toBeDisabled();
    await medical.getByRole('checkbox').uncheck();
    await expect(modal.getByTestId('travel-manual-assessment-blocker')).toHaveCount(0);
    await expect(continueToTravel).toBeDisabled();

    // Replacing a checked identity invalidates confirmation until rechecked.
    await modal.locator('#travel-passport-first').fill('TEST230001');
    await expect(addPassenger).toHaveCount(0);
    await expect(modal.getByTestId('travel-passenger-name-first')).toHaveCount(0);
    await modal.getByRole('button', { name: 'Check Passport' }).click();
    await expect(modal.getByTestId('travel-passenger-name-first')).toHaveText('SAMPLE PASSENGER TWO');
    await expect(modal.getByTestId('travel-passenger-birth-first')).toHaveText('1988-11-10');
    await expect(addPassenger).toBeEnabled();

    const inOwnerCard = await addPassenger.evaluate(button => {
      const editor = button.closest('.travel-passenger-workspace__entry');
      const card = button.closest('.travel-flow__identity-card');
      const assessment = card?.querySelector('.travel-passenger-workspace__medical');
      return editor?.getAttribute('data-passenger-id') === 'first' &&
        !!card && !!assessment &&
        !!(assessment.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    if (!inOwnerCard) throw new Error('Add passenger must remain within the checked passenger editor after medical review');
    await addPassenger.click();
    const confirmed = modal.locator('.travel-passenger-workspace__rail .travel-passenger-workspace__person');
    await expect(confirmed).toHaveCount(1);
    await expect(confirmed.first()).toHaveAttribute('data-passenger-id', 'first');
    await expect(confirmed.first()).toHaveAttribute('data-complete', 'true');
    await expect(addPassenger).toHaveCount(0);
    await expect(continueToTravel).toBeEnabled();

    // Confirmed people occupy the rail; a new identity is edited separately.
    await modal.locator('.travel-passenger-workspace__blank')
      .getByRole('button', { name: 'Bangladeshi', exact: true }).click();
    const second = modal.locator('.travel-passenger-workspace__entry');
    const secondId = await second.getAttribute('data-passenger-id');
    if (!secondId || secondId === 'first') throw new Error('A second passenger must have its own stable identity');
    const secondPassport = second.locator('input[role="combobox"]');
    await secondPassport.click();
    const secondOptions = second.locator('.travel-flow__passport-suggestions [role="option"]');
    await expect(secondOptions).toHaveCount(9);
    await expect(secondOptions.filter({ hasText: 'TEST230001' })).toHaveCount(0);
    await secondPassport.fill('TEST230001');
    await expect(second.getByText('Passport already added.', { exact: true })).toBeVisible();
    await expect(continueToTravel).toBeDisabled();
    await modal.locator('.travel-passenger-workspace__editor').getByRole('button', { name: 'Cancel adding' }).click();
    await expect(modal.getByRole('button', { name: 'Remove passenger' })).toHaveCount(0);
    await expect(modal.getByRole('button', { name: 'Undo removal' })).toHaveCount(0);
    await expect(confirmed).toHaveCount(1);
    await expect(modal.locator('.travel-passenger-workspace__entry')).toHaveCount(0);
    await expect(continueToTravel).toBeEnabled();

    await continueToTravel.click();
    await expect(modal.getByRole('button', {name:'Save Draft', exact:true})).toHaveCount(0);
    await expect(modal.locator('.taxpay-modal__title')).toHaveText('Travel Details');
    await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow', '2');
    const modes = modal.locator('#travel-tax-route-results');
    await expect(modes.locator('input[type=radio]')).toHaveCount(2);
    await expect(modes.locator('#travel-tax-route-0')).toBeChecked();
    await expect(modes).toContainText('By land');
    await expect(modes).not.toContainText('স্থলপথে');
    await modal.locator('#travel-port').selectOption('Benapole');
    await modal.locator('#travel-destination').fill('India');
    await modal.locator('#travel-departure-date').fill(new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Dhaka' })
      .format(new Date(Date.now() + 86_400_000)));
    await modal.getByRole('button', { name: 'Continue to review' }).click();
    await expect(modal.locator('.taxpay-modal__title')).toHaveText('Final Preview');
    await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow', '3');
    await expect(modal.locator('.travel-flow__passenger-table tbody tr')).toHaveCount(1);
    await expect(modal.getByTestId('travel-payment-details')).toBeVisible();
    await expect(modal.getByTestId('travel-preview-total')).toContainText('1,000');
    await expect(modal.getByTestId('travel-preview-total-in-words')).toContainText('One Thousand');
    await expect(modal.getByRole('heading',{name:'Payer and receipt details'})).toBeVisible();
    await expect(modal.locator('.travel-flow__passenger-table tfoot')).toHaveCount(0);
    await modal.screenshot({path:`test-results/live-travel-passport-${name}-final-preview.png`,animations:'disabled'});
    const contact = modal.getByTestId('travel-preview-receipt-contact');
    const [contactBounds, phoneBounds] = await Promise.all([
      contact.boundingBox(),
      modal.locator('#travel-mobile').boundingBox(),
    ]);
    if (!contactBounds || !phoneBounds || phoneBounds.width < .8 * contactBounds.width) {
      throw new Error('Receipt mobile must fill the Final Preview contact field');
    }
    await modal.getByRole('button', { name: 'Make Payment' }).click();
    await expect(modal.getByRole('alert')).toContainText('11-digit receipt mobile number');
    await modal.locator('#travel-mobile').fill('01712345678');
    await modal.getByRole('button', { name: 'Make Payment' }).click();
    await expect(modal.getByTestId('travel-payment-channel-screen')).toBeVisible();
    await modal.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(modal.locator('.taxpay-modal__title')).toHaveText('Final Preview');
    await expect(modal.locator('#travel-mobile')).toHaveValue('01712345678');
    await modal.getByRole('button', { name: 'Edit travel details' }).click();
    await expect(modal.locator('#travel-port')).toHaveValue('Benapole');
    await modal.getByRole('button',{name:'Continue to review'}).click();
    await expect(modal.locator('#travel-mobile')).toHaveValue('01712345678');
    await modal.getByRole('button',{name:'Make Payment'}).click();
    }
    await expect(modal.getByTestId('travel-payment-channel-screen')).toBeVisible();
    await expect(modal.getByTestId('travel-payment-channel-screen').locator('.unified-v5-review-total')).toHaveCount(0);
    await modal.getByRole('button',{name:tr('Pay online','অনলাইনে পরিশোধ')}).click();
    await modal.getByRole('button',{name:tr('Mobile banking','মোবাইল ব্যাংকিং')}).click();
    await modal.getByRole('radio',{name:'Nagad'}).check();
    await modal.getByLabel(tr('I confirm the travel information, all passengers and the combined amount.','ভ্রমণের তথ্য, সকল যাত্রী এবং মোট টাকার পরিমাণ নিশ্চিত করছি।')).check();
    await modal.getByRole('button',{name:tr('Confirm sample payment','নমুনা পেমেন্ট নিশ্চিত করুন')}).click();
    const confirmation = modal.getByTestId('travel-payment-result');
    await expect(confirmation).toBeVisible({timeout:20000});
    await expect(modal.locator('.taxpay-modal__title')).toHaveText(tr('Payment result','পেমেন্টের ফলাফল'));
    await expect(confirmation.getByRole('heading',{name:tr('Payment record saved','পেমেন্ট রেকর্ড সংরক্ষিত')})).toBeVisible();
    await expect(confirmation.locator('.payment-lifecycle__overview')).toContainText(amountText);
    await expect(confirmation.getByTestId('walkin-result-benefits')).toBeVisible();
    await expect(modal.getByTestId('travel-family-challan')).toHaveCount(0);
    await modal.screenshot({path:`test-results/live-travel-passport-${name}-payment-result.png`,animations:'disabled'});
    await confirmation.getByTestId('walkin-challan-action').getByRole('button').first().click();
    await expect(modal.locator('.taxpay-modal__title')).toHaveText(tr('Challan details','চালানের বিবরণ'));
    await expect(modal.getByTestId('travel-family-challan').locator('tbody tr')).toHaveCount(1);
    await expect(modal.getByTestId('travel-family-challan')).toContainText('SAMPLE PASSENGER TWO');
    await expect(modal.getByRole('button',{name:tr('Download','ডাউনলোড'),exact:true})).toBeVisible();
    await expect(modal.getByRole('button',{name:tr('Print receipt','রসিদ প্রিন্ট'),exact:true})).toBeVisible();
    await modal.screenshot({path:`test-results/live-travel-passport-${name}-challan.png`,animations:'disabled'});
    await modal.getByRole('tab',{name:tr('Payment record certificate','পেমেন্ট রেকর্ড সনদ')}).click();
    const certificate = modal.getByTestId('payment-certificate-document');
    await expect(certificate).toBeVisible();
    await expect(modal.locator('.taxpay-modal__title')).toHaveText(tr('Payment record certificate','পেমেন্ট রেকর্ড সনদ'));
    await expect(certificate.getByTestId('payment-certificate-reference')).toContainText('SK-PC-'+fixtureId);
    await expect(certificate.getByTestId('payment-certificate-total')).toContainText(amountText);
    await modal.screenshot({path:`test-results/live-travel-passport-${name}-certificate.png`,animations:'disabled'});
    await modal.getByRole('button',{name:tr('Back to receipt','রসিদে ফিরুন'),exact:true}).click();
    await expect(modal.getByTestId('travel-family-challan')).toBeVisible();
    await modal.getByRole('button',{name:tr('Back to confirmation','পেমেন্টের ফলাফলে ফিরুন'),exact:true}).click();
    await expect(confirmation).toBeVisible();
    expect(posts).toBe(1);
    await expect(modal.getByTestId('travel-office-sync-status')).toHaveCount(0);
    expect(reads).toBeGreaterThanOrEqual(1);
    console.log('PASS: '+name+' deployed Travel Tax preview, payment result, challan and certificate; all financial requests intercepted; no hosted writes');

    if (mobile) {
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 2) throw new Error('Live mobile Travel Tax has horizontal overflow: ' + overflow + 'px');
    }
    // Screenshot at the fully settled animation state, not the initial 240 ms fade.
    await page.screenshot({ path: 'test-results/live-travel-passport-' + name + '.png',
      fullPage: false, animations: 'disabled' });
    await page.close();
  }
  console.log('PASS: production Travel Tax passport lookup, manual medical block, duplicate handling, passenger rail, separate receipt contact and payment channel, EN/BN desktop/mobile responsive bounds, confirmation, challan and certificate (intercepted nonfinancial fixture)');
} finally {
  await browser.close();
}
