import test from 'node:test';
import assert from 'node:assert/strict';
import {historyModeForBoundId} from '../src/services/accountHistoryMode';

test('existing bound private simulator remains reachable',()=>{
  assert.equal(historyModeForBoundId('user6'),'simulation');
  assert.equal(historyModeForBoundId('user10'),'simulation');
});
test('TIN-unbound app accounts use protected review history, never public demo',()=>{
  for(const id of [null,undefined,'', 'user999',{},'user6;DROP TABLE']){
    assert.equal(historyModeForBoundId(id),'reviews');
  }
});
