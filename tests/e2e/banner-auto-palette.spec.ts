import { expect, test } from '@playwright/test';
import { publishedBannerRows } from './mock-published-banners';
test('image palette overrides mismatched built-in service heading as in Office preview', async ({page}) => {
  const palette={background_color:'#F6F1FC',heading_color:'#4E327B',body_color:'#4E327B',outline_color:'#4E327B'};
  await page.route('**/rest/v1/taxpay_site_banners**',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify(publishedBannerRows.map((row,i)=>i===1?{...row,...palette}:row)),
  }));
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const width of [1280,390]) {
    await page.setViewportSize({width,height:820});
    await page.goto('/?action=landing');
    const slides=page.locator('.public-hero-carousel__slide');
    await expect(slides).toHaveCount(5);
    const slide=slides.nth(1);
    await expect(slide).toHaveAttribute('data-banner-palette','image');
    await expect(slide).toHaveCSS('background-color','rgb(246, 241, 252)');
    await expect(slide.locator('h2')).toHaveCSS('color','rgb(78, 50, 123)');
    await expect(slide.locator('.citizen-public-hero__copy > p')).toHaveCSS('color','rgb(78, 50, 123)');
    await expect(slide.locator('.public-hero-carousel__travel')).toHaveCSS('border-color','rgb(78, 50, 123)');
    await expect(slide.locator('.citizen-public-primary')).toHaveCSS('background-color','rgb(44, 94, 173)');
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

// Every service needs its SQL-published color, not a baked-in brand token.
// Distinct hues from defaults prevent a false-positive like purple-on-purple.
test('all service headings, descriptions and outlines respect different Office colors', async ({page})=>{
  const colors=[
    {background_color:'#F6F1FC',heading_color:'#4E327B',body_color:'#604979',outline_color:'#69458A'},
    {background_color:'#EFF7F4',heading_color:'#185A43',body_color:'#245B4B',outline_color:'#24664E'},
    {background_color:'#F9F5EC',heading_color:'#70430E',body_color:'#694C23',outline_color:'#805018'},
    {background_color:'#FFF1F3',heading_color:'#842B48',body_color:'#7D3850',outline_color:'#8C3452'},
  ];
  await page.route('**/rest/v1/taxpay_site_banners**',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify(publishedBannerRows.map((row,i)=>i>0?{...row,...colors[i-1]}:row)),
  }));
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const width of [1280,320]) {
    await page.setViewportSize({width,height:820});
    await page.goto('/?action=landing');
    const slides=page.locator('.public-hero-carousel__slide');
    await expect(slides).toHaveCount(5);
    for(let i=1;i<=4;i++) {
      const palette=colors[i-1],slide=slides.nth(i);
      const rgb=(hex:string)=>'rgb('+[1,3,5].map(k=>parseInt(hex.slice(k,k+2),16)).join(', ')+')';
      await expect(slide).toHaveAttribute('data-banner-palette','image');
      await expect(slide).toHaveCSS('background-color',rgb(palette.background_color));
      await expect(slide.locator('h2')).toHaveCSS('color',rgb(palette.heading_color));
      await expect(slide.locator('.citizen-public-hero__copy > p')).toHaveCSS('color',rgb(palette.body_color));
      await expect(slide.locator('.public-hero-carousel__travel')).toHaveCSS('color',rgb(palette.outline_color));
      await expect(slide.locator('.public-hero-carousel__travel')).toHaveCSS('border-color',rgb(palette.outline_color));
      await expect(slide.locator('.citizen-public-primary')).toHaveCSS('background-color','rgb(44, 94, 173)');
      await expect(slide.locator('img')).toHaveCSS('object-fit','contain');
    }
  }
});

test('active service frame and keyboard focus use the Office outline accent', async ({page}) => {
  const palette={background_color:'#F1F6FA',heading_color:'#234868',
    body_color:'#375977',outline_color:'#265D79'};
  await page.route('**/rest/v1/taxpay_site_banners**',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify(publishedBannerRows.map((row,i)=>i===1?{...row,...palette}:row)),
  }));
  await page.goto('/?action=landing');
  const carousel=page.getByRole('region',{name:'Tax payment service banners'});
  await carousel.focus();
  await page.keyboard.press('ArrowRight');
  await expect(carousel).toHaveAttribute('data-active-slide','1');
  await expect(carousel).toHaveAttribute('data-active-palette','image');
  await expect(carousel).toHaveCSS('border-color','rgb(38, 93, 121)');
  const action=carousel.locator('.public-hero-carousel__slide').nth(1).locator('.citizen-public-primary');
  await action.focus();
  await expect(action).toHaveCSS('outline-color','rgb(38, 93, 121)');
  await carousel.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(carousel).not.toHaveAttribute('data-active-palette','image');
});
