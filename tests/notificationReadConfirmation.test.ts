import assert from 'node:assert/strict';
import {test} from 'node:test';
import {assertAccountNotificationReadRows} from '../src/services/notificationReadConfirmation';

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
