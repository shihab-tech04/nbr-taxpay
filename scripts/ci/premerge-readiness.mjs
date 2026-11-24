import {execFileSync} from 'node:child_process';
import {safeReleasePaths} from './verified-merge-release.mjs';

// Advisory only. Supply freshly fetched exact Main and PR head SHAs.
// Never approves a merge, skips checks, or mutates refs.
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const sha=/^[0-9a-f]{40}$/;
export function assess(base,head){
  if(!sha.test(base||'')||!sha.test(head||''))throw Error('Exact Main and PR head SHAs required');
  for(const ref of [base,head])if(git('cat-file','-t',ref)!=='commit')throw Error('Not a commit: '+ref);
  if(git('merge-base',base,head)!==base)return {mode:'refresh-required',base,head};
  const paths=execFileSync('git',['diff','--name-only','--no-renames','-z',base,head],{encoding:'utf8'}).split('\0').filter(Boolean);
  return {mode:safeReleasePaths(paths)?'exact-tree-candidate':'full-validation',base,head,tree:git('rev-parse',head+'^{tree}'),paths};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
  try{
    const result=assess(process.argv[2],process.argv[3]);
    console.log(JSON.stringify(result));
    if(result.mode==='refresh-required')process.exitCode=2;
  }catch(error){console.error('Readiness unavailable: '+String(error?.message||error));process.exitCode=1;}
}
