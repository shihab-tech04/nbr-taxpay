import test from 'node:test';
import assert from 'node:assert/strict';
import {activityPaymentPayer} from '../src/services/activityPaymentPayer';
import type {ChallanReceipt} from '../src/types/tax';

const receipt=(payerName:string,payerTin:string):ChallanReceipt=>({payerName,payerTin} as ChallanReceipt);

test('combined receipts show the one recorded payer, not the user or beneficiary',()=>{
  const row={kind:'income',sql:{receipts:[receipt('Actual payer','111111111111'),receipt('Actual payer','111111111111')]}};
  assert.deepEqual(activityPaymentPayer(row,{name:'Example user',tin:'999999999999'}),{
    name:'Actual payer',tin:'111111111111'
  });
});

test('absent and conflicting batch payer data fail closed',()=>{
  assert.equal(activityPaymentPayer({sql:{receipts:[]}}, {name:'Example user'}),null);
  assert.equal(activityPaymentPayer({sql:{receipts:[receipt('One','111111111111'),receipt('Two','111111111111')]}},null),null);
  assert.equal(activityPaymentPayer({sql:{receipts:[receipt('One','111111111111'),receipt('One','222222222222')]}},null),null);
  assert.equal(activityPaymentPayer({sql:{receipts:[receipt('—','')]}}),null);
});

test('only fictional income rows inherit their explicitly documented example payer',()=>{
  const example={name:'Md. Arif Rahman',tin:'1111111111111'};
  assert.deepEqual(activityPaymentPayer({kind:'income'},example),example);
  for(const kind of ['tds','ait','travel','refund','adjustment']){
    assert.equal(activityPaymentPayer({kind},example),null);
  }
});
