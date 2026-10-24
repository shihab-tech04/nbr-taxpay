/** Optional payment preselection, never evidence of a legally payable tax amount.
 * This is presentation-only input. Server payment validation and entitlement checks remain mandatory.
 */
export const prefillCategories = [
  'TAX_WITH_RETURN','ADVANCE_TAX','ASSESSED_DEMAND','PENALTY',
  'SOURCE_TAX_DEPOSIT','APPELLATE_TRIBUNAL','OTHER_TAX_PAYMENT'
] as const;
export type PrefillCategory = typeof prefillCategories[number];
export type PaymentPrefill = {
  category:PrefillCategory;
  assessmentYear:string;
  amount:string;
};
export function parsePaymentPrefill(input:{
  initialCategory?:unknown;
  initialAssessmentYear?:unknown;
  initialAmount?:unknown;
}):PaymentPrefill | null {
  const category=typeof input.initialCategory==='string' &&
    (prefillCategories as readonly string[]).includes(input.initialCategory)
      ? input.initialCategory as PrefillCategory : null;
  if(!category)return null;
  let assessmentYear='2026-27';
  if(typeof input.initialAssessmentYear==='string'){
    const match=/^(20\d{2})-(20\d{2}|\d{2})$/.exec(input.initialAssessmentYear);
    if(match){
      const start=Number(match[1]),end=Number(match[2]);
      if(end%100===(start+1)%100)assessmentYear=match[1]+'-'+String((start+1)%100).padStart(2,'0');
    }
  }
  let amount='100.00';
  const raw=input.initialAmount;
  if((typeof raw==='string'||typeof raw==='number')&&/^\d{1,10}(?:\.\d{1,2})?$/.test(String(raw))){
    const value=Number(raw);
    if(Number.isFinite(value)&&value>0&&value<=1000000000)amount=value.toFixed(2);
  }
  return {category,assessmentYear,amount};
}
