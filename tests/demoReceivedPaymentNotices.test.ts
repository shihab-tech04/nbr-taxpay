import test from 'node:test';
import assert from 'node:assert/strict';
import {parseReceivedPaymentNotice} from '../src/services/demoReceivedPaymentNotices';

const valid={
  eventId:'parent:allocation:1',
  paymentId:'77777777-7777-4777-8777-777777777777',
  allocationId:'allocation-1',recipientTin:'222222222222',
  headId:'121',serviceCode:'ADVANCE_TAX',assessmentYear:'2026-27',
  amountMinor:1500,receiptReference:'SIM-123',createdAt:'2026-11-13T18:00:00Z',
  isRead:false,
};

test('recipient notice retains only own allocation/year and no foreign source details',()=>{
  const parsed=parseReceivedPaymentNotice({...valid,payerTin:'PRIVATE-FOREIGN-TIN',
    allocations:[{taxpayerTin:'333333333333'}]});
  assert.equal(parsed.eventId,valid.eventId);
  assert.equal(parsed.recipientTin,'222222222222');
  assert.equal(parsed.amountMinor,1500);
  assert.equal(parsed.assessmentYear,'2026-27');
  assert.equal(parsed.receiptReference,'SIM-123');
  assert.equal(Object.hasOwn(parsed,'payerTin'),false);
  assert.equal(Object.hasOwn(parsed,'allocations'),false);
});

test('recipient notice rejects unsafe amounts, malformed and already-read events',()=>{
  for(const changes of [{amountMinor:Number.MAX_SAFE_INTEGER+1},{amountMinor:0},
    {amountMinor:-1},{amountMinor:1.5},{isRead:true},
    {eventId:''},{paymentId:'wrong-id'},{createdAt:'not-a-date'}]){
    assert.throws(()=>parseReceivedPaymentNotice({...valid,...changes}));
  }
});


test('recipient backlog retrieves 205 events and preserves their order across pages',async()=>{
  const base='77777777-7777-4777-8777-777777777777';
  const records=Array.from({length:205},(_,i)=>({...valid,eventId:base+':allocation:'+(i+1)}));
  const offsets:number[]=[];
  const {loadUnreadReceivedPaymentNotices}=await import('../src/services/demoReceivedPaymentNotices');
  const all=await loadUnreadReceivedPaymentNotices(async(offset,limit)=>{
    offsets.push(offset);
    const slice=records.slice(offset,offset+limit);
    return {items:slice,total:records.length,offset,limit,hasMore:offset+limit<records.length};
  });
  assert.deepEqual(offsets,[0,100,200]);
  assert.deepEqual(all.map(item=>item.eventId),records.map(item=>item.eventId));
});

test('recipient backlog fails closed on missing page, cross-page duplicate and inconsistent count',async()=>{
  const {loadUnreadReceivedPaymentNotices}=await import('../src/services/demoReceivedPaymentNotices');
  const item=(i:number)=>({...valid,eventId:'event-'+i});
  await assert.rejects(loadUnreadReceivedPaymentNotices(async(offset,limit)=>{
    if(offset===0)return {items:[item(1)],total:2,offset,limit,hasMore:true};
    throw Error('offline');
  }),/offline/);
  await assert.rejects(loadUnreadReceivedPaymentNotices(async(offset,limit)=>({
    items:[item(1)],total:2,offset,limit,hasMore:offset===0,
  })),/Duplicate/);
  await assert.rejects(loadUnreadReceivedPaymentNotices(async(offset,limit)=>({
    items:[item(offset+1)],total:offset===0?2:3,offset,limit,hasMore:offset===0,
  })),/Invalid notice page/);
});


test('stored recipient notices keep acknowledged items and exact recipient-only fields',async()=>{
  const {parseStoredReceivedPaymentNotice}=await import('../src/services/demoReceivedPaymentNotices');
  const old=parseStoredReceivedPaymentNotice({...valid,isRead:true,
    acknowledgedAt:'2026-11-14T04:20:00Z',payerTin:'PRIVATE-FOREIGN-TIN',
    allocations:[{recipientTin:'333333333333'}]});
  assert.equal(old.isRead,true);
  assert.equal(old.acknowledgedAt,'2026-11-14T04:20:00Z');
  assert.equal(old.recipientTin,valid.recipientTin);
  assert.equal(old.amountMinor,1500);
  assert.equal(Object.hasOwn(old,'payerTin'),false);
  assert.equal(Object.hasOwn(old,'allocations'),false);
  const unread=parseStoredReceivedPaymentNotice({...valid,acknowledgedAt:null});
  assert.equal(unread.isRead,false);
  assert.equal(unread.acknowledgedAt,null);
  for(const row of [
    {...valid,isRead:true,acknowledgedAt:null},
    {...valid,isRead:false,acknowledgedAt:'2026-11-14T04:20:00Z'},
    {...valid,isRead:true,acknowledgedAt:'not-a-date'},
    {...valid,isRead:'true',acknowledgedAt:'2026-11-14T04:20:00Z'}
  ])assert.throws(()=>parseStoredReceivedPaymentNotice(row));
});

test('stored notice list retains all 205 read/unread events in SQL order with >100 page recovery',async()=>{
  const {loadStoredReceivedPaymentNotices}=await import('../src/services/demoReceivedPaymentNotices');
  const rows=Array.from({length:205},(_,i)=>({
    ...valid,eventId:'event-'+String(i+1).padStart(4,'0'),
    createdAt:new Date(Date.parse(valid.createdAt)+i*1000).toISOString(),
    isRead:i%2===0,acknowledgedAt:i%2===0?'2026-11-14T04:20:00Z':null
  }));
  const offsets:number[]=[];
  const result=await loadStoredReceivedPaymentNotices(async(offset,limit)=>{
    offsets.push(offset);
    return {items:rows.slice(offset,offset+limit),total:rows.length,offset,limit,
      hasMore:offset+limit<rows.length};
  });
  assert.deepEqual(offsets,[0,100,200]);
  assert.deepEqual(result.map(row=>row.eventId),rows.map(row=>row.eventId));
  assert.equal(result.filter(row=>row.isRead).length,103);
  assert.equal(result.filter(row=>!row.isRead).length,102);
  await assert.rejects(loadStoredReceivedPaymentNotices(async(offset,limit)=>{
    if(offset===0)return {items:rows.slice(0,100),total:205,offset,limit,hasMore:true};
    throw Error('offline');
  }),/offline/);
  await assert.rejects(loadStoredReceivedPaymentNotices(async(offset,limit)=>({
    items:offset===0?[rows[0]]:[rows[0]],total:2,offset,limit,hasMore:offset===0,
  })),/Duplicate/);
  await assert.rejects(loadStoredReceivedPaymentNotices(async(offset,limit)=>({
    items:offset===0?[rows[2]]:[rows[1]],total:2,offset,limit,hasMore:offset===0,
  })),/ordering/);
});
