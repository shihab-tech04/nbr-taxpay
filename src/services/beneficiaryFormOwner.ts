/** Bind an open beneficiary write form to its original, verified owner context.
 * Preview capability changes matter even if the visible demo User ID is the same.
 * This key is held in memory only: never log or persist it as a UI preference.
 */
export type BeneficiaryPreviewOwner={
  profileId:string;
  capability:string;
  paymentSessionId:string;
};

export type BeneficiaryOwnerContext={
  ownerUid:string|null;
  ownerKey:string|null;
  checkingIdentity:boolean;
};

export function beneficiaryFormOwnerKey(
  authUid:string|null,
  previewAccountId:string|null,
  preview:BeneficiaryPreviewOwner|null,
  allowDevFixture=false,
):string|null{
  if(authUid)return 'auth:'+authUid;
  if(!previewAccountId)return null;
  // Existing isolated Vite/Playwright fixtures use a demoUser route without a
  // deployed capability. Production must never accept that special case.
  if(!preview)return allowDevFixture?'preview-fixture:'+previewAccountId:null;
  if(preview.profileId!==previewAccountId)return null;
  if(!preview.capability||!preview.paymentSessionId)return null;
  return 'preview:'+preview.profileId+':'+preview.capability+':'+preview.paymentSessionId;
}

export function beneficiaryFormOwnerUnchanged(openedFor:string|null,current:string|null):boolean{
  return openedFor!==null && openedFor===current;
}

/** A saved-row editor is valid only for the Auth UID and preview capability
 * captured when the row was opened, and only after identity resolution ends.
 */
export function beneficiaryOwnerContextUnchanged(
  opened:BeneficiaryOwnerContext,
  current:BeneficiaryOwnerContext,
):boolean{
  return !current.checkingIdentity && opened.ownerUid===current.ownerUid &&
    beneficiaryFormOwnerUnchanged(opened.ownerKey,current.ownerKey);
}
