import type { ChallanReceipt, PaymentCategory, PaymentLineItem } from '../types/tax';

/** Both Office and TaxPay link to this same TaxPay receipt route.
 * It reads SQL-confirmed Office records, never browser-local sample receipts. */
const OFFICE_API='https://ihbtabrvmyiwikqqbhrf.supabase.co/functions/v1/demo-story1-office';
const serviceCodes=new Set<PaymentCategory>([
 'TAX_WITH_RETURN','ADVANCE_TAX','ASSESSED_DEMAND','PENALTY',
 'SOURCE_TAX_DEPOSIT','APPELLATE_TRIBUNAL','OTHER_TAX_PAYMENT','TRAVEL_TAX'
]);
const methods=new Set<ChallanReceipt['paymentMethod']>([
 'BKASH','NAGAD','ROCKET','SONALI_E_SHEBA','A_CHALLAN_CARD',
 'BEFTN_RTGS','INTERNET_BANKING','VISA','MASTERCARD','BANK_BRANCH','SIMULATED'
]);
export const validCertificateTransactionId=(id:unknown):id is string=>
 typeof id==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
interface StoredPayment {
 id:string;service:string;amountMinor:number;status:string;createdAt:string;
 details?:Record<string,unknown>;
}
type StoredPage={items:StoredPayment[];total:number};
function stringValue(value:unknown):string{return typeof value==='string'?value:'';}
function numberValue(value:unknown):number{return typeof value==='number'&&Number.isFinite(value)?value:0;}
function toItems(value:unknown):PaymentLineItem[]{
 if(!Array.isArray(value))return [];
 return value.filter(item=>item&&typeof item==='object'&&!Array.isArray(item))
  .slice(0,40).map((raw):PaymentLineItem=>{
   const v=raw as Record<string,unknown>;
   return {headId:numberValue(v.headId),economicCode:stringValue(v.economicCode),
    headNameEn:stringValue(v.headNameEn),taxAmount:numberValue(v.taxAmount),
    penaltyAmount:numberValue(v.penaltyAmount),surchargeAmount:numberValue(v.surchargeAmount),
    interestAmount:numberValue(v.interestAmount),totalAmount:numberValue(v.totalAmount),
    ...(typeof v.note==='string'?{note:v.note}:{})};
  });
}
/** Validate snapshot against immutable database transaction identity and amount. */
export function makeConfirmedReceipt(tx:StoredPayment):ChallanReceipt{
 if(!validCertificateTransactionId(tx.id)||tx.status!=='SIMULATED_SUCCESS'||
    !serviceCodes.has(tx.service as PaymentCategory)||!Number.isSafeInteger(tx.amountMinor)||tx.amountMinor<=0)
   throw new Error('Payment record cannot be certified');
 const d=tx.details??{};
 const method=stringValue(d.paymentMethod);
 const snapshot=d.receiptSnapshot;
 if(snapshot&&typeof snapshot==='object'&&!Array.isArray(snapshot)){
  const raw=snapshot as Record<string,unknown>;
  const category=raw.paymentCategory;
  if(category===tx.service&&Math.round(numberValue(raw.totalAmount)*100)===tx.amountMinor
    &&Array.isArray(raw.items)){
    return {
      ...(raw as unknown as ChallanReceipt),
      paymentTransactionId:tx.id,
      createdAt:tx.createdAt,completedAt:tx.createdAt,
      treasuryStatus:'GATEWAY_SUCCESS',
      isSimulatedDemo:true,
      taxCreditStatus:tx.service==='SOURCE_TAX_DEPOSIT'?'NOT_APPLICABLE':'PENDING_RECONCILIATION',
    };
  }
 }
 const category=tx.service as PaymentCategory;
 const total=tx.amountMinor/100;
 const fallback:ChallanReceipt={
  id:tx.id,paymentTransactionId:tx.id,
  challanNo:stringValue(d.receiptReference)||tx.id,tokenNumber:'—',
  paymentCategory:category,assessmentYear:stringValue(d.assessmentYear)||'—',
  payerName:stringValue(d.payerName)||'—',payerTin:stringValue(d.payerTin)||'—',
  taxpayerTin:stringValue(d.taxpayerTin),receiptMobile:stringValue(d.receiptMobile),
  noticeReference:stringValue(d.noticeReference),
  isRepresentativePayment:d.payerMode==='OTHER',
  taxZone:stringValue(d.taxZone)||'—',taxCircle:stringValue(d.taxCircle)||'—',
  isWithholding:category==='SOURCE_TAX_DEPOSIT'||d.isWithholding===true,
  items:toItems(d.lines),totalAmount:total,
  paymentMethod:methods.has(method as ChallanReceipt['paymentMethod'])?
   method as ChallanReceipt['paymentMethod']:'SIMULATED',
  gatewayTransactionId:tx.id,treasuryStatus:'GATEWAY_SUCCESS',
  taxCreditStatus:category==='SOURCE_TAX_DEPOSIT'?'NOT_APPLICABLE':'PENDING_RECONCILIATION',
  createdAt:tx.createdAt,completedAt:tx.createdAt,isSimulatedDemo:true,
 };
 return fallback;
}
export async function getConfirmedReceipt(transactionId:string):Promise<ChallanReceipt>{
 if(!validCertificateTransactionId(transactionId))throw new Error('Invalid transaction reference');
 // The Office feed contains only UI-submitted, SQL-mirrored simulated payments.
 // Page through all rows rather than silently displaying a fixture for a missing record.
 for(let page=1;page<=100;page++){
  const response=await fetch(OFFICE_API+'/payments?page='+page+'&perPage=100',{cache:'no-store'});
  if(!response.ok)throw new Error('Certificate record service unavailable');
  const envelope=await response.json() as {success:boolean;data:StoredPage};
  if(!envelope.success||!envelope.data||!Array.isArray(envelope.data.items))
   throw new Error('Invalid certificate response');
  const matched=envelope.data.items.find(p=>p.id===transactionId);
  if(matched)return makeConfirmedReceipt(matched);
  if(page*100>=envelope.data.total)break;
 }
 throw new Error('No synchronized payment record found for this transaction');
}
export const certificateDocumentUrl=(transactionId:string,action?:'print'|'download')=>{
 const url=new URL(window.location.origin+import.meta.env.BASE_URL);
 url.searchParams.set('action','payment_details');
 url.searchParams.set('transactionId',transactionId);
 if(action)url.searchParams.set('docAction',action);
 return url.toString();
};
