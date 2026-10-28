/** Read-only owned application record counts, never financial balances. */
export type AccountActivityCounts = {drafts:number;reviewRequests:number;correctionInquiries:number};
export function checkedOwnerRecordCount(value:number|null):number {
  if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)
    throw new Error('Account record count unavailable or invalid');
  return value;
}
