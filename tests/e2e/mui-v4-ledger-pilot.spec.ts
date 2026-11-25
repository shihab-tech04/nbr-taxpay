import {expect,test} from '@playwright/test';
const ledger='/?action=ledger&demoUser=user1';
test('MUI ledger uses the unified desktop table and original mobile records; detail dialog restores focus',async({page})=>{
 await page.goto(ledger+'&lang=en');
 const region=page.getByTestId('event-tax-ledger');
 await expect(region).toBeVisible();
 const table=region.getByTestId('event-ledger-table');
 await expect(table).toHaveClass(/MuiTable-root/);
 await expect(table).toHaveAttribute('data-unified-table','true');
 if((page.viewportSize()?.width??1280)>=768){
   await expect(table).toBeVisible();
   await expect(table.getByRole('columnheader',{name:'Date / time'})).toHaveClass(/MuiTableCell-root/);
 }else{
   await expect(table).toBeHidden();
   await expect(region.locator('.taxpay-mobile-table-card').first()).toBeVisible();
 }
 await region.getByRole('button',{name:'Filter',exact:true}).click();
 await region.getByRole('combobox',{name:'Filter ledger by year'}).selectOption('2025-2026');
 await region.getByRole('button',{name:'Credits',exact:true}).click();
 const trigger=region.getByRole('button',{name:/Salary withholding/}).first();
 await trigger.focus();
 await trigger.press('Enter');
 const dialog=page.getByRole('dialog');
 await expect(dialog).toHaveClass(/MuiDialog-paper/);
 await expect(dialog.getByTestId('tax-event-details')).toContainText('DEMO-ETDS-SAL-01');
 await expect(dialog.getByRole('button',{name:'Close modal'})).toBeFocused();
 await page.keyboard.press('Escape');
 await expect(dialog).toHaveCount(0);
 await expect(trigger).toBeFocused();
 await trigger.click();
 await dialog.getByRole('button',{name:'Close modal'}).click();
 await expect(dialog).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});
test('MUI ledger event details remain a single scrollable mobile bottom sheet in Bengali',async({page})=>{
 await page.setViewportSize({width:320,height:760});
 await page.goto(ledger+'&lang=bn');
 const region=page.getByTestId('event-tax-ledger');
 await expect(region.getByTestId('event-ledger-table')).toBeHidden();
 const trigger=region.locator('.taxpay-mobile-table-card button').first();
 await trigger.click();
 const dialog=page.getByRole('dialog');
 await expect(dialog).toHaveCount(1);
 await expect(dialog).toHaveAttribute('aria-modal','true');
 await expect(dialog.getByTestId('tax-event-details')).toBeVisible();
 const box=await dialog.boundingBox();
 expect(box).not.toBeNull();
 expect(box!.x).toBeGreaterThanOrEqual(-1);
 expect(box!.x+box!.width).toBeLessThanOrEqual(321);
 expect(box!.y+box!.height).toBeGreaterThanOrEqual(757);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
 await page.keyboard.press('Escape');
 await expect(dialog).toHaveCount(0);
});
