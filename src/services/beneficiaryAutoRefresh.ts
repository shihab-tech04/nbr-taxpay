/** Collapse the two browser events triggered by a return to the same tab into
 * one fresh read. Never cache successful responses: explicit edits always
 * request the latest persisted lists and people. One gate is scoped per view. */
export function createBeneficiaryAutoRefreshGate(cooldownMs = 1250) {
  let running = false;
  let lastStartedAt = Number.NEGATIVE_INFINITY;
  return {
    begin(now: number): boolean {
      if (!Number.isFinite(now) || running || now - lastStartedAt < cooldownMs) return false;
      running = true;
      lastStartedAt = now;
      return true;
    },
    finish(): void { running = false; }
  };
}

/** A new Auth owner or preview session must remount the entire beneficiary
 * workspace before any previous owner's saved rows or open edit dialogs can
 * render under a different identity. The key contains no TIN or capability.
 */
export function beneficiaryWorkspaceOwnerScope(input:{
  authLoading:boolean;authUid:string|null;previewId:string|null;previewSessionId:string|null;
}):string{
  if(input.authLoading)return 'auth-pending';
  if(input.authUid)return 'auth:'+input.authUid;
  if(input.previewId)return 'preview:'+input.previewId+':'+(input.previewSessionId??'unavailable');
  return 'guest';
}
