import {expect,test} from '@playwright/test';

const demo='/?action=taxpayer_home&demoUser=user1';

test('desktop Pay Tax is an overlay that keeps navigation positions stable and closes with Escape',async({page},info)=>{
 test.skip(info.project.name!=='desktop-1280','Desktop sidebar is shown at 1600px');
 await page.setViewportSize({width:1600,height:900});
 await page.goto(demo);
 const rail=page.getByRole('complementary',{name:'Taxpayer desktop navigation'});
 const overview=rail.getByRole('button',{name:'Overview',exact:true});
 const before=await overview.boundingBox();
 const trigger=rail.getByRole('button',{name:'Pay Tax menu'});
 await trigger.click();
 const menu=rail.getByRole('menu',{name:'Payment options'});
 await expect(menu).toBeVisible();
 await expect(menu.getByRole('menuitem')).toHaveCount(2);
 await expect(menu).toHaveCSS('position','absolute');
 const after=await overview.boundingBox();
 expect(before).not.toBeNull();
 expect(after).not.toBeNull();
 expect(Math.abs(after!.y-before!.y)).toBeLessThan(1);
 await page.keyboard.press('Escape');
 await expect(menu).toHaveCount(0);
 await expect(trigger).toBeFocused();
 await expect(rail.getByRole('button',{name:'Correction Requests'})).toHaveCount(0);
 await trigger.click();
 await menu.getByRole('menuitem',{name:'Pay Tax',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Pay Tax'})).toBeVisible();
 await expect(page.getByRole('dialog',{name:'Pay Tax'}).locator('[data-payer-relationship]')).toHaveCount(2);
});

test('desktop Travel Tax is a different payment selection and outside click dismisses dropdown',async({page},info)=>{
 test.skip(info.project.name!=='desktop-1280','Desktop only');
 await page.setViewportSize({width:1600,height:900});
 await page.goto(demo);
 const rail=page.getByRole('complementary',{name:'Taxpayer desktop navigation'});
 await rail.getByRole('button',{name:'Pay Tax menu'}).click();
 await page.getByRole('heading',{name:'Overview'}).click();
 await expect(rail.locator('#taxpayer-pay-menu')).toHaveCount(0);
 await rail.getByRole('button',{name:'Pay Tax menu'}).click();
 await rail.getByRole('menuitem',{name:'Travel Tax',exact:true}).click();
 const travel=page.getByRole('dialog',{name:'Travel tax'});
 await expect(travel).toBeVisible();
 await expect(travel.getByTestId('travel-passenger-list')).toBeVisible();
 await expect(travel.locator('.tax-service-choice__payer-grid')).toHaveCount(0);
 await expect(travel.locator('[data-payment-entry]')).toHaveCount(0);
 await expect(travel.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','1');
});

test('mobile split Pay popup keeps approved dock visible and exposes both journeys',async({page},info)=>{
 test.skip(info.project.name==='desktop-1280','Mobile only');
 await page.goto(demo);
 const dock=page.getByRole('navigation',{name:'Mobile primary navigation'});
 await expect(dock).toBeVisible();
 await page.getByRole('button',{name:'Pay — select payment type'}).click();
 const menu=page.getByRole('menu',{name:'Payment options'});
 await expect(menu).toBeVisible();
 await expect(menu.getByRole('menuitem',{name:'Pay Tax',exact:true})).toBeVisible();
 await expect(menu.getByRole('menuitem',{name:'Travel Tax',exact:true})).toBeVisible();
 await expect(dock).toBeVisible();
 const rect=await menu.boundingBox();
 expect(rect).not.toBeNull();
 expect(rect!.x).toBeGreaterThanOrEqual(0);
 expect(rect!.x+rect!.width).toBeLessThanOrEqual(page.viewportSize()!.width+1);
 await menu.getByRole('menuitem',{name:'Travel Tax',exact:true}).click();
 const travel=page.getByRole('dialog',{name:'Travel tax'});
 await expect(travel).toBeVisible();
 await expect(travel.getByTestId('travel-passenger-list')).toBeVisible();
 await expect(travel.locator('.tax-service-choice__payer-grid')).toHaveCount(0);
 await expect(travel.locator('[data-payment-entry]')).toHaveCount(0);
 await expect(travel.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow','1');
});

test('Bengali labels and dashboard correction details stay on the account overview',async({page},info)=>{
 test.skip(info.project.name!=='mobile-375','Single responsive language check');
 await page.goto(demo+'&lang=bn');
 const section=page.locator('#dashboard-correction-requests');
 await expect(section).toBeVisible();
 await expect(section.getByTestId('dashboard-correction-request-list').locator('li')).toHaveCount(2);
 await section.getByRole('button',{name:/আবেদনের বিস্তারিত/}).first().click();
 await expect(page.locator('.taxpay-modal')).toBeVisible();
});

test('Bengali Travel Tax menu enters passengers directly, not the income-tax payer selector',async({page},info)=>{
 test.skip(info.project.name!=='mobile-375','Bengali mobile route acceptance');
 await page.goto(demo+'&lang=bn');
 await page.getByRole('button',{name:'কর পরিশোধের ধরন নির্বাচন'}).click();
 const menu=page.getByRole('menu',{name:'পরিশোধের ধরন'});
 await menu.getByRole('menuitem',{name:'ভ্রমণ কর'}).click();
 const travel=page.getByRole('dialog',{name:'ভ্রমণ কর'});
 await expect(travel).toBeVisible();
 await expect(travel.getByTestId('travel-passenger-list')).toBeVisible();
 await expect(travel.locator('[data-payer-relationship]')).toHaveCount(0);
 await expect(travel.locator('.tax-service-choice__selected-service')).toHaveCount(0);
 await expect(travel.locator('.taxpay-modal__title')).toHaveText('যাত্রী ও রসিদের তথ্য');
 await expect(travel.locator('.travel-flow')).toBeVisible();
 await expect(travel.locator('.tax-service-choice--travel')).toHaveCount(0);
});
