import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

// Advisory only: never grants permission to skip any required acceptance lane.
// Git diff --name-only --no-renames -z BASE HEAD is the supported input.
const lanes = Object.freeze(['compile','core-e2e','core-beneficiary-e2e','core-cms-e2e','payment-ux-e2e','payment-progress-e2e','public-e2e','public-travel-e2e','public-login-e2e','beneficiary-picker-e2e','public-support-e2e','route-e2e','phase02','recovery','live-smoke']);
const safePath = p => typeof p === 'string' && /^[A-Za-z0-9_.@/-]+$/.test(p) && !p.startsWith('/') && p.split('/').every(s=>s && s!=='.' && s!=='..');
const docs = p => p==='README.md' || /^docs\/[A-Za-z0-9_./-]+\.md$/.test(p);
const test = p => /^tests\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.(test|spec)\.ts$/.test(p);
export function impact(paths) {
  const valid=Array.isArray(paths)&&paths.length>0&&paths.every(safePath);
  const unique=valid?[...new Set(paths)].sort():[];
  let risk='full', reason='Unknown, shared, runtime, dependency, CI, API, SQL or security change';
  if(valid&&unique.every(docs)){risk='documentation';reason='Only recognized Markdown documentation paths';}
  else if(valid&&unique.every(p=>docs(p)||test(p))){risk='test-only';reason='Recognized documentation and test specifications; test coverage may change';}
  return {risk,reason,paths:unique,requiredLanes:[...lanes],allowSkip:false,requiresCurrentMain:true};
}
function selfTest(){
  assert.equal(impact(['docs/release.md','README.md']).risk,'documentation');
  assert.equal(impact(['tests/e2e/payment.spec.ts','docs/release.md']).risk,'test-only');
  for(const p of ['src/styles/a.css','src/services/payment.ts','supabase/migrations/1.sql','.github/workflows/pages.yml','package-lock.json','tests/helpers.ts','src/../docs/a.md','docs/a.md\n','/docs/a.md','docs//a.md','docs/../README.md','public/a.svg']) assert.equal(impact([p]).risk,'full',p);
  assert.equal(impact([]).risk,'full');assert.equal(impact(null).risk,'full');
  assert.equal(impact(['docs/a.md','src/App.tsx']).risk,'full');
  for(const sample of [[],['docs/a.md'],['tests/a.test.ts'],['src/App.tsx']]){const r=impact(sample);assert.equal(r.allowSkip,false);assert.deepEqual(r.requiredLanes,lanes);}
  assert.deepEqual(impact(['README.md','README.md']).paths,['README.md']);
  console.log('PASS: fail-closed path classification, mixed changes, traversal, empty input, mandatory-lane preservation');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv[2]==='--self-test')selfTest();
  else {const raw=readFileSync(0,'utf8');console.log(JSON.stringify(impact(raw.endsWith('\0')?raw.slice(0,-1).split('\0'):[]),null,2));}
}
