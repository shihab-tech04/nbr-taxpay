import {describe,it,expect} from 'vitest';
import {parseReceivedPaymentNotice} from '../src/services/demoReceivedPaymentNotices';

const valid={
  eventId:'parent:allocation:1',
  paymentId:'77777777-7777-4777-8777-777777777777',
  allocationId:'allocation-1',recipientTin:'222222222222',
  headId:'121',serviceCode:'ADVANCE_TAX',assessmentYear:'2026-27',
  amountMinor:1500,receiptReference:'SIM-123',createdAt:'2026-11-13T18:00:00Z',
  isRead:false,
};

describe('WS2 recipient notice capability feed parsing',()=>{
  it('retains only the recipient allocation and exact amount/year/reference',()=>{
    const parsed=parseReceivedPaymentNotice({...valid,payerTin:'PRIVATE-FOREIGN-TIN',
      allocations:[{taxpayerTin:'333333333333'}]});
    expect(parsed).toMatchObject({eventId:valid.eventId,recipientTin:valid.recipientTin,
      amountMinor:1500,assessmentYear:'2026-27',receiptReference:'SIM-123'});
    expect(parsed).not.toHaveProperty('payerTin');
    expect(parsed).not.toHaveProperty('allocations');
  });
  it('rejects unsafe amounts, malformed rows and pre-acknowledged feed items',()=>{
    for(const changes of [{amountMinor:Number.MAX_SAFE_INTEGER+1},{amountMinor:0},
      {amountMinor:-1},{amountMinor:1.5},{isRead:true},
      {eventId:''},{paymentId:'wrong-id'},{createdAt:'not-a-date'}]){
      expect(()=>parseReceivedPaymentNotice({...valid,...changes})).toThrow();
    }
  });
});
