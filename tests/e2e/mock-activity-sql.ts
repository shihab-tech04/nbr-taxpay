import type {Page} from '@playwright/test';

/** Deterministic test-only SQL API response, never bundled in the app. */
export function sqlActivityRecord(id='00000000-0000-4000-8000-000000000911', assessmentYear='2023-24', taxpayerTin='111111111111', amountMinor=1500000){
  return {id,service:'OTHER_TAX_PAYMENT',amountMinor,status:'SIMULATED_SUCCESS',createdAt:'2026-11-09T10:00:00.000Z',
    details:{assessmentYear,payerId:'user1',payerName:'Test payer',payerTin:'111111111111',
      taxpayerName:'Test recipient',taxpayerTin,payerMode:taxpayerTin==='111111111111'?'SELF':'OTHER',
      paymentMethod:'SIMULATED',lines:[]}};
}
export async function mockActivitySql(page:Page, records=[sqlActivityRecord()]){
  await page.route(url=>url.pathname==='/functions/v1/demo-story1-taxpay/payments'||url.pathname.startsWith('/functions/v1/demo-story1-taxpay/payments/'),async route=>{
    const req=route.request();
    if(req.method()!=='GET'||!req.headers()['x-taxpay-guest-capability'])
      return route.fulfill({status:403,contentType:'application/json',body:'{}'});
    const path=new URL(req.url()).pathname;
    const payment=records.find(item=>path.endsWith('/'+item.id));
    const data=path.endsWith('/payments')
      ?{items:records.map(({details,...summary})=>summary),total:records.length}
      :payment?{id:payment.id,status:payment.status,createdAt:payment.createdAt,
        data:{origin:'TAXPAY_UI',service:payment.service,amountMinor:payment.amountMinor,details:payment.details}}:null;
    return route.fulfill({status:data?200:404,contentType:'application/json',body:JSON.stringify({success:Boolean(data),simulationOnly:true,data})});
  });
}
