import {pathToFileURL} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';
const repository = 'shihab-tech04/nbr-taxpay';
export const workflowId = 381898102;
const names = ['Isolated local Supabase acceptance (no hosted credentials)', 'Current Office main contract and build'];
const hex = /^[0-9a-f]{40}$/;
export function selectRun(runs, sha) {
  if (!hex.test(sha || '') || !Array.isArray(runs)) throw Error('Invalid release evidence');
  const matching = runs.filter(r => r.head_sha === sha && r.head_branch === 'main' &&
    r.workflow_id === workflowId && ['push','workflow_dispatch'].includes(r.event) &&
    r.repository?.full_name === repository && r.head_repository?.full_name === repository);
  return matching.sort((a,b)=>b.id-a.id)[0] || null;
}
export function acceptance(run, jobs, sha) {
  if (!run || run.head_sha !== sha) return false;
  if (run.status !== 'completed' || run.conclusion !== 'success') return false;
  if (!Array.isArray(jobs)) return false;
  return names.every(name => {
    const matches = jobs.filter(j=>j.name===name);
    return matches.length===1 && matches[0].status==='completed' && matches[0].conclusion==='success' &&
      matches[0].head_sha===sha && matches[0].run_id===run.id;
  });
}
async function get(path) {
  if (process.env.GITHUB_REPOSITORY !== repository || !process.env.GH_TOKEN) throw Error('Unauthorized release context');
  const res=await fetch('https://api.github.com/repos/'+repository+'/'+path,{
    headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+process.env.GH_TOKEN,'X-GitHub-Api-Version':'2022-11-28'},
    signal:AbortSignal.timeout(15000)
  });
  if (!res.ok) throw Error('GitHub evidence HTTP '+res.status);
  return res.json();
}
async function main(){
  const sha=process.env.GITHUB_SHA;
  if (!hex.test(sha||'') || process.env.GITHUB_REF!=='refs/heads/main' || !['push','workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME)) throw Error('Not an exact Main release');
  const deadline=Date.now()+40*60*1000;
  while(Date.now()<deadline){
    const branch=await get('branches/main');
    if(branch.commit?.sha!==sha) throw Error('Release superseded by newer Main; do not publish stale candidate');
    const data=await get('actions/workflows/'+workflowId+'/runs?branch=main&head_sha='+sha+'&per_page=100');
    const run=selectRun(data.workflow_runs,sha);
    if(run?.status==='completed'){
      if(run.conclusion!=='success') throw Error('Exact Main SQL acceptance '+run.conclusion+' in run '+run.id);
      const data=await get('actions/runs/'+run.id+'/attempts/'+run.run_attempt+'/jobs?per_page=100');
      if(!acceptance(run,data.jobs,sha)) throw Error('Mandatory exact-SHA SQL or Office check not proven');
      console.log('PASS: exact Main SQL and Office acceptance: '+sha+' run '+run.id+' attempt '+run.run_attempt);
      return;
    }
    console.log('Awaiting exact Main SQL acceptance '+sha+' '+(run?.status||'not yet created'));
    await sleep(15000);
  }
  throw Error('Timed out awaiting exact Main SQL and Office acceptance');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  main().catch(e=>{console.error(e.message);process.exitCode=1;});
}
