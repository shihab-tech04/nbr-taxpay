import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveReceivedNoticeRegisterScope as scope} from '../src/services/receivedNoticeRegisterScope';
const data={authOwnerUid:undefined as string|undefined,profileId:undefined as string|undefined,
  authenticatedUid:null as string|null,realFeedEnabled:true,previewFeedEnabled:true};

test('verified Auth account gets only its exact UID notice source',()=>{
  assert.deepEqual(scope({...data,authOwnerUid:'owner-A',authenticatedUid:'owner-A'}),{
    ownerKey:'auth:owner-A',mode:'auth'});
});
test('signed-out or switched Auth account cannot retain previous owner source',()=>{
  for(const authenticatedUid of [null,'owner-B'])
    assert.equal(scope({...data,authOwnerUid:'owner-A',authenticatedUid}),null);
});
test('real feed flag off keeps real register inaccessible',()=>{
  assert.equal(scope({...data,authOwnerUid:'owner-A',authenticatedUid:'owner-A',realFeedEnabled:false}),null);
});
test('fictional preview is isolated from real authenticated account',()=>{
  assert.equal(scope({...data,profileId:'user1',authenticatedUid:'owner-A'}),null);
  assert.deepEqual(scope({...data,profileId:'user1'}),{ownerKey:'preview:user1',mode:'preview'});
});
test('preview feed flag off and no owner are fail closed',()=>{
  assert.equal(scope({...data,profileId:'user1',previewFeedEnabled:false}),null);
  assert.equal(scope(data),null);
});
test('authentication source takes priority over coincidentally same preview id',()=>{
  assert.deepEqual(scope({...data,profileId:'owner-A',authOwnerUid:'owner-A',authenticatedUid:'owner-A'}),{
    ownerKey:'auth:owner-A',mode:'auth'});
});
