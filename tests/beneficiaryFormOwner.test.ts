import assert from 'node:assert/strict';
import {test} from 'node:test';
import {beneficiaryFormOwnerKey,beneficiaryFormOwnerUnchanged} from '../src/services/beneficiaryFormOwner';

const preview={profileId:'user1',capability:'A'.repeat(43),paymentSessionId:'11111111-1111-4111-8111-111111111111'};

test('beneficiary form is bound to the verified Auth owner, not a preview identity',()=>{
  const opened=beneficiaryFormOwnerKey('auth-user-a','user1',preview);
  assert.equal(opened,'auth:auth-user-a');
  assert.equal(beneficiaryFormOwnerUnchanged(opened,beneficiaryFormOwnerKey('auth-user-a','user2',null)),true);
  assert.equal(beneficiaryFormOwnerUnchanged(opened,beneficiaryFormOwnerKey('auth-user-b',null,null)),false);
});

test('preview form rejects User2, missing capability and replacement User1 login',()=>{
  const opened=beneficiaryFormOwnerKey(null,'user1',preview);
  assert.ok(opened?.startsWith('preview:user1:'));
  assert.equal(beneficiaryFormOwnerUnchanged(opened,beneficiaryFormOwnerKey(null,'user1',preview)),true);
  assert.equal(beneficiaryFormOwnerUnchanged(opened,beneficiaryFormOwnerKey(null,'user2',{...preview,profileId:'user2'})),false);
  assert.equal(beneficiaryFormOwnerUnchanged(opened,beneficiaryFormOwnerKey(null,'user1',{...preview,capability:'B'.repeat(43)})),false);
  assert.equal(beneficiaryFormOwnerUnchanged(opened,beneficiaryFormOwnerKey(null,'user1',{...preview,paymentSessionId:'22222222-2222-4222-8222-222222222222'})),false);
  assert.equal(beneficiaryFormOwnerUnchanged(opened,beneficiaryFormOwnerKey(null,'user1',null)),false);
});

test('anonymous or mismatched preview context never permits a beneficiary write',()=>{
  assert.equal(beneficiaryFormOwnerKey(null,'user1',{...preview,profileId:'user2'}),null);
  assert.equal(beneficiaryFormOwnerKey(null,null,preview),null);
  assert.equal(beneficiaryFormOwnerKey(null,'user1',null,true),'preview-fixture:user1');
  assert.equal(beneficiaryFormOwnerKey(null,'user1',null),null);
  assert.equal(beneficiaryFormOwnerUnchanged(null,null),false);
  assert.equal(beneficiaryFormOwnerUnchanged(null,'auth:auth-user-a'),false);
});
