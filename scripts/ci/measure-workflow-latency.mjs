import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

// Read-only report from GitHub Actions jobs REST JSON. Supports gh api --paginate --slurp.
const seconds = (a, b) => {
  if (!a || !b) return null;
  const x = Date.parse(a), y = Date.parse(b);
  return Number.isFinite(x) && Number.isFinite(y) && y >= x ? (y - x) / 1000 : null;
};
const percentile = (values, p) => {
  const a = values.filter(Number.isFinite).sort((x,y)=>x-y);
  return a.length ? a[Math.max(0, Math.ceil(a.length*p)-1)] : null;
};
export function summarize(payload) {
  const pages = Array.isArray(payload) ? payload : [payload];
  if (!pages.length || pages.some(p=>!Array.isArray(p?.jobs))) throw new Error('Expected GitHub jobs API object or paginated array');
  const jobs = [...new Map(pages.flatMap(p=>p.jobs).map(j=>[j.id,j])).values()];
  const rows = jobs.map(j=>({id:j.id,name:j.name,status:j.status,conclusion:j.conclusion,
    queueSeconds:seconds(j.created_at,j.started_at), executionSeconds:seconds(j.started_at,j.completed_at)}));
  const completed = rows.filter(j=>j.status==='completed' && !['skipped','cancelled'].includes(j.conclusion));
  const group = completed.filter(j=>/^Public routes \(shard \d+\/\d+\)$/.test(j.name));
  const stats = a=>({jobs:a.length,queueSamples:a.filter(j=>j.queueSeconds!==null).length,
    executionSamples:a.filter(j=>j.executionSeconds!==null).length,
    queueP50Seconds:percentile(a.map(j=>j.queueSeconds),.5),queueP95Seconds:percentile(a.map(j=>j.queueSeconds),.95),
    executionP95Seconds:percentile(a.map(j=>j.executionSeconds),.95),
    totalObservedRunnerSeconds:a.reduce((s,j)=>s+(j.executionSeconds??0),0)});
  return {totalJobs:rows.length,completedMeasured:completed.length,unfinished:rows.filter(j=>j.status!=='completed').length,
    failures:rows.filter(j=>j.conclusion==='failure').map(j=>j.name),all:stats(completed),publicRoutes:stats(group),jobs:rows};
}
function selfTest(){
  const make=(id,name,status,conclusion,created_at,started_at,completed_at)=>({id,name,status,conclusion,created_at,started_at,completed_at});
  const t=n=>new Date(Date.UTC(2026,10,24,0,0,n)).toISOString();
  const a=make(1,'Public routes (shard 1/8)','completed','success',t(0),t(20),t(50));
  const b=make(2,'SQL','completed','failure',t(0),t(10),t(50));
  const c=make(3,'Deploy','queued',null,t(1),null,null);
  const d=make(4,'Skip','completed','skipped',t(0),t(0),t(0));
  const e=make(5,'Bad timestamp','completed','success',t(5),t(1),null);
  const r=summarize([{jobs:[a,b,c]},{jobs:[a,d,e]}]);
  assert.equal(r.totalJobs,5); assert.equal(r.unfinished,1); assert.equal(r.completedMeasured,3);
  assert.deepEqual(r.failures,['SQL']); assert.equal(r.all.queueSamples,2); assert.equal(r.all.executionSamples,2);
  assert.equal(r.all.queueP95Seconds,20); assert.equal(r.all.totalObservedRunnerSeconds,70);
  assert.equal(r.publicRoutes.jobs,1); assert.equal(r.publicRoutes.executionP95Seconds,30);
  assert.equal(summarize({jobs:[]}).all.queueP95Seconds,null);
  assert.throws(()=>summarize({foo:[]}),/Expected GitHub/);
  console.log('PASS: pagination, deduplication, missing timestamps, pending/skipped jobs, failures and latency metrics');
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  if (process.argv[2]==='--self-test') selfTest();
  else console.log(JSON.stringify(summarize(JSON.parse(readFileSync(process.argv[2]??0,'utf8'))),null,2));
}
