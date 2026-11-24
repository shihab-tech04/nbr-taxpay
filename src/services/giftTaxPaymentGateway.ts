/**
 * Gift Tax money must NEVER be initiated through the public simulated
 * payment RPC, payment_v1 nonfinancial request, or fixture TIN lookup.
 *
 * Until a verified, server-controlled Gift Tax head, NBR identity/zone/circle,
 * exemptions, trusted gateway, settlement callback, Office readback and donor
 * credit posting exist, the production adapter fails closed without network
 * requests or SQL writes. The union describes a future audited adapter
 * contract; only UNAVAILABLE can currently be returned.
 */
import type {ChallanReceipt} from '../types/tax';

export interface GiftTaxPaymentInput {
  donor: {tin: string; name: string};
  donee: {
    tin: string;
    name: string;
    tag: 'clients' | 'friends_family' | 'others';
    relationship: string | null;
    otherLabel: string | null;
  };
  giftAmountMinor: number;
  estimatedTaxMinor: number;
  description: string;
  giftDate: string;
  remarks: string;
  /** Sample-only payer/receipt fields from the shared walk-in Final Preview.
   * Never interpreted as authorization or sent to the financial gateway. */
  payer?: {name:string;phone:string;email:string;noticeReference:string;tin:string};
  /** Generated for this exact review. Reuse on retry until server resolves. */
  idempotencyKey: string;
}
export type GiftTaxPaymentOutcome =
  | {kind: 'UNAVAILABLE'; code: 'OFFICIAL_GIFT_TAX_NOT_CONFIGURED'}
  | {kind: 'PENDING'; requestId: string; reference: string; receivedAt: string}
  | {kind: 'FAILED'; requestId: string; reason: string; retryable: boolean}
  | {kind: 'SETTLED'; requestId: string; verified: GiftTaxVerifiedSettlement}
  | {kind: 'SIMULATED_SUCCESS'; reference: string; method: GiftTaxSimulationMethod; createdAt: string; receipt?:ChallanReceipt}
  | {kind:'SIMULATED_SYNC_PENDING';reference:string;method:GiftTaxSimulationMethod}
  | {kind: 'SIMULATED_PENDING'; reference: string}
  | {kind: 'SIMULATED_FAILED'; reason: string; retryable: true}
  | {kind: 'SIMULATED_NO_TAX'};

export interface GiftTaxVerifiedSettlement {
  /** Retrieved from a trusted server verification response, never browser input. */
  issuer: 'OFFICIAL_PAYMENT_GATEWAY';
  sourceEvidenceRef: string;
  paymentReference: string;
  governmentChallanNo: string;
  receiptDocumentUrl: string;
  challanDocumentUrl: string;
  donorTin: string;
  doneeTin: string;
  donorZone: string;
  donorCircle: string;
  confirmedAmountMinor: number;
  confirmedAt: string;
  donorCreditPostingReference: string;
}

/** Fail closed on missing/mismatched data. This does NOT replace server authentication. */
export function validatedGiftTaxSettlement(
  outcome: GiftTaxPaymentOutcome,
  input: GiftTaxPaymentInput
): GiftTaxVerifiedSettlement | null {
  if (outcome.kind !== 'SETTLED') return null;
  const proof = outcome.verified;
  if (proof.issuer !== 'OFFICIAL_PAYMENT_GATEWAY' ||
    !proof.sourceEvidenceRef || !proof.paymentReference ||
    !proof.governmentChallanNo || !proof.donorCreditPostingReference ||
    !proof.donorZone || !proof.donorCircle || !proof.confirmedAt ||
    proof.donorTin !== input.donor.tin ||
    proof.doneeTin !== input.donee.tin ||
    proof.confirmedAmountMinor !== input.estimatedTaxMinor ||
    !Number.isSafeInteger(proof.confirmedAmountMinor) ||
    !/^https:\/\//i.test(proof.receiptDocumentUrl) ||
    !/^https:\/\//i.test(proof.challanDocumentUrl)
  ) return null;
  return proof;
}

/** No official Gift Tax settlement adapter or authenticated guest payment yet. */
export async function initiateGiftTaxPayment(
  _input: GiftTaxPaymentInput
): Promise<GiftTaxPaymentOutcome> {
  // Deliberately NO simulated RPC and NO payment_v1 request: neither settles
  // bank funds nor credits the donor. Returning success would be fabricated.
  return {kind: 'UNAVAILABLE', code: 'OFFICIAL_GIFT_TAX_NOT_CONFIGURED'};
}

/** The approved public simulation is deliberately separate from official payment.
 * It performs NO SQL mutation, no real gateway call and no donor credit posting.
 * Any SIM reference or receipt is a session-only preview, NOT an A-Challan.
 */
export type GiftTaxSimulationMethod =
  | 'BKASH' | 'NAGAD' | 'ROCKET' | 'SONALI_E_SHEBA' | 'A_CHALLAN_CARD'
  | 'BEFTN_RTGS' | 'INTERNET_BANKING' | 'VISA' | 'MASTERCARD' | 'BANK_BRANCH' | 'SIMULATED';
export function simulateGiftTaxPayment(input:GiftTaxPaymentInput,method:GiftTaxSimulationMethod,
  simulateDecline=false):GiftTaxPaymentOutcome {
  if (!/^\d{12}$/.test(input.donor.tin) || !/^\d{12}$/.test(input.donee.tin) ||
    input.donor.tin===input.donee.tin ||
    !Number.isSafeInteger(input.estimatedTaxMinor) || input.estimatedTaxMinor<0 ||
    !Number.isSafeInteger(input.giftAmountMinor) || input.giftAmountMinor<=0)
    return {kind:'SIMULATED_FAILED',reason:'Invalid Gift Tax review details.',retryable:true};
  if (input.estimatedTaxMinor===0) return {kind:'SIMULATED_NO_TAX'};
  const reference='SIM-GIFT-'+input.idempotencyKey;
  if (method==='BANK_BRANCH') return {kind:'SIMULATED_PENDING',reference};
  if (simulateDecline) return {kind:'SIMULATED_FAILED',reason:'The simulated payment was declined. Select another method and retry.',retryable:true};
  return {kind:'SIMULATED_SUCCESS',reference,method,createdAt:new Date().toISOString()};
}
