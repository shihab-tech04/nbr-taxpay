import {expect, test} from '@playwright/test';

test('authorization request uses Add taxpayer and inline Cancel, never a large Close action', async ({page}, info) => {
  test.skip(info.project.name !== 'desktop-1280', 'One representative account journey');
  await page.route('**/functions/v1/demo-story1-taxpay/authorizations**', route => route.fulfill({
    status:200, contentType:'application/json', body:JSON.stringify({success:true,data:[]})
  }));
  await page.goto('/?action=taxpayer_login');
  const login=page.getByRole('dialog',{name:'Sign In To Your Amar Kor Account'});
  await login.getByRole('textbox',{name:'User ID'}).fill('user1');
  await login.getByRole('textbox',{name:'Password'}).fill('user1');
  await login.getByRole('button',{name:'Sign In'}).click();
  await page.goto('/?action=manage_authorization');
  const panel=page.getByTestId('manage-authorization');
  const add=panel.getByRole('button',{name:'Add taxpayer'});
  await expect(add).toBeVisible();
  await add.click();
  await expect(panel.getByLabel('Taxpayer TIN')).toBeFocused();
  await expect(panel.getByRole('button',{name:'Close',exact:true})).toHaveCount(0);
  await expect(panel.getByRole('button',{name:'Request authorization'})).toBeVisible();
  await panel.getByLabel('Taxpayer TIN').fill('2222222222222');
  await panel.getByRole('button',{name:'Discard',exact:true}).click();
  await expect(panel.getByLabel('Taxpayer TIN')).toHaveCount(0);
  await expect(add).toBeVisible();
  await expect(add).toBeFocused();
  await add.click();
  await expect(panel.getByLabel('Taxpayer TIN')).toHaveValue('');
});

test('transaction search has one outer focus boundary at mobile and desktop widths',async({page},info)=>{
  test.skip(info.project.name !== 'desktop-1280', 'Responsive matrix on a single worker');
  for(const width of [375,1280]){
    await page.setViewportSize({width,height:850});
    await page.goto('/?action=taxpayer_home&demoUser=user1');
    await page.getByRole('button',{name:'Open transaction history'}).click();
    await expect(page.getByRole('heading',{name:'Transaction history'})).toBeVisible();
    await page.getByRole('combobox',{name:'Assessment year'}).selectOption('2023-2024');
    const wrapper=page.locator('.taxpayer-transaction-filter__search');
    const search=wrapper.locator('input[type="search"]');
    await expect(search).toHaveCount(1);
    await expect(search).toHaveCSS('border-top-width','0px');
    await search.focus();
    await expect(search).toHaveCSS('outline-style','none');
    await expect(search).toHaveCSS('box-shadow','none');
    await expect(wrapper).toHaveCSS('outline-style','solid');
    await search.fill('Advance');
    await expect(page.getByText('Advance tax',{exact:true}).first()).toBeVisible();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow,'unexpected horizontal overflow at '+width).toBeLessThanOrEqual(2);
  }
});
