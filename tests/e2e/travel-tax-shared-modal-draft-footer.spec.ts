import {expect, test, type Page, type Locator} from '@playwright/test';
import {openTravelTaxFromBanner} from './public-travel-tax-entry';

async function previewLogin(page:Page) {
  await page.goto('/?action=taxpayer_login');
  const login=page.getByRole('dialog',{name:'Sign In To Your Korbritto Account'});
  await login.getByRole('textbox',{name:'User ID'}).fill('user2');
  await login.getByLabel('Password',{exact:true}).fill('user2');
  await login.getByRole('button',{name:'Sign In'}).click();
  await expect(login).toHaveCount(0);
}

async function assertUnifiedTravel(modal:Locator, width:number) {
  await expect(modal).toBeVisible();
  await expect(modal.locator('.taxpay-modal__title')).toHaveText('Passengers and receipt details');
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
    expect(Math.abs(left.y-right.y),'aligned footer actions at '+width+'px').toBeLessThan(7);
    expect(left.x+left.width,'Save Draft is left of Continue').toBeLessThanOrEqual(right.x+2);
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
 await expect(modal.locator('.taxpay-modal__title')).toHaveText('যাত্রী ও রসিদের তথ্য');
 await expect(modal.getByTestId('travel-passenger-list')).toBeVisible();
 await expect(modal.locator('.tax-service-choice__selected-service')).toHaveCount(0);
 await expect(modal.locator('.taxpay-modal__footer .travel-flow__primary')).toHaveCount(1);
});
