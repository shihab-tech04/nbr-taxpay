import {expect,test} from '@playwright/test';
import {randomBytes,randomUUID} from 'node:crypto';
import {enterTaxPayService} from './pay-tax-entry-helper';

// Real disposable Auth + PostgREST. Fail closed if pointed at any hosted database.
test('real account saves private beneficiary, reopens it, isolates another owner and prefills Pay Tax',async({browser})=>{
  test.setTimeout(120_000);
  const raw=process.env.TAXPAY_LOCAL_SUPABASE_URL, key=process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
  if(!raw||!key)throw new Error('BLOCKED: disposable local Supabase credentials required');
  const api=new URL(raw);
  if(api.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(api.hostname))
    throw new Error('Refusing non-loopback beneficiary acceptance');
  const makeUser=async()=>{
    const email='beneficiary-'+randomUUID()+'@example.invalid',password=randomBytes(32).toString('base64url');
    const response=await fetch(new URL('/auth/v1/signup',api.origin),{
      method:'POST',headers:{apikey:key,'Content-Type':'application/json'},
      body:JSON.stringify({email,password}),
    });
    expect(response.status).toBe(200);
    const value=await response.json();
    expect(value.user?.id).toBeTruthy();
    const session=value.session??value;
    expect(session.access_token).toBeTruthy();
    return {id:value.user.id as string,session};
  };
  const ownerA=await makeUser(),ownerB=await makeUser();
  const loginUrl=(session:{access_token:string;refresh_token:string;expires_at?:number})=>
    '/?action=beneficiaries#access_token='+encodeURIComponent(session.access_token)+
    '&refresh_token='+encodeURIComponent(session.refresh_token)+
    '&token_type=bearer&expires_in=3600&expires_at='+
    (session.expires_at??Math.floor(Date.now()/1000)+3600);
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4173',viewport:{width:375,height:812}});
  const page=await context.newPage();
  await page.goto(loginUrl(ownerA.session));
  await expect(page.getByTestId('beneficiaries-page')).toBeVisible({timeout:15000});
  await expect(page.getByRole('heading',{name:'Beneficiaries',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Add single'}).click();
  await page.locator('#beneficiary-new-list-name').fill('Family');
  await page.locator('#beneficiary-tin').fill('012345678901');
  await page.locator('#beneficiary-name').fill('Local Beneficiary One');
  await page.getByRole('button',{name:'Add beneficiary',exact:true}).click();
  await expect(page.getByText('Beneficiary saved.')).toBeVisible({timeout:15000});
  await expect(page.getByText('012345678901')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
  await expect(page.getByText('Local Beneficiary One')).toBeVisible();

  // Import a genuine compressed Excel workbook: one duplicate and one valid new beneficiary.
  await page.getByRole('button',{name:'Bulk add'}).click();
  await page.locator('#beneficiary-file').setInputFiles({
    name:'beneficiaries-two-rows.xlsx',
    mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer:Buffer.from('UEsDBBQAAAAIAJQsXl0cdPw42AAAAPYBAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbK2RvU4DMQzHX+WUtWpcGDqgXhfKCgy8gJvz9aLLl2K3XN++uVAYUIGFyUr+Hz9L3rydE3EzeRe4VYNIegBgM5BH1jFRKEofs0cpz3yAhGbEA8H9arUGE4NQkKXMHWq72VGPRyfN01S+2cbQqkyOVfP4YZxZrcKUnDUoRYdT6L5RlleCLsnq4cEmXhSDgpuEWfkZcM29nChn21Hzilme0RcXTA7eYx73MY7695IbW8a+t4a6aI6+RDSnTNjxQCTe6Tq1RxsWf/OrmaGOu39e5Kv/cw+o595eAFBLAwQUAAAACACULF5d/luGcooAAADwAAAACwAAAF9yZWxzLy5yZWxzjc8xDsIwDAXQq1Q+QF0YGFDaiaUr4gImddqqTRw5QZTbk7EgBkbrf70vmyuvlGcJaZpjqja/htTClHM8IyY7sadUS+RQEifqKZdTR4xkFxoZj01zQt0b0Jm9WfVDC9oPB6hur8j/2OLcbPki9uE55B8TX40ik46cW9hWfIoud5GlLihgZ/Djwe4NUEsDBBQAAAAIAJQsXl1ulYF6lQAAAOsAAAAPAAAAeGwvd29ya2Jvb2sueG1sjY+xDoMwDER/JfIH1NChAwKGqgufkYJpIkgc2UHt5zeCsnc6n073rGvfLMuTeTGfsEbtwOWcGkQdHQWrF04USzKzBJuLlRdqErKTOqIcVrxW1Q2D9REOQiP/MHie/UgPHrdAMR8QodVmz1GdTwp9u3/Qn5poA3Vwp0il6a14UjB7NEwd1GCk8eWQYaoB+xbPNp4D+y9QSwMEFAAAAAgAlCxeXbZUqs+OAAAA8QAAABoAAAB4bC9fcmVscy93b3JrYm9vay54bWwuc43PPQ7CMAwF4KtUOUDdMjCgJhNLV8QFotRtojY/so2A2xMxoCIxMFl+lr4nDxfcrISc2IfCzSNuibXyIuUEwM5jtNzmgqle5kzRSl1pgWLdaheEQ9cdgfaGMsPebMZJKxqnXjXXZ8F/7DzPweE5u1vEJD8q4J5pZY8oFbW0oGj1iRjeo2+rqsAM8PWheQFQSwMEFAAAAAgAlCxeXeIzMv/dAAAA+QEAABgAAAB4bC93b3Jrc2hlZXRzL3NoZWV0MS54bWx9kdFqwzAMRX/F+AMmO2nTZDiGlb0URvew7gOMpy5msR1sQ7q/n1tG2Fi8N+lKV/eAxOzDRxwQE7nY0cWeDilN9wBRD2hVvPMTujw5+2BVym14hzgFVG83kx2hYqwBq4yjUty0R5WUFMHPJPSUZ1VfiwdOSeqpcaNx+JJC1k2UIsnT4SggSQHXFvT3+r60/hoxkKOy+NsEOW8JrZbQqnCF8arebJtd2zG+ll7yPXmtRrJHh2ejjQqf5Nn9R1IvJHXhYtfumu2mrjjr2jWSku8vyWn2ayTw4ymwfFt+AVBLAQIUAxQAAAAIAJQsXl0cdPw42AAAAPYBAAATAAAAAAAAAAAAAACAAQAAAABbQ29udGVudF9UeXBlc10ueG1sUEsBAhQDFAAAAAgAlCxeXf5bhnKKAAAA8AAAAAsAAAAAAAAAAAAAAIABCQEAAF9yZWxzLy5yZWxzUEsBAhQDFAAAAAgAlCxeXW6VgXqVAAAA6wAAAA8AAAAAAAAAAAAAAIABvAEAAHhsL3dvcmtib29rLnhtbFBLAQIUAxQAAAAIAJQsXl22VKrPjgAAAPEAAAAaAAAAAAAAAAAAAACAAX4CAAB4bC9fcmVscy93b3JrYm9vay54bWwucmVsc1BLAQIUAxQAAAAIAJQsXl3iMzL/3QAAAPkBAAAYAAAAAAAAAAAAAACAAUQDAAB4bC93b3Jrc2hlZXRzL3NoZWV0MS54bWxQSwUGAAAAAAUABQBFAQAAVwQAAAAA','base64'),
  });
  const importAlerts=await page.locator('[role="alert"]').allTextContents();
  await expect(page.getByText(/Upload successful:/),'Excel parser / import errors: '+JSON.stringify(importAlerts)).toBeVisible();
  await page.getByRole('button',{name:'Next'}).click();
  await expect(page.getByText('Already saved in this list.')).toBeVisible();
  await expect(page.getByText('1 valid, 1 needing attention')).toBeVisible();
  await page.getByRole('button',{name:'Next'}).click();
  await page.getByRole('button',{name:'Finish Import'}).click();
  await expect(page.getByText('1 beneficiaries added to the list.')).toBeVisible({timeout:15000});
  await expect(page.getByText('Local Beneficiary Two')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Local Beneficiary Two')).toBeVisible();

  const read=async(token:string)=>{
    const response=await fetch(new URL('/rest/v1/taxpay_beneficiaries?select=owner_uid,tin,display_name',api.origin),{
      headers:{apikey:key,Authorization:'Bearer '+token},
    });
    expect(response.status).toBe(200);
    return response.json();
  };
  const own=await read(ownerA.session.access_token);
  expect(own).toHaveLength(2);
  expect(own).toEqual(expect.arrayContaining([{owner_uid:ownerA.id,tin:'012345678901',display_name:'Local Beneficiary One'},{owner_uid:ownerA.id,tin:'987654321098',display_name:'Local Beneficiary Two'}]));
  expect(await read(ownerB.session.access_token)).toEqual([]);

  const otherContext=await browser.newContext({baseURL:'http://127.0.0.1:4173',viewport:{width:320,height:720}});
  const otherPage=await otherContext.newPage();
  await otherPage.goto(loginUrl(ownerB.session));
  await expect(otherPage.getByTestId('beneficiaries-page')).toBeVisible({timeout:15000});
  await expect(otherPage.getByText('Local Beneficiary One')).toHaveCount(0);
  await otherContext.close();

  await page.goto('/?action=landing');
  await page.getByRole('button',{name:'Pay Tax',exact:true}).first().click();
  const modal=page.getByRole('dialog',{name:'Pay Tax'});
  await enterTaxPayService(modal,'OTHER_TAX_PAYMENT','OTHER');
  const picker=modal.getByTestId('saved-beneficiary-picker');
  await expect(picker).toContainText('Local Beneficiary One',{timeout:15000});
  await picker.locator('label').filter({hasText:'Local Beneficiary One'}).locator('input').check();
  await picker.getByRole('button',{name:/Add selected to payment|Use selected beneficiary/}).click();
  await expect(modal.locator('#guest-tin')).toHaveValue('012345678901');
  await context.close();
});
