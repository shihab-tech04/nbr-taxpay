import test from 'node:test';
import assert from 'node:assert/strict';
import { authRedirectUrl, sameAuthenticatedOwner, confirmDraftDeletion, shouldApplyInitialAuthResolution } from '../src/services/secureWorkspacePolicy.ts';

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
