import {test,expect} from '@playwright/test';

// Two publicly known synthetic preview IDs are not verified private identities,
// but they must not read or overwrite one another's browser capability data.
test('sample login switch isolates saved lists and restores each selected list after sign-out',async({page})=>{
  test.setTimeout(120_000);
  await page.setViewportSize({width:375,height:812});
  const login=async(id:'user1'|'user2')=>{
    await page.goto('/?action=taxpayer_login');
    await page.getByRole('textbox',{name:'User ID'}).fill(id);
    await page.getByLabel('Password',{exact:true}).fill(id);
    await page.getByRole('button',{name:'Sign In',exact:true}).click();
    await expect(page).toHaveURL(/action=taxpayer_home/);
    await page.goto('/?action=beneficiaries');
    await expect(page.getByTestId('beneficiaries-page')).toBeVisible({timeout:15000});
  };
  const create=async(name:string)=>{
    await page.getByRole('button',{name:'Create list',exact:true}).first().click();
    const dialog=page.getByRole('dialog',{name:'Create list'});
    await dialog.locator('#beneficiary-create-list-name').fill(name);
    await dialog.getByRole('button',{name:'Create list',exact:true}).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('#beneficiary-list')).toContainText(name);
  };
  const logout=async()=>{
    await page.getByRole('button',{name:'Open menu'}).first().click();
    const menu=page.getByRole('dialog',{name:'Services & menu'});
    await menu.getByRole('button',{name:'Sign out'}).click();
    await expect(page).toHaveURL(/action=landing/);
  };
  await login('user1');
  await create('Family U1');
  const key1=await page.evaluate(()=>localStorage.getItem('korbritto.guest-beneficiaries.capability.v1:preview:user1'));
  expect(key1).toMatch(/^[A-Za-z0-9_-]{43}$/);
  await logout();
  await login('user2');
  await expect(page.getByText('Family U1')).toHaveCount(0);
  await create('Clients U2');
  const key2=await page.evaluate(()=>localStorage.getItem('korbritto.guest-beneficiaries.capability.v1:preview:user2'));
  expect(key2).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(key2).not.toBe(key1);
  await logout();
  await login('user1');
  await expect(page.locator('#beneficiary-list')).toContainText('Family U1');
  await expect(page.getByText('Clients U2')).toHaveCount(0);
  expect(await page.evaluate(()=>localStorage.getItem('korbritto.guest-beneficiaries.capability.v1:preview:user1'))).toBe(key1);
});
