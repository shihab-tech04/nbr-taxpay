import {test,expect,type Locator} from '@playwright/test';
import {enterTaxPayService} from './pay-tax-entry-helper';

async function paired(dialog:Locator){
  const fields=['#guest-payer-name','#guest-phone','#guest-receipt-email','#guest-notice-ref'];
  const bounds=await Promise.all(fields.map(id=>dialog.locator(id).locator('..').boundingBox()));
  for(const box of bounds)expect(box).not.toBeNull();
  expect(Math.abs(bounds[0]!.y-bounds[1]!.y)).toBeLessThanOrEqual(3);
  expect(Math.abs(bounds[2]!.y-bounds[3]!.y)).toBeLessThanOrEqual(3);
  expect(bounds[0]!.x).toBeLessThan(bounds[1]!.x);
  expect(bounds[2]!.x).toBeLessThan(bounds[3]!.x);
  expect(bounds[2]!.y).toBeGreaterThan(bounds[0]!.y+30);
}

test('guest Other Tax pairs payer and receipt contacts; email stays optional',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280');
  await page.goto('/');
  await page.getByRole('button',{name:'Pay Tax',exact:true}).click();
  const modal=page.getByRole('dialog',{name:'Pay Tax'});
  await enterTaxPayService(modal,'OTHER_TAX_PAYMENT','OTHER');
  const name=modal.locator('#guest-payer-name');
  const phone=modal.locator('#guest-phone');
  const email=modal.locator('#guest-receipt-email');
  const reference=modal.locator('#guest-notice-ref');
  for(const input of [name,phone,email,reference])await expect(input).toBeVisible();
  await expect(email).not.toHaveAttribute('required','');
  await paired(modal);
  await email.fill('not-an-address');
  await expect(email).toHaveAttribute('aria-invalid','true');
  await email.fill(' payer+receipt@example.com ');
  await expect(email).not.toHaveAttribute('aria-invalid','true');
  await email.fill('');
  await expect(email).not.toHaveAttribute('aria-invalid','true');
  await page.setViewportSize({width:375,height:812});
  const bounds=await Promise.all([name,phone,email,reference].map(input=>input.locator('..').boundingBox()));
  for(let i=1;i<bounds.length;i++)expect(bounds[i]!.y).toBeGreaterThan(bounds[i-1]!.y);
  expect(await modal.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(2);
});

test('guest Tax with Return uses the same four contact fields',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280');
  await page.goto('/');
  await page.getByRole('button',{name:'Pay Tax',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Pay Tax'});
  await enterTaxPayService(dialog,'TAX_WITH_RETURN','OTHER');
  await expect(dialog.locator('#guest-receipt-email')).toBeVisible();
  await paired(dialog);
});
