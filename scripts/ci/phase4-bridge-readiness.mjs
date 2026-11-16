/** Independent Phase 4 source-routing gate. Input consists of counts/config booleans,
 * never keys, taxpayer records or personal identifiers. This module cannot mutate SQL.
 */
export function verifyBridgeReadiness(s) {
  if (!s || typeof s !== 'object') throw Error('INVALID_SNAPSHOT');
  for (const key of ['legacyStoryCount','officeLegacyCount','v2StoryCount','officeV2Count','v2StoryMirrorOutbox','v2SyncOutbox']) {
    if (!Number.isSafeInteger(s[key]) || s[key] < 0) throw Error('INVALID_COUNT_'+key);
  }
  const blockers = [];
  if (s.legacyStoryCount !== s.officeLegacyCount)
    blockers.push('LEGACY_OFFICE_PARITY');
  if (s.v2StoryCount !== s.officeV2Count)
    blockers.push('V2_OFFICE_PARITY');
  if (s.v2StoryCount > 0 && s.v2StoryMirrorOutbox > 0 && s.v2SyncOutbox === 0)
    blockers.push('STORY_OUTBOX_NOT_SYNC_OUTBOX');
  if (s.v2BridgeEnabled !== true)
    blockers.push('V2_BRIDGE_DISABLED');
  if (s.officePeerIsV2 !== true)
    blockers.push('OFFICE_PEER_NOT_V2');
  if (s.crossProjectOfficerReadback !== true)
    blockers.push('OFFICER_READBACK_UNVERIFIED');
  if (s.hostedRecoveryVerified !== true)
    blockers.push('HOSTED_RECOVERY_UNVERIFIED');
  return { safeForCutover: blockers.length === 0, blockers };
}
