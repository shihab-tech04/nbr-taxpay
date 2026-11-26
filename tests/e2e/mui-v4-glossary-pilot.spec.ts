import {expect,test} from '@playwright/test';
import {mockPublishedBannerCms} from './mock-published-banners';

test('MUI glossary uses real scoped Material UI controls, retains native form semantics and focus',async({page})=>{
  await page.goto('/?action=glossary&lang=en');
  const region=page.locator('[data-mui-citizen-region="glossary"]');
  await expect(region).toBeVisible();
  const search=region.getByRole('searchbox',{name:'Search terms'});
  const topic=region.getByRole('combobox',{name:'Topic'});
  await expect(search).toHaveClass(/MuiInputBase-input/);
  await expect(topic).toHaveClass(/MuiNativeSelect-select/);
  await search.fill('e-TIN');
  await expect(region.getByRole('heading',{name:'Taxpayer Identification Number'})).toBeVisible();
  await expect(region.getByRole('button',{name:'Clear search'})).toHaveClass(/MuiIconButton-root/);
  await topic.selectOption('PAYMENT');
  const clear=region.getByRole('button',{name:'Clear filters'});
  await expect(clear).toHaveClass(/MuiButton-root/);
  await clear.click();
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('');
  await expect(topic).toHaveValue('ALL');
  await search.fill('no-such-term-xyz');
  await expect(region.getByRole('status')).toContainText('No terms match');
  await clear.press('Enter');
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('');
  await page.goto('/?action=glossary&lang=bn');
  await region.getByRole('searchbox',{name:'শব্দ খুঁজুন'}).fill('রসিদ');
  await expect(region.getByRole('heading',{name:'Payment Receipt'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});

test('MUI pilot is never rendered on any protected homepage',async({page})=>{
  await mockPublishedBannerCms(page);
  for(const action of ['landing','home-2','home-3']){
    await page.goto('/?action='+action+'&lang=en');
    const root=action==='home-2'?'[data-testid="home2-root"]':action==='home-3'?'[data-testid="home3-root"]':'.public-record-discovery';
    await expect(page.locator(root)).toBeVisible();
    await expect(page.locator('[data-mui-citizen-region], .MuiButton-root, .MuiInputBase-root')).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  }
});
