import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {
  assertProductionCutoverSafe, ORIGINAL_TAXPAYER, PRIMARY_V2_CANDIDATE,
  SEPARATE_OFFICE, SIMULATION_SCOPE,
} from './sohojkor-v2-cutover-gate.mjs';

const baseline = {originalUrl: ORIGINAL_TAXPAYER, officeUrl: SEPARATE_OFFICE};

test('preserve existing Original primary configuration only when the frontend matches', () => {
  assert.deepEqual(assertProductionCutoverSafe({...baseline, primaryUrl: ORIGINAL_TAXPAYER, frontendUrl: ORIGINAL_TAXPAYER}),
    {status:'ORIGINAL_PRIMARY_UNCHANGED'});
});
test('reject V2 without reviewed fictional-simulation scope', () => {
  assert.throws(() => assertProductionCutoverSafe({...baseline, primaryUrl: PRIMARY_V2_CANDIDATE, frontendUrl: PRIMARY_V2_CANDIDATE}),
    /only reviewed fictional simulation scope/);
});
test('do not accept an approval=true flag without the correct scope', () => {
  assert.throws(() => assertProductionCutoverSafe({...baseline,
    primaryUrl: PRIMARY_V2_CANDIDATE, frontendUrl: PRIMARY_V2_CANDIDATE, approved: true}),
  /only reviewed fictional simulation scope/);
});
test('scoped V2 candidate must still pass actual hosted smoke at deployment', () => {
  assert.deepEqual(assertProductionCutoverSafe({...baseline,
    primaryUrl: PRIMARY_V2_CANDIDATE, frontendUrl: PRIMARY_V2_CANDIDATE, releaseScope: SIMULATION_SCOPE}),
    {status:'V2_SIMULATION_HOSTED_SMOKE_REQUIRED'});
});
test('reject a production/frontend project swap in either direction', () => {
  assert.throws(() => assertProductionCutoverSafe({...baseline,
    primaryUrl: PRIMARY_V2_CANDIDATE, frontendUrl: ORIGINAL_TAXPAYER, releaseScope: SIMULATION_SCOPE}),
  /refusing a project swap/);
  assert.throws(() => assertProductionCutoverSafe({...baseline,
    primaryUrl: ORIGINAL_TAXPAYER, frontendUrl: PRIMARY_V2_CANDIDATE}),
  /refusing a project swap/);
  assert.throws(() => assertProductionCutoverSafe({...baseline,
    primaryUrl: PRIMARY_V2_CANDIDATE, releaseScope: SIMULATION_SCOPE}),
  /refusing a project swap/);
});
test('do not overwrite the separately identified Original database', () => {
  assert.throws(() => assertProductionCutoverSafe({...baseline,
    originalUrl: PRIMARY_V2_CANDIDATE, primaryUrl: PRIMARY_V2_CANDIDATE, frontendUrl: PRIMARY_V2_CANDIDATE,
    releaseScope: SIMULATION_SCOPE}), /Legacy source changed/);
});
test('Office must remain an independent SQL and Auth identity', () => {
  assert.throws(() => assertProductionCutoverSafe({...baseline,
    officeUrl: ORIGINAL_TAXPAYER, primaryUrl: PRIMARY_V2_CANDIDATE, frontendUrl: PRIMARY_V2_CANDIDATE,
    releaseScope: SIMULATION_SCOPE}), /Office identity changed/);
});
test('unknown backend endpoints fail closed', () => {
  assert.throws(() => assertProductionCutoverSafe({...baseline,
    primaryUrl:'https://unknown.supabase.co', frontendUrl:'https://unknown.supabase.co', releaseScope: SIMULATION_SCOPE}),
    /Unrecognized/);
});

test('integration workflow keeps both release gates and V2-only hosted persistence', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/pages.yml', import.meta.url), 'utf8');
  const signed = workflow.indexOf('run: node scripts/ci/hybrid-cutover-gate.mjs');
  const hosted = workflow.indexOf('run: node scripts/ci/sohojkor-v2-cutover-gate.mjs');
  const cms = workflow.indexOf('run: node scripts/ci/v2-public-read-preflight.mjs', hosted);
  const publish = workflow.indexOf('uses: actions/deploy-pages@');
  assert.ok(signed >= 0 && hosted > signed && cms > hosted && publish > cms,
    'Signed and hosted V2 gates and public CMS availability must all pass before Pages publication');
  const hostedGate = workflow.match(/- name: Reverify V2 simulation-only production cutover and hosted sessions[^]*?(?=\n\s*- name:|\n\S)/)?.[0] ?? '';
  assert.match(hostedGate, /VITE_SUPABASE_URL:\s*'https:\/\/gmuhitmaynfhipcvbvkh\.supabase\.co'/,
    'production project gate must receive the exact frontend endpoint it is authorizing');
  const persistence = workflow.match(/- name: Verify hosted persistence[^]*?(?=\n\s*- name:|\n\S)/)?.[0] ?? '';
  assert.match(persistence, /gmuhitmaynfhipcvbvkh\.supabase\.co/);
  assert.doesNotMatch(persistence, /eyqhoavnitkrajvyqvxn\.supabase\.co/);
});

test('reviewed PR artifact reuse must check V2 and reject the original-only bundle', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/pages.yml', import.meta.url),'utf8');
  const reuse = workflow.split('  reuse-reviewed-build:')[1]?.split('  verification-gate:')[0]??'';
  assert.ok(reuse.includes("grep -RFq 'https://gmuhitmaynfhipcvbvkh.supabase.co' dist/assets"),
    'reused immutable bundle must contain the approved V2 frontend endpoint');
  assert.ok(!reuse.includes("grep -RFq 'https://eyqhoavnitkrajvyqvxn.supabase.co' dist/assets"),
    'do not require the Original endpoint in a V2-only reviewed bundle');
});
