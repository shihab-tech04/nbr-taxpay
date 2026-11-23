import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

/**
 * User screenshot regression — 23 Nov 2026, homepage only.
 * Real rendered public Home and shared nav/search/footer geometry.
 * No hosted writes, payment submissions, or synthetic probe elements.
 */
test('Home search, benefit padding and footer remain aligned at real viewport sizes in EN/BN', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1280', 'One exhaustive layout audit across viewports');
  test.setTimeout(180_000);
  const viewports = [
    { width: 320, height: 720 },
    { width: 375, height: 812 },
    { width: 768, height: 900 },
    { width: 1024, height: 900 },
    { width: 1186, height: 1254 },
    { width: 1280, height: 864 },
    { width: 1440, height: 900 },
    { width: 1769, height: 864 },
    { width: 1920, height: 1080 },
  ];
  for (const viewport of viewports) {
    for (const lang of ['en', 'bn'] as const) {
      await page.setViewportSize(viewport);
      await page.goto('/?action=landing&lang=' + lang);
      await expect(page.locator('.public-record-search input')).toBeVisible();
      await expect(page.locator('.public-benefits__grid .public-benefits__item')).toHaveCount(6);
      await page.evaluate(async () => { await document.fonts.ready; });
      const geometry = await page.evaluate(() => {
        const rect = (selector: string) => {
          const el = document.querySelector(selector);
          if (!el) throw new Error('Missing public-home element ' + selector);
          const b = el.getBoundingClientRect();
          return { x:b.x, y:b.y, left:b.left, right:b.right, top:b.top, bottom:b.bottom, width:b.width, height:b.height };
        };
        const pad = (selector: string) => {
          const s = getComputedStyle(document.querySelector(selector)!);
          return { top:parseFloat(s.paddingTop), left:parseFloat(s.paddingLeft) };
        };
        const overlap = (a:{left:number,right:number,top:number,bottom:number}, b:{left:number,right:number,top:number,bottom:number}) =>
          a.left < b.right - 1 && a.right > b.left + 1 &&
          a.top < b.bottom - 1 && a.bottom > b.top + 1;
        const nav = Array.from(document.querySelectorAll('.public-footer__navs > *'))
          .filter(el => getComputedStyle(el).display !== 'none')
          .map(el => {
            const b=el.getBoundingClientRect();
            return {left:b.left,right:b.right,top:b.top,bottom:b.bottom};
          });
        const footerIdentity=rect('.public-footer__identity');
        const footerCopyright=rect('.public-footer__bottom');
        const help=rect('.public-help-launch');
        const footerParts=[...nav,footerIdentity,footerCopyright];
        const footerCollision=footerParts.some((a,i)=>footerParts.some((b,j)=>i<j && overlap(a,b)));
        return {
          rail:rect('.public-information-hub'),
          record:rect('.public-record-discovery'),
          benefits:rect('.public-benefits'),
          footerInner:rect('.public-footer__inner'),
          footerIdentity,
          footerCopyright,
          nav,
          help,
          footerCollision,
          footerHelpCollision: footerParts.some(part=>overlap(part,help)),
          field:rect('.public-record-search'),
          input:rect('.public-record-search input'),
          button:rect('.public-record-search button'),
          searchPadding:pad('.public-record-discovery'),
          benefitsPadding:pad('.public-benefits'),
          horizontalOverflow:document.documentElement.scrollWidth-innerWidth,
          inputSize:parseFloat(getComputedStyle(document.querySelector('.public-record-search input')!).fontSize),
        };
      });
      expect(geometry.horizontalOverflow, JSON.stringify({viewport,lang,geometry})).toBeLessThanOrEqual(2);
      expect(Math.abs(geometry.record.width-geometry.benefits.width)).toBeLessThanOrEqual(2);
      expect(geometry.inputSize).toBe(16);
      expect(geometry.button.width).toBeGreaterThanOrEqual(44);
      expect(geometry.button.height).toBeGreaterThanOrEqual(44);
      expect(geometry.button.right).toBeLessThanOrEqual(geometry.field.right+1);
      expect(geometry.button.left).toBeGreaterThan(geometry.field.left);
      if (viewport.width >= 981) {
        expect(geometry.field.height, JSON.stringify({viewport,lang,geometry})).toBeLessThanOrEqual(54);
        expect(geometry.field.height).toBeGreaterThanOrEqual(50);
        expect(Math.abs(geometry.searchPadding.top-geometry.benefitsPadding.top)).toBeLessThanOrEqual(1);
        expect(Math.abs(geometry.searchPadding.left-geometry.benefitsPadding.left)).toBeLessThanOrEqual(1);
      }
      if (viewport.width >= 1121) {
        // Homepage-only footer retains readable navigation and identity.
        if (viewport.width >= 1400) {
          expect(geometry.help.bottom, JSON.stringify({viewport,lang,geometry})).toBeLessThanOrEqual(geometry.footerInner.top - 8);
        }
        // Neither footer nor Help may visually escape the same page rail.
        expect(geometry.footerInner.left).toBeGreaterThanOrEqual(geometry.rail.left-3);
        expect(geometry.footerInner.right).toBeLessThanOrEqual(geometry.rail.right+3);
        expect(geometry.footerIdentity.left).toBeGreaterThanOrEqual(geometry.rail.left-3);
        expect(geometry.footerCopyright.right).toBeLessThanOrEqual(geometry.rail.right+3);
        expect(geometry.nav.length).toBe(4);
        expect(geometry.footerCollision, JSON.stringify({viewport,lang,geometry})).toBe(false);
        expect(geometry.footerHelpCollision, JSON.stringify({viewport,lang,geometry})).toBe(false);
      }
      if (viewport.width <= 375) {
        await expect(page.locator('.public-footer__mobile-actions')).toBeVisible();
        await expect(page.locator('.public-footer__navs')).toBeHidden();
      }
      // Snapshot the actual browser rendering for before/after review.
      if ((viewport.width === 1769 || viewport.width === 375) && lang === 'en') {
        await mkdir('test-results', {recursive:true});
        await page.screenshot({path:`test-results/home-layout-${viewport.width}-${lang}.png`, fullPage:true});
      }
    }
  }
});
