import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const paths = [
  ".github/workflows/branding-v2-cms-regression.yml",
  ".github/workflows/other-tax-batch-v11.yml",
  ".github/workflows/pages.yml",
  ".github/workflows/phase02-local-supabase.yml",
  ".github/workflows/pre-release-source-recovery.yml",
  ".github/workflows/receipt-session-recovery.yml",
  ".github/workflows/received-payment-notice-ui.yml",
  ".github/workflows/shared-certificate-qa.yml",
  ".github/workflows/transaction-story-ui.yml"
];
const suffix = "${{ (github.event_name == 'pull_request' && github.event.pull_request.draft == true && github.event.pull_request.base.ref == 'main' && !startsWith(github.head_ref, 'ws5/')) && '-draft' || '' }}";
const lane = ({ event, draft, base, head }) => event === 'pull_request' && draft === true && base === 'main' && !head.startsWith('ws5/') ? '-draft' : '';

test('all draft-aware cancelling workflows isolate only deferred draft runs', () => {
  for (const path of paths) {
    const source = readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
    const group = source.match(/^  group: .*$/m)?.[0];
    assert.ok(group?.endsWith(suffix), path);
    assert.match(source, /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/, path);
    assert.ok(source.includes('github.event.pull_request.draft != true'), path + ': existing full acceptance guard');
  }
});

test('late draft events cannot cancel or replace pending ready acceptance', () => {
  const ordinary = { event:'pull_request', base:'main', head:'feat/home3' };
  const ready = 'same-pr' + lane({...ordinary,draft:false});
  const draft = 'same-pr' + lane({...ordinary,draft:true});
  assert.notEqual(ready, draft);
  const pending = new Map([[ready,'full acceptance']]);
  pending.set(draft,'late draft event');
  assert.equal(pending.get(ready),'full acceptance');
  assert.equal(lane({...ordinary,draft:true,head:'ws5/integration'}),'');
  assert.equal(lane({...ordinary,draft:true,base:'develop'}),'');
  assert.equal(lane({...ordinary,event:'push',draft:false}),'');
  assert.equal(lane({...ordinary,event:'workflow_dispatch',draft:false}),'');
});
