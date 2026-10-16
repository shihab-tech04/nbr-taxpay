import { expect, test } from '@playwright/test';

test('public Login opens the eTIN-style TaxPay-only popup; invalid credentials stay signed out', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Understand tax payments. Stay in control.'})).toBeVisible();
  if (page.viewportSize()!.width<=900) {
    await page.getByRole('button',{name:'Menu'}).click();
    await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('link',{name:'Login'}).click();
  } else {
    await page.locator('.public-home-header__tools .public-home-login-link--desktop').click();
  }
  const dialog=page.getByRole('dialog',{name:'Sign In To Your Amar Kor Account'});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox',{name:'User ID'})).toBeFocused();
  await expect(dialog.getByLabel('Password', {exact:true})).toHaveAttribute('type','password');
  await expect(dialog.getByText('Forgot your details?')).toBeVisible();
  await dialog.getByRole('button',{name:'Recover Account'}).click();
  await expect(dialog.getByRole('status')).toContainText('password is the same as the User ID');
  await dialog.getByRole('button',{name:'Show password'}).click();
  await expect(dialog.getByLabel('Password', {exact:true})).toHaveAttribute('type','text');
  await dialog.getByRole('button',{name:'Hide password'}).click();
  await expect(dialog.getByLabel('Password', {exact:true})).toHaveAttribute('type','password');
  await expect(page.getByRole('heading',{name:'Understand tax payments. Stay in control.'})).toBeVisible();
  await dialog.getByRole('textbox',{name:'User ID'}).fill('user11');
  await dialog.getByLabel('Password',{exact:true}).fill('user11');
  await dialog.getByRole('button',{name:'Sign In'}).click();
  await expect(dialog.getByRole('alert')).toContainText('Incorrect User ID or password');
  await expect(page).toHaveURL(/action=taxpayer_login/);
  expect(await page.evaluate(()=>sessionStorage.getItem('taxpay-taxpayer-preview-user'))).toBeNull();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/action=landing/);
});

test('all ten matching ID/password pairs open their own taxpayer dashboard and profile, then sign out', async ({page}, info) => {
  test.skip(info.project.name!=='desktop-1280','Complete ID matrix on desktop');
  await page.setViewportSize({width:1600,height:900});
  const hostedCalls:string[]=[];
  page.on('request',req=>{if(new URL(req.url()).hostname.endsWith('.supabase.co'))hostedCalls.push(req.url());});
  for(let id=1;id<=10;id++){
    await page.goto('/?action=taxpayer_login');
    const dialog=page.getByRole('dialog',{name:'Sign In To Your Amar Kor Account'});
    await dialog.getByRole('textbox',{name:'User ID'}).fill('user'+id);
    await dialog.getByLabel('Password',{exact:true}).fill('user'+id);
    await dialog.getByRole('button',{name:'Sign In'}).click();
    await expect(page).toHaveURL(/action=taxpayer_home/);
    await expect(page.getByRole('heading',{name:'Dashboard summary'})).toBeVisible();
    await page.locator('.taxpayer-reference-rail summary').click();
    await page.locator('.taxpayer-reference-rail').getByRole('button',{name:'Profile',exact:true}).click();
    await expect(page).toHaveURL(/action=account_profile/);
    if (id!==1) await expect(page.getByText('user'+id,{exact:true}).first()).toBeVisible();
    await page.locator('.taxpayer-reference-rail').getByRole('button',{name:'Sign out'}).click();
    await expect(page.getByRole('heading',{name:'Understand tax payments. Stay in control.'})).toBeVisible();
    expect(await page.evaluate(()=>sessionStorage.getItem('taxpay-taxpayer-preview-user'))).toBeNull();
  }
  expect(hostedCalls).toEqual([]);
});

test('refresh keeps selected preview identity without turning URL into authentication', async ({page}, info) => {
  test.skip(info.project.name!=='desktop-1280','Desktop session persistence check');
  await page.setViewportSize({width:1600,height:900});
  await page.goto('/?action=taxpayer_login');
  await page.getByRole('textbox',{name:'User ID'}).fill('user8');
  await page.getByLabel('Password',{exact:true}).fill('user8');
  await page.getByRole('button',{name:'Sign In'}).click();
  await page.reload();
  await expect(page.getByRole('heading',{name:'Dashboard summary'})).toBeVisible();
  await expect(page).not.toHaveURL(/demoUser=/);
  await page.locator('.taxpayer-reference-rail').getByRole('button',{name:'Sign out'}).click();
  await page.goto('/?action=account_profile');
  await expect(page.getByRole('heading',{name:'Profile',exact:true,level:1})).toBeVisible();
  await expect(page.getByText('user8',{exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>sessionStorage.getItem('taxpay-taxpayer-preview-user'))).toBeNull();
});

test('empty and mismatched passwords cannot sign in even with a valid User ID', async ({page},info) => {
  test.skip(info.project.name!=='desktop-1280','One password validation case');
  await page.goto('/?action=taxpayer_login');
  const dialog=page.getByRole('dialog',{name:'Sign In To Your Amar Kor Account'});
  await dialog.getByLabel('User ID',{exact:true}).fill('user1');
  await dialog.getByRole('button',{name:'Sign In'}).click();
  await expect(dialog.getByRole('alert')).toContainText('Incorrect User ID or password');
  await dialog.getByLabel('Password',{exact:true}).fill('user2');
  await dialog.getByRole('button',{name:'Sign In'}).click();
  await expect(dialog.getByRole('alert')).toContainText('Incorrect User ID or password');
  await expect(page).toHaveURL(/action=taxpayer_login/);
  expect(await page.evaluate(()=>sessionStorage.getItem('taxpay-taxpayer-preview-user'))).toBeNull();
});
