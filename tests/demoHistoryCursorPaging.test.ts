import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getDemoStoryPaymentHistory} from '../src/services/simulatedPaymentsApi';

const transaction=(n:number)=>({
 id:'SIM-'+String(n).padStart(16,'0'),
 transactionId:'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),
 payer:'user1',state:'SIMULATED',reviewStatus:'MIRRORED_TO_OFFICE',
 simulationOnly:true,totalMinor:100,
 createdAt:new Date(Date.UTC(2026,0,1)+n*1000).toISOString(),
 allocations:[{beneficiary:'user1',category:'TAX_WITH_RETURN',
  assessmentYear:'2026-27',amountMinor:100}],
 events:[{id:n,action:'SIMULATION_RECORDED',note:'SQL',occurredAt:new Date(Date.UTC(2026,0,1)+n*1000).toISOString()}]
});
test('full demo payment history reads records after legacy 200 and retains stable details',async()=>{
 const old=globalThis.fetch;
 const first=Array.from({length:200},(_,i)=>transaction(201-i));
 let firstCalls=0;let pages=0;
 globalThis.fetch=async(input,init)=>{
   const path=String(input);
   const args=JSON.parse(String(init?.body||'{}'));
   if(path.endsWith('/demo_story1_demo_history')){
     firstCalls++;assert.equal(args.p_actor,'user1');return Response.json(first);
   }
   if(path.endsWith('/demo_story1_demo_history_page')){
     pages++;assert.equal(args.p_before_id,first[199].transactionId);
     return Response.json([transaction(1)]);
   }
   throw Error('Unexpected RPC '+path);
 };
 try{
   const records=await getDemoStoryPaymentHistory('user1','payer');
   assert.equal(firstCalls,1);assert.equal(pages,1);assert.equal(records.length,201);
   assert.equal(records[0].transactionId,transaction(201).transactionId);
   assert.equal(records[200].transactionId,transaction(1).transactionId);
   assert.equal(records[200].allocations[0].id,transaction(1).transactionId+'-1');
 }finally{globalThis.fetch=old;}
});
test('cursor endpoint is additive, sorted, bounded and public-demo-only',()=>{
 const sql=readFileSync('supabase/migrations/20261106110000_taxpay_demo_history_cursor_page.sql','utf8');
 assert.match(sql,/p_page_size not between 1 and 100/);
 assert.match(sql,/\(p.created_at,p.id\)<\(p_before_created_at,p_before_id\)/);
 assert.match(sql,/order by p.created_at desc,p.id desc/);
 assert.match(sql,/grant execute on function public.demo_story1_demo_history_page/);
 assert.doesNotMatch(sql,/drop table|delete from demo_payment|update demo_payment/);
});
