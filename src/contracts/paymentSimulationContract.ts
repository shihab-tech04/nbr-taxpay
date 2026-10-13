/** TaxPay shared simulation contract v1.0.0.
 * Byte-identical in TaxPay and Office Management; changes require coordinated review.
 * Demonstration states are NOT government payments, challans or tax credits.
 */
export const TAXPAY_SIMULATION_CONTRACT_VERSION = '1.0.0' as const;
export const simulationUsers = ['user1','user2','user3','user4','user5','user6','user7','user8','user9','user10'] as const;
export type SimulationUser = typeof simulationUsers[number];
export const simulationCategories = ['TAX_WITH_RETURN','ADVANCE_TAX','ASSESSED_DEMAND','PENALTY','SOURCE_TAX_DEPOSIT','APPELLATE_TRIBUNAL','OTHER_TAX_PAYMENT'] as const;
export type SimulationCategory = typeof simulationCategories[number];
export const simulationStates = ['SIMULATED','PENDING','FAILED','REVERSED'] as const;
export type SimulationState = typeof simulationStates[number];
export const simulationReviewStates = ['PENDING_OFFICER','MAKER_ACKNOWLEDGED','REVIEWER_VERIFIED','APPROVER_CLOSED'] as const;
export type SimulationReviewState = typeof simulationReviewStates[number];
export type SimulationLine = {beneficiary:SimulationUser;category:SimulationCategory;assessmentYear:string;amountMinor:number};
export type SimulationAllocation = SimulationLine & {id:string;lineNo:number};
export type SimulationEvent = {id:number;action:string;note:string;occurredAt:string};
export type SimulationTransaction = {id:string;transactionId:string;payer:SimulationUser;state:SimulationState;createdAt:string;simulationOnly:true;totalMinor:number;reviewStatus:string;allocations:SimulationAllocation[];events:SimulationEvent[]};
export type SimulationNotice = {id:number;userId:SimulationUser;transactionId:string;messageCode:string;createdAt:string;isRead:boolean};
export type SimSubmission = {transactionId:string;reference:string;totalMinor:number;replayed:boolean};

/** Distinguishes UI stage from financial/payment status; no implied Treasury recognition. */
export const paymentJourneyStages = ['CATEGORY','INFORMATION','PAYMENT_DETAILS','SIMULATION_REVIEW','CONFIRMATION'] as const;
export type PaymentJourneyStage = typeof paymentJourneyStages[number];
export const simulationCategoryLabels:Record<SimulationCategory,{en:string;bn:string}> = {
 TAX_WITH_RETURN:{en:'Tax with return',bn:'রিটার্নের সাথে কর'},
 ADVANCE_TAX:{en:'Advance tax',bn:'অগ্রিম কর'},
 ASSESSED_DEMAND:{en:'Assessed demand',bn:'নির্ধারিত দাবির কর'},
 PENALTY:{en:'Penalty',bn:'জরিমানা'},
 SOURCE_TAX_DEPOSIT:{en:'Source tax deposit',bn:'উৎসে কর জমা'},
 APPELLATE_TRIBUNAL:{en:'Appellate tribunal',bn:'আপিল ট্রাইব্যুনাল'},
 OTHER_TAX_PAYMENT:{en:'Other tax payment',bn:'অন্যান্য কর পরিশোধ'}
};
/** Head names are display labels only, not verified legal applicability or rates. */
export const paymentStageLabels:Record<PaymentJourneyStage,{en:string;bn:string}> = {
 CATEGORY:{en:'Category',bn:'শ্রেণি'},INFORMATION:{en:'Information',bn:'তথ্য'},
 PAYMENT_DETAILS:{en:'Make payment',bn:'পেমেন্ট'},SIMULATION_REVIEW:{en:'Simulation',bn:'সিমুলেশন'},
 CONFIRMATION:{en:'Confirmation',bn:'নিশ্চিতকরণ'}
};
