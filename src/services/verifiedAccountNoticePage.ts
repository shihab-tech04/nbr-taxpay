/** Pure, fail-closed provenance/privacy gate for Auth-owned recipient SQL.
 * The caller's TIN must not be returned from the notice endpoint or accepted
 * as an input. An unverified source row never reaches the notification UI.
 */
export function validateAccountReceivedPaymentPage(raw:unknown):unknown {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid recipient page');
  const data=raw as Record<string,unknown>;
  if(!Array.isArray(data.items))throw Error('Invalid recipient page');
  for(const item of data.items){
    if(!item||typeof item!=='object'||Array.isArray(item))
      throw Error('Invalid recipient event');
    const row=item as Record<string,unknown>;
    if(row.recordState!=='RECORDED_NOT_CONFIRMED_TAX_CREDIT'||row.recipientTin!==null)
      throw Error('Recipient provenance or privacy not verified');
  }
  return data;
}
