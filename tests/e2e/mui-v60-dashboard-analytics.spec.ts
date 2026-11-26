import {expect,test} from '@playwright/test';
async function verifyPaperParity(el:import('@playwright/test').Locator){
 await expect(el).toBeVisible();
 await expect(el).toHaveClass(/MuiPaper-root/);
 const result=await el.evaluate(node=>{
  const native=document.createElement('section');
  for(const a of Array.from(node.attributes))if(!['class','style','data-mui-coverage'].includes(a.name))native.setAttribute(a.name,a.value);
  native.className=Array.from(node.classList).filter(c=>!c.startsWith('Mui')&&!c.startsWith('css-')).join(' ');
  for(const child of Array.from(node.childNodes))native.append(child.cloneNode(true));
  const metrics=(e:Element)=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {tag:e.tagName,width:r.width,height:r.height,color:s.color,bg:s.backgroundColor,radius:s.borderTopLeftRadius,border:s.borderTopWidth,padding:s.paddingTop,shadow:s.boxShadow,display:s.display,gap:s.gap};};
  const actual=metrics(node);node.replaceWith(native);const original=metrics(native);native.replaceWith(node);return {actual,original};
 });
 expect(result.actual).toEqual(result.original);
}

for(const language of ['en','bn'] as const){
 test('scoped dashboard analytics MUI actions preserve selection and navigation '+language,async({page})=>{
  const bn=language==='bn',tr=(en:string,bengali:string)=>bn?bengali:en;
  await page.goto('/?action=taxpayer_home&demoUser=user1&qaScenario=1&lang='+language);
  await page.getByRole('combobox',{name:tr('Assessment year','করবর্ষ')}).selectOption('2025-2026');
  const analytics=page.getByTestId('dashboard-payment-analytics');
  await expect(analytics).toBeVisible();
  const site=(id:string)=>analytics.locator('[data-mui-coverage="MUI-ANALYTICS-'+id+'"]');
  const examples=site('SOURCE-EXAMPLE');
  await expect(examples).toHaveClass(/MuiButtonBase-root/);
  await examples.focus();await examples.press('Enter');
  await expect(examples).toHaveAttribute('aria-pressed','true');
  const advanced=analytics.getByTestId('dashboard-recipient-advanced');
  await advanced.locator('summary').click();
  await site('VIEW-TAGS').click();
  const tag=site('TAG-BAR').first();
  await expect(tag).toBeVisible();
  await expect(tag).toHaveClass(/MuiButtonBase-root/);
  await tag.focus();await tag.press('Space');
  await expect(tag).toHaveAttribute('aria-pressed','true');
  await site('RESET-FILTERS').click();
  await expect(tag).toHaveAttribute('aria-pressed','false');
  await site('VIEW-TOP').click();
  const select=site('RELATION-FILTER').locator('select');
  await expect(select).toHaveClass(/MuiNativeSelect-select/);
  await select.selectOption('all');
  await expect(site('TOP-FILTERED').first()).toBeVisible();
  await expect(site('TOP-FILTERED').first()).toHaveClass(/MuiButtonBase-root/);
  await analytics.getByTestId('dashboard-payment-extra').locator('summary').click();
  for(const id of ['BENEFICIARY','RANKING','SERVICE','ROLES'])await verifyPaperParity(site('PAPER-'+id));
  const service=site('SERVICE-BAR').first();
  await expect(service).toBeVisible();
  await service.click();
  await expect(service).toHaveAttribute('aria-pressed','true');
  await site('CLEAR-SERVICE').click();
  await expect(service).toHaveAttribute('aria-pressed','false');
  await expect(analytics.locator('button:not(.MuiButtonBase-root)')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  await site('SOURCE-RECORDED').click();
  await expect(analytics).toHaveAttribute('data-chart-source','recorded');
  await expect(analytics).not.toContainText('113,500');
 });
}
