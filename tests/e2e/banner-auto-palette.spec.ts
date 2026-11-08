import { expect, test } from '@playwright/test';
import { publishedBannerRows } from './mock-published-banners';
test('published image palettes color heading, body, background and outline independently', async ({page}) => {
  const palette={background_color:'#F6F1FC',heading_color:'#4E327B',body_color:'#4E327B',outline_color:'#4E327B'};
  await page.route('**/rest/v1/taxpay_site_banners**',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify(publishedBannerRows.map((row,i)=>i===3?{...row,...palette}:row)),
  }));
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const width of [1280,390]) {
    await page.setViewportSize({width,height:820});
    await page.goto('/?action=landing');
    const slides=page.locator('.public-hero-carousel__slide');
    await expect(slides).toHaveCount(5);
    const slide=slides.nth(3);
    await expect(slide).toHaveAttribute('data-banner-palette','image');
    await expect(slide).toHaveCSS('background-color','rgb(246, 241, 252)');
    await expect(slide.locator('h2')).toHaveCSS('color','rgb(78, 50, 123)');
    await expect(slide.locator('.citizen-public-hero__copy > p')).toHaveCSS('color','rgb(78, 50, 123)');
    await expect(slide.locator('.citizen-public-primary')).toHaveCSS('border-color','rgb(78, 50, 123)');
    await expect(slides.first()).not.toHaveAttribute('data-banner-palette','image');
  }
});
test('main image theme colors only its background/text and outlined secondary action',async ({page})=>{
  const palette={background_color:'#F8F7EB',heading_color:'#3D451B',body_color:'#38401B',outline_color:'#3D451B'};
  await page.route('**/rest/v1/taxpay_site_banners**',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify(publishedBannerRows.map((row,i)=>i===0?{...row,...palette}:row)),
  }));
  await page.goto('/?action=landing');
  const slide=page.locator('.public-hero-carousel__slide').first();
  await expect(slide).toHaveCSS('background-color','rgb(248, 247, 235)');
  await expect(slide.locator('h1')).toHaveCSS('color','rgb(61, 69, 27)');
  await expect(slide.locator('.public-hero-carousel__travel')).toHaveCSS('border-color','rgb(61, 69, 27)');
  await expect(slide.locator('.citizen-public-primary')).toHaveCSS('background-color','rgb(44, 94, 173)');
});
