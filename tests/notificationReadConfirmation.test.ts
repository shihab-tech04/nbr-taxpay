import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {assertAccountNotificationReadRows,createAccountNotificationRefreshGate,collectAccountNotificationPages} from '../src/services/notificationReadConfirmation';

test('WS2 review notices require exact owner-scoped persisted read confirmation',()=>{
  const expected=['notice-a','notice-b'];
  assert.doesNotThrow(()=>assertAccountNotificationReadRows(expected,[
    {id:'notice-b',is_read:true},{id:'notice-a',is_read:true},
  ]));
  for(const rows of [
    [{id:'notice-a'},{id:'notice-b',is_read:true}],
    [{id:'notice-a',is_read:false},{id:'notice-b',is_read:true}],
    [{id:'notice-a',is_read:true}],
    [{id:'notice-a',is_read:true},{id:'notice-a',is_read:true}],
    [{id:'notice-a',is_read:true},{id:'other-owner',is_read:true}],
    [{id:'notice-a',is_read:true},{id:'notice-b',is_read:'true'}],
    null,
  ]){
    assert.throws(()=>assertAccountNotificationReadRows(expected,rows),
      /Review notice read-back not confirmed/);
  }
  assert.doesNotThrow(()=>assertAccountNotificationReadRows([],[]));
});

test('WS2 account notice polling ignores stale responses and invalidated owner views',()=>{
  
  const gate=createAccountNotificationRefreshGate();
  const first=gate.next(),second=gate.next();
  assert.equal(gate.isLatest(first),false);
  assert.equal(gate.isLatest(second),true);
  gate.invalidate();
  assert.equal(gate.isLatest(second),false);
  const third=gate.next();
  assert.equal(gate.isLatest(third),true);
});

test('WS2 private notification rows require both Auth owner and bound simulation profile',()=>{
  const source=readFileSync('src/components/screens/NotificationsView.tsx','utf8');
  assert.match(source,/const noticeIdentity=\(authenticatedUser\?\.id\?\?''\)\+':'\+\(id\?\?''\)/);
  assert.match(source,/noticeOwner===noticeIdentity\?notices:\[\]/);
  assert.match(source,/privatePaymentRows\?\.owner===noticeIdentity/);
  assert.match(source,/setNoticeOwner\(noticeIdentity\)/);
  assert.doesNotMatch(source,/noticeOwner===id/);
});

test('WS2 full account notice register reads every stable page, not just 50 rows',async()=>{
  const records=Array.from({length:235},(_,i)=>({id:'notice-'+String(i).padStart(3,'0')}));
  const calls:Array<[number,number]>=[];
  const result=await collectAccountNotificationPages(async(from,to)=>{
    calls.push([from,to]);
    return records.slice(from,to+1);
  });
  assert.deepEqual(result,records);
  assert.deepEqual(calls,[[0,99],[100,199],[200,299]]);
  assert.deepEqual(await collectAccountNotificationPages(async()=>[]),[]);
});

test('WS2 notice paging fails closed for duplicate, overflow and truncation',async()=>{
  await assert.rejects(collectAccountNotificationPages(async(from,to)=>
    from===0?[{id:'a'},{id:'b'}]:[{id:'b'}],2),/changed while loading/);
  await assert.rejects(collectAccountNotificationPages(async()=>[{id:'a'},{id:'b'},{id:'c'}],2),
    /Invalid account notification page/);
  await assert.rejects(collectAccountNotificationPages(async()=>[{id:'a'},{id:'b'}],2,1),
    /safe retrieval limit/);
  await assert.rejects(collectAccountNotificationPages(async()=>[],101),
    /Invalid account notification pagination/);
});

test('WS2 Account Center reads and acknowledges the full Auth owner SQL register',()=>{
  const source=readFileSync('src/components/screens/AccountCenter.tsx','utf8');
  assert.match(source,/collectAccountNotificationPages<ReviewNotice>/);
  assert.match(source,/\.eq\('recipient_uid',uid\)/);
  assert.match(source,/\.order\('id',\{ascending:false\}\)/);
  assert.match(source,/\.range\(from,to\)/);
  assert.match(source,/item\.recipient_uid!==uid/);
  assert.match(source,/const currentNotices=await readReviewNotices\(supabase,requestUid\)/);
  const chunkIndex=source.indexOf('for(let offset=0;offset<unread.length;offset+=100)');
  const readBackIndex=source.indexOf('assertAccountNotificationReadRows(ids,persisted)',chunkIndex);
  const timestampIndex=source.indexOf('const confirmedReadAt=new Date().toISOString()',chunkIndex);
  assert.ok(chunkIndex>=0 && readBackIndex>chunkIndex && timestampIndex>readBackIndex);
});
