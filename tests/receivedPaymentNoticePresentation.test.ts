import assert from 'node:assert/strict';
import test from 'node:test';
import {receivedPaymentNoticePresentation,receivedNoticeDhakaDay} from '../src/services/receivedPaymentNoticePresentation';
import type {ReceivedPaymentNotice} from '../src/services/demoReceivedPaymentNotices';
const notice:ReceivedPaymentNotice={eventId:'event',paymentId:'00000000-0000-0000-0000-000000000001',allocationId:'allocation',recipientTin:null,serviceCode:'GIFT_TAX',headId:'unrelated-head',assessmentYear:'2026-27',amountMinor:125050,receiptReference:'REF-1',createdAt:'2026-11-25T23:30:00Z',isRead:false,payerName:'Example payer',paymentStatus:'SIMULATED_SUCCESS'};
test('confirmed simulated success exposes recipient allocation and localized service, payer and time',()=>{
 const en=receivedPaymentNoticePresentation(notice,'en');
 assert.equal(en.title,'A payment has been made on your behalf.');
 assert.equal(en.category,'Gift Tax');assert.equal(en.payer,'Example payer');assert.equal(en.year,'2026-27');assert.equal(en.amount,'৳ 1,250.5');assert.equal(en.reference,'REF-1');assert.match(en.dateTime,/26\/11\/2026, 05:30:00/);assert.equal(en.status,'Completed (simulated)');
 const bn=receivedPaymentNoticePresentation(notice,'bn');assert.equal(bn.category,'দানকর');assert.equal(bn.amount,'৳ ১,২৫০.৫');assert.equal(bn.status,'সম্পন্ন (সিমুলেটেড)');
});
test('legacy notices do not invent payer, service or completion; payment ID remains stable fallback',()=>{
 const en=receivedPaymentNoticePresentation({...notice,payerName:undefined,paymentStatus:undefined,serviceCode:null,receiptReference:null},'en',true);
 assert.equal(en.title,'Received payment notice');assert.equal(en.payer,'Payer name unavailable');assert.equal(en.category,'Payment category unavailable');assert.equal(en.status,'Recorded — settlement not confirmed');assert.equal(en.reference,notice.paymentId);
});

test('the panel can present a dismissed notice without changing its payment status or local event day',()=>{
 const read={...notice,isRead:true,acknowledgedAt:'2026-11-26T01:00:00Z'};
 const view=receivedPaymentNoticePresentation(read,'en');
 assert.equal(view.status,'Completed (simulated)');
 assert.equal(view.reference,notice.receiptReference);
 assert.equal(read.isRead,true);
 assert.equal(receivedNoticeDhakaDay(notice.createdAt),'2026-11-26');
});

test('initiated notice has exact approved title in both languages and never implies completion',()=>{
 const initiated={...notice,paymentStatus:'SIMULATED_INITIATED' as const};
 const en=receivedPaymentNoticePresentation(initiated,'en');
 assert.equal(en.title,'A payment has been initiated on your behalf');
 assert.equal(en.status,'Initiated (simulated)');
 const bn=receivedPaymentNoticePresentation(initiated,'bn');
 assert.equal(bn.title,'আপনার পক্ষ থেকে একটি পেমেন্ট শুরু হয়েছে');
 assert.equal(bn.status,'শুরু হয়েছে (সিমুলেটেড)');
 assert.equal(en.reference,notice.receiptReference);
});
