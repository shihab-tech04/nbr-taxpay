import { expect, type Locator, type Page } from '@playwright/test';
/** Open the preserved service chooser from the persistent Pay action, not the unified guest hero. */
export async function openLegacyTaxServiceChoice(page: Page): Promise<Locator> {
  const payAction = page.getByRole('button', { name: /^(Pay — select payment type|কর পরিশোধের ধরন নির্বাচন)$/ });
  const originalViewport = page.viewportSize();
  const restoreDesktopViewport = originalViewport !== null && originalViewport.width > 900;
  // The persistent guest Pay action is a mobile control. Open it at its real
  // breakpoint, then restore desktop geometry before measuring the modal.
  if (restoreDesktopViewport && !(await payAction.isVisible().catch(() => false))) {
    await page.setViewportSize({ width: 900, height: originalViewport.height });
  }
  await expect(payAction).toBeVisible();
  await payAction.click();
  const menu = page.getByRole('menu', { name: /Payment options|পরিশোধের ধরন/ });
  if (await menu.isVisible().catch(() => false)) {
    await menu.getByRole('menuitem').first().click();
  }
  const dialog = page.getByRole('dialog', { name: /Pay Tax|কর পরিশোধ/ });
  await expect(dialog).toBeVisible();
  if (restoreDesktopViewport) await page.setViewportSize(originalViewport);
  return dialog;
}

/** Start a fresh journey when account-specific saved drafts are offered first. */
export async function ensureNewPaymentEntry(dialog: Locator) {
  // Account-owned drafts introduce a first decision. Tests for the existing
  // new-payment journey deliberately select Start new before the payer cards.
  const entry = dialog.getByTestId('account-draft-entry');
  const startNew = entry.getByRole('button', { name: /Start new Tax payment|নতুন কর পরিশোধ শুরু করুন/ });
  await expect.poll(async () => {
    if (await startNew.isVisible().catch(() => false)) return 'draft-choice';
    if (await dialog.locator('[data-payer-relationship]').count() === 2) return 'payer';
    if (await entry.getByRole('alert').count()) return 'draft-error';
    return 'loading';
  }, { timeout: 15000 }).not.toBe('loading');
  if (await startNew.isVisible().catch(() => false)) await startNew.click();
  await expect(dialog.locator('[data-payer-relationship]')).toHaveCount(2);
}

/** Original payer relationship and financial service IDs remain intact. */
export async function enterTaxPayService(dialog: Locator, serviceId: string, payer: 'SELF' | 'OTHER' = 'SELF') {
  await ensureNewPaymentEntry(dialog);
  await dialog.locator(`[data-payer-relationship="${payer}"]`).click();
  await expect(dialog.locator('[data-payment-entry]')).toHaveCount(2);
  if (serviceId === 'TAX_WITH_RETURN') {
    await dialog.locator('[data-payment-entry="TAX_WITH_RETURN"]').click();
  } else {
    await dialog.locator('[data-payment-entry="OTHER_TAX"]').click();
    await expect(dialog.locator('#tax-service-other-type')).toHaveCount(0);
    // The public Other Tax card now selects its generic service directly.
    await expect(dialog.locator('[data-payment-entry="OTHER_TAX"]')).toHaveAttribute('aria-pressed', 'true');
  }
  // Signed-in users skip the access question altogether. Guests still
  // select Walk-in Payment; both paths use the same Continue action.
  const guest = dialog.locator('[data-payment-access="GUEST"]');
  const continueButton = dialog.locator('.tax-service-choice__actions').getByRole('button', { name: 'Continue', exact: true });
  // The Auth subscription can resolve after the tax selection. Wait for
  // either the guest choices or the signed-in enabled Continue state.
  await expect.poll(async () => (await guest.count()) > 0 || await continueButton.isEnabled()).toBe(true);
  if (await guest.count()) {
    const account = dialog.locator('[data-payment-access="ACCOUNT"]');
    const accountSelected = await account.getAttribute('aria-pressed') === 'true';
    if (!accountSelected) await guest.click();
  } else {
    await expect(dialog.locator('[data-entry-section="access"]')).toHaveCount(0);
  }
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
}

/** The approved account entry must use a visible control at its native viewport. */
export async function openNativeSignedInDraftGate(page: Page, locale: 'en'|'bn' = 'en', route: 'landing'|'taxpayer_home' = 'landing'): Promise<Locator> {
  await page.goto('/?action='+route+'&lang='+locale);
  const viewport=page.viewportSize();
  if(!viewport) throw new Error('Expected a configured viewport');
  const bn=locale==='bn';
  const paymentLabel=bn?'কর পরিশোধ':'Pay Tax';
  if(viewport.width>900 && route==='taxpayer_home') {
    await page.getByRole('button',{name:bn?'কর পরিশোধের মেনু':'Pay Tax menu',exact:true}).click();
    await page.getByRole('menuitem',{name:paymentLabel,exact:true}).click();
  } else if(viewport.width>900) {
    await page.getByRole('button',{name:paymentLabel,exact:true}).filter({visible:true}).first().click();
  } else {
    await page.getByRole('button',{name:bn?'কর পরিশোধের ধরন নির্বাচন':'Pay — select payment type',exact:true}).click();
    await page.getByRole('menu',{name:/Payment options|পরিশোধের ধরন/}).getByRole('menuitem',{name:paymentLabel,exact:true}).click();
  }
  expect(page.viewportSize()).toEqual(viewport);
  const dialog=page.getByRole('dialog',{name:paymentLabel});
  await expect(dialog.getByTestId('account-draft-entry')).toBeVisible();
  return dialog;
}

export async function openUnifiedSignedInPayment(page: Page, locale: 'en'|'bn' = 'en', route: 'landing'|'taxpayer_home' = 'landing'): Promise<Locator> {
  const dialog=await openNativeSignedInDraftGate(page,locale,route);
  await dialog.getByRole('button',{name:/Start new Tax payment|নতুন কর পরিশোধ শুরু করুন/}).click();
  await expect(dialog.getByTestId('unified-account-own')).toBeVisible();
  await expect(dialog.locator('[data-payment-access], [data-payer-relationship]')).toHaveCount(0);
  return dialog;
}

/** Preserve the original guest-origin account journey as its own contract.
 * Never use it as evidence of native authenticated navigation: that is covered
 * by openUnifiedSignedInPayment and the connected F-039 workspace tests.
 */
export async function enterLegacyPaymentAsAccount(page:Page,user:string,service:string,payer:'SELF'|'OTHER'='SELF',locale:'en'|'bn'='en'):Promise<Locator>{
  const bn=locale==='bn';
  await page.goto('/?action=landing&lang='+locale);
  const payment=await openLegacyTaxServiceChoice(page);
  await payment.locator(`[data-payer-relationship="${payer}"]`).click();
  await payment.locator(`[data-payment-entry="${service==='TAX_WITH_RETURN'?'TAX_WITH_RETURN':'OTHER_TAX'}"]`).click();
  await payment.locator('[data-payment-access="ACCOUNT"]').click();
  await payment.locator('.tax-service-choice__actions .tax-service-choice__continue').click();
  const login=page.getByRole('dialog',{name:/Sign In To Your .* Account|আপনার .* অ্যাকাউন্টে সাইন ইন করুন/});
  await login.locator('#taxpayer-login-user-id').fill(user);
  await login.locator('#taxpayer-login-password').fill(user);
  await login.getByRole('button',{name:bn?'সাইন ইন':'Sign In',exact:true}).click();
  await expect(login).toHaveCount(0);
  const resumed=page.getByRole('dialog',{name:bn?'কর পরিশোধ':'Pay Tax'});
  await expect(resumed.locator('.taxpay-modal__step-count')).toContainText('1/4');
  return resumed;
}
