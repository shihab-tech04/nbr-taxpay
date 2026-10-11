import {expect,test} from '@playwright/test';

test('Office Management source-shaped login is the default entry, no authentication calls',async({page},info)=>{
 const authRequests:string[]=[];
 page.on('request',req=>{if(new URL(req.url()).hostname.endsWith('.supabase.co'))authRequests.push(req.url())});
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'TaxPay',exact:true})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'User ID'})).toBeDisabled();
 await expect(page.getByLabel('Password',{exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeDisabled();
 await expect(page.locator('.login-form-card')).toBeVisible();
 await expect(page.locator('.login-form-card .MuiTextField-root')).toHaveCount(2);
 // Visual fidelity: inactive authentication must not dim the entire Office form.
 const labelOpacity = await page.locator('.MuiInputLabel-root.Mui-disabled').first().evaluate(el=>Number(getComputedStyle(el).opacity));
 const checkboxLabelOpacity = await page.locator('.MuiFormControlLabel-label').first().evaluate(el=>Number(getComputedStyle(el).opacity));
 const submitOpacity = await page.getByRole('button',{name:'Sign in',exact:true}).evaluate(el=>Number(getComputedStyle(el).opacity));
 expect(labelOpacity).toBeGreaterThan(0.95);
 expect(checkboxLabelOpacity).toBeGreaterThan(0.95);
 expect(submitOpacity).toBeGreaterThan(0.95);
 await expect(page.locator('.office-source-language')).toHaveCount(0);
 if(info.project.name==='desktop-1280') await expect(page.locator('.login-brand-panel')).toBeVisible();
 if(info.project.name==='desktop-1280'){
   await expect(page.locator('.login-slide__image img')).toBeVisible();
   expect(await page.locator('.login-slide__image img').evaluate((e:HTMLImageElement)=>e.naturalWidth)).toBeGreaterThan(0);
   await expect(page.getByRole('button',{name:'Pause slideshow'})).toBeVisible();
   await expect(page.getByRole('button',{name:'Go to slide 1'})).toBeVisible();
   const sliderBox=await page.locator('.login-slider').boundingBox();
   const imageBox=await page.locator('.login-slide__image').boundingBox();
   const fieldBox=await page.locator('.login-form-card .MuiOutlinedInput-root').first().boundingBox();
   expect(sliderBox).not.toBeNull();expect(imageBox).not.toBeNull();expect(fieldBox).not.toBeNull();
   expect(sliderBox!.height).toBeGreaterThanOrEqual(599);
   expect(Math.abs(imageBox!.height-400)).toBeLessThan(2);
   expect(Math.abs(fieldBox!.height-56)).toBeLessThan(2);
   const brandBox=await page.locator('.login-brand-panel').boundingBox();
   const formBox=await page.locator('.login-form-wrapper').boundingBox();
   expect(brandBox).not.toBeNull();expect(formBox).not.toBeNull();
   expect(brandBox!.x).toBeLessThan(formBox!.x);
   expect(Math.abs(formBox!.x-(brandBox!.x+brandBox!.width)-48)).toBeLessThan(3);
 }else await expect(page.locator('.login-brand-panel')).toHaveCount(0);
 const layout=await page.locator('.office-auth-clone').boundingBox();expect(layout).not.toBeNull();
 expect(layout!.x+layout!.width).toBeLessThanOrEqual(page.viewportSize()!.width+2);
 expect(authRequests).toEqual([]);
 await page.getByRole('button',{name:'Explore TaxPay'}).click();
 await expect(page.getByText('Independent TaxPay Workspace')).toBeVisible();
 expect(authRequests).toEqual([]);
});

test('original Office slider dots pause and help UI work, EN/BN remains usable',async({page},info)=>{
 // Office source login has no standalone language switch. Change language via TaxPay's public header,
 // then return to the login. This preserves EN/BN without adding new layout elements.
 await page.goto('/?action=landing');
 await page.getByRole('button',{name:'বাংলা'}).click();
 await page.getByRole('button',{name:'অফিস লগইন'}).click();
 await expect(page.getByRole('heading',{name:'স্বাগতম'})).toBeVisible();
 await expect(page.getByRole('button',{name:'ট্যাক্সপে দেখুন'})).toBeVisible();
 await page.getByRole('button',{name:'ট্যাক্সপে দেখুন'}).click();
 await page.getByRole('button',{name:'EN'}).click();
 await page.getByRole('button',{name:'Office Login'}).click();
 await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();
 if(info.project.name==='desktop-1280'){
  await page.getByRole('button',{name:'Pause slideshow'}).click();
  await expect(page.getByRole('button',{name:'Play slideshow'})).toBeVisible();
  await page.getByRole('button',{name:'Go to slide 2'}).click();
  await expect(page.getByRole('heading',{name:'Track Approvals Faster'})).toBeVisible();
  await expect(page.getByText('Monitor pending, approved, and rejected items with clear status updates.')).toBeVisible();
 }
 await page.getByRole('button',{name:'Help & User Guide'}).click();
 await expect(page.getByRole('dialog',{name:'Help & User Guide'})).toBeVisible();
 await page.getByRole('button',{name:'Close',exact:true}).first().click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
});
