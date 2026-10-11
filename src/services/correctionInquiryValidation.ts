/** COR-001: unverified intake ONLY. Cannot open a verified correction, change
 * financial attribution, award a credit or verify claimant/official receipt. */
export type ProposedAttributionField='ASSESSMENT_YEAR'|'CIRCLE'|'PAYMENT_HEAD'|'ATTRIBUTION';
export type ProposedAttribution=Readonly<{
  field:ProposedAttributionField;
  previousValue:string;
  proposedValue:string;
}>;
export type CorrectionInquiryInput=Readonly<{
  change?:ProposedAttribution | null;
  originalReference:string;
  reason:string;
  desiredOutcome:string;
}>;
export type CorrectionInquiryDecision=Readonly<{
  allowedToRecordInquiry:boolean;
  verifiedClaimant:false;
  verifiedOriginalReceipt:false;
  authorizesFinancialCorrection:false;
  error:string|null;
}>;
export function validateCorrectionInquiry(input: CorrectionInquiryInput):CorrectionInquiryDecision {
  const fail=(error:string):CorrectionInquiryDecision=>({
    allowedToRecordInquiry:false, verifiedClaimant:false,
    verifiedOriginalReceipt:false,authorizesFinancialCorrection:false,error
  });
  const reference=input.originalReference.trim();
  const reason=input.reason.trim();
  const outcome=input.desiredOutcome.trim();
  const diff=input.change;
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{5,79}$/.test(reference))
    return fail('Enter a 6–80 character original reference. This does not verify an official receipt.');
  if (reason.length<10 || reason.length>1000)
    return fail('Explain the correction reason in 10–1000 characters.');
  if (outcome.length<10 || outcome.length>600)
    return fail('Describe the requested outcome in 10–600 characters.');
  if(diff) {
    if(!['ASSESSMENT_YEAR','CIRCLE','PAYMENT_HEAD','ATTRIBUTION'].includes(diff.field))
      return fail('Unsupported attribution field.');
    const oldValue=diff.previousValue.trim();
    const newValue=diff.proposedValue.trim();
    if(oldValue.length<1||newValue.length<1||oldValue.length>120||newValue.length>120)
      return fail('Original and proposed values must each be 1–120 characters.');
    if(oldValue.toLocaleLowerCase()===newValue.toLocaleLowerCase())
      return fail('The proposed attribution must differ from the original.');
  }
  return {
    allowedToRecordInquiry:true, verifiedClaimant:false,
    verifiedOriginalReceipt:false, authorizesFinancialCorrection:false,error:null
  };
}
