import {expect, test, type Page, type Locator} from '@playwright/test';
import {openTravelTaxFromBanner} from './public-travel-tax-entry';

async function previewLogin(page:Page) {
  await page.goto('/?action=taxpayer_login');
  const login=page.getByRole('dialog',{name:'Sign In To Your Sohojkor Account'});
  await login.getByRole('textbox',{name:'User ID'}).fill('user2');
  await login.getByLabel('Password',{exact:true}).fill('user2');
  await login.getByRole('button',{name:'Sign In'}).click();
  await expect(login).toHaveCount(0);
}

async function assertUnifiedTravel(modal:Locator, width:number) {
  await expect(modal).toBeVisible();
  await expect(modal.locator('.taxpay-modal__title')).toHaveText('Passenger Information');
  await expect(modal.locator('.tax-service-choice--travel')).toHaveCount(0);
  await expect(modal.locator('.tax-service-choice__selected-service')).toHaveCount(0);
  await expect(modal.locator('.travel-flow')).toBeVisible();
  await expect(modal.getByTestId('travel-passenger-list')).toBeVisible();
  await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','1');

  const footer=modal.locator('.taxpay-modal__footer');
  const save=footer.getByRole('button',{name:'Save Draft',exact:true});
  const next=footer.getByRole('button',{name:'Continue to travel details'});
  await expect(save).toBeVisible();
  await expect(next).toBeVisible();
  await expect(footer.locator('.payment-form-draft-controls__open')).toHaveCount(0);
  await expect(modal.locator('.taxpay-modal__body .payment-form-draft-controls__actions')).toHaveCount(0);
  await expect(modal.locator('.taxpay-modal__body .payment-form-draft-controls__open')).toHaveCount(0);
  const [left,right,bar]=await Promise.all([save.boundingBox(),next.boundingBox(),footer.boundingBox()]);
  expect(left && right && bar).toBeTruthy();
  if (left && right && bar) {
    expect(left.y + left.height,'Save Draft precedes the full-width primary action at '+width+'px').toBeLessThanOrEqual(right.y+2);
    expect(right.width,'Continue fills the footer at '+width+'px').toBeGreaterThanOrEqual(bar.width-60);
    expect(right.x+right.width,'Continue stays inside modal').toBeLessThanOrEqual(bar.x+bar.width+2);
  }
  const formWidth=await modal.locator('.travel-flow__main').evaluate(node=>node.getBoundingClientRect().width);
  const bodyWidth=await modal.locator('.taxpay-modal__body').evaluate(node=>node.getBoundingClientRect().width);
  expect(bodyWidth-formWidth,'Travel Tax passenger form uses the available modal width').toBeLessThanOrEqual(4);
  const overflow=await modal.evaluate(node=>node.scrollWidth-node.clientWidth);
  expect(overflow,'modal horizontal overflow').toBeLessThanOrEqual(2);
}

for(const width of [320,375,1280]) {
 test('public hero and taxpayer Travel Tax share modal + approved draft footer at '+width+'px',async({page},info)=>{
  const project=width===1280?'desktop-1280':'mobile-'+width;
  test.skip(info.project.name!==project,'Dedicated viewport project');
  await page.setViewportSize({width,height:830});
  await previewLogin(page);
  await page.goto('/?action=landing');
  await openTravelTaxFromBanner(page);
  const publicModal=page.getByRole('dialog',{name:'Travel tax'});
  await assertUnifiedTravel(publicModal,width);
  const publicMain=await publicModal.locator('.travel-flow__main').boundingBox();
  await page.screenshot({path:'test-results/screenshots/travel-unified-public-'+width+'.png'});
  await page.goto('/?action=taxpayer_home');
  const enter=page.getByRole('button',{name:'Explore taxpayer workspace'});
  if(await enter.isVisible())await enter.click();
  const rail=page.locator('.taxpayer-reference-rail');
  if(await rail.isVisible()){
    await rail.getByRole('button',{name:'Pay Tax menu'}).click();
    await rail.getByRole('menuitem',{name:'Travel Tax'}).click();
  }else{
    await page.getByRole('button',{name:'Pay — select payment type'}).click();
    await page.getByRole('menuitem',{name:'Travel Tax'}).click();
  }
  const accountModal=page.getByRole('dialog',{name:'Travel tax'});
  await assertUnifiedTravel(accountModal,width);
  const accountMain=await accountModal.locator('.travel-flow__main').boundingBox();
  expect(publicMain && accountMain).toBeTruthy();
  if(publicMain&&accountMain)expect(Math.abs(publicMain.width-accountMain.width),'both entry points have equal form widths').toBeLessThanOrEqual(3);
  await page.screenshot({path:'test-results/screenshots/travel-unified-account-'+width+'.png'});
 });
}

test('Bengali Travel Tax retains identical stage heading and single primary footer action',async({page},info)=>{
 test.skip(info.project.name!=='mobile-375','Mobile Bengali UX parity');
 await page.goto('/?action=landing&lang=bn');
 await openTravelTaxFromBanner(page);
 const modal=page.getByRole('dialog',{name:'ভ্রমণ কর'});
 await expect(modal.locator('.taxpay-modal__title')).toHaveText('যাত্রীর তথ্য');
 await expect(modal.getByTestId('travel-passenger-list')).toBeVisible();
 await expect(modal.locator('.tax-service-choice__selected-service')).toHaveCount(0);
 await expect(modal.locator('.taxpay-modal__footer .travel-flow__primary')).toHaveCount(1);
});


test('Travel Tax passport lookup is full-width on tablet and phone without changing desktop pairing', async ({page}, info) => {
  test.skip(info.project.name !== 'desktop-1280', 'Cross-breakpoint regression executes once');
  await page.goto('/?action=landing');
  await openTravelTaxFromBanner(page);
  const dialog = page.getByRole('dialog', {name: 'Travel tax'});
  const passport = dialog.locator('.travel-flow__passport-row').first();
  const field = passport.locator('.travel-flow__passport-input');
  const action = passport.locator('.travel-flow__passport-action');
  for (const width of [375, 650, 768]) {
    await page.setViewportSize({width, height: 830});
    // The approved Travel Tax dialog animates its width for 300 ms. Sample
    // row and action in the same settled layout, not during different frames
    // of that transition. Keep the strict two-pixel geometry gate unchanged.
    await dialog.evaluate(async element => {
      await Promise.all(
        element.getAnimations({subtree: false})
          .filter(animation => animation.playState === 'running')
          .map(animation => animation.finished.catch(() => undefined))
      );
      await new Promise<void>(resolve => requestAnimationFrame(() =>
        requestAnimationFrame(() => resolve())));
    });
    const [row, input, button] = await Promise.all([
      passport.boundingBox(), field.boundingBox(), action.boundingBox()
    ]);
    expect(row && input && button, 'Passport controls are visible at '+width).toBeTruthy();
    if (!row || !input || !button) continue;
    expect(input.width, 'Passport input fills the tablet/phone row').toBeGreaterThanOrEqual(row.width - 2);
    expect(button.width, 'Check Passport fills the tablet/phone row').toBeGreaterThanOrEqual(row.width - 2);
    expect(button.y, 'Check Passport is below the passport field').toBeGreaterThanOrEqual(input.y + input.height);
    expect(await dialog.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(2);
  }
  await page.setViewportSize({width:1280,height:830});
  // Returning from the full-width phone/tablet layout also starts the
  // approved 300 ms dialog width transition. Measure the desktop pairing only
  // after that transition settles; keep the strict 3 px alignment limit.
  await dialog.evaluate(async element => {
    await Promise.all(
      element.getAnimations({subtree: false})
        .filter(animation => animation.playState === 'running')
        .map(animation => animation.finished.catch(() => undefined))
    );
    await new Promise<void>(resolve => requestAnimationFrame(() =>
      requestAnimationFrame(() => resolve())));
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>(resolve => requestAnimationFrame(() =>
      requestAnimationFrame(() => resolve())));
  });
  const [input,button] = await Promise.all([field.boundingBox(),action.boundingBox()]);
  expect(input && button).toBeTruthy();
  if (input && button) {
    expect(button.x).toBeGreaterThanOrEqual(input.x + input.width);
    expect(Math.abs(button.y + button.height - input.y - input.height)).toBeLessThanOrEqual(3);
  }
});


test('Travel Tax suggestions stay attached to passport and visible above modal footer across sizes',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','One project sweeps the exact responsive widths');
  await page.emulateMedia({reducedMotion:'reduce'});
  for (const width of [320,375,768,1280,2048]) {
    await page.setViewportSize({width,height:700});
    await page.goto('/?action=landing&lang=en');
    await openTravelTaxFromBanner(page);
    const dialog=page.getByRole('dialog',{name:'Travel tax'});
    const overlay=page.locator('.taxpay-modal__overlay').last();
    const cover=await overlay.evaluate(node=>{
      const rect=node.getBoundingClientRect();
      return {top:rect.top,left:rect.left,right:rect.right,bottom:rect.bottom,
        vw:innerWidth,vh:innerHeight};
    });
    expect(Math.abs(cover.top),'backdrop reaches top at '+width).toBeLessThanOrEqual(1);
    expect(Math.abs(cover.left),'backdrop reaches left at '+width).toBeLessThanOrEqual(1);
    expect(cover.right,'backdrop reaches right at '+width).toBeGreaterThanOrEqual(cover.vw-1);
    expect(cover.bottom,'backdrop reaches bottom at '+width).toBeGreaterThanOrEqual(cover.vh-1);

    const passport=dialog.getByRole('combobox',{name:/Passport number/i}).first();
    await passport.focus();
    const list=dialog.getByRole('listbox',{name:'Available sample passports'});
    await expect(list).toBeVisible();
    await expect(list.getByRole('option')).toHaveCount(10);
    const geometry=await list.evaluate(node=>{
      const rect=node.getBoundingClientRect();
      const input=node.closest('.travel-flow__passport-input')?.getBoundingClientRect();
      const footer=node.closest('.taxpay-modal')?.querySelector('.taxpay-modal__footer')?.getBoundingClientRect();
      const style=getComputedStyle(node);
      return {top:rect.top,bottom:rect.bottom,left:rect.left,right:rect.right,
        inputRight:input?.right,inputLeft:input?.left,inputBottom:input?.bottom,
        footerTop:footer?.top,position:style.position,overflowY:style.overflowY,
        withinInput:node.parentElement?.classList.contains('travel-flow__passport-input')};
    });
    expect(geometry.withinInput,'suggestions belong to input at '+width).toBe(true);
    expect(geometry.position,'floating listbox at '+width).toBe('absolute');
    expect(geometry.top,'listbox below input at '+width).toBeGreaterThanOrEqual((geometry.inputBottom??0)-1);
    expect(geometry.left,'listbox left aligned at '+width).toBeGreaterThanOrEqual((geometry.inputLeft??0)-2);
    expect(geometry.right,'listbox inside input at '+width).toBeLessThanOrEqual((geometry.inputRight??0)+2);
    expect(geometry.bottom,'options not hidden by footer at '+width).toBeLessThanOrEqual((geometry.footerTop??Infinity)-4);
    await list.getByRole('option').first().click();
    await expect(list).toHaveCount(0);
    await expect(passport).not.toHaveValue('');
  }
});
