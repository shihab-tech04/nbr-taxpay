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

test('typing opens a clean floating dropdown without changing the card height', async ({ page }) => {
  await page.goto('/?action=landing');
  const section = page.getByRole('region', { name: 'Find a payment record' });
  const search = page.getByRole('searchbox', { name: 'Search payment records by reference' });
  const cardHeightBefore = await section.evaluate(element => element.getBoundingClientRect().height);
  const nextGapBefore = await page.evaluate(() => {
    const card = document.querySelector('.public-record-discovery')!.getBoundingClientRect();
    const next = document.querySelector('#public-how-it-works')!.getBoundingClientRect();
    return next.top - card.bottom;
  });
  await search.fill('DEMO-REF-001');
  await expect(section.getByRole('heading', { name: 'Matching references' })).toBeVisible();
  await expect(section.locator('.public-record-suggestions__examples')).toHaveCount(0);
  await expect(section.getByRole('button', { name: /AC-2025-09-DEMO-REF-001/ })).toBeVisible();
  await expect(section.getByRole('button', { name: /AC-2025-09-DEMO-REF-001/ })).toBeVisible();
  const geometry = await section.evaluate(element => {
    const dropdown = element.querySelector<HTMLElement>('.public-record-suggestions')!;
    const searchField = element.querySelector<HTMLElement>('.public-record-search')!;
    const rect = dropdown.getBoundingClientRect();
    return {
      position: getComputedStyle(dropdown).position,
      shadow: getComputedStyle(dropdown).boxShadow,
      belowField: rect.top >= searchField.getBoundingClientRect().bottom,
      cardHeight: element.getBoundingClientRect().height,
      dropdownOutsideCard: rect.bottom > element.getBoundingClientRect().bottom,
      nextGap: document.querySelector('#public-how-it-works')!.getBoundingClientRect().top - element.getBoundingClientRect().bottom,
    };
  });
  expect(geometry.position).toBe('absolute');
  expect(geometry.belowField).toBe(true);
  expect(geometry.dropdownOutsideCard).toBe(true);
  expect(Math.abs(geometry.cardHeight - cardHeightBefore)).toBeLessThan(2);
  expect(Math.abs(geometry.nextGap - nextGapBefore)).toBeLessThan(2);
  const resultOption = section.getByRole('button', { name: /AC-2025-09-DEMO-REF-001/ });
  await expect(resultOption).toHaveCSS('text-decoration-line', 'none');
  await resultOption.focus();
  await expect(resultOption).toBeFocused();
  await search.fill('not-a-real-reference');
  await expect(section.getByText(/No matching references/)).toBeVisible();
  await expect(section.locator('.public-record-suggestions__examples')).toHaveCount(0);
  await expect(section.getByRole('button', { name: 'Search records' })).toBeEnabled();
});

test('keyboard can select a matching synthetic reference without leaking it into URL', async ({ page }) => {
  await page.goto('/?action=landing');
  const search = page.getByRole('searchbox', { name: 'Search payment records by reference' });
  await search.fill('TKN-882190');
  await search.press('ArrowDown');
  await expect(page.locator('#public-search-option-0')).toHaveClass(/is-active/);
  await search.press('Enter');
  await expect(page).toHaveURL(/action=verify/);
  expect(page.url()).not.toContain('TKN-882190');
  await expect(page.getByRole('dialog', { name: 'Payment status & receipt' }).locator('.receipt-view--embedded')).toContainText('TKN-882190');
});

test('matching reference opens the receipt modal without exposing the reference in the URL', async ({ page }) => {
  await page.goto('/?action=landing');
  await page.getByRole('searchbox', { name: 'Search payment records by reference' }).fill('DEMO-REF-003');
  await page.getByRole('button', { name: /AC-2025-06-DEMO-REF-003/ }).click();
  await expect(page).toHaveURL(/action=verify/);
  expect(page.url()).not.toContain('DEMO-REF');
  const modal = page.getByRole('dialog', { name: 'Payment status & receipt' });
  await expect(modal.locator('.receipt-view--embedded')).toContainText('AC-2025-06-DEMO-REF-003');
  await expect(modal.getByRole('button', { name: 'Back to search' })).toHaveCount(0);
  await modal.getByRole('button', { name: 'Close modal' }).click();
  await expect(page).toHaveURL(/action=landing/);
  await expect(page.getByRole('searchbox', { name: 'Search payment records by reference' })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'মিলে যাওয়া রেফারেন্স' })).toBeVisible();
});

test('dropdown overlays following content without resizing the card or overflowing narrow screens', async ({ page }) => {
  for (const width of [320, 375, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 820 });
    await page.goto('/?action=landing');
    const heightBefore = await page.locator('.public-record-discovery').evaluate(element => element.getBoundingClientRect().height);
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
        cardHeight: section.getBoundingClientRect().height,
        dropdownIsFloating: getComputedStyle(dropdown).position === 'absolute',
        belowField: bounds.top >= document.querySelector('.public-record-search')!.getBoundingClientRect().bottom,
        nextSectionBelowCard: following.getBoundingClientRect().top >= section.getBoundingClientRect().bottom,
      };
    });
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expect(geometry.dropdownIsFloating).toBe(true);
    expect(geometry.belowField).toBe(true);
    expect(geometry.nextSectionBelowCard).toBe(true);
    expect(Math.abs(geometry.cardHeight - heightBefore)).toBeLessThan(2);
  }
});
