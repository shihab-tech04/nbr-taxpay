import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPaymentHistoryRefresh} from '../src/services/paymentHistoryRefresh';
const deferred=<T>()=>{let resolve!:(value:T)=>void;let reject!:(error:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const settle=async()=>{await Promise.resolve();await Promise.resolve();};
test('confirmed events refresh immediately without a periodic tick',async()=>{
  const seen:number[]=[];let count=0;
  const queue=createPaymentHistoryRefresh(async()=>++count,value=>seen.push(value),error=>{throw error;});
  queue.refresh();assert.equal(count,1);await settle();assert.deepEqual(seen,[1]);
  queue.refresh();assert.equal(count,2);await settle();assert.deepEqual(seen,[1,2]);queue.dispose();
});
test('concurrent events coalesce, stale read cannot win, and poll does not overlap',async()=>{
  const first=deferred<number>(),next=deferred<number>(),seen:number[]=[];let count=0;
  const queue=createPaymentHistoryRefresh(()=>++count===1?first.promise:next.promise,value=>seen.push(value),error=>{throw error;});
  queue.refresh();queue.poll();queue.refresh();queue.refresh();queue.poll();assert.equal(count,1);
  first.resolve(1);await settle();assert.deepEqual(seen,[]);assert.equal(count,2);
  next.resolve(2);await settle();assert.deepEqual(seen,[2]);queue.dispose();
});
test('owner change or unmount discards pending reads and ignores later events',async()=>{
  const first=deferred<number>(),seen:number[]=[];let count=0;
  const queue=createPaymentHistoryRefresh(()=>{count++;return first.promise;},value=>seen.push(value),error=>{throw error;});
  queue.refresh();queue.refresh();queue.dispose();first.resolve(1);await settle();queue.refresh();queue.poll();
  assert.deepEqual(seen,[]);assert.equal(count,1);
});
test('a failed SQL read remains an error; the next event recovers without inventing records',async()=>{
  const seen:number[]=[],errors:unknown[]=[];let count=0;
  const queue=createPaymentHistoryRefresh(async()=>{if(++count===1)throw Error('unavailable');return 2;},value=>seen.push(value),error=>errors.push(error));
  queue.refresh();await settle();assert.equal(errors.length,1);assert.deepEqual(seen,[]);
  queue.refresh();await settle();assert.deepEqual(seen,[2]);queue.dispose();
});
