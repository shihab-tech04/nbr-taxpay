import assert from 'node:assert/strict';
import {test} from 'node:test';
import {compactRecordItems} from '../src/components/ui/compactRecordItems';

test('one row with four recipients renders one identity and a truthful +3 disclosure',()=>{
  const source=Object.freeze([
    Object.freeze({tin:'111111111111',name:'Recipient A'}),
    Object.freeze({tin:'222222222222',name:'Recipient B'}),
    Object.freeze({tin:'333333333333',name:'Recipient C'}),
    Object.freeze({tin:'444444444444',name:'Recipient D'})
  ]);
  const result=compactRecordItems(source);
  assert.deepEqual(result.visible,[source[0]]);
  assert.equal(result.hiddenCount,3);
  assert.equal(result.totalCount,4);
  assert.equal(source.length,4,'No original allocations or party IDs are removed');
  assert.deepEqual(compactRecordItems(source,4).visible,source);
});

test('empty and single-recipient cells have no more button',()=>{
  assert.deepEqual(compactRecordItems([]),{visible:[],hiddenCount:0,totalCount:0});
  assert.deepEqual(compactRecordItems(['one']),{visible:['one'],hiddenCount:0,totalCount:1});
});

test('nonpositive or invalid list sizes still retain the first recipient',()=>{
  const names=['a','b','c'];
  for(const invalid of [0,-9,Number.NaN,Number.POSITIVE_INFINITY]) {
    const item=compactRecordItems(names,invalid);
    assert.deepEqual(item.visible,['a']);
    assert.equal(item.hiddenCount,2);
  }
});
