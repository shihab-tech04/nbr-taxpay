import { expect, test } from '@playwright/test';
import { enterTaxPayService, openLegacyTaxServiceChoice } from './pay-tax-entry-helper';

// Preserve both existing entry routes: SELF always one taxpayer, OTHER may
// include additional recipients after the required TIN lookup/confirmation.
test('walk-in self is single taxpayer while facilitator can add another', async ({ page }) => {
  await page.goto('/?action=landing&lang=en');
  const payment = await openLegacyTaxServiceChoice(page);
  await enterTaxPayService(payment, 'OTHER_TAX', 'SELF');
  const self = payment.getByTestId('other-tax-primary-taxpayer');
  await expect(self).toBeVisible();
  await self.locator('#guest-tin').fill('111111111111');
  await self.locator('.taxpayer-tin-lookup__search').click();
  await expect(self.getByRole('heading', { name: 'Taxpayer Information' })).toHaveCount(0);
  await expect(payment.getByRole('button', { name: 'Add another taxpayer' })).toHaveCount(0);
  await expect(payment.getByTestId('other-tax-taxpayer')).toHaveCount(0);
  await payment.locator('.taxpay-modal__back').click();
  await payment.locator('[data-payer-relationship="OTHER"]').click();
  await payment.locator('.tax-service-choice__actions').getByRole('button', { name: 'Continue', exact: true }).click();
  const other = payment.getByTestId('other-tax-primary-taxpayer');
  await other.locator('#guest-tin').fill('111111111111');
  await other.locator('.taxpayer-tin-lookup__search').click();
  await other.getByRole('button', { name: 'Add taxpayer' }).click();
  await expect(payment.getByRole('button', { name: 'Add another taxpayer' })).toBeVisible();
});

test('walk-in self shows NBR disclaimer only after sample TIN search', async ({ page }) => {
  await page.goto('/?action=landing');
  const payment=await openLegacyTaxServiceChoice(page);
  await enterTaxPayService(payment,'OTHER_TAX','SELF');
  const card=payment.getByTestId('other-tax-primary-taxpayer');
  await expect(card.getByTestId('taxpayer-sample-source')).toHaveCount(0);
  await card.locator('#guest-tin').fill('111111111111');
  await card.getByRole('button',{name:'Search',exact:true}).click();
  await expect(card.locator('#other-tax-primary-name')).toHaveValue('User 1');
  await expect(card.getByTestId('taxpayer-sample-source')).toContainText('Sample only — not NBR verified.');
  await card.getByRole('button',{name:'Clear TIN search'}).click();
  await expect(card.getByTestId('taxpayer-sample-source')).toHaveCount(0);
});

test('signed-in self has no saved beneficiary or additional taxpayer controls', async ({ page }) => {
  await page.goto('/?action=taxpayer_login');
  const login = page.getByRole('dialog', { name: 'Sign In To Your Sohojkor Account' });
  await login.getByRole('textbox', { name: 'User ID' }).fill('user1');
  await login.getByLabel('Password', { exact: true }).fill('user1');
  await login.getByRole('button', { name: 'Sign In' }).click();
  await page.goto('/?action=landing&lang=en');
  const payment = await openLegacyTaxServiceChoice(page);
  await enterTaxPayService(payment, 'OTHER_TAX', 'SELF');
  await expect(payment.locator('#signed-in-account-taxpayer-card')).toBeVisible();
  await expect(payment.getByTestId('self-payment-add-beneficiaries')).toHaveCount(0);
  await expect(payment.getByTestId('saved-beneficiary-picker')).toHaveCount(0);
  await expect(payment.getByRole('button', { name: 'Add another taxpayer' })).toHaveCount(0);
});


test('taxpayer TIN and name fields use the full card width in SELF and OTHER paths', async ({ page }) => {
  await page.goto('/?action=landing&lang=en');
  const payment = await openLegacyTaxServiceChoice(page);
  await enterTaxPayService(payment, 'OTHER_TAX', 'SELF');
  const assertFullWidth = async (card: ReturnType<typeof payment.getByTestId>) => {
    const sizes = await card.evaluate(node => {
      const row = node.querySelector<HTMLElement>('.taxpay-taxpayer-row__fields');
      const lookup = node.querySelector<HTMLElement>('.taxpayer-tin-lookup');
      const search = node.querySelector<HTMLElement>('.taxpayer-tin-lookup__search-row');
      const name = node.querySelector<HTMLElement>('.taxpayer-tin-lookup__field input[id*="name"]');
      if (!row || !lookup || !search || !name) return null;
      return { row: row.getBoundingClientRect().width, lookup: lookup.getBoundingClientRect().width,
        search: search.getBoundingClientRect().width, name: name.getBoundingClientRect().width };
    });
    expect(sizes).not.toBeNull();
    expect(sizes!.lookup).toBeGreaterThan(sizes!.row * .94);
    expect(sizes!.search).toBeGreaterThan(sizes!.lookup * .94);
    expect(sizes!.name).toBeGreaterThan(sizes!.lookup * .94);
  };
  await assertFullWidth(payment.getByTestId('other-tax-primary-taxpayer'));
  const emailWidths = await payment.locator('.payment-identity__receipt-row').first().evaluate(node => {
    const email = node.querySelector<HTMLElement>('#guest-receipt-email');
    return email ? { row: node.getBoundingClientRect().width, email: email.getBoundingClientRect().width } : null;
  });
  expect(emailWidths).not.toBeNull();
  expect(emailWidths!.email).toBeGreaterThan(emailWidths!.row * .94);
  await payment.locator('.taxpay-modal__back').click();
  await payment.locator('[data-payer-relationship="OTHER"]').click();
  await payment.locator('.tax-service-choice__actions').getByRole('button', { name: 'Continue', exact: true }).click();
  const primary = payment.getByTestId('other-tax-primary-taxpayer');
  await assertFullWidth(primary);
  await primary.locator('#guest-tin').fill('111111111111');
  await primary.locator('.taxpayer-tin-lookup__search').click();
  await primary.getByRole('button', { name: 'Add taxpayer' }).click();
  await payment.getByRole('button', { name: 'Add another taxpayer' }).click();
  const additional = payment.getByTestId('other-tax-taxpayer');
  await assertFullWidth(additional);
});

// CSS regression gate: TIN / search / name share the full editor width,
// while contact fields stack at desktop and mobile for both payer contexts.
test('walk-in self identity inputs fill editor column without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({width:1280,height:850});
  await page.goto('/?action=landing');
  const payment=await openLegacyTaxServiceChoice(page);
  await enterTaxPayService(payment,'OTHER_TAX','SELF');
  const row=payment.getByTestId('other-tax-primary-taxpayer');
  const lookup=row.getByTestId('shared-taxpayer-tin-lookup');
  const field=lookup.locator('.taxpayer-tin-lookup__field').first();
  const input=row.locator('#guest-tin');
  const search=lookup.locator('.taxpayer-tin-lookup__search');
  const form=payment.locator('.payment-flow-embedded__identity .payment-form-layout__sections');
  for (const width of [1280,375,320]) {
    await page.setViewportSize({width,height:850});
    await expect(input).toBeVisible();
    const metrics=await page.evaluate(({formSelector,inputSelector,searchSelector,fieldSelector})=>{
      const f=document.querySelector(formSelector),i=document.querySelector(inputSelector),s=document.querySelector(searchSelector),fld=document.querySelector(fieldSelector);
      if(!f||!i||!s||!fld)return null;
      const fr=f.getBoundingClientRect(),ir=i.getBoundingClientRect(),sr=s.getBoundingClientRect(),fl=fld.getBoundingClientRect();
      return {formWidth:fr.width,fieldWidth:fl.width,occupied:ir.width+sr.width,buttonWidth:sr.width,fieldOverflow:Math.max(0,sr.right-fl.right),editorOverflow:Math.max(0,fl.right-fr.right)};
    },{formSelector:'.payment-flow-embedded__identity .payment-form-layout__sections',inputSelector:'#guest-tin',searchSelector:'.taxpayer-tin-lookup__search',fieldSelector:'.taxpay-taxpayer-row--single .taxpayer-tin-lookup__field'});
    expect(metrics).not.toBeNull();
    expect(metrics!.fieldWidth).toBeGreaterThan(width===1280?300:150);
    expect(metrics!.buttonWidth).toBeGreaterThanOrEqual(80);
    expect(metrics!.fieldOverflow).toBeLessThanOrEqual(2);
    expect(metrics!.editorOverflow).toBeLessThanOrEqual(2);
  }
  await expect(field).toBeVisible();
  await expect(search).toBeVisible();
  await expect(form).toBeVisible();
});

test('walk-in facilitator receipt fields are full editor width and ordered', async ({page}) => {
  await page.goto('/?action=landing');
  const payment=await openLegacyTaxServiceChoice(page);
  await enterTaxPayService(payment,'OTHER_TAX','OTHER');
  for(const width of [1280,375,320]){
    await page.setViewportSize({width,height:850});
    const fields=payment.locator('.payment-flow-embedded__identity .payment-identity__receipt-row');
    await expect(fields).toBeVisible();
    const m=await fields.evaluate(el=>{
      const row=el.getBoundingClientRect();
      const inputs=[...el.querySelectorAll('input')].filter(x=>x.getClientRects().length);
      return {row:row.width,fields:inputs.map(x=>({width:x.getBoundingClientRect().width,cellWidth:x.parentElement!.getBoundingClientRect().width,right:x.getBoundingClientRect().right,top:x.getBoundingClientRect().top}))};
    });
    expect(m.fields.length).toBeGreaterThanOrEqual(3);
    for(const f of m.fields){
      expect(Math.abs(f.width-f.cellWidth)).toBeLessThanOrEqual(2);
      expect(f.right).toBeLessThanOrEqual(width+2);
    }
    if(width<=650){
      for(const f of m.fields)expect(f.width).toBeGreaterThan(m.row-3);
      expect(m.fields[1].top).toBeGreaterThan(m.fields[0].top);
    }
  }
});
