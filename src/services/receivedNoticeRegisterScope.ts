/** Resolve a recipient notice register without mixing real Auth and preview
 * identities. UI scoping is defense in depth; both SQL backends enforce
 * their own capability/approved Auth binding independently.
 */
export type RecipientRegisterScope=Readonly<{
  ownerKey:string;
  mode:'auth'|'preview';
}>;

export function resolveReceivedNoticeRegisterScope(input:Readonly<{
  authOwnerUid?:string;
  profileId?:string;
  authenticatedUid:string|null;
  realFeedEnabled:boolean;
  previewFeedEnabled:boolean;
}>):RecipientRegisterScope|null{
  const {authOwnerUid,profileId,authenticatedUid,realFeedEnabled,previewFeedEnabled}=input;
  if(authOwnerUid){
    if(!realFeedEnabled||!authenticatedUid||authenticatedUid!==authOwnerUid)return null;
    return {ownerKey:'auth:'+authOwnerUid,mode:'auth'};
  }
  // Never let an authenticated account silently fall through to a fictional
  // browser capability; the user must explicitly sign out of real Auth.
  if(authenticatedUid||!previewFeedEnabled||!profileId)return null;
  return {ownerKey:'preview:'+profileId,mode:'preview'};
}
