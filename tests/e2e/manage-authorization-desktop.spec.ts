import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page, userId: 'user1' | 'user2') {
  await page.goto('/?action=taxpayer_login');
  const login = page.getByRole('dialog', { name: 'Sign In To Your Amar Kor Account' });
  await login.getByRole('textbox', { name: 'User ID' }).fill(userId);
  await login.getByRole('textbox', { name: 'Password' }).fill(userId);
  await login.getByRole('button', { name: 'Sign In' }).click();
  await page.goto('/?action=manage_authorization');
}

test('recipient accepts, payer confirms 4 digits, and recipient revokes', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  const requests: Array<{
    id:string;payerId:'user1';taxpayerId:'user2';status:string;requestedAt:number;
    codeExpiresAt:number;consentCode:string|null;confirmedAt:number|null;
    activeUntil:null;attempts:number;revokedAt:number|null;
  }> = [];
  // Isolated API fixture: CI never modifies the live demo databases.
  await page.route('**/functions/v1/demo-story1-taxpay/authorizations**', async route => {
    const request=route.request(),url=new URL(request.url());
    if(request.method()==='GET'){
      const actor=url.searchParams.get('actor');
      const rows=requests.filter(r=>r.payerId===actor||r.taxpayerId===actor).map(r=>({
        ...r,consentCode:r.taxpayerId===actor?r.consentCode:null
      }));
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data:rows})});
      return;
    }
    const input=request.postDataJSON() as {actor:string;action:string;id?:string;tin?:string;code?:string};
    let row=requests.find(r=>r.id===input.id);
    if(input.action==='request'&&input.actor==='user1'&&input.tin==='2222222222222'){
      row={id:'9e13df95-85ec-4548-8363-467a6d6e95f0',payerId:'user1',taxpayerId:'user2',
        status:'PENDING',requestedAt:Date.now(),codeExpiresAt:Date.now()+900000,consentCode:null,
        confirmedAt:null,activeUntil:null,attempts:0,revokedAt:null};
      requests.push(row);
    }else if(row&&input.action==='accept'&&input.actor==='user2'){
      row.status='CODE_ISSUED';row.consentCode='4826';
    }else if(row&&input.action==='confirm'&&input.actor==='user1'&&input.code==='4826'){
      row.status='ACTIVE';row.confirmedAt=Date.now();row.consentCode=null;
    }else if(row&&input.action==='revoke'&&input.actor==='user2'){
      row.status='REVOKED';row.revokedAt=Date.now();
    }else{await route.fulfill({status:409,contentType:'application/json',body:'{"success":false,"error":"INVALID_ACTION"}'});return;}
    await route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({success:true,mirrored:true,data:{id:row.id,status:row.status,consentCode:row.consentCode,attempts:row.attempts}})});
  });
  await signIn(page,'user1');
  const authorization=page.getByTestId('manage-authorization');
  const directions=authorization.getByRole('navigation',{name:'Authorization direction'});
  await expect(directions.getByRole('button',{name:'I can pay for'})).toBeVisible();
  await expect(directions.getByRole('button',{name:'Can pay for me'})).toBeVisible();
  await authorization.getByRole('button',{name:'Add'}).click();
  await authorization.getByLabel('Taxpayer TIN').fill('2222222222222');
  await authorization.getByRole('button',{name:'Request authorization'}).click();
  await expect(authorization.getByRole('status')).toContainText('Request sent');
  await page.getByRole('button',{name:'Sign out'}).click();

  await signIn(page,'user2');
  const popup=page.getByRole('dialog',{name:'Payment authorization request'});
  await expect(popup).toBeVisible();
  await popup.getByRole('button',{name:'Accept'}).click();
  await expect(popup.getByText('4826')).toBeVisible();
  await popup.getByRole('button',{name:'Close'}).click();
  await page.getByRole('button',{name:'Sign out'}).click();

  await signIn(page,'user1');
  await expect(authorization.getByText('Awaiting code')).toBeVisible();
  await authorization.getByRole('textbox',{name:'Four-digit confirmation code'}).fill('4826');
  await authorization.getByRole('button',{name:'Complete authorization'}).click();
  await expect(authorization.getByText('Active',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Sign out'}).click();

  await signIn(page,'user2');
  await authorization.getByRole('navigation',{name:'Authorization direction'})
    .getByRole('button',{name:'Can pay for me'}).click();
  await authorization.getByRole('button',{name:'Remove authorization'}).click();
  await authorization.getByRole('button',{name:'Confirm removal'}).click();
  await expect(authorization.getByText('Revoked',{exact:true})).toBeVisible();
});
