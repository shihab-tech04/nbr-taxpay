import test from 'node:test';
import assert from 'node:assert/strict';
import {safeReleasePaths,exactMergeTree,checkPassed} from './verified-merge-release.mjs';
const h='a'.repeat(40),b='b'.repeat(40),m='c'.repeat(40);
test('only narrow approved presentation files can reuse a fully tested artifact',()=>{
 assert.ok(safeReleasePaths(['src/components/screens/PublicReport.tsx','docs/RELEASES.md']));
 for(const path of ['src/services/supabaseClient.ts','src/components/screens/TaxpayerDashboard.ts','supabase/migrations/001.sql','tests/a.spec.ts','.github/workflows/pages.yml','package-lock.json','src/../components/Unsafe.tsx']){
   assert.equal(safeReleasePaths([path]),false,path);
 }
 assert.equal(safeReleasePaths([]),false);
});
test('merge must have exactly two parents and byte-identical tested tree',()=>{
 assert.ok(exactMergeTree([m,h,b],h,h));
 assert.equal(exactMergeTree([m,h,b],h,b),false);
 assert.equal(exactMergeTree([m,h],h,h),false);
 assert.equal(exactMergeTree([m,h,b,b],h,h),false);
});
test('security check must be completed by Actions on exact SHA before merge',()=>{
 const mergeTime='2026-11-07T10:00:00Z';
 const good={name:'Build and verify static preview',head_sha:h,app:{slug:'github-actions'},status:'completed',conclusion:'success',completed_at:'2026-11-07T09:59:00Z'};
 assert.equal(checkPassed([good],good.name,h,mergeTime),true);
 assert.equal(checkPassed([{...good,head_sha:b}],good.name,h,mergeTime),false);
 assert.equal(checkPassed([{...good,conclusion:'skipped'}],good.name,h,mergeTime),false);
 assert.equal(checkPassed([{...good,completed_at:'2026-11-07T10:01:00Z'}],good.name,h,mergeTime),false);
});
