import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyBridgeReadiness} from './phase4-bridge-readiness.mjs';

const good = () => ({
 legacyStoryCount:23,officeLegacyCount:23,
 v2StoryCount:6,officeV2Count:6,
 v2StoryMirrorOutbox:6,v2SyncOutbox:6,
 v2BridgeEnabled:true,officePeerIsV2:true,
 crossProjectOfficerReadback:true,hostedRecoveryVerified:true,
});
test('matching source and Office snapshots with validated routing can proceed to other gates',()=>{
 const result=verifyBridgeReadiness(good());
 assert.deepEqual(result,{safeForCutover:true,blockers:[]});
});
test('legacy 23 and V2 6 are distinct records, not 29 assumed synced',()=>{
 const current={...good(),officeV2Count:0};
 assert.ok(verifyBridgeReadiness(current).blockers.includes('V2_OFFICE_PARITY'));
});
test('a demo mirror outbox is not a signed payment_sync outbox',()=>{
 const current={...good(),v2SyncOutbox:0};
 assert.ok(verifyBridgeReadiness(current).blockers.includes('STORY_OUTBOX_NOT_SYNC_OUTBOX'));
});
test('disabled V2 and a legacy Office peer block cutover',()=>{
 const current={...good(),v2BridgeEnabled:false,officePeerIsV2:false};
 const result=verifyBridgeReadiness(current);
 assert.ok(result.blockers.includes('V2_BRIDGE_DISABLED'));
 assert.ok(result.blockers.includes('OFFICE_PEER_NOT_V2'));
});
test('hosted restore and officer readback cannot be replaced by local CI',()=>{
 const current={...good(),crossProjectOfficerReadback:false,hostedRecoveryVerified:false};
 assert.equal(verifyBridgeReadiness(current).safeForCutover,false);
});
test('zero payments cannot be represented by negative or fractional counts',()=>{
 assert.throws(()=>verifyBridgeReadiness({...good(),v2StoryCount:-1}),/INVALID_COUNT/);
 assert.throws(()=>verifyBridgeReadiness({...good(),v2SyncOutbox:0.5}),/INVALID_COUNT/);
});
