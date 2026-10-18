import assert from 'node:assert/strict';
const tax='https://eyqhoavnitkrajvyqvxn.supabase.co/functions/v1/demo-story1-taxpay';
const office='https://ihbtabrvmyiwikqqbhrf.supabase.co/functions/v1/demo-story1-office';
const sessionId='10c81297-08a9-4958-87fb-0f59de2c3c75';
const body={
 idempotencyKey:'32e72f2d-d7fa-4690-a550-470602851310',
 sessionId,service:'ADVANCE_TAX',amountMinor:125000,
 details:{payerName:'Sample Taxpayer One',taxpayerTin:'1111111111111',
 assessmentYear:'2026-27',receiptReference:'DEMO-TEST-20261018',
 paymentMethod:'BKASH',lines:[{headId:1,totalAmount:1250}]}
};
async function read(url,options){
 const response=await fetch(url,options);
 const payload=await response.json();
 assert.equal(response.status,200,`${url}: ${response.status} ${JSON.stringify(payload)}`);
 assert.equal(payload.success,true,`${url} did not return success`);
 return payload.data??payload;
}
const submitted=await read(tax+'/payments',{
 method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
assert.equal(submitted.mirrored,true);
assert.equal(submitted.status,'SIMULATED_SUCCESS');
const detail=await read(tax+'/payments/'+submitted.id+'?sessionId='+sessionId);
assert.equal(detail.data.service,'ADVANCE_TAX');
assert.equal(detail.data.amountMinor,125000);
const officeItems=await read(office+'/payments');
const mirrored=officeItems.find(p=>p.id===submitted.id);
assert.ok(mirrored,'Office SQL mirror missing');
assert.equal(mirrored.amountMinor,body.amountMinor);
assert.equal(mirrored.details.payerName,body.details.payerName);
const officeNotices=await read(office+'/notifications');
assert.ok(officeNotices.some(n=>n.paymentId===submitted.id),'Office notification missing');
const taxpayerNotices=await read(tax+'/notifications?sessionId='+sessionId);
assert.ok(taxpayerNotices.some(n=>n.paymentId===submitted.id),'TaxPay notification missing');
const replay=await read(tax+'/payments',{
 method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
assert.equal(replay.id,submitted.id);
assert.equal(replay.replayed,true);
const officeAfter=await read(office+'/payments');
assert.equal(officeAfter.filter(p=>p.id===submitted.id).length,1,'Duplicate Office mirror');
console.log('PASS: simulated payment persisted, mirrored, notified, idempotent');
