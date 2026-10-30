import test from 'node:test';
import assert from 'node:assert/strict';
import { authRedirectUrl, verifiedDraftCategory, draftSeedForCategory, sameAuthenticatedOwner, confirmDraftDeletion, shouldApplyInitialAuthResolution } from '../src/services/secureWorkspacePolicy.ts';

test('hosted auth redirect retains GitHub Pages subpath',()=>{
 assert.equal(authRedirectUrl('https://shihab2-tech.github.io','/NBR-Tax-Payment/'),
 'https://shihab2-tech.github.io/NBR-Tax-Payment/?action=secure_workspace');
});
test('auth callback path blocks arbitrary external host and injection',()=>{
 for(const p of ['//evil.tld/', '/../', '/x?other=', '/x#frag', 'x/', '/NBR-Tax-Payment'])
 assert.throws(()=>authRedirectUrl('https://shihab2-tech.github.io',p));
 assert.throws(()=>authRedirectUrl('evil.com','/'));
});
test('session identity owner comparison fails closed',()=>{
 assert.equal(sameAuthenticatedOwner('abc','abc'),true);
 for(const id of ['',undefined,null,'other'])
 assert.equal(sameAuthenticatedOwner(id,'abc'),false);
});

test('late startup identity resolution yields to a newer auth state event',()=>{
 assert.equal(shouldApplyInitialAuthResolution(4,4),true);
 assert.equal(shouldApplyInitialAuthResolution(4,5),false);
});

test('delete confirmation requires exact single returned owner row',()=>{
 assert.equal(confirmDraftDeletion('draft-a', [{id:'draft-a'}]), true);
 for(const result of [[], null, undefined, [{}], [{id:'other'}], [{id:'draft-a'},{id:'draft-a'}], 'draft-a'])
   assert.equal(confirmDraftDeletion('draft-a',result),false);
});

test('selected payment purpose survives allowed email callback without private data in URL', () => {
  assert.equal(authRedirectUrl('http://127.0.0.1:4173', '/', 'SOURCE_TAX_DEPOSIT'),
    'http://127.0.0.1:4173/?action=secure_workspace&draftCategory=SOURCE_TAX_DEPOSIT');
  assert.equal(authRedirectUrl('https://taxpay.example.test', '/nbr-taxpay/', 'ADVANCE_TAX'),
    'https://taxpay.example.test/nbr-taxpay/?action=secure_workspace&draftCategory=ADVANCE_TAX');
  assert.equal(verifiedDraftCategory('ADVANCE_TAX', null), 'ADVANCE_TAX');
  assert.equal(verifiedDraftCategory(null, 'SOURCE_TAX_DEPOSIT'), 'SOURCE_TAX_DEPOSIT');
  assert.equal(verifiedDraftCategory('__proto__', 'unknown'), null);
  assert.equal(verifiedDraftCategory('TRAVEL_TAX', null), null);
  assert.deepEqual(draftSeedForCategory('SOURCE_TAX_DEPOSIT'), {
    purpose: 'WITHHOLDING_TAX_DEPOSIT', category: 'SOURCE_TAX_DEPOSIT',
    assessmentYear: '', amount: '', memo: ''
  });
  assert.deepEqual(draftSeedForCategory('ADVANCE_TAX'), {
    purpose: 'TAX_LIABILITY_PAYMENT', category: 'ADVANCE_TAX',
    assessmentYear: '', amount: '', memo: ''
  });
  assert.equal(draftSeedForCategory(null), null);
});

test('beneficiary email login returns only to the allowlisted private destination and preserves language', () => {
  assert.equal(authRedirectUrl('https://shihab-tech04.github.io','/nbr-taxpay/', undefined, 'beneficiaries','bn'),
    'https://shihab-tech04.github.io/nbr-taxpay/?action=beneficiaries&lang=bn');
  assert.equal(authRedirectUrl('https://shihab-tech04.github.io','/nbr-taxpay/', undefined, 'https://evil.example','en'),
    'https://shihab-tech04.github.io/nbr-taxpay/?action=secure_workspace');
  assert.equal(authRedirectUrl('https://shihab-tech04.github.io','/nbr-taxpay/', undefined, 'manage_authorization'),
    'https://shihab-tech04.github.io/nbr-taxpay/?action=secure_workspace');
});
