import assert from 'node:assert/strict';
import test from 'node:test';
import {projectRecipientPaymentActivity,formatRecipientCompletedMinor} from '../src/services/recipientPaymentActivity';
import type {StoredReceivedPaymentNotice} from '../src/services/demoReceivedPaymentNotices';
const base:StoredReceivedPaymentNotice={eventId:'p1:allocation:1',paymentId:'p1',allocationId:'a1',recipientTin:null,serviceCode:'GIFT_TAX',headId:null,assessmentYear:'2026-27',amountMinor:123456,receiptReference:'REF',createdAt:'2026-11-25T23:00:00Z',isRead:true,acknowledgedAt:'2026-11-26T01:00:00Z',paymentStatus:'SIMULATED_SUCCESS'};
test('received allocations count a completed payment once and add exact recipient minor units only',()=>{
 const other={...base,eventId:'p1:allocation:2',allocationId:'a2',amountMinor:500};
 const unknown={...base,paymentId:'p2',eventId:'p2:allocation:1',paymentStatus:undefined,amountMinor:999999};
 const older={...base,paymentId:'p3',eventId:'p3:allocation:1',assessmentYear:'2025-26'};
 const view=projectRecipientPaymentActivity([base,other,unknown,older,{...base}], '2026-2027');
 assert.equal(view.completedPaymentCount,1);assert.equal(view.completedMinor,123956n);
 assert.equal(formatRecipientCompletedMinor(view.completedMinor,'en'),'৳1,239.56');
 assert.equal(formatRecipientCompletedMinor(view.completedMinor,'bn'),'৳১,২৩৯.৫৬');
});
test('conflicting duplicate allocation excludes ambiguous amount without dropping other valid allocations',()=>{
 const view=projectRecipientPaymentActivity([base,{...base,amountMinor:9},{...base,allocationId:'a2',eventId:'p1:allocation:2',amountMinor:10}]);
 assert.equal(view.inconsistentAllocationCount,1);assert.equal(view.completedMinor,10n);
});
test('unconfirmed legacy payment never inflates completed total, including a dismissed notice',()=>{
 const view=projectRecipientPaymentActivity([{...base,paymentStatus:undefined}]);
 assert.equal(view.rows.length,1);assert.equal(view.completedMinor,0n);assert.equal(view.completedPaymentCount,0);
});
