/** A late SQL response is usable only for the exact account/profile that requested it.
 * SQL/RLS remains authoritative; this prevents a stale React result or error repaint.
 */
export type NoticeOwnerIdentity=Readonly<{authUid:string|null;profileId:string|null}>;

export function isCurrentNoticeOwner(request:NoticeOwnerIdentity,current:NoticeOwnerIdentity):boolean{
  return request.authUid!==null&&request.profileId!==null&&
    request.authUid===current.authUid&&request.profileId===current.profileId;
}
