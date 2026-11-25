import type {ChallanReceipt} from '../types/tax';
import type {GiftTaxPaymentInput,GiftTaxPaymentOutcome} from './giftTaxPaymentGateway';

/** Browser-local sample only. Never substitute a local receipt for SQL evidence. */
export function resolveGiftTaxReceipt(input:GiftTaxPaymentInput,
  outcome:GiftTaxPaymentOutcome,signedIn:boolean):ChallanReceipt|null {
  if(outcome.kind!=='SIMULATED_SUCCESS')return null;
  if(outcome.receipt)return outcome.receipt;
  if(signedIn)return null;
  const {donor,donee,giftAmountMinor,estimatedTaxMinor,giftDate,description,remarks}=input;
  const year=Number(giftDate.slice(0,4))+(Number(giftDate.slice(5,7))>=7?1:0);
  const assessmentYear=year+'-'+String(year+1).slice(-2);
  const amount=estimatedTaxMinor/100;
  return {
    id:outcome.reference,challanNo:outcome.reference,tokenNumber:'SIMULATION',
    paymentCategory:'GIFT_TAX',assessmentYear,
    payerName:input.payer?.name??'',payerTin:input.payer?.tin??'',
    taxpayerName:donor.name,taxpayerTin:donor.tin,
    receiptMobile:input.payer?.phone,receiptEmail:input.payer?.email,
    noticeReference:input.payer?.noticeReference,paymentRemarks:remarks,
    giftDetails:{donor:{...donor},donee:{...donee},giftAmountMinor,estimatedTaxMinor,giftDate,description,remarks},
    isRepresentativePayment:false,taxZone:'—',taxCircle:'—',isWithholding:false,
    items:[{headId:0,economicCode:'SIM-GIFT',headNameEn:'Gift Tax',taxAmount:amount,
      penaltyAmount:0,surchargeAmount:0,interestAmount:0,totalAmount:amount}],
    totalAmount:amount,paymentMethod:outcome.method,gatewayTransactionId:outcome.reference,
    treasuryStatus:'INITIATED',taxCreditStatus:'NOT_APPLICABLE',
    createdAt:outcome.createdAt,isSimulatedDemo:true,
  };
}
