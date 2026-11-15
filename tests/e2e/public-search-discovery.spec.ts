import { setWorkspaceLanguage } from './workspace-language';
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
  await expect(section.getByRole('heading', { name: 'Example reference numbers' })).toBeVisible();
  await expect(section.locator('.public-record-suggestions__option')).toHaveCount(3);
  await expect(section.locator('.public-record-suggestions__examples')).toHaveCount(1);
});

test('typing opens a clean floating dropdown without changing the card height', async ({ page }) => {
  await page.goto('/?action=landing');
  // Compare settled layout to settled layout: swapping in Poppins after the
  // initial measurement can change wrapped helper text by one line on 375px.
  await page.evaluate(async () => { await document.fonts.ready; });
  const section = page.getByRole('region', { name: 'Find a payment record' });
  const search = page.getByRole('searchbox', { name: 'Search payment records by reference' });
  const cardHeightBefore = await section.evaluate(element => element.getBoundingClientRect().height);
  const nextGapBefore = await page.evaluate(() => {
    const card = document.querySelector('.public-record-discovery')!.getBoundingClientRect();
    const next = document.querySelector('.public-footer')!.getBoundingClientRect();
    return next.top - card.bottom;
  });
  await search.fill('DEMO-REF-001');
  await expect(section.getByRole('heading', { name: 'Matching references' })).toBeVisible();
  await expect(section.locator('.public-record-suggestions__examples')).toHaveCount(1);
  const matches = section.locator('.public-record-suggestions__group:not(.public-record-suggestions__examples)');
  await expect(matches.getByRole('button', { name: /AC-2025-09-DEMO-REF-001/ })).toBeVisible();
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
      nextGap: document.querySelector('.public-footer')!.getBoundingClientRect().top - element.getBoundingClientRect().bottom,
    };
  });
  expect(geometry.position).toBe('absolute');
  expect(geometry.belowField).toBe(true);
  expect(geometry.dropdownOutsideCard).toBe(true);
  expect(Math.abs(geometry.cardHeight - cardHeightBefore)).toBeLessThan(2);
  expect(Math.abs(geometry.nextGap - nextGapBefore)).toBeLessThan(2);
  const resultOption = section.locator('.public-record-suggestions__group:not(.public-record-suggestions__examples)').getByRole('button', { name: /AC-2025-09-DEMO-REF-001/ });
  await expect(resultOption).toHaveCSS('text-decoration-line', 'none');
  await resultOption.focus();
  await expect(resultOption).toBeFocused();
  await search.fill('not-a-real-reference');
  await expect(section.getByText(/No matching references/)).toBeVisible();
  await expect(section.locator('.public-record-suggestions__examples')).toHaveCount(1);
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
  await page.locator('.public-record-suggestions__group:not(.public-record-suggestions__examples)').getByRole('button', { name: /AC-2025-06-DEMO-REF-003/ }).click();
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
  await setWorkspaceLanguage(page,'bn');
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
      const following = document.querySelector<HTMLElement>('.public-footer')!;
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


test('focus examples are keyboard-selectable, private-reference safe and do not resize the search card', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/?action=landing');
  const section = page.getByRole('region', { name: 'Find a payment record' });
  const search = section.getByRole('searchbox', { name: 'Search payment records by reference' });
  const before = await section.evaluate(element => element.getBoundingClientRect().height);
  await search.focus();
  await expect(section.getByRole('heading', { name: 'Example reference numbers' })).toBeVisible();
  await expect(section.locator('.public-record-suggestions__option')).toHaveCount(3);
  const example = await section.locator('.public-record-suggestions__value').first().textContent();
  expect(example?.trim()).toBeTruthy();
  expect(Math.abs((await section.evaluate(element => element.getBoundingClientRect().height)) - before)).toBeLessThan(2);
  await search.press('ArrowDown');
  await expect(section.locator('#public-search-option-0')).toHaveClass(/is-active/);
  await search.press('Enter');
  await expect(page).toHaveURL(/action=verify/);
  expect(page.url()).not.toContain(example!.trim());
});


test('typed search keeps matched references above a distinct bottom sample-number group', async ({ page }) => {
  await page.goto('/?action=landing');
  const search = page.getByRole('searchbox', { name: 'Search payment records by reference' });
  await search.fill('DEMO-REF-001');
  const dropdown = page.locator('.public-record-suggestions');
  await expect(dropdown.locator('.public-record-suggestions__group')).toHaveCount(2);
  await expect(dropdown.locator('.public-record-suggestions__group').first().getByRole('heading', { name: 'Matching references' })).toBeVisible();
  await expect(dropdown.locator('.public-record-suggestions__group').last().getByRole('heading', { name: 'Example reference numbers' })).toBeVisible();
  await expect(dropdown.locator('.public-record-suggestions__examples button')).toHaveCount(3);
  const match = dropdown.locator('.public-record-suggestions__group').first().getByRole('button', { name: /AC-2025-09-DEMO-REF-001/ });
  await expect(match).toBeVisible();
  await expect(match).toHaveCSS('text-decoration-line', 'none');
});

test('public suggestions announce only example matches and keyboard selection without exposing references in URL',async({page})=>{
  await page.goto('/?action=landing&lang=en');
  const discovery=page.locator('.public-record-discovery');
  const search=discovery.getByRole('searchbox',{name:'Search payment records by reference'});
  await search.fill('TKN-882190');
  await expect(search).toHaveAttribute('aria-autocomplete','list');
  await expect(search).toHaveAttribute('aria-describedby','public-record-discovery-help');
  await expect(discovery.getByTestId('public-search-match-status')).toContainText('matching example references');
  await search.press('ArrowDown');
  await expect(search).toHaveAttribute('aria-activedescendant','public-search-option-0');
  await expect(discovery.locator('#public-search-option-0')).toHaveClass(/is-active/);
  await search.press('Escape');
  await expect(search).toBeFocused();
  await expect(search).not.toHaveAttribute('aria-activedescendant',/./);
  await expect(discovery.getByTestId('public-search-match-status')).toHaveCount(0);
  await search.fill('TKN-882190');
  await search.press('ArrowDown');
  await search.press('Enter');
  await expect(page.getByRole('dialog',{name:'Payment status & receipt'})).toBeVisible();
  expect(new URL(page.url()).searchParams.get('initialReference')).toBeNull();
});

test('unmatched public examples never falsely imply that actual payment SQL was searched (EN/BN)',async({page})=>{
  for(const language of ['en','bn'] as const){
    await page.goto('/?action=landing&lang='+language);
    const discovery=page.locator('.public-record-discovery');
    const search=discovery.getByRole('searchbox',{name:language==='bn'
      ?'রেফারেন্স দিয়ে পেমেন্ট রেকর্ড খুঁজুন':'Search payment records by reference'});
    await search.fill('ZZ-UNKNOWN-REFERENCE-765');
    const notice=discovery.getByTestId('public-search-match-status');
    await expect(notice).toContainText(language==='bn'?'কোনো নমুনা রেফারেন্স মেলেনি':'No example references matched');
    await expect(discovery.locator('.public-record-suggestions__empty'))
      .toContainText(language==='bn'?'নমুনার মধ্যে মিলে যাওয়া রেফারেন্স নেই':'No matching references among the examples');
    await discovery.getByRole('button',{name:language==='bn'?'রেকর্ড খুঁজুন':'Search records'}).click();
    await expect(page).toHaveURL(/action=verify/);
    await expect(page.getByTestId('receipt-mobile-required')).toBeVisible();
  }
});
