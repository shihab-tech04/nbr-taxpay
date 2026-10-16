import { expect, test } from '@playwright/test';

test('public Login opens the TaxPay-only popup; invalid ID stays signed out', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Understand tax payments. Stay in control.'})).toBeVisible();
  if (page.viewportSize()!.width<=900) {
    await page.getByRole('button',{name:'Menu'}).click();
    await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('link',{name:'Login'}).click();
  } else {
    await page.locator('.public-home-header__tools .public-home-login-link--desktop').click();
  }
  const dialog=page.getByRole('dialog',{name:'Sign In To Your TaxPay Account'});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox',{name:'User ID'})).toBeFocused();
  await expect(dialog.locator('input[type=password]')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Understand tax payments. Stay in control.'})).toBeVisible();
  await dialog.getByRole('textbox',{name:'User ID'}).fill('user11');
  await dialog.getByRole('button',{name:'Login'}).click();
  await expect(dialog.getByRole('alert')).toContainText('valid User ID');
  await expect(page).toHaveURL(/action=taxpayer_login/);
  expect(await page.evaluate(()=>sessionStorage.getItem('taxpay-taxpayer-preview-user'))).toBeNull();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/action=landing/);
});

test('all ten User IDs open their own taxpayer dashboard and profile, then sign out', async ({page}, info) => {
  test.skip(info.project.name!=='desktop-1280','Complete ID matrix on desktop');
  await page.setViewportSize({width:1600,height:900});
  const hostedCalls:string[]=[];
  page.on('request',req=>{if(new URL(req.url()).hostname.endsWith('.supabase.co'))hostedCalls.push(req.url());});
  for(let id=1;id<=10;id++){
    await page.goto('/?action=taxpayer_login');
    const dialog=page.getByRole('dialog',{name:'Sign In To Your TaxPay Account'});
    await dialog.getByRole('textbox',{name:'User ID'}).fill('user'+id);
    await dialog.getByRole('button',{name:'Login'}).click();
    await expect(page).toHaveURL(/action=taxpayer_home/);
    await expect(page.getByRole('heading',{name:'Dashboard summary'})).toBeVisible();
    await page.locator('.taxpayer-reference-rail summary').click();
    await page.locator('.taxpayer-reference-rail').getByRole('button',{name:'Profile',exact:true}).click();
    await expect(page).toHaveURL(/action=account_profile/);
    if (id!==1) await expect(page.getByText('user'+id,{exact:true})).toBeVisible();
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
  await page.getByRole('button',{name:'Login'}).click();
  await page.reload();
  await expect(page.getByRole('heading',{name:'Dashboard summary'})).toBeVisible();
  await expect(page).not.toHaveURL(/demoUser=/);
  await page.locator('.taxpayer-reference-rail').getByRole('button',{name:'Sign out'}).click();
  await page.goto('/?action=account_profile&demoUser=user8');
  await expect(page.getByRole('heading',{name:'Private taxpayer workspace'})).toBeVisible();
});
