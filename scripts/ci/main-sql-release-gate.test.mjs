import test from 'node:test';
import assert from 'node:assert/strict';
import {selectRun,acceptance,workflowId} from './main-sql-release-gate.mjs';
const sha='a'.repeat(40), other='b'.repeat(40), repo={full_name:'shihab-tech04/nbr-taxpay'};
const run={id:7,head_sha:sha,head_branch:'main',workflow_id:workflowId,event:'push',repository:repo,head_repository:repo,status:'completed',conclusion:'success'};
const jobs=['Isolated local Supabase acceptance (no hosted credentials)','Current Office main contract and build'].map(name=>({name,head_sha:sha,run_id:7,status:'completed',conclusion:'success'}));
test('select only exact in-repository Main runs, newest attempt/run',()=>{
 assert.equal(selectRun([run,{...run,id:8,head_sha:other},{...run,id:9,event:'pull_request'},{...run,id:10,head_repository:{full_name:'fork/repo'}}],sha),run);
 assert.equal(selectRun([{...run,id:8,status:'in_progress'},run],sha).id,8);
 assert.equal(selectRun([{...run,workflow_id:1}],sha),null);
});
test('both exact run jobs must succeed; no skipped, stale, failed, duplicate or missing evidence',()=>{
 assert.equal(acceptance(run,jobs,sha),true);
 for(const bad of [{...run,head_sha:other},{...run,conclusion:'failure'},{...run,status:'in_progress'}]) assert.equal(acceptance(bad,jobs,sha),false);
 for(const bad of [[],[jobs[0]],[jobs[0],jobs[1],jobs[1]],[jobs[0],{...jobs[1],conclusion:'skipped'}],[jobs[0],{...jobs[1],head_sha:other}],[jobs[0],{...jobs[1],run_id:9}]]) assert.equal(acceptance(run,bad,sha),false);
});
