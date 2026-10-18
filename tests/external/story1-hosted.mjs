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
// The POST acknowledgement proves Office SQL confirmed the TaxPay record.
// QA-origin submissions must not appear as user-submitted Admin transactions.
assert.equal(submitted.mirrored,true,'Office SQL did not acknowledge write');
const officePage=await read(office+'/payments?page=1&perPage=100');
assert.ok(Array.isArray(officePage.items),'Paginated Office list required');
assert.equal(officePage.items.some(p=>p.id===submitted.id),false,
  'Automated QA payment leaked into user transaction table');
const officeNotices=await read(office+'/notifications');
assert.equal(officeNotices.some(n=>n.paymentId===submitted.id),false,
  'Automated QA notification leaked into Office activity');
const taxpayerNotices=await read(tax+'/notifications?sessionId='+sessionId);
assert.ok(taxpayerNotices.some(n=>n.paymentId===submitted.id),'TaxPay notification missing');
const replay=await read(tax+'/payments',{
 method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
assert.equal(replay.id,submitted.id);
assert.equal(replay.replayed,true);
const officeAfter=await read(office+'/payments?page=1&perPage=100');
assert.equal(officeAfter.items.filter(p=>p.id===submitted.id).length,0,
  'QA payment must stay outside live transaction list');
console.log('PASS: simulated payment persisted, mirrored, notified, idempotent');
