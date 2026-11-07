import {expect,test,type BrowserContext,type Page} from '@playwright/test';

/** Two independent browser contexts, actual disposable Postgres + Edge Function; no hosted credentials. */
test('signed-in preview draft saves, resumes, updates, isolates and deletes across browsers',async({browser},info)=>{
  test.setTimeout(120_000);
  const raw=process.env.TAXPAY_LOCAL_SUPABASE_URL;
  const key=process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
  if(!raw||!key)throw new Error('Disposable local Supabase credentials required.');
  const api=new URL(raw);
  if(api.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(api.hostname))
    throw new Error('Refusing draft persistence tests against hosted SQL.');
  const viewport=info.project.name.startsWith('mobile')?{width:375,height:812}:{width:1280,height:800};
  const contexts:BrowserContext[]=[];
  const make=async()=>{
    const context=await browser.newContext({baseURL:'http://127.0.0.1:4173',viewport});
    contexts.push(context);
    return context.newPage();
  };
  const login=async(page:Page,id:'user1'|'user2')=>{
    await page.goto('/?action=taxpayer_login');
    await page.getByRole('textbox',{name:'User ID'}).fill(id);
    await page.getByLabel('Password',{exact:true}).fill(id);
    await page.getByRole('button',{name:'Sign In',exact:true}).click();
    await expect(page).toHaveURL(/action=taxpayer_home/);
    await page.goto('/?action=guest');
    await expect(page.getByTestId('preview-drafts-guest_payment')).toBeVisible();
  };
  try{
    const first=await make();
    await login(first,'user1');
    const unique='TEST-DRAFT-'+Date.now();
    await first.locator('#guest-notice-ref').fill(unique);
    const panel=first.getByTestId('preview-drafts-guest_payment');
    await panel.getByRole('button',{name:'Save draft'}).click();
    await expect(panel.getByRole('status')).toContainText('Draft saved to your account');
    await panel.getByRole('button',{name:/My drafts/}).click();
    await expect(panel.getByText('TAX WITH RETURN')).toBeVisible();

    const second=await make();
    await login(second,'user1');
    const otherPanel=second.getByTestId('preview-drafts-guest_payment');
    await otherPanel.getByRole('button',{name:/My drafts/}).click();
    await expect(otherPanel.getByText('TAX WITH RETURN')).toBeVisible();
    await otherPanel.getByRole('button',{name:'Continue'}).click();
    await expect(second.locator('#guest-notice-ref')).toHaveValue(unique);
    await second.locator('#guest-notice-ref').fill(unique+'-EDIT');
    await otherPanel.getByRole('button',{name:'Save draft'}).click();
    await expect(otherPanel.getByRole('status')).toContainText('Draft saved to your account');

    // Optimistic version prevents stale browser A from overwriting browser B.
    await first.locator('#guest-notice-ref').fill(unique+'-STALE');
    await panel.getByRole('button',{name:'Save draft'}).click();
    await expect(panel.getByRole('status')).toContainText('changed in another session');

    const other=await make();
    await login(other,'user2');
    const otherUserPanel=other.getByTestId('preview-drafts-guest_payment');
    await otherUserPanel.getByRole('button',{name:/My drafts/}).click();
    await expect(otherUserPanel.getByText('No saved drafts.')).toBeVisible();
    await expect(otherUserPanel.getByText('TAX WITH RETURN')).toHaveCount(0);

    await otherPanel.getByRole('button',{name:/My drafts/}).click();
    await otherPanel.getByRole('button',{name:'Delete',exact:true}).click();
    await otherPanel.getByRole('button',{name:'Confirm delete'}).click();
    await expect(otherPanel.getByRole('status')).toContainText('Draft deleted');
    await expect(otherPanel.getByText('No saved drafts.')).toBeVisible();
  }finally{
    await Promise.all(contexts.map(context=>context.close()));
  }
});
