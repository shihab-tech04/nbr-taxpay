import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const gate=()=>readFileSync('src/components/screens/PaymentDraftEntryGate.tsx','utf8');
const chooser=()=>readFileSync('src/components/screens/PaymentServiceChoiceDialog.tsx','utf8');

test('payment chooser keys private drafts to a verified preview session, not profile ID',()=>{
  const source=chooser();
  assert.match(source,/import \{ paymentDraftOwnerScope, type PaymentFormDraft/);
  assert.match(source,/const draftOwnerKey = paymentDraftOwnerScope\(draftActor\)/);
  assert.doesNotMatch(source,/draftOwnerKey = draftActor \? draftActor\.kind/);
});

test('draft entry rejects stale A -> B -> A owner and disabled-gate responses',()=>{
  const source=gate();
  assert.match(source,/const requestScope = ownerKey \+ ':' \+ String\(enabled\)/);
  assert.match(source,/const requestRef = useRef\(\{ scope: requestScope, generation: 0 \}\)/);
  assert.match(source,/requestRef\.current\.generation \+ 1/);
  assert.match(source,/requestRef\.current\.generation === requestGeneration/);
  assert.match(source,/const catalogCurrent = catalog\.ownerKey === ownerKey && catalog\.generation === requestGeneration/);
  assert.match(source,/if \(!stillCurrent\(\)\) return;\s*const latest = rows\.find/);
  assert.match(source,/if \(active && stillCurrent\(\)\) setCatalog/);
  assert.match(source,/if \(stillCurrent\(\)\) onResume\(latest\)|onResume\(latest\)/);
  assert.match(source,/if \(stillCurrent\(\)\) setError/);
  assert.match(source,/if \(stillCurrent\(\)\) setResuming\(null\)/);
});

test('draft entry blocks stale catalog even if parent mode is new',()=>{
  const source=gate();
  assert.match(source,/const blocking = enabled && \(!catalogCurrent \|\| \(mode !== 'new'/);
  assert.match(source,/!catalogCurrent \|\| catalog\.status === 'loading'/);
  assert.match(source,/setResuming\(null\)/);
  assert.match(source,/setCatalog\(\{ ownerKey, generation: requestGeneration, status: 'loading'/);
});

test('payment modal hides and closes an old draft immediately after an established owner changes',()=>{
  const source=chooser();
  assert.match(source,/originalDraftOwnerRef = useRef<string \| null>\(draftOwnerKey \|\| null\)/);
  assert.match(source,/if \(!originalDraftOwnerRef\.current && draftOwnerKey\) originalDraftOwnerRef\.current = draftOwnerKey/);
  assert.match(source,/originalDraftOwnerRef\.current !== draftOwnerKey/);
  assert.match(source,/if \(paymentOwnerChanged\) setPaymentServiceChoiceOpen\(false\)/);
  assert.match(source,/if \(paymentOwnerChanged\) return null;\s*return \(\s*<TaxPayModal/);
});

test('dashboard draft cards and counts reject an earlier generation of the same account',()=>{
  const source=readFileSync('src/components/screens/DashboardPaymentDrafts.tsx','utf8');
  assert.match(source,/generation: number/);
  assert.match(source,/catalog\.generation === requestGeneration && catalog\.status === 'ready'/);
  assert.match(source,/previous\.generation === requestGeneration && previous\.status === 'ready'/);
  assert.match(source,/catalog\.ownerKey !== ownerKey \|\| catalog\.generation !== requestGeneration/);
  assert.match(source,/onCountChange\?\.\(catalog\.ownerKey === ownerKey && catalog\.generation === requestGeneration/);
  assert.match(source,/if \(sameOwner\(\)\) setCatalog\(previous => previous\.ownerKey === ownerKey && previous\.generation === requestGeneration/);
  assert.match(source,/setCatalog\(previous => previous\.ownerKey === ownerKey && previous\.generation === requestGeneration/);
});
