import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getDemoStoryPaymentHistory} from '../src/services/simulatedPaymentsApi';

const transaction=(n:number)=>(
  ({id:'SIM-'+String(n).padStart(16,'0'),
   transactionId:'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),
   payer:'user1',state:'SIMULATED',reviewStatus:'MIRRORED_TO_OFFICE',simulationOnly:true,totalMinor:100,
   createdAt:new Date(Date.UTC(2026,0,1)+n*1000).toISOString(),
   allocations:[{beneficiary:'user1',category:'TAX_WITH_RETURN',assessmentYear:'2026-27',amountMinor:100}],
   events:[{id:n,action:'SIMULATION_RECORDED',note:'SQL',occurredAt:new Date(Date.UTC(2026,0,1)+n*1000).toISOString()}]})
);

test('full demo payment history always reads cursor SQL and retains stable details',async()=>{
 const old=globalThis.fetch;
 const oldWindow=(globalThis as any).window;
 const profile={profileId:'user1',capability:'A'.repeat(43),paymentSessionId:'11111111-1111-4111-8111-111111111111',language:'en',selectedListId:null};
 const stored=new Map([['taxpay-taxpayer-preview-user','user1'],['korbritto.demo-profile-session.v1',JSON.stringify(profile)]]);
 Object.defineProperty(globalThis,'window',{configurable:true,value:{sessionStorage:{getItem:(key:string)=>stored.get(key)??null}}});
 const ordered=Array.from({length:201},(_,i)=>transaction(201-i));
 let pages=0;
 globalThis.fetch=async(input,init)=>{
   const url=new URL(String(input),'https://unit.test');
   const path=url.pathname;
   const headers=init?.headers as Record<string,string>;
   assert.equal(typeof headers.apikey,'string','Public Supabase requests must include the configured API-key header');
   assert.equal(headers['x-taxpay-guest-capability'],profile.capability,'History reads must carry the signed-in profile capability');
   assert.equal(headers.Authorization,undefined,'Publishable keys must not be sent as bearer JWTs');
   if(!path.endsWith('/demo-story1-taxpay/profile-history'))throw Error('Unexpected profile history endpoint '+path);
   pages++;
   assert.equal(url.searchParams.get('view'),'payer');assert.equal(url.searchParams.get('pageSize'),'100');
   if(pages===1){assert.equal(url.searchParams.has('beforeId'),false);return Response.json({success:true,simulationOnly:true,data:ordered.slice(0,100)});}
   if(pages===2){assert.equal(url.searchParams.get('beforeId'),ordered[99].transactionId);return Response.json({success:true,simulationOnly:true,data:ordered.slice(100,200)});}
   assert.equal(url.searchParams.get('beforeId'),ordered[199].transactionId);
   return Response.json({success:true,simulationOnly:true,data:ordered.slice(200)});
 };
 try{
   const rows=await getDemoStoryPaymentHistory('user1','payer');
   assert.equal(pages,3);assert.equal(rows.length,201);
   assert.equal(rows[0].transactionId,transaction(201).transactionId);
   assert.equal(rows[200].transactionId,transaction(1).transactionId);
   assert.equal(rows[200].allocations[0].id,transaction(1).transactionId+'-1');
 }finally{globalThis.fetch=old;if(oldWindow===undefined)delete (globalThis as any).window;else Object.defineProperty(globalThis,'window',{configurable:true,value:oldWindow});}
});

test('cursor and compatibility endpoints scope payer and beneficiary data',()=>{
 const sql=readFileSync('supabase/migrations/20261106160000_taxpay_verified_recovery_and_history_scope.sql','utf8');
 const profileSql=readFileSync('supabase/migrations/20261106180000_taxpay_demo_profile_scoped_payment_access.sql','utf8');
 assert.match(sql,/p_page_size not between 1 and 100/);
 assert.match(sql,/\(x.created_at,x.id\)<\(p_before_created_at,p_before_id\)/);
 assert.match(sql,/order by x.created_at desc,x.id desc/);
 assert.match(profileSql,/revoke all on function public\.demo_story1_demo_history_page\(text,text,timestamptz,uuid,integer\)[\s\S]+?from public,anon,authenticated/);
 assert.match(profileSql,/taxpay_demo_story1_history_page\(text,text,timestamptz,uuid,integer\)/);
 assert.match(profileSql,/grant execute on function public\.taxpay_demo_story1_history_page[\s\S]+?to service_role/);
 assert.match(sql,/line\.value->>'beneficiary'=p_actor/);
 assert.match(sql,/sum\(\(line\.value->>'amountMinor'\)::bigint\)/);
 assert.match(sql,/then p\.amount_minor else/);
 assert.doesNotMatch(sql,/data->'details'->>'payerId' ~ '\^user/);
 assert.doesNotMatch(sql,/drop table|delete from demo_payment|update demo_payment/);
});
