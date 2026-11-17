import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createBeneficiaryAutoRefreshGate,beneficiaryWorkspaceOwnerScope} from '../src/services/beneficiaryAutoRefresh';

test('focus plus visibility resume shares one beneficiary read', () => {
  const gate = createBeneficiaryAutoRefreshGate(1250);
  assert.equal(gate.begin(1000), true);
  assert.equal(gate.begin(1001), false, 'Do not duplicate an in-flight read');
  gate.finish();
  assert.equal(gate.begin(1010), false, 'Do not repeat immediate focus/visibility events');
  assert.equal(gate.begin(2250), true, 'Allow a subsequent genuine focus refresh');
  gate.finish();
});

test('failed reads release the guard without treating stale data as current', () => {
  const gate = createBeneficiaryAutoRefreshGate(100);
  assert.equal(gate.begin(0), true);
  gate.finish();
  assert.equal(gate.begin(100), true);
  gate.finish();
  assert.equal(gate.begin(Number.NaN), false);
});

test('saved picker ignores list and TIN callbacks from a previous owner session', () => {
  const picker=readFileSync('src/components/screens/SavedBeneficiaryPicker.tsx','utf8');
  assert.match(picker,/ownerScopeRef\.current=ownerScope/);
  assert.equal((picker.match(/if\(cancelled\|\|ownerScopeRef\.current!==ownerScope\)return;/g)||[]).length,2);
  assert.match(picker,/finally\(\(\)=>\{if\(!cancelled&&ownerScopeRef\.current===ownerScope\)setLoading\(false\);\}\)/);
  assert.match(picker,/onAvailableTins\(Array\.from\(new Set\(result\.people/);
});

test('beneficiary view remounts for every Auth owner and renewed preview session',()=>{
  const scope=beneficiaryWorkspaceOwnerScope;
  const owner=(authUid:string|null,previewId:string|null=null,previewSessionId:string|null=null,
    authLoading=false)=>scope({authLoading,authUid,previewId,previewSessionId});
  assert.equal(owner(null,null,null,true),'auth-pending');
  assert.equal(owner(null),'guest');
  assert.notEqual(owner('auth-a'),owner('auth-b'));
  assert.notEqual(owner('auth-a'),owner(null));
  assert.notEqual(owner('auth-a'),owner(null,'user1','session-1'));
  assert.notEqual(owner(null,'user1','session-1'),owner(null,'user1','session-2'));
  assert.equal(owner('auth-a','user1','session-1'),owner('auth-a','user2','session-2'),
    'Real Auth identity takes precedence over any synthetic preview state');
});

test('beneficiary interface keys all private rows and editing state by active owner',()=>{
  const source=readFileSync('src/components/screens/Beneficiaries.tsx','utf8');
  assert.match(source,/const ownerScope=beneficiaryWorkspaceOwnerScope\(/);
  assert.match(source,/return <BeneficiariesForOwner key=\{ownerScope\}\/>/);
  assert.match(source,/function BeneficiariesForOwner\(\)/);
  assert.match(source,/previewSessionId:session\?\.profileId===previewAccount\?\.id\?session\.paymentSessionId:null/);
});
