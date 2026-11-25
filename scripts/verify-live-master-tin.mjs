import {chromium, expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const requested=process.env.TAXPAY_LIVE_URL;
if(!requested)throw new Error('TAXPAY_LIVE_URL is required');
const base=new URL(requested);
if(base.protocol!=='https:'||base.hostname!=='shihab-tech04.github.io'||!base.pathname.startsWith('/nbr-taxpay/'))
  throw new Error('TIN verification must target real Taxpayer production Pages URL');
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({headless:true});
try {
  for(const [label,width,locale] of [
    ['desktop-en',1280,'en'],['phone-375-en',375,'en'],['phone-320-bn',320,'bn']
  ]) {
    const mobile=width<700;
    const page=await browser.newPage({viewport:{width,height:850},isMobile:mobile,hasTouch:mobile});
    try{
      // Live signed-out readback only: never initiate checkout, alter hosted
      // financial records, or require a synthetic account's authorization.
      await page.route('https://eyqhoavnitkrajvyqvxn.supabase.co/storage/v1/object/public/**',
        route=>route.abort('blockedbyclient'));
      const u=new URL(base);u.searchParams.set('action','landing');u.searchParams.set('lang',locale);
      await page.goto(u.toString(),{waitUntil:'domcontentloaded',timeout:45000});
      await page.locator('.public-benefits__item[data-benefit="payments"]').click();
      const modal=page.getByRole('dialog',{name:locale==='bn'?'কর পরিশোধ':'Pay Tax'});
      await expect(modal).toBeVisible({timeout:20000});
      await modal.getByRole('button',{name:locale==='bn'?'ওয়াক-ইন পেমেন্ট':'Walk-in Payment'}).click();
      const lookup=modal.getByTestId('shared-taxpayer-tin-lookup');
      const boxes=lookup.getByTestId('unified-v5-tin-blocks').locator('span');
      await expect(boxes).toHaveCount(12);
      const search=lookup.getByRole('button',{name:locale==='bn'?'করদাতার টিআইএন অনুসন্ধান':'Search taxpayer TIN'});
      const input=lookup.getByTestId('unified-tin-input');
      // Approved master screenshot omits the extra Clear icon, including
      // after entry; other workflows intentionally retain their Clear action.
      await expect(lookup.getByRole('button',{name:locale==='bn'?'টিআইএন অনুসন্ধান মুছুন':'Clear TIN search'})).toHaveCount(0);
      const magnifier=search.locator('svg');
      await expect(magnifier).toBeVisible();
      await input.fill('33333333333');
      await expect(search).toBeDisabled();
      await expect(search).toHaveCSS('background-color','rgb(245, 246, 248)');
      await expect(search).toHaveCSS('border-top-width','1px');
      await input.fill('333333333333');
      await expect(search).toBeEnabled();
      await expect(magnifier).toBeVisible();
      await expect(search).toHaveCSS('background-color','rgb(255, 255, 255)');
      await expect(search).toHaveCSS('border-top-width','1px');
      await expect(search).toHaveCSS('border-top-color','rgb(184, 200, 215)');

      await page.evaluate(async()=>{await document.fonts.ready});
      const geometry=await lookup.evaluate(root=>{
        const d=root.querySelector('[data-testid="unified-v5-tin-blocks"]');
        const a=root.querySelector('button.taxpayer-tin-lookup__search');
        const seg=Array.from(d?.querySelectorAll('span')??[]);
        const box=d?.getBoundingClientRect(),button=a?.getBoundingClientRect();
        const scroll=root.closest('.taxpay-modal__body');
        return {minCell:Math.min(...seg.map(el=>el.getBoundingClientRect().width)),
          bottom:box?.bottom??0,actionTop:button?.top??0,
          overflow:scroll?scroll.scrollWidth-scroll.clientWidth:0};
      });
      if(width<=420&&(geometry.minCell<20||geometry.actionTop<geometry.bottom-2))
        throw new Error('Live phone TIN slots/Search geometry wrong: '+JSON.stringify({label,geometry}));
      if(geometry.overflow>2)throw new Error('Live TIN modal overflow: '+JSON.stringify({label,geometry}));
      await input.fill('33333333333');await expect(search).toBeDisabled();
      await input.fill('333333333333');await expect(search).toBeEnabled();
      await search.click();
      const result=modal.getByTestId('unified-taxpayer-search-result');
      await expect(result).toBeVisible();
      await expect(result).toContainText(locale==='bn'?'ইউজার 3':'User 3');
      await expect(result).toContainText('333*********');
      await expect(result).not.toContainText('333333333333');
      await expect(result.getByRole('button',{name:/copy|কপি/i})).toHaveCount(0);
      const reveal=result.getByRole('button',{name:locale==='bn'?'টিআইএন দেখুন':'Reveal TIN'});
      await reveal.click();await expect(result).toContainText('333333333333');
      await result.getByRole('button',{name:locale==='bn'?'টিআইএন আড়াল করুন':'Hide TIN'}).click();
      await expect(result).not.toContainText('333333333333');
      await modal.screenshot({path:'test-results/live-master-tin-'+label+'.png'});
      await result.getByRole('button',{name:locale==='bn'?'করদাতা যোগ করুন':'Add taxpayer'}).click();
      await expect(modal.getByTestId('unified-taxpayer-count')).toHaveText('1');
      console.log('PASS: live '+label+' '+JSON.stringify(geometry));
    }finally{await page.close();}
  }
}finally{await browser.close();}
console.log('PASS: live Pages 12-box TIN Search, responsive geometry, EN/BN, mask/reveal, and Add taxpayer');
