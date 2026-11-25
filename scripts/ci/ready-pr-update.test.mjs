import test from 'node:test';
import assert from 'node:assert/strict';
import { planReadyUpdate, updateReadyPr } from './ready-pr-update.mjs';
const repo = 'shihab-tech04/nbr-taxpay';
const main = 'a'.repeat(40), head = 'b'.repeat(40), candidate = 'c'.repeat(40);
const pr = { state: 'open', draft: false, base: { ref: 'main', repo: { full_name: repo } }, head: { ref: 'fix/one', sha: head, repo: { full_name: repo } } };
const input = { pr, main, candidate, remoteHead: head, isAncestor: () => true };
test('ready branch update preserves history and targets one exact ref', () => assert.deepEqual(planReadyUpdate(input), {action:'push', ref:'refs/heads/fix/one', candidate}));
test('unchanged head emits no update', () => assert.deepEqual(planReadyUpdate({...input,candidate:head}), {action:'noop'}));
test('draft, wrong repository, Main head, stale remote, and missing ancestry fail closed', () => {
  for (const overrides of [{pr:{...pr,draft:true}}, {pr:{...pr,head:{...pr.head,repo:{full_name:'other/repo'}}}}, {pr:{...pr,head:{...pr.head,ref:'main'}}}, {remoteHead:main}, {isAncestor:()=>false}, {isAncestor:a=>a===head}]) assert.throws(()=>planReadyUpdate({...input,...overrides}));
});
function mock({ unchanged = false, race = false } = {}) {
  const calls = []; let reads = 0;
  const run = (cmd,args) => {
    calls.push([cmd,...args]);
    if (cmd === 'gh') { reads++; return JSON.stringify(pr); }
    if (args[0] === 'remote') return `https://github.com/${repo}.git`;
    if (args[0] === 'status') return '';
    if (args[0] === 'rev-parse') return unchanged ? head : candidate;
    if (args[0] === 'ls-remote') return args.at(-1).endsWith('/main') ? (race && reads>1 ? candidate : main) : head;
    if (args[0] === 'merge-base' || args[0] === 'push') return '';
    throw Error('Unexpected command');
  }; return {run,calls};
}
test('dry-run and unchanged candidate never push or mutate PR status', () => {
  for (const unchanged of [false,true]) { const m=mock({unchanged}); updateReadyPr({number:1065,apply:unchanged,run:m.run}); assert.ok(!m.calls.some(c=>c[1]==='push')); assert.ok(m.calls.filter(c=>c[0]==='gh').every(c=>c[1]==='api')); }
});
test('apply uses exactly one non-force push and no status mutation', () => {const m=mock(); updateReadyPr({number:1065,apply:true,run:m.run}); assert.deepEqual(m.calls.filter(c=>c[1]==='push'),[['git','push','origin',`${candidate}:refs/heads/fix/one`]]); assert.ok(m.calls.filter(c=>c[0]==='gh').every(c=>c[1]==='api'));});
test('concurrent Main change prevents push', () => {const m=mock({race:true}); assert.throws(()=>updateReadyPr({number:1065,apply:true,run:m.run})); assert.ok(!m.calls.some(c=>c[1]==='push'));});
