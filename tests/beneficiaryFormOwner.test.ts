import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {beneficiaryDeleteFailureMayHaveCommitted,beneficiaryFormOwnerKey,beneficiaryFormOwnerUnchanged,beneficiaryOwnerContextUnchanged} from '../src/services/beneficiaryFormOwner';

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

test('saved-row retag editor rejects an account, preview capability or identity-resolution change',()=>{
  const auth={ownerUid:'auth-user-a',ownerKey:'auth:auth-user-a',checkingIdentity:false};
  assert.equal(beneficiaryOwnerContextUnchanged(auth,auth),true);
  assert.equal(beneficiaryOwnerContextUnchanged(auth,{...auth,ownerUid:'auth-user-b',ownerKey:'auth:auth-user-b'}),false);
  const guest={ownerUid:null,ownerKey:beneficiaryFormOwnerKey(null,'user1',preview),checkingIdentity:false};
  assert.equal(beneficiaryOwnerContextUnchanged(guest,guest),true);
  assert.equal(beneficiaryOwnerContextUnchanged(guest,{...guest,ownerKey:beneficiaryFormOwnerKey(null,'user1',{...preview,capability:'B'.repeat(43)})}),false);
  assert.equal(beneficiaryOwnerContextUnchanged(guest,{...guest,checkingIdentity:true}),false);
});

test('delete recovery reconciles ambiguous transport failures but preserves deterministic denials',()=>{
  assert.equal(beneficiaryDeleteFailureMayHaveCommitted(new TypeError('Failed to fetch')),true);
  assert.equal(beneficiaryDeleteFailureMayHaveCommitted(new Error('The beneficiary is no longer saved. Refresh and try again.')),false);
  assert.equal(beneficiaryDeleteFailureMayHaveCommitted({status:403}),false);
  assert.equal(beneficiaryDeleteFailureMayHaveCommitted({status:502}),true);
});

test('every beneficiary write form rechecks its captured owner before its API mutation',()=>{
  const source=readFileSync(new URL('../src/components/screens/Beneficiaries.tsx',import.meta.url),'utf8');
  const body=(name:string)=>{
    const start=[`async function ${name}(`,`function ${name}(`]
      .map(marker=>source.indexOf(marker)).find(index=>index>=0)??-1;
    assert.notEqual(start,-1,`${name} handler exists`);
    const end=source.indexOf('\n  }',start);
    assert.notEqual(end,-1,`${name} handler has a body`);
    return source.slice(start,end);
  };
  const cases=[
    ['saveList','createBeneficiaryList(owner,listName)'],
    ['saveSingle','addBeneficiaries(owner,id,'],
    ['finishImport','addBeneficiaries(owner,id,chosen.map'],
  ] as const;
  for(const [name,mutation] of cases){
    const fn=body(name);
    const ownerCheck=fn.indexOf('maySaveFor(');
    const write=fn.indexOf(mutation);
    assert.ok(ownerCheck>=0,`${name} checks the captured owner`);
    assert.ok(write>ownerCheck,`${name} checks ownership before ${mutation}`);
  }
  const resolve=body('resolveList');
  assert.ok(resolve.indexOf('maySaveFor(')>=0);
  assert.ok(resolve.indexOf('createBeneficiaryList(owner,listName)')>resolve.indexOf('maySaveFor('));
  const openEdit=body('openPersonEditor');
  assert.match(openEdit,/editOwnerContextRef\.current=\{ownerUid:owner,ownerKey:activeFormOwner\(\),checkingIdentity\}/);
  const edit=body('saveEdit');
  const editOwnerCheck=edit.indexOf('if(!editOwnerIsCurrent())');
  const editWrites=[edit.indexOf('moveBeneficiary(editOwnerContext.ownerUid,'),edit.indexOf('editBeneficiaryClassification(editOwnerContext.ownerUid,')].filter(i=>i>=0);
  assert.ok(editOwnerCheck>=0,'saveEdit rejects a stale owner before changing a tagged row');
  assert.ok(editWrites.length===2,'both retag and legacy-move paths use the captured owner');
  assert.ok(editWrites.every(i=>i>editOwnerCheck),'the captured owner check precedes both edit paths');
  assert.ok(edit.indexOf('if(!editOwnerIsCurrent())throw new Error(accountChangedMessage())')>Math.max(...editWrites),
    'saveEdit checks the captured owner after the write before readback');
  assert.ok(edit.includes('loadBeneficiaries(editOwnerContext.ownerUid,{forceFresh:true})'),
    'readback is scoped to the editor owner captured when the row was opened');
});

test('saved-beneficiary deletion is bound to the captured edit owner and verified after refresh',()=>{
  const source=readFileSync(new URL('../src/components/screens/Beneficiaries.tsx',import.meta.url),'utf8');
  const body=(name:string)=>{
    const start=[`async function ${name}(`,`function ${name}(`]
      .map(marker=>source.indexOf(marker)).find(index=>index>=0)??-1;
    assert.notEqual(start,-1,`${name} handler exists`);
    const end=source.indexOf('\n  }',start);
    assert.notEqual(end,-1,`${name} handler has a body`);
    return source.slice(start,end);
  };
  const request=body('requestDeletePerson');
  assert.ok(request.includes('deleteOwnerContextRef.current=context'));
  assert.ok(request.includes('beneficiaryOwnerContextUnchanged(context,currentOwnerContextRef.current)'));
  const remove=body('confirmRemove');
  const preflight=remove.indexOf('if(!deleteOwnerIsCurrent())');
  const mutation=remove.indexOf('removeBeneficiary(deleteOwnerContext.ownerUid,person.id)');
  assert.ok(preflight>=0&&mutation>preflight,'the captured owner is checked before the delete');
  const readback=remove.indexOf('loadBeneficiaries(deleteOwnerContext.ownerUid,{forceFresh:true})');
  assert.ok(readback>mutation,'deletion is confirmed with a fresh read scoped to the captured owner');
  const postReadback=remove.indexOf('if(!deleteOwnerIsCurrent())',readback);
  assert.ok(postReadback>readback,
    'the owner context is checked again after the asynchronous readback');
  assert.ok(remove.includes('saved.people.some(item=>item.id===person.id)'),
    'the UI reports success only after the deleted row is absent in owner-scoped readback');
  const recover=remove.indexOf('if(beneficiaryDeleteFailureMayHaveCommitted(e)){');
  assert.ok(recover>postReadback,
    'the recovery read is only attempted after a failure that may have committed');
  assert.ok(remove.indexOf('const recovered=await loadBeneficiaries(deleteOwnerContext.ownerUid,{forceFresh:true})')>recover,
    'a dropped first readback gets a fresh owner-scoped recovery read before retry is offered');
});

test('bulk beneficiary removal stays bound to the owner captured when confirmation opens',()=>{
  const source=readFileSync(new URL('../src/components/screens/Beneficiaries.tsx',import.meta.url),'utf8');
  const body=(name:string)=>{
    const start=[`async function ${name}(`,`function ${name}(`]
      .map(marker=>source.indexOf(marker)).find(index=>index>=0)??-1;
    assert.notEqual(start,-1,`${name} handler exists`);
    const end=source.indexOf('\n  }',start);
    assert.notEqual(end,-1,`${name} handler has a body`);
    return source.slice(start,end);
  };
  const request=body('requestBulkRemove');
  assert.ok(request.includes('bulkRemoveOwnerContextRef.current=context'));
  const remove=body('confirmBulkRemove');
  const preflight=remove.indexOf('if(!ownerIsCurrent())');
  const mutation=remove.indexOf('removeBeneficiary(context.ownerUid,id)');
  assert.ok(preflight>=0&&mutation>preflight,'bulk deletion checks the captured owner before its first write');
  assert.ok(remove.includes('if(!ownerIsCurrent()){closeStaleBulkRemove();return;}'),
    'bulk deletion stops between rows if the owner changes during the request');
  const readback=remove.indexOf('const saved=await reload()');
  assert.ok(readback>mutation&&remove.indexOf('if(!ownerIsCurrent())',readback)>readback,
    'bulk deletion checks owner context after the fresh list readback');
});
