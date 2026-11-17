import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {assertAccountNotificationReadRows,createAccountNotificationRefreshGate} from '../src/services/notificationReadConfirmation';

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
