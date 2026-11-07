import {execFileSync} from 'node:child_process';
import {appendFileSync} from 'node:fs';

const HEX40=/^[0-9a-f]{40}$/;
const ALLOWED=[
  /^README\.md$/,
  /^docs\/[A-Za-z0-9_./-]+\.md$/,
  /^src\/components\/[A-Za-z0-9_./-]+\.(tsx|css)$/,
  /^src\/styles\/[A-Za-z0-9_./-]+\.css$/,
  /^src\/index\.css$/,
  /^public\/[A-Za-z0-9_./-]+\.(svg|png|jpg|jpeg|webp|css)$/
];
export const safeReleasePaths=(paths)=>paths.length>0&&paths.every(p=>ALLOWED.some(r=>r.test(p))&&!p.includes('..'));
export const exactMergeTree=(parents,mergeTree,headTree)=>parents.length===3&&
  parents.every(p=>HEX40.test(p))&&mergeTree===headTree&&HEX40.test(mergeTree);
export const checkPassed=(checks,name,head,mergedAt)=>checks.some(c=>
  c.name===name&&c.head_sha===head&&c.app?.slug==='github-actions'&&
  c.status==='completed'&&c.conclusion==='success'&&
  c.completed_at&&Date.parse(c.completed_at)<=Date.parse(mergedAt));
const cmd=(...args)=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const output=(values)=>{if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,
  Object.entries(values).map(([key,value])=>key+'='+value).join('\n')+'\n');};
async function api(path){
  const repository=process.env.GITHUB_REPOSITORY;
  if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository||'')||!process.env.GH_TOKEN)throw Error('API context unavailable');
  const response=await fetch('https://api.github.com/repos/'+repository+'/'+path,{
    headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+process.env.GH_TOKEN,
      'X-GitHub-Api-Version':'2022-11-28'},
    signal:AbortSignal.timeout(12000)
  });
  if(!response.ok)throw Error('API '+response.status+' for '+path.split('?')[0]);
  return response.json();
}
const validRun=(r,head,branch,mergedAt,name)=>r&&r.head_sha===head&&r.head_branch===branch&&
  r.name===name&&r.event==='pull_request'&&r.status==='completed'&&
  r.conclusion==='success'&&Date.parse(r.updated_at)<=Date.parse(mergedAt);
export async function discover(){
  if(process.env.GITHUB_EVENT_NAME!=='push'||process.env.GITHUB_REF!=='refs/heads/main')return {mode:'full',reason:'Not a protected Main push'};
  const sha=process.env.GITHUB_SHA;
  if(!HEX40.test(sha||'')||cmd('rev-parse','HEAD')!==sha)return {mode:'full',reason:'Source HEAD mismatch'};
  const parents=cmd('rev-list','--parents','-n','1',sha).split(' ');
  const head=parents[2];
  if(!head||!exactMergeTree(parents,cmd('rev-parse',sha+'^{tree}'),cmd('rev-parse',head+'^{tree}')))return{mode:'full',reason:'Merge source tree not identical to PR head'};
  const base=parents[1];
  const files=cmd('diff','--name-only','--no-renames',base,sha).split('\n').filter(Boolean);
  if(!safeReleasePaths(files))return{mode:'full',reason:'Restricted or unrecognized source changes'};
  const linked=await api('commits/'+sha+'/pulls?per_page=50');
  const pr=Array.isArray(linked)&&linked.find(x=>x.merged_at&&
    x.merge_commit_sha===sha&&x.head?.sha===head&&x.base?.sha===base&&x.base?.ref==='main'&&
    x.base?.repo?.full_name===process.env.GITHUB_REPOSITORY&&
    x.head?.repo?.full_name===process.env.GITHUB_REPOSITORY);
  if(!pr)return{mode:'full',reason:'No matching protected in-repository merge PR'};
  const runs=await api('actions/runs?event=pull_request&head_sha='+head+'&per_page=100');
  const findRun=(name)=>runs.workflow_runs?.find(r=>validRun(r,head,pr.head.ref,pr.merged_at,name));
  const pages=findRun('TaxPay - build and GitHub Pages');
  const sql=findRun('TaxPay Phase 02 - disposable Auth, RLS and draft persistence');
  const backup=findRun('Verified pre-release source recovery');
  if(!pages||!sql||!backup)return{mode:'full',reason:'All three original PR workflows not verified'};
  const checks=(await api('commits/'+head+'/check-runs?per_page=100')).check_runs||[];
  for(const name of ['Build and verify static preview','Isolated local Supabase acceptance (no hosted credentials)','source-backup']){
    if(!checkPassed(checks,name,head,pr.merged_at))return{mode:'full',reason:'Required exact-head check missing: '+name};
  }
  const artifacts=(await api('actions/runs/'+pages.id+'/artifacts?per_page=100')).artifacts||[];
  const name='taxpay-reviewed-dist-'+head;
  const matches=artifacts.filter(a=>a.name===name&&a.workflow_run?.id===pages.id&&!a.expired&&a.size_in_bytes>0&&/^sha256:[0-9a-f]{64}$/.test(a.digest||''));
  if(matches.length!==1)return{mode:'full',reason:'Unique immutable verified PR artifact missing'};
  return{mode:'reuse',reason:'Exact source tree + all PR gates + immutable reviewed artifact',
    head,tree:cmd('rev-parse',sha+'^{tree}'),run:String(pages.id),artifact:String(matches[0].id)};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
  let result;
  try{result=await discover();}
  catch(error){result={mode:'full',reason:'Fail-closed: '+String(error?.message||error)};}
  console.log('TaxPay release mode: '+result.mode+' ('+result.reason+')');
  output({mode:result.mode,head:result.head||'',tree:result.tree||'',run:result.run||'',artifact:result.artifact||''});
}
