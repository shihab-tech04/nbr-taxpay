import test from 'node:test';
import assert from 'node:assert/strict';
import {safeReleasePaths,exactMergeTree,exactSquashTree,exactPRTree,checkPassed} from './verified-merge-release.mjs';
const h='a'.repeat(40),b='b'.repeat(40),m='c'.repeat(40);
test('exact-head verified UI plus regression specs can reuse an immutable artifact',()=>{
 assert.ok(safeReleasePaths(['src/components/screens/PublicReport.tsx','docs/RELEASES.md']));
 assert.ok(safeReleasePaths(['src/styles/taxpay-service-choice.css','tests/e2e/step1-calculation-sticky.spec.ts']));
 assert.ok(safeReleasePaths(['src/components/screens/Beneficiaries.tsx','tests/beneficiariesRegisterActions.test.ts','tests/e2e/beneficiaries-activity-parity.spec.ts']));
 for(const path of ['src/services/supabaseClient.ts','src/components/screens/TaxpayerDashboard.ts','supabase/migrations/001.sql','tests/a.ts','tests/e2e/helpers.ts','tests/e2e/runner.mjs','.github/workflows/pages.yml','package-lock.json','src/../components/Unsafe.tsx','tests/e2e/../unsafe.spec.ts']){
   assert.equal(safeReleasePaths([path]),false,path);
 }
 assert.equal(safeReleasePaths(['src/styles/taxpay-service-choice.css','supabase/migrations/001.sql']),false);
 assert.equal(safeReleasePaths([]),false);
});
test('merge must have exactly two parents and byte-identical tested tree',()=>{
 assert.ok(exactMergeTree([m,h,b],h,h));
 assert.equal(exactMergeTree([m,h,b],h,b),false);
 assert.equal(exactMergeTree([m,h],h,h),false);
 assert.equal(exactMergeTree([m,h,b,b],h,h),false);
});
test('squash merge must preserve exact reviewed source tree and an identified PR head',()=>{
 assert.equal(exactSquashTree([m,b],h,h),true);
 assert.equal(exactSquashTree([m,b],h,b),false);
 assert.equal(exactSquashTree([m,b,h],h,h),false);
 assert.equal(exactSquashTree([m,'not-a-sha'],h,h),false);
 assert.equal(exactPRTree([m,b],h,h,h),true);
 assert.equal(exactPRTree([m,b],h,h,b),false);
 assert.equal(exactPRTree([m,b],'not-a-sha',h,h),false);
 // Two-parent merge still requires the GitHub-identified PR head as parent 2.
 assert.equal(exactPRTree([m,b,h],h,h,h),true);
 assert.equal(exactPRTree([m,b,h],b,h,h),false);
 assert.equal(exactPRTree([m,b,h,h],h,h,h),false);
});
test('security check must be completed by Actions on exact SHA before merge',()=>{
 const mergeTime='2026-11-07T10:00:00Z';
 const good={name:'Build and verify static preview',head_sha:h,app:{slug:'github-actions'},status:'completed',conclusion:'success',completed_at:'2026-11-07T09:59:00Z'};
 assert.equal(checkPassed([good],good.name,h,mergeTime),true);
 assert.equal(checkPassed([{...good,head_sha:b}],good.name,h,mergeTime),false);
 assert.equal(checkPassed([{...good,conclusion:'skipped'}],good.name,h,mergeTime),false);
 assert.equal(checkPassed([{...good,completed_at:'2026-11-07T10:01:00Z'}],good.name,h,mergeTime),false);
});
