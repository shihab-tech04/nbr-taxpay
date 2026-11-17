import assert from 'node:assert/strict';
import {test} from 'node:test';
import {collectBeneficiaryPages} from '../src/services/beneficiaries';

const records=Array.from({length:1201},(_,i)=>({id:'beneficiary-'+i}));

test('WS2 beneficiary lists load all owner SQL pages without silently truncating',async()=>{
  const calls:Array<[number,number]>=[];
  const rows=await collectBeneficiaryPages(async(from,to)=>{
    calls.push([from,to]);
    return records.slice(from,to+1);
  });
  assert.deepEqual(rows,records);
  assert.deepEqual(calls,[[0,499],[500,999],[1000,1499]]);
  assert.deepEqual(await collectBeneficiaryPages(async()=>[]),[]);
});

test('WS2 beneficiary pagination rejects duplicates from concurrent page drift',async()=>{
  await assert.rejects(collectBeneficiaryPages(async(from)=>from===0
    ?[{id:'first'},{id:'second'}]
    :[{id:'second'}],2),/changed while loading/);
});

test('WS2 beneficiary pagination rejects oversized and malformed SQL pages',async()=>{
  await assert.rejects(collectBeneficiaryPages(async()=>
    [{id:'a'},{id:'b'},{id:'c'}],2),/Invalid saved beneficiary page/);
  await assert.rejects(collectBeneficiaryPages(async()=>[{} as {id:string}],10),
    /changed while loading/);
});

test('WS2 beneficiary pagination has a bounded safe retrieval limit',async()=>{
  await assert.rejects(collectBeneficiaryPages(async()=>[{id:'a'},{id:'b'}],2,1),
    /safe retrieval limit/);
  await assert.rejects(collectBeneficiaryPages(async()=>[],0),
    /Invalid beneficiary pagination/);
  await assert.rejects(collectBeneficiaryPages(async()=>[],1,101),
    /Invalid beneficiary pagination/);
});
