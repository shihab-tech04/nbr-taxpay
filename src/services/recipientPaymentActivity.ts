import type {StoredReceivedPaymentNotice} from './demoReceivedPaymentNotices';

/** Recipient totals are separate from payer spending. The notice API has already
 * verified account ownership and excludes registered self-payments. Never use
 * parent totals, match by name/TIN in the browser or infer completion from read state. */
const normalizeYear=(value:string)=>value.trim().replace(/^(20\d{2})-(\d{2})$/,(_,first:string,last:string)=>first+'-20'+last);
export function projectRecipientPaymentActivity(input:readonly StoredReceivedPaymentNotice[],assessmentYear?:string){
  const rows=input.filter(row=>!assessmentYear||assessmentYear.toLowerCase()==='all'||normalizeYear(row.assessmentYear)===normalizeYear(assessmentYear));
  const byAllocation=new Map<string,StoredReceivedPaymentNotice>();
  const inconsistent=new Set<string>();
  for(const row of rows){
    const key=JSON.stringify([row.paymentId,row.allocationId??row.eventId]);
    const old=byAllocation.get(key);
    if(old&&(old.amountMinor!==row.amountMinor||old.assessmentYear!==row.assessmentYear||old.paymentStatus!==row.paymentStatus||old.eventId!==row.eventId)){
      inconsistent.add(key);
      continue;
    }
    byAllocation.set(key,row);
  }
  const completed=[...byAllocation.entries()].filter(([key,row])=>!inconsistent.has(key)&&row.paymentStatus==='SIMULATED_SUCCESS').map(([,row])=>row);
  return {rows,completedMinor:completed.reduce((sum,row)=>sum+BigInt(row.amountMinor),0n),
    completedPaymentCount:new Set(completed.map(row=>row.paymentId)).size,
    inconsistentAllocationCount:inconsistent.size};
}
export function formatRecipientCompletedMinor(amountMinor:bigint,language:'en'|'bn'){
 const locale=language==='bn'?'bn-BD':'en-BD';
 const whole=new Intl.NumberFormat(locale).format(amountMinor/100n);
 const remainder=amountMinor%100n;
 const fraction=remainder?'.'+new Intl.NumberFormat(locale,{minimumIntegerDigits:2,useGrouping:false}).format(remainder):'';
 return '৳'+whole+fraction;
}
