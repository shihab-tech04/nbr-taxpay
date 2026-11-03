import {expect,test} from '@playwright/test';
import {ROUTES} from '../../src/services/routeContract';

const allowedRoutes = new Set<string>(ROUTES);

test('public citizen shell uses shared fonts and active links have registered destinations', async ({page}) => {
  await page.goto('/?action=landing');
  const shell = page.locator('.taxpay-citizen-shell');
  await expect(shell).toBeVisible();
  expect(await shell.evaluate(element => getComputedStyle(element).fontFamily)).toContain('Poppins');
  const links = await page.locator('a[href]').evaluateAll(anchors => anchors.map(anchor => ({
    text: anchor.getAttribute('aria-label') || anchor.textContent?.trim(),
    href: anchor.getAttribute('href') || ''
  })));
  for (const link of links) {
    expect(link.href.trim(), `Empty link: ${link.text}`).not.toBe('');
    expect(link.href, `Inert link: ${link.text}`).not.toBe('#');
    const target = new URL(link.href, page.url());
    const action = target.searchParams.get('action');
    if (action) expect(allowedRoutes.has(action), `Unregistered link: ${link.href}`).toBe(true);
  }
});

test('User1 dashboard uses vector meters with variable geometry and no inline CSS',async ({page}) => {
  await page.goto('/?action=taxpayer_home&demoUser=user1');
  const dashboard = page.getByTestId('user1-synthetic-workspace');
  await expect(dashboard).toBeVisible();
  const donut = dashboard.locator('.ui-metric-donut').first();
  await expect(donut).toBeVisible();
  await expect(donut.locator('circle')).toHaveCount(5);
  const segmentAttributes = await donut.locator('circle:not(.ui-metric-donut__track)').evaluateAll(nodes =>
    nodes.map(node => ({array:node.getAttribute('stroke-dasharray'), offset:node.getAttribute('stroke-dashoffset')})));
  expect(segmentAttributes.every(item => item.array?.includes(' '))).toBe(true);
  await expect(dashboard.locator('.ui-metric-stack')).toBeVisible();
  expect(await dashboard.locator('[style]').count()).toBe(0);
});

test('shared payment stepper has accessible, dynamic SVG progress',async ({page}) => {
  await page.goto('/?action=landing');
  await page.getByRole('button',{name:'Pay Tax',exact:true}).click();
  const dialog = page.getByRole('dialog',{name:'Pay Tax'});
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-payer-relationship="SELF"]').click();
  await dialog.locator('[data-payment-entry="OTHER_TAX"]').click();
  await dialog.locator('[data-payment-access="GUEST"]').click();
  await dialog.getByRole('button',{name:'Continue',exact:true}).click();
  const progress = dialog.getByRole('progressbar',{name:'Payment progress'});
  await expect(progress).toHaveAttribute('aria-valuenow','1');
  await expect(progress).toHaveAttribute('aria-valuemax','4');
  const fill = progress.locator('svg.ui-metric-bar rect');
  await expect(fill).toHaveAttribute('width','25');
  expect(await dialog.locator('[style]').count()).toBe(0);
});
