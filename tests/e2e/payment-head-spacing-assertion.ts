import { expect, type Locator } from '@playwright/test';

export async function expectTaxHeadSpacing(editor: Locator) {
  const head = editor.locator('.unified-v5-tax-head-heading');
  const status = editor.locator('.other-tax-selection-status');
  const category = editor.locator('.other-tax-category-heading');
  const catalogue = editor.getByTestId('other-tax-head-catalogue');
  for (const element of [head, status, category, catalogue]) await expect(element).toBeVisible();
  await expect.poll(async () => {
    const [a,b,c,d] = await Promise.all([head,status,category,catalogue].map(element => element.boundingBox()));
    if (!a || !b || !c || !d) return Infinity;
    return Math.max(Math.abs(b.y-a.y-a.height-8), Math.abs(c.y-b.y-b.height-16), Math.abs(d.y-c.y-c.height-12));
  }, {message:'Shared Payment Head directory has 8/16/12px vertical spacing'}).toBeLessThanOrEqual(2);
  await expect(catalogue).toHaveCSS('row-gap','6px');
}
