import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const url=process.env.TAXPAY_LOCAL_PG_DSN;
if(!url)throw Error('Disposable PostgreSQL required');
const db=new URL(url);
if(!['postgresql:','postgres:'].includes(db.protocol)||!['127.0.0.1','localhost'].includes(db.hostname))
 throw Error('Refusing non-loopback SQL test');
function query(statement){
 const p=spawnSync('psql',['-X','-At','-v','ON_ERROR_STOP=1','-c',statement],{
  encoding:'utf8',timeout:12000,
  env:{...process.env,PGHOST:db.hostname,PGPORT:db.port||'5432',
   PGDATABASE:decodeURIComponent(db.pathname.slice(1)),PGUSER:decodeURIComponent(db.username),
   PGPASSWORD:decodeURIComponent(db.password)}
 });
 if(p.status!==0)throw Error('SQL integrity read-back failed: '+p.stderr.slice(0,450));
 return p.stdout.trim();
}
function json(statement){return JSON.parse(query(statement));}
function quote(s){return "'"+s.replaceAll("'","''")+"'";}
const all=json("select public.sim_payment_history(null,'all')");
assert.ok(all.length>=9,'Seeded SQL transactions not available');
assert.equal(new Set(all.map(t=>t.id)).size,all.length);
const seeded=all.filter(t=>/^DEMO-TX-00[1-9]$/.test(t.id));
assert.equal(seeded.length,9);
assert.equal(seeded.reduce((n,t)=>n+t.allocations.length,0),16);
assert.equal(seeded.reduce((n,t)=>n+t.totalMinor,0),5040000);
for(const transaction of all){
 assert.equal(transaction.simulationOnly,true);
 assert.equal(transaction.allocations.reduce((n,a)=>n+a.amountMinor,0),transaction.totalMinor,transaction.id+' unequal allocations');
 assert.ok(transaction.events.length>=3,transaction.id+' events missing');
 for(let i=1;i<transaction.events.length;i++)
   assert.ok(Date.parse(transaction.events[i].occurredAt)>=Date.parse(transaction.events[i-1].occurredAt));
}
const users=Array.from({length:10},(_,i)=>'user'+(i+1));
for(const user of users){
 const beneficiary=json("select public.sim_payment_history("+quote(user)+",'beneficiary')");
 const payer=json("select public.sim_payment_history("+quote(user)+",'payer')");
 const notices=json("select public.sim_payment_notices("+quote(user)+")");
 assert.deepEqual(beneficiary.map(t=>t.transactionId).sort(),
  all.filter(t=>t.allocations.some(a=>a.beneficiary===user)).map(t=>t.transactionId).sort(),
  user+' beneficiary graph');
 for(const t of beneficiary)assert.ok(t.allocations.every(a=>a.beneficiary===user),'Other beneficiary allocation disclosed');
 assert.deepEqual(payer.map(t=>t.transactionId).sort(),
  all.filter(t=>t.payer===user).map(t=>t.transactionId).sort(),user+' payer graph');
 assert.ok(notices.every(n=>n.userId===user),'Notification recipient mismatch');
 const known=new Set(all.map(t=>t.transactionId));
 assert.ok(notices.every(n=>known.has(n.transactionId)),user+' notification has unknown transaction');
}
const privileges=json("select jsonb_build_object('anon_history',has_function_privilege('anon','public.sim_payment_history(text,text)','EXECUTE'),'anon_notices',has_function_privilege('anon','public.sim_payment_notices(text)','EXECUTE'),'anon_submit',has_function_privilege('anon','public.sim_submit_payment(text,jsonb,uuid)','EXECUTE'))");
assert.deepEqual(privileges,{anon_history:false,anon_notices:false,anon_submit:false});
console.log('PASS: original seeded graph assertions (9 transactions,16 allocations,5040000 paisa), all 10 payer/beneficiary/notice projections and revoked anonymous RPCs');
