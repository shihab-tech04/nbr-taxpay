import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { collectBeneficiaryPages } from '../src/services/beneficiaries';
import { getDemoStoryPaymentHistory } from '../src/services/simulatedPaymentsApi';

// F-125 / US-109 isolated representative-volume baseline. Not a hosted or
// real-user latency measurement; the owner must approve numeric SLA thresholds.
test('12,005 saved rows paginate without truncation or missing name/TIN search',async()=>{
 const source=Array.from({length:12005},(_,n)=>({
   id:'saved-'+n,tin:String(n+1).padStart(12,'0'),
   name:n===12004?'Unique বাংলা beneficiary':'Saved beneficiary '+n
 }));
 const ranges:Array<[number,number]>=[];
 const began=performance.now();
 const rows=await collectBeneficiaryPages(async(from,to)=>{
   ranges.push([from,to]);return source.slice(from,to+1);
 },500);
 const milliseconds=performance.now()-began;
 assert.equal(rows.length,12005);
 assert.equal(new Set(rows.map(x=>x.id)).size,12005);
 assert.equal(ranges.length,25);
 assert.deepEqual(ranges.at(-1),[12000,12499]);
 assert.deepEqual(rows.filter(x=>(x.name+' '+x.tin).toLocaleLowerCase().includes('বাংলা')).map(x=>x.id),['saved-12004']);
 assert.deepEqual(rows.filter(x=>x.tin==='000000012005').map(x=>x.id),['saved-12004']);
 console.info('F125 isolated beneficiary baseline',JSON.stringify({
   rows:rows.length,pages:ranges.length,jsDurationMs:Number(milliseconds.toFixed(2)),
   productionOrFieldLatencyVerified:false
 }));
});

test('1,305 capability-owned payment records paginate and reject other account',async()=>{
 const session={profileId:'user1',capability:'A'.repeat(43),
   paymentSessionId:'11111111-1111-4111-8111-111111111111',language:'en',selectedListId:null};
 const rows=Array.from({length:1305},(_,i)=>{
   const n=1305-i,createdAt=new Date(Date.UTC(2026,0,1)+n*1000).toISOString();
   return {id:'SIM-'+n,transactionId:'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),
     payer:'user1' as const,state:'SIMULATED' as const,reviewStatus:'MIRRORED_TO_OFFICE' as const,
     simulationOnly:true,totalMinor:100,createdAt,
     allocations:[{beneficiary:'user1' as const,category:'ADVANCE_TAX' as const,
       assessmentYear:'2026-27',amountMinor:100}],events:[]};
 });
 const offsets=new Map(rows.map((x,i)=>[x.transactionId,i] as const));
 const storage=new Map([['taxpay-taxpayer-preview-user','user1'],['korbritto.demo-profile-session.v1',JSON.stringify(session)]]);
 const previousWindow=(globalThis as any).window,previousFetch=globalThis.fetch;
 Object.defineProperty(globalThis,'window',{configurable:true,
   value:{sessionStorage:{getItem:(key:string)=>storage.get(key)??null}}});
 let requests=0;
 globalThis.fetch=async(input,init)=>{
   const url=new URL(String(input),'https://isolated.invalid');
   assert.equal(url.pathname.endsWith('/demo-story1-taxpay/profile-history'),true);
   assert.equal(url.searchParams.get('view'),'payer');
   assert.equal(url.searchParams.get('pageSize'),'100');
   const headers=init?.headers as Record<string,string>;
   assert.equal(headers['x-taxpay-guest-capability'],session.capability);
   assert.equal(headers.Authorization,undefined);
   const cursor=url.searchParams.get('beforeId');
   const offset=cursor===null?0:(offsets.get(cursor)??-2)+1;
   assert.ok(offset>=0);
   if(cursor!==null)assert.equal(url.searchParams.get('beforeCreatedAt'),rows[offset-1].createdAt);
   requests++;
   return Response.json({success:true,simulationOnly:true,data:rows.slice(offset,offset+100)});
 };
 try{
   const began=performance.now();
   const history=await getDemoStoryPaymentHistory('user1','payer');
   const milliseconds=performance.now()-began;
   assert.equal(requests,14);
   assert.equal(history.length,1305);
   assert.deepEqual(history.map(x=>x.transactionId),rows.map(x=>x.transactionId));
   assert.ok(history.every(x=>x.allocations.length===1&&x.allocations[0].amountMinor===100));
   assert.equal(history.at(-1)?.allocations[0].id,rows.at(-1)!.transactionId+'-1');
   await assert.rejects(getDemoStoryPaymentHistory('user2','payer'),/Sign in to the matching demo profile/);
   assert.equal(requests,14,'Different owner cannot fetch another account history');
   console.info('F125 isolated history baseline',JSON.stringify({
     rows:history.length,pages:requests,jsDurationMs:Number(milliseconds.toFixed(2)),
     productionOrFieldLatencyVerified:false
   }));
 }finally{
   globalThis.fetch=previousFetch;
   if(previousWindow===undefined)delete (globalThis as any).window;
   else Object.defineProperty(globalThis,'window',{configurable:true,value:previousWindow});
 }
});
