import {test} from 'node:test';
import assert from 'node:assert/strict';
import {paymentTagGroupForTin} from '../src/services/beneficiaryPaymentTags';
const tin='909000000011';
test('derive family and friends separately and prevent double counting for ambiguous tags',()=>{
 const sample=[
  {tin,tag:'friends_family',relationship:'mother'},
  {tin:'222222222222',tag:'friends_family',relationship:'friends'},
  {tin:'333333333333',tag:'clients',relationship:null},
  {tin:'444444444444',tag:'others',relationship:null},
 ];
 assert.equal(paymentTagGroupForTin(tin,sample as any),'family');
 assert.equal(paymentTagGroupForTin('222222222222',sample as any),'friends');
 assert.equal(paymentTagGroupForTin('333333333333',sample as any),'clients');
 assert.equal(paymentTagGroupForTin('444444444444',sample as any),'others');
 assert.equal(paymentTagGroupForTin('555555555555',sample as any),'unassigned');
 assert.equal(paymentTagGroupForTin(undefined,sample as any),'unassigned');
 assert.equal(paymentTagGroupForTin(tin,[...sample,{tin,tag:'clients',relationship:null}] as any),'unassigned');
});
