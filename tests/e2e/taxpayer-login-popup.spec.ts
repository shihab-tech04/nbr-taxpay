import { expect, test } from '@playwright/test';

test('public Login opens the eTIN-style TaxPay-only popup; invalid credentials stay signed out', async ({page}) => {
  await page.goto('/');
  await expect(page.locator('#public-home-title')).toBeVisible();
  if (page.viewportSize()!.width<=900) {
    await page.getByRole('button',{name:'Open menu'}).click();
    await page.getByRole('dialog',{name:'Services & menu'}).getByRole('button',{name:'Sign in'}).click();
  } else {
    await page.locator('.public-home-header__tools .public-home-login-link--desktop').click();
  }
  const dialog=page.getByRole('dialog',{name:'Sign In To Your Sohojkor Account'});
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveClass(/taxpay-modal/);
  await expect(dialog.locator('.taxpay-modal__footer .tax-service-choice__continue')).toBeVisible();
  await expect(dialog.locator('.taxpay-modal__close')).toBeVisible();
  await expect(dialog.getByRole('textbox',{name:'User ID'})).toBeFocused();
  await expect(dialog.getByLabel('Password', {exact:true})).toHaveAttribute('type','password');
  await expect(dialog.getByText('Forgot your details?')).toBeVisible();
  await dialog.getByRole('button',{name:'Recover Account'}).click();
  await expect(dialog.getByRole('status')).toContainText('password is the same as the User ID');
  await expect(dialog.getByRole('status')).toContainText('user1–user30');
  await dialog.getByRole('button',{name:'Show password'}).click();
  await expect(dialog.getByLabel('Password', {exact:true})).toHaveAttribute('type','text');
  await dialog.getByRole('button',{name:'Hide password'}).click();
  await expect(dialog.getByLabel('Password', {exact:true})).toHaveAttribute('type','password');
  await expect(page.locator('#public-home-title')).toBeVisible();
  await dialog.getByRole('textbox',{name:'User ID'}).fill('user31');
  await dialog.getByLabel('Password',{exact:true}).fill('user31');
  await dialog.getByRole('button',{name:'Sign In'}).click();
  await expect(dialog.getByRole('alert')).toContainText('Incorrect User ID or password');
  await expect(page).toHaveURL(/action=taxpayer_login/);
  expect(await page.evaluate(()=>sessionStorage.getItem('taxpay-taxpayer-preview-user'))).toBeNull();
  const userIdInput=dialog.locator('#taxpayer-login-user-id');
  // An invalid login refocuses User ID and reopens suggestions: first Escape
  // closes those choices; second Escape dismisses the existing shared modal.
  await expect(userIdInput).toHaveAttribute('aria-expanded','true');
  await page.keyboard.press('Escape');
  await expect(userIdInput).toHaveAttribute('aria-expanded','false');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/action=landing/);
});

test('user1-user30 selector filters, keyboard-selects, fills only QA credentials and dismisses',async({page})=>{
  await page.goto('/?action=taxpayer_login');
  const dialog=page.getByRole('dialog',{name:'Sign In To Your Sohojkor Account'});
  const input=dialog.getByRole('textbox',{name:'User ID'});
  await input.focus();
  await expect(input).toHaveAttribute('aria-expanded','true');
  const allAccounts=dialog.getByRole('listbox',{name:'Test accounts'});
  await expect(allAccounts.getByRole('option')).toHaveCount(30);
  // The first ArrowUp wraps to the final account and must scroll inside the
  // list; a keyboard user should never lose sight of the active option.
  await input.press('ArrowUp');
  await expect(input).toHaveAttribute('aria-activedescendant','taxpayer-login-account-user30');
  await expect.poll(()=>allAccounts.evaluate(element=>element.scrollTop)).toBeGreaterThan(0);
  await input.press('ArrowDown');
  await expect(input).toHaveAttribute('aria-activedescendant','taxpayer-login-account-user1');
  await input.fill('user30');
  const list=dialog.getByRole('listbox',{name:'Test accounts'});
  await expect(list.getByRole('option')).toHaveCount(1);
  await input.press('ArrowDown');
  await input.press('Enter');
  await expect(input).toHaveValue('user30');
  await expect(dialog.getByLabel('Password',{exact:true})).toHaveValue('user30');
  await expect(input).toHaveAttribute('aria-expanded','false');
  await input.click(); // already focused: explicit user click reopens choices
  await expect(input).toHaveAttribute('aria-expanded','true');
  await input.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(input).toHaveAttribute('aria-expanded','false');
  await input.fill('user31');
  await expect(dialog.getByRole('listbox',{name:'Test accounts'}).getByText('No test accounts found')).toBeVisible();
  await expect(dialog.getByLabel('Password',{exact:true})).toBeEmpty();
});

test('Bangla account search matches a Bengali profile name and only fills synthetic QA credentials',async({page})=>{
  await page.goto('/?action=taxpayer_login&lang=bn');
  const userId=page.locator('#taxpayer-login-user-id');
  await expect(userId).toBeVisible();
  await page.getByRole('button',{name:'অ্যাকাউন্ট পুনরুদ্ধার'}).click();
  await expect(page.locator('#taxpayer-login-recovery')).toContainText('user1–user30');
  await userId.fill('করদাতা অ্যাকাউন্ট 30');
  const options=page.getByRole('listbox',{name:'পরীক্ষামূলক অ্যাকাউন্ট'});
  await expect(options.getByRole('option')).toHaveCount(1);
  await expect(options.getByRole('option')).toContainText('user30');
  await userId.press('ArrowDown');
  await userId.press('Enter');
  await expect(userId).toHaveValue('user30');
  await expect(page.locator('#taxpayer-login-password')).toHaveValue('user30');
  await expect(userId).toHaveAttribute('aria-expanded','false');
});

test('all ten matching ID/password pairs open their own taxpayer dashboard and profile, then sign out', async ({page}, info) => {
  // Ten complete sign-in → dashboard → profile → sign-out journeys need a
  // proportionate total budget; keep every assertion and the ten-account scope.
  test.setTimeout(120_000);
  test.skip(info.project.name!=='desktop-1280','Complete ID matrix on desktop');
  await page.setViewportSize({width:1600,height:900});
  const hostedCalls:string[]=[];
  const authorizationActors=new Set<string>();
  page.on('request',req=>{if(new URL(req.url()).hostname.endsWith('.supabase.co'))hostedCalls.push(req.url());});
  await page.route('**/functions/v1/demo-story1-taxpay/authorizations?actor=*',async route=>{
    const request=route.request();
    expect(request.method()).toBe('GET');
    authorizationActors.add(new URL(request.url()).searchParams.get('actor')??'');
    await route.fulfill({status:200,contentType:'application/json',body:'{"success":true,"data":[]}'});
  });
  for(let id=1;id<=10;id++){
    await page.goto('/?action=taxpayer_login');
    const dialog=page.getByRole('dialog',{name:'Sign In To Your Sohojkor Account'});
    await dialog.getByRole('textbox',{name:'User ID'}).fill('user'+id);
    await dialog.getByLabel('Password',{exact:true}).fill('user'+id);
    await dialog.getByRole('button',{name:'Sign In'}).click();
    await expect(page).toHaveURL(/action=taxpayer_home/);
    await expect(page.getByRole('heading',{name:'Your tax overview',exact:true})).toBeVisible();
    await page.locator('.taxpayer-reference-rail').getByRole('button',{name:'Profile',exact:true}).click();
    await expect(page).toHaveURL(/action=account_profile/);
    const profile=page.getByTestId('user1-taxpayer-profile');
    await expect(page.getByRole('heading',{name:'Taxpayer profile',exact:true})).toBeVisible();
    await expect(profile).toContainText('Account: user'+id);
    await expect(profile.locator('[data-profile-field]')).toHaveCount(24);
    // The same template, not an obsolete generic badge, belongs to all users.
    if(id!==1) await expect(profile.getByRole('button',{name:'Copy TIN'})).toBeDisabled();
    await page.locator('.taxpayer-reference-rail').getByRole('button',{name:'Sign out'}).click();
    await expect(page.locator('#public-home-title')).toBeVisible();
    expect(await page.evaluate(()=>sessionStorage.getItem('taxpay-taxpayer-preview-user'))).toBeNull();
  }
  expect([...authorizationActors], 'Offline fictional login must not contact hosted consent without an issued profile capability').toEqual([]);
  expect(hostedCalls.every(url=>new URL(url).pathname==='/functions/v1/demo-story1-taxpay/authorizations')).toBe(true);
});

test('refresh keeps selected preview identity without turning URL into authentication', async ({page}, info) => {
  test.skip(info.project.name!=='desktop-1280','Desktop session persistence check');
  await page.setViewportSize({width:1600,height:900});
  await page.goto('/?action=taxpayer_login');
  await page.getByRole('textbox',{name:'User ID'}).fill('user8');
  await page.getByLabel('Password',{exact:true}).fill('user8');
  await page.getByRole('button',{name:'Sign In'}).click();
  await expect(page).toHaveURL(/action=taxpayer_home/);
  await expect(page.getByRole('heading',{name:'Your tax overview',exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading',{name:'Your tax overview',exact:true})).toBeVisible();
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
  const dialog=page.getByRole('dialog',{name:'Sign In To Your Sohojkor Account'});
  await dialog.getByLabel('User ID',{exact:true}).fill('user1');
  await expect(dialog.getByRole('button',{name:'Sign In'})).toBeDisabled();
  await dialog.getByLabel('Password',{exact:true}).fill('user2');
  await expect(dialog.getByRole('button',{name:'Sign In'})).toBeEnabled();
  await dialog.getByRole('button',{name:'Sign In'}).click();
  await expect(dialog.getByRole('alert')).toContainText('Incorrect User ID or password');
  await expect(page).toHaveURL(/action=taxpayer_login/);
  expect(await page.evaluate(()=>sessionStorage.getItem('taxpay-taxpayer-preview-user'))).toBeNull();
});
for (const language of ['en','bn'] as const) {
  test(`clicking a demo account fills only its matching masked preview password (${language})`,async({page},info)=>{
    test.skip(!['desktop-1280','mobile-375'].includes(info.project.name),'Pointer acceptance at desktop and touch viewport');
    await page.goto('/?action=taxpayer_login'+(language==='bn'?'&lang=bn':''));
    const dialog=page.getByRole('dialog');
    const userId=dialog.locator('#taxpayer-login-user-id');
    const password=dialog.locator('#taxpayer-login-password');
    const authRequests:string[]=[];
    page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/auth/v1/'))authRequests.push(request.url());});
    await userId.click();
    const options=dialog.getByRole('listbox',{name:language==='bn'?'পরীক্ষামূলক অ্যাকাউন্ট':'Test accounts'});
    await expect(options.getByRole('option')).toHaveCount(30);
    await options.locator('#taxpayer-login-account-user2').click();
    await expect(userId).toHaveValue('user2');
    await expect(password).toHaveValue('user2');
    await expect(password).toHaveAttribute('type','password');
    await expect(userId).toHaveAttribute('aria-expanded','false');

    // A second explicit click must reopen, replacing (never appending) the
    // previous demo password when the selected user changes.
    await userId.click();
    await userId.fill('user30');
    await expect(password).toBeEmpty();
    await options.locator('#taxpayer-login-account-user30').click();
    await expect(userId).toHaveValue('user30');
    await expect(password).toHaveValue('user30');
    await expect(password).toHaveAttribute('type','password');
    await expect(userId).toHaveAttribute('aria-expanded','false');
    expect(authRequests).toEqual([]);
    expect(await page.evaluate(()=>sessionStorage.getItem('taxpay-taxpayer-preview-user'))).toBeNull();
  });
}


test('account options float without resizing the login form or footer (desktop and mobile)', async ({page}, info) => {
  test.skip(info.project.name !== 'desktop-1280', 'Explicit desktop/mobile viewport matrix');
  for (const {width, height} of [{width:1280,height:600},{width:375,height:800}]) {
    await page.setViewportSize({width,height});
    await page.goto('/?action=taxpayer_login');
    // Stabilize the unchanged UI before comparing geometry.
    await page.evaluate(async ()=>{
      await document.fonts.ready;
      await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
    });
    const dialog=page.getByRole('dialog',{name:'Sign In To Your Sohojkor Account'});
    // The approved modal's 280ms entrance animation must finish before
    // checking the existing <3px dropdown no-reflow threshold.
    await dialog.evaluate(async element=>{
      await Promise.all(element.getAnimations().map(animation=>animation.finished.catch(()=>{})));
    });
    const userId=dialog.locator('#taxpayer-login-user-id');
    const password=dialog.locator('#taxpayer-login-password');
    const footer=dialog.locator('.taxpay-modal__footer');
    if (await userId.getAttribute('aria-expanded') === 'true') await userId.press('Escape');
    // Measure after webfont readiness: font replacement is not dropdown reflow.
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const beforePassword=await password.boundingBox();
    const beforeFooter=await footer.boundingBox();
    const beforeDialog=await dialog.boundingBox();
    await userId.click();
    const options=dialog.getByRole('listbox',{name:'Test accounts'});
    await expect(options).toBeVisible();
    await expect(options).toHaveCSS('position','absolute');
    await expect(userId).toHaveAttribute('autocomplete','off');
    await expect(password).toHaveAttribute('autocomplete','off');
    const afterPassword=await password.boundingBox();
    const afterFooter=await footer.boundingBox();
    const afterDialog=await dialog.boundingBox();
    // The modal may move ~1px as webfonts settle; it must not reflow by an option row.
    expect(Math.abs(afterPassword!.y-beforePassword!.y)).toBeLessThan(3);
    expect(Math.abs(afterFooter!.y-beforeFooter!.y)).toBeLessThan(3);
    expect(Math.abs(afterDialog!.height-beforeDialog!.height)).toBeLessThan(3);
    const inputBounds=await userId.boundingBox();
    const optionsBounds=await options.boundingBox();
    expect(optionsBounds!.y).toBeGreaterThanOrEqual(inputBounds!.y+inputBounds!.height);
    expect(optionsBounds!.x).toBeGreaterThanOrEqual(inputBounds!.x-2);
    expect(optionsBounds!.width).toBeGreaterThanOrEqual(inputBounds!.width-4);
    // Existing recovery must remain a clickable target below the dropdown.
    await dialog.getByRole('button',{name:'Recover Account'}).click();
    await expect(dialog.getByRole('status')).toContainText('password is the same as the User ID');
    await expect(userId).toHaveAttribute('aria-expanded','false');
    await userId.click();
    await userId.fill('user20');
    await expect(options.getByRole('option')).toHaveCount(1);
    await options.getByRole('option').click();
    await expect(userId).toHaveValue('user20');
    await expect(password).toHaveValue('user20');
    await expect(userId).toHaveAttribute('aria-expanded','false');
  }
});
