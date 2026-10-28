import { expect, test } from '@playwright/test';

test('search uses the established icon-free section heading and concise single-line help', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/?action=landing');
  const section = page.getByRole('region', { name: 'Find a payment record' });
  const heading = section.getByRole('heading', { name: 'Find a payment record' });
  const description = section.getByText('Search by challan, token or transaction reference.');
  await expect(heading).toBeVisible();
  await expect(description).toBeVisible();
  await expect(section.locator('.public-record-discovery__heading svg')).toHaveCount(0);
  await expect(section.getByText(/For guest-payment records/)).toHaveCount(0);
  const descriptionLines = await description.evaluate(node => {
    const style = getComputedStyle(node);
    return node.getBoundingClientRect().height / parseFloat(style.lineHeight);
  });
  expect(descriptionLines).toBeLessThan(1.2);
  const search = page.getByRole('searchbox', { name: 'Search payment records by reference' });
  await search.click();
  await expect(page.locator('.public-record-suggestions')).toHaveCount(0);
});

test('typing shows a clean, in-flow two-part suggestion list with demo-only references', async ({ page }) => {
  await page.goto('/?action=landing');
  const section = page.getByRole('region', { name: 'Find a payment record' });
  const search = page.getByRole('searchbox', { name: 'Search payment records by reference' });
  await search.fill('DEMO-REF-001');
  await expect(section.getByRole('heading', { name: 'Matching sample references' })).toBeVisible();
  await expect(section.getByRole('heading', { name: 'Sample references (demo only)' })).toBeVisible();
  await expect(section.getByRole('option', { name: /AC-2025-09-DEMO-REF-001/ })).toBeVisible();
  await expect(section.getByRole('link', { name: /Try sample reference: AC-2025-09-DEMO-REF-001/ })).toBeVisible();
  const geometry = await section.evaluate(element => {
    const dropdown = element.querySelector<HTMLElement>('.public-record-suggestions')!;
    const searchField = element.querySelector<HTMLElement>('.public-record-search')!;
    const rect = dropdown.getBoundingClientRect();
    return {
      position: getComputedStyle(dropdown).position,
      shadow: getComputedStyle(dropdown).boxShadow,
      belowField: rect.top >= searchField.getBoundingClientRect().bottom,
      sectionContainsDropdown: element.getBoundingClientRect().bottom >= rect.bottom,
    };
  });
  expect(geometry).toEqual({ position: 'static', shadow: 'none', belowField: true, sectionContainsDropdown: true });
  await search.fill('not-a-real-reference');
  await expect(section.getByText(/No matching samples/)).toBeVisible();
  await expect(section.getByRole('link', { name: /Try sample reference/ }).first()).toBeVisible();
  await expect(section.getByRole('button', { name: 'Search records' })).toBeEnabled();
});

test('keyboard can select a matching synthetic reference without leaking it into URL', async ({ page }) => {
  await page.goto('/?action=landing');
  const search = page.getByRole('searchbox', { name: 'Search payment records by reference' });
  await search.fill('TKN-882190');
  await search.press('ArrowDown');
  await expect(search).toHaveAttribute('aria-activedescendant', 'public-search-option-0');
  await search.press('Enter');
  await expect(page).toHaveURL(/action=verify/);
  expect(page.url()).not.toContain('TKN-882190');
  await expect(page.getByRole('textbox', { name: /Challan, token or transaction reference/ })).toHaveValue('TKN-882190');
});

test('sample links use the existing receipt lookup without URL reference exposure', async ({ page }) => {
  await page.goto('/?action=landing');
  await page.getByRole('searchbox', { name: 'Search payment records by reference' }).fill('DEMO');
  await page.getByRole('link', { name: /Try sample reference: AC-2025-06-DEMO-REF-003/ }).click();
  await expect(page).toHaveURL(/action=verify/);
  expect(page.url()).not.toContain('DEMO-REF');
  await expect(page.getByRole('textbox', { name: /Challan, token or transaction reference/ })).toHaveValue('AC-2025-06-DEMO-REF-003');
});

test('suggestions close on Escape or outside click, and translate cleanly into Bangla', async ({ page }) => {
  await page.goto('/?action=landing');
  const search = page.getByRole('searchbox', { name: 'Search payment records by reference' });
  await search.fill('DEMO');
  await expect(page.locator('.public-record-suggestions')).toBeVisible();
  await search.press('Escape');
  await expect(page.locator('.public-record-suggestions')).toHaveCount(0);
  await search.click();
  await page.getByRole('heading', { name: 'Find a payment record' }).click();
  await expect(page.locator('.public-record-suggestions')).toHaveCount(0);
  await page.getByRole('button', { name: 'বাংলা' }).click();
  await expect(page.getByRole('heading', { name: 'পেমেন্ট রেকর্ড খুঁজুন' })).toBeVisible();
  await page.getByRole('searchbox', { name: 'রেফারেন্স দিয়ে পেমেন্ট রেকর্ড খুঁজুন' }).fill('DEMO');
  await expect(page.getByRole('heading', { name: 'নমুনা রেফারেন্স (শুধু ডেমো)' })).toBeVisible();
});

test('dropdown pushes later sections down without horizontal overflow on narrow screens', async ({ page }) => {
  for (const width of [320, 375, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 820 });
    await page.goto('/?action=landing');
    await page.getByRole('searchbox', { name: 'Search payment records by reference' }).fill('DEMO');
    const geometry = await page.evaluate(() => {
      const section = document.querySelector<HTMLElement>('.public-record-discovery')!;
      const dropdown = document.querySelector<HTMLElement>('.public-record-suggestions')!;
      const following = document.querySelector<HTMLElement>('#public-how-it-works')!;
      const bounds = dropdown.getBoundingClientRect();
      return {
        left: bounds.left, right: bounds.right,
        viewportWidth: innerWidth,
        pageWidth: document.documentElement.scrollWidth,
        noOverlap: following.getBoundingClientRect().top >= section.getBoundingClientRect().bottom,
      };
    });
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expect(geometry.noOverlap).toBe(true);
  }
});
