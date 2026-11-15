import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileThreeWay} from './phase4-threeway.mjs';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const record=(id,minor=100)=>({id,service_code:'OTHER_TAX_PAYMENT',amount_minor:minor,status:'SIMULATED_SUCCESS',
 data:{origin:'TAXPAY_UI',details:{payerTin:'111111111111',payerMode:'SELF',taxpayerTin:'222222222222',
 assessmentYear:'2026-27',paymentSource:'BANK',dhara:'evidenced',receiptReference:'r',receiptSnapshot:{challanNo:'c'},
 allocations:[{allocationId:'A',taxpayerTin:'222222222222',headId:101,assessmentYear:'2026-27',dhara:'evidenced',amountMinor:minor}]}}});
const clone=x=>structuredClone(x);
test('distinct old and V2 parents must both be present in Office',()=>{
 const a=record('legacy-a'),b=record('v2-b');
 const x=reconcileThreeWay([a],[b],[clone(a)]);
 assert.equal(x.historical.parityPassed,true);
 assert.equal(x.v2.parityPassed,false);
 assert.equal(x.combined.parityPassed,false);
 assert.ok(x.combined.issues.some(i=>i.reason==='MISSING_OFFICE'));
});
test('complete 1:1 union passes parity but does not attest settlement',()=>{
 const a=record('legacy-a'),b=record('v2-b');
 const x=reconcileThreeWay([a],[b],[clone(a),clone(b)]);
 assert.equal(x.combined.parityPassed,true);
 assert.equal(x.combined.matched,2);
 assert.equal(x.releaseVerified,false);
 assert.equal(x.combined.releaseVerified,false);
});
test('identical cloned payment ID is deduplicated, preferring V2 without duplication',()=>{
 const a=record('legacy-a');
 const x=reconcileThreeWay([a],[clone(a)],[clone(a)]);
 assert.equal(x.combined.parityPassed,true);
 assert.equal(x.combined.taxpayerCount,1);
 assert.equal(x.sourceProblems.length,0);
});
test('conflicting reused payment ID is never silently overwritten',()=>{
 const a=record('legacy-a'),b=clone(a);b.data.details.receiptReference='altered';
 const x=reconcileThreeWay([a],[b],[clone(a)]);
 assert.equal(x.combined.parityPassed,false);
 assert.ok(x.sourceProblems.some(i=>i.reason==='SOURCE_COLLISION'));
 assert.ok(!JSON.stringify(x).includes('111111111111'));
});
test('duplicate IDs within each source block release and redact identifiers',()=>{
 const a=record('legacy-a');
 const x=reconcileThreeWay([a,clone(a)],[],[clone(a)]);
 assert.equal(x.combined.parityPassed,false);
 assert.ok(x.sourceProblems.some(i=>i.reason==='DUPLICATE_ID'));
 assert.equal(JSON.stringify(x).includes('legacy-a'),false);
});
test('Office-only unexpected payments and invalid snapshot inputs fail closed',()=>{
 const a=record('legacy-a');
 const x=reconcileThreeWay([a],[],[clone(a),record('unknown')]);
 assert.equal(x.combined.parityPassed,false);
 assert.ok(x.combined.issues.some(i=>i.reason==='UNEXPECTED_OFFICE'));
 assert.throws(()=>reconcileThreeWay(null,[],[]),/INVALID_ORIGINAL_EXPORT/);
});

test('CLI deduplicates identical cloned data without claiming payment settlement',()=>{
 const dir=mkdtempSync(join(tmpdir(),'phase4-reconcile-'));
 try{
  const a=record('legacy-a');
  const paths=['original.json','office.json','v2.json'].map(x=>join(dir,x));
  for(const path of paths)writeFileSync(path,JSON.stringify([a]));
  const output=spawnSync(process.execPath,[fileURLToPath(new URL('./phase4-reconcile.mjs',import.meta.url)),...paths],{encoding:'utf8'});
  assert.equal(output.status,1); // Simulated history cannot prove settlement.
  const report=JSON.parse(output.stdout);
  assert.equal(report.combined.parityPassed,true);
  assert.equal(report.combined.taxpayerCount,1);
  assert.equal(report.v2.parityPassed,true);
  assert.equal(report.sourceProblems.length,0);
  assert.equal(report.combined.releaseVerified,false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('CLI blocks conflicting cloned payment IDs even when Office matches legacy',()=>{
 const dir=mkdtempSync(join(tmpdir(),'phase4-collision-'));
 try{
  const a=record('legacy-a'), altered=clone(a);altered.data.details.receiptReference='forged';
  const paths=['original.json','office.json','v2.json'].map(x=>join(dir,x));
  for(const [i,rows] of [[0,[a]],[1,[clone(a)]],[2,[altered]]])writeFileSync(paths[i],JSON.stringify(rows));
  const output=spawnSync(process.execPath,[fileURLToPath(new URL('./phase4-reconcile.mjs',import.meta.url)),...paths],{encoding:'utf8'});
  assert.equal(output.status,1);
  const report=JSON.parse(output.stdout);
  assert.equal(report.combined.parityPassed,false);
  assert.ok(report.sourceProblems.some(x=>x.reason==='SOURCE_COLLISION'));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
