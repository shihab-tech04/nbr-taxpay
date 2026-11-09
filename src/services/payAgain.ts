/** Copy a recorded payer-owned transaction into independent, editable allocations.
 * Never copy receipt IDs, settlement status, old authorization or payment keys.
 */
export const CURRENT_PAY_AGAIN_YEAR='2026-27';
export const PAY_AGAIN_YEAR_OPTIONS=['2024-25','2025-26','2026-27','2027-28'] as const;
export type RepeatablePayment={payer:string;state:string;allocations:readonly {beneficiary:string;category:string;assessmentYear:string;amountMinor:number}[]};
export const canPayAgain=(p:RepeatablePayment,actor:string,view:string)=>Boolean(actor)&&view==='payer'&&p.payer===actor&&p.state==='SIMULATED'&&Array.isArray(p.allocations)&&p.allocations.length>0&&p.allocations.length<=20;
export function copyPreviousPayment(p:RepeatablePayment,actor:string,view:string,allowedTaxpayers:readonly string[],allowedCategories:readonly string[],currentYear=CURRENT_PAY_AGAIN_YEAR) {
  if(!canPayAgain(p,actor,view))throw Error('Only your recorded payments can be reused.');
  if(!PAY_AGAIN_YEAR_OPTIONS.some(y=>y===currentYear))throw Error('Current assessment year is not configured.');
  const allowed=new Set(allowedTaxpayers),categories=new Set(allowedCategories);
  const lines=p.allocations.map(a=>{
    if(!allowed.has(a.beneficiary))throw Error('A taxpayer is no longer available. Review beneficiary access.');
    if(!categories.has(a.category))throw Error('A payment category is no longer available.');
    if(!/^\d{4}-\d{2}$/.test(a.assessmentYear)||!Number.isSafeInteger(a.amountMinor)||a.amountMinor<=0)throw Error('Previous allocation is invalid.');
    return {beneficiary:a.beneficiary,category:a.category,assessmentYear:a.assessmentYear===currentYear?currentYear:'',amount:Math.floor(a.amountMinor/100)+'.'+String(a.amountMinor%100).padStart(2,'0')};
  });
  return {lines,clearedYears:lines.filter(l=>!l.assessmentYear).length};
}
