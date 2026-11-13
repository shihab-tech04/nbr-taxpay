import { CATEGORY_LABELS, MASTER_PAYMENT_HEADS } from '../data/paymentHeads';
import { validCertificateTransactionId } from './transactionId';
export { validCertificateTransactionId } from './transactionId';
import type { ChallanReceipt, PaymentCategory, PaymentLineItem, ReceiptAllocationItem } from '../types/tax';
import {sampleTinForUserNumber} from '../data/sampleTinSuggestions';

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
  }).filter(item=>item.headNameEn.trim().length>0||item.economicCode.trim().length>0||
   item.taxAmount!==0||item.penaltyAmount!==0||item.surchargeAmount!==0||
   item.interestAmount!==0||item.totalAmount!==0);
}
const validMinorAmount=(value:unknown):value is number=>
 typeof value==='number'&&Number.isSafeInteger(value)&&value>0;
const validTin=(value:unknown):value is string=>
 typeof value==='string'&&/^[0-9]{12,13}$/.test(value);

/** Older fictional records used a userN/SAVED_TIN synthetic beneficiary
 * identifier without a separate TIN field. This restores only that exact,
 * previously approved illustrative mapping, never taxpayer entitlement. */
function legacySyntheticTin(beneficiary:string):string|undefined {
 if(beneficiary.startsWith('SAVED_TIN:')){
  const saved=beneficiary.slice('SAVED_TIN:'.length);
  return validTin(saved)?saved:undefined;
 }
 const match=/^user([1-9]|[12][0-9]|30)$/.exec(beneficiary);
 if(!match)return undefined;
 return sampleTinForUserNumber(Number(match[1]))??undefined;
}

function toAllocationItems(tx:StoredPayment):ReceiptAllocationItem[]|undefined{
 const d=tx.details??{};
 const lines=Array.isArray(d.lines)
  ?d.lines.filter(line=>line&&typeof line==='object'&&!Array.isArray(line)) as Array<Record<string,unknown>>
  :[];
 const explicit=Array.isArray(d.allocations)
  ?d.allocations.filter(item=>item&&typeof item==='object'&&!Array.isArray(item)) as Array<Record<string,unknown>>
  :[];
 const synthetic=lines.some(line=>typeof line.beneficiary==='string');
 let items:ReceiptAllocationItem[]=[];
 if(synthetic && explicit.length){
  // Combined SQL payment: accounting lines and display allocations must match
  // one-to-one. Never use an unverified receipt snapshot to infer tax credit.
  const receiptLines=Array.isArray(d.receiptLines)
    ?d.receiptLines.filter(line=>line&&typeof line==='object'&&!Array.isArray(line)) as Array<Record<string,unknown>>
    :[];
  if(explicit.length!==lines.length||receiptLines.length!==lines.length||
    explicit.some((allocation,index)=>{
      const line=lines[index],head=receiptLines[index];
      return !validTin(allocation.taxpayerTin) ||
        !validMinorAmount(allocation.amountMinor) ||
        !Number.isSafeInteger(allocation.headId) ||
        typeof allocation.assessmentYear!=='string'||!allocation.assessmentYear.trim() ||
        // Earlier synthetic lines carry beneficiary/category/amount/year, with
        // TIN and head ID stored in the matched allocation and receipt line.
        // Preserve that valid historical contract while rejecting any explicit
        // synthetic TIN/head that disagrees with the durable allocation.
        (line.taxpayerTin!==undefined && line.taxpayerTin!==allocation.taxpayerTin) ||
        line.amountMinor!==allocation.amountMinor ||
        line.assessmentYear!==allocation.assessmentYear ||
        (line.headId!==undefined && line.headId!==allocation.headId) ||
        line.category!==tx.service ||
        head.headId!==allocation.headId ||
        Math.round(numberValue(head.totalAmount)*100)!==allocation.amountMinor;
    }))return undefined;
  items=explicit.map((allocation,index)=>{
    const head=receiptLines[index];
    const name=stringValue(allocation.taxpayerName).trim();
    const serviceEn=stringValue(head.headNameEn).trim()||CATEGORY_LABELS[tx.service]?.en||tx.service;
    return {taxpayerName:name||'TIN '+stringValue(allocation.taxpayerTin),
      taxpayerTin:stringValue(allocation.taxpayerTin),
      paymentServiceEn:serviceEn,
      paymentServiceBn:stringValue(head.headNameBn).trim()||MASTER_PAYMENT_HEADS.find(item=>item.id===head.headId&&item.nameEn===serviceEn)?.nameBn||serviceEn,
      assessmentYear:stringValue(allocation.assessmentYear),
      amountMinor:allocation.amountMinor as number,
      ...(stringValue(head.economicCode)?{economicCode:stringValue(head.economicCode)}:{})};
  });
 }else if(synthetic){
  if(lines.some(line=>typeof line.beneficiary!=='string'||
    !validMinorAmount(line.amountMinor)||!serviceCodes.has(line.category as PaymentCategory)))return undefined;
  items=lines.map(line=>{
   const category=line.category as PaymentCategory;
   const label=CATEGORY_LABELS[category];
   const name=stringValue(line.beneficiary).trim();
   // A single legacy record may carry the exact saved TIN in payment
   // details even when its synthetic user alias has a different length.
   // For mixed-recipient records, derive only the fixed fictional ID mapping.
   const storedSingleTin=lines.length===1&&validTin(d.taxpayerTin)?d.taxpayerTin:undefined;
   const tin=validTin(line.taxpayerTin)?line.taxpayerTin:
     storedSingleTin??legacySyntheticTin(name);
   return {taxpayerName:name||'—',paymentServiceEn:label.en,
    paymentServiceBn:label.bn,assessmentYear:stringValue(line.assessmentYear)||stringValue(d.assessmentYear)||'—',
    amountMinor:line.amountMinor as number,...(tin?{taxpayerTin:tin}:{}),
    ...(stringValue(line.economicCode)?{economicCode:stringValue(line.economicCode)}:{})};
  });
 }else if(explicit.length){
  if(explicit.some(item=>!validTin(item.taxpayerTin)||typeof item.headId!=='number'||
    !Number.isSafeInteger(item.headId)||!validMinorAmount(item.amountMinor)||
    typeof item.assessmentYear!=='string'||!item.assessmentYear.trim()))return undefined;
  items=explicit.map(item=>{
   const head=lines.find(line=>line.headId===item.headId);
   const name=stringValue(item.taxpayerName);
   const serviceEn=stringValue(head?.headNameEn).trim()||CATEGORY_LABELS[tx.service]?.en||tx.service;
   const serviceBn=stringValue(head?.headNameBn).trim()||MASTER_PAYMENT_HEADS.find(item=>item.id===head?.headId&&item.nameEn===serviceEn)?.nameBn||serviceEn;
   return {taxpayerName:name||'TIN '+stringValue(item.taxpayerTin),
    taxpayerTin:stringValue(item.taxpayerTin),paymentServiceEn:serviceEn,paymentServiceBn:serviceBn,
    assessmentYear:stringValue(item.assessmentYear),amountMinor:item.amountMinor as number,
    ...(stringValue(head?.economicCode)?{economicCode:stringValue(head?.economicCode)}:{})};
  });
 }else return undefined;
 if(!items.length)return undefined;
 let total=0;
 for(const item of items){total+=item.amountMinor;if(!Number.isSafeInteger(total))return undefined;}
 return total===tx.amountMinor?items:undefined;
}
/** Validate snapshot against immutable database transaction identity and amount. */
export function makeConfirmedReceipt(tx:StoredPayment):ChallanReceipt{
 if(!validCertificateTransactionId(tx.id)||tx.status!=='SIMULATED_SUCCESS'||
    !serviceCodes.has(tx.service as PaymentCategory)||!Number.isSafeInteger(tx.amountMinor)||tx.amountMinor<=0)
   throw new Error('Payment record cannot be certified');
 const d=tx.details??{};
 const method=stringValue(d.paymentMethod);
 const allocationItems=toAllocationItems(tx);
 // Do not allow a saved receipt snapshot to bypass beneficiary/amount reconciliation.
 if(Array.isArray(d.allocations)&&d.allocations.length>0&&!allocationItems)
  throw new Error('Payment allocations could not be reconciled');
 const batchId=validCertificateTransactionId(d.batchId)?d.batchId:undefined;
 const batchItemIndex=Number.isSafeInteger(d.batchItemIndex)&&Number(d.batchItemIndex)>0?Number(d.batchItemIndex):undefined;
 const batchItemCount=Number.isSafeInteger(d.batchItemCount)&&Number(d.batchItemCount)>0?Number(d.batchItemCount):undefined;
 const batchInfo=batchId&&batchItemIndex&&batchItemCount&&batchItemIndex<=batchItemCount
  ? {batchId,batchItemIndex,batchItemCount}: {};
 const snapshot=d.receiptSnapshot;
 if(snapshot&&typeof snapshot==='object'&&!Array.isArray(snapshot)){
  const raw=snapshot as Record<string,unknown>;
  const category=raw.paymentCategory;
  if(category===tx.service&&Math.round(numberValue(raw.totalAmount)*100)===tx.amountMinor
    &&Array.isArray(raw.items)){
    // The receipt snapshot is display data, never an alternative accounting
    // source. When durable SQL already supplies per-head facts, the snapshot
    // must retain those exact head identities and amounts before display.
    const accountingSource=Array.isArray(d.receiptLines)?d.receiptLines:d.lines;
    const accounting=Array.isArray(accountingSource)&&accountingSource.length>0&&
      accountingSource.every(line=>line&&typeof line==='object'&&!Array.isArray(line)&&
        Number.isSafeInteger((line as Record<string,unknown>).headId))
      ?accountingSource as Array<Record<string,unknown>>:null;
    // Older combined receipts may have no head items in the snapshot;
    // their independently reconciled SQL allocations remain authoritative.
    if(accounting&&raw.items.length>0&&(raw.items.length!==accounting.length||
      raw.items.some((item,index)=>{
        if(!item||typeof item!=='object'||Array.isArray(item))return true;
        const snapshotLine=item as Record<string,unknown>;
        const sourceLine=accounting[index];
        return ['headId','headNameEn','economicCode','totalAmount'].some(key=>
          sourceLine[key]!==undefined&&sourceLine[key]!==snapshotLine[key]);
      })))throw Error('Payment receipt lines could not be reconciled');
    return {
      ...(raw as unknown as ChallanReceipt),
      paymentTransactionId:tx.id,
      createdAt:tx.createdAt,completedAt:tx.createdAt,
      treasuryStatus:'GATEWAY_SUCCESS',
      isSimulatedDemo:true,
      ...(allocationItems?{allocationItems}:{}),...batchInfo,
      taxCreditStatus:tx.service==='SOURCE_TAX_DEPOSIT'?'NOT_APPLICABLE':'PENDING_RECONCILIATION',
    };
  }
 }
 const category=tx.service as PaymentCategory;
 const total=tx.amountMinor/100;
 const allocationYears=Array.from(new Set((allocationItems??[])
  .map(item=>item.assessmentYear).filter(year=>year&&year!=='—')));
 const fallback:ChallanReceipt={
  id:tx.id,paymentTransactionId:tx.id,
  challanNo:stringValue(d.receiptReference)||tx.id,tokenNumber:'—',
  paymentCategory:category,assessmentYear:allocationYears.length?allocationYears.join(', '):stringValue(d.assessmentYear)||'—',
  payerName:stringValue(d.payerName)||'—',payerTin:stringValue(d.payerTin)||'—',
  taxpayerName:stringValue(d.taxpayerName)||stringValue(d.recipientName)||undefined,
  taxpayerTin:stringValue(d.taxpayerTin),receiptMobile:stringValue(d.receiptMobile),
  noticeReference:stringValue(d.noticeReference),
  isRepresentativePayment:d.payerMode==='OTHER',
  taxZone:stringValue(d.taxZone)||'—',taxCircle:stringValue(d.taxCircle)||'—',
  isWithholding:category==='SOURCE_TAX_DEPOSIT'||d.isWithholding===true,
  items:allocationItems?[]:toItems(d.lines),...(allocationItems?{allocationItems}:{}),totalAmount:total,
  paymentMethod:methods.has(method as ChallanReceipt['paymentMethod'])?
   method as ChallanReceipt['paymentMethod']:'SIMULATED',
  gatewayTransactionId:tx.id,treasuryStatus:'GATEWAY_SUCCESS',
  taxCreditStatus:category==='SOURCE_TAX_DEPOSIT'?'NOT_APPLICABLE':'PENDING_RECONCILIATION',
  createdAt:tx.createdAt,completedAt:tx.createdAt,isSimulatedDemo:true,...batchInfo,
 };
 return fallback;
}
export async function getConfirmedReceipt(transactionId:string):Promise<ChallanReceipt>{
 if(!validCertificateTransactionId(transactionId))throw new Error('Invalid transaction reference');
 // The Office feed contains only UI-submitted, SQL-mirrored simulated payments.
 // Page through all rows rather than silently displaying a fixture for a missing record.
 for(let page=1;page<=2000;page++){
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
