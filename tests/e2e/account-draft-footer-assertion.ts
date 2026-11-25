import {expect, type Locator} from '@playwright/test';

/** Actual rendered account footer contract. Never invoke a write or submit. */
export async function assertAccountDraftFooter(modal:Locator) {
  const footer=modal.locator('.taxpay-modal__footer');
  const save=footer.locator('.payment-form-draft-controls__save');
  const next=footer.locator('.payment-flow-embedded__footer-actions > .tax-service-choice__continue,.travel-flow__footer-actions .travel-flow__primary');
  await expect(save).toBeVisible();
  await expect(next).toBeVisible();
  await expect(modal.locator('.taxpay-modal__body .payment-form-draft-controls__actions')).toHaveCount(0);
  await expect(footer.locator('.payment-form-draft-controls__open')).toHaveCount(0);
  await expect.poll(async()=>{
    const [a,b,bar]=await Promise.all([save.boundingBox(),next.boundingBox(),footer.boundingBox()]);
    if(!a||!b||!bar)return false;
    return Math.abs(a.y-b.y)<=2 && Math.abs(a.height-b.height)<=2 &&
      a.x+a.width+3<=b.x && a.x-bar.x<=36 && bar.x+bar.width-b.x-b.width<=36 &&
      a.height>=44 && b.height>=44 && b.width<bar.width*.75 &&
      a.x>=bar.x && b.x+b.width<=bar.x+bar.width+1;
  },{message:'Save Draft left and Continue right must share one contained action row'}).toBe(true);
  await expect(save).toHaveCSS('border-top-width','1px');
  const palette=await save.evaluate(el=>{
    const s=getComputedStyle(el);
    const sample=document.createElement('span');
    sample.style.color='var(--citizen-primary)';
    el.append(sample);
    const primary=getComputedStyle(sample).color;
    sample.remove();
    return {background:s.backgroundColor,color:s.color,primary};
  });
  expect(palette.color).toBe(palette.primary);
  expect(palette.background).not.toBe(palette.primary);
  expect(await footer.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(2);
  for(const action of [save,next])expect(await action.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(14);
}
