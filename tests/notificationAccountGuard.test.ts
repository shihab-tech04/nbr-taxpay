import test from 'node:test';
import assert from 'node:assert/strict';
import {isCurrentNoticeOwner,type NoticeOwnerIdentity} from '../src/services/notificationAccountGuard';

const owner=(authUid:string|null,profileId:string|null):NoticeOwnerIdentity=>({authUid,profileId});

test('WS2 F-085: delayed Account A SQL acknowledgment never repaints Account B',async()=>{
  let release!:()=>void;
  const delayedSqlAck=new Promise<void>(resolve=>{release=resolve;});
  let current=owner('auth-A','user1');
  const request=current;
  const visibleB=['Account B own notification'];
  const markRead=async()=>{
    await delayedSqlAck;
    if(isCurrentNoticeOwner(request,current))visibleB.push('Account A late notification');
  };
  const pending=markRead();
  current=owner('auth-B','user2');
  release();
  await pending;
  assert.deepEqual(visibleB,['Account B own notification']);
});

test('WS2 F-085: same-owner SQL acknowledgment and refresh can update only own rows',async()=>{
  let current=owner('auth-A','user1');
  const request=current;
  let result='unread';
  const apply=(next:string)=>{if(isCurrentNoticeOwner(request,current))result=next;};
  apply('read');
  assert.equal(result,'read');
  current=owner('auth-A','user1');
  apply('unread');
  assert.equal(result,'unread');
});

test('WS2 F-085: logout/cancellation, changed profile, and unbound sessions reject late responses',()=>{
  const request=owner('auth-A','user1');
  for(const switched of [
    owner(null,null),owner('auth-B','user2'),owner('auth-A','user2'),
    owner('auth-A',null),owner('auth-B','user1'),
  ])assert.equal(isCurrentNoticeOwner(request,switched),false);
  assert.equal(isCurrentNoticeOwner(owner(null,null),owner(null,null)),false);
});

test('WS2 F-085: stale acknowledgment failures do not repaint another account error',async()=>{
  let rejectAck!:(err:Error)=>void;
  const pendingSql=new Promise<void>((_,reject)=>{rejectAck=reject;});
  let current=owner('auth-A','user1');
  const request=current;
  let errorB='';
  const action=pendingSql.catch(e=>{
    if(isCurrentNoticeOwner(request,current))errorB=e.message;
  });
  current=owner('auth-B','user2');
  rejectAck(new Error('Account A SQL timeout'));
  await action;
  assert.equal(errorB,'');
});
