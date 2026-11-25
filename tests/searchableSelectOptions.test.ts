import assert from 'node:assert/strict';
import {test} from 'node:test';
import {matchSearchableOptions} from '../src/components/ui/SearchableSelect';

const options=[
  {value:'',label:'Choose one'},
  {value:'return',label:'74 — Tax with return',group:'TAX WITH YOUR RETURN',secondary:'রিটার্নের কর'},
  {value:'advance',label:'64 — Advance Tax',group:'ADVANCE TAX',secondary:'অগ্রিম আয়কর'},
  {value:'friends',label:'Friends',group:'FRIENDS & FAMILY'},
  {value:'clients',label:'Clients',group:'BUSINESS'}
];

test('search finds labels, codes, group headings and Bengali secondary labels',()=>{
  assert.deepEqual(matchSearchableOptions(options,'advance').map(x=>x.value),['advance']);
  assert.deepEqual(matchSearchableOptions(options,'74').map(x=>x.value),['return']);
  assert.deepEqual(matchSearchableOptions(options,'অগ্রিম').map(x=>x.value),['advance']);
  assert.deepEqual(matchSearchableOptions(options,'family').map(x=>x.value),['friends']);
  assert.deepEqual(matchSearchableOptions(options,'clients').map(x=>x.value),['clients']);
});
test('empty search preserves option ordering and excludes placeholder values',()=>{
  assert.deepEqual(matchSearchableOptions(options,' ').map(x=>x.value),['return','advance','friends','clients']);
  assert.deepEqual(matchSearchableOptions(options,'not-found'),[]);
});
