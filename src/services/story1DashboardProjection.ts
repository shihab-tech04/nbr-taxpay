import {makeConfirmedReceipt} from './confirmedPaymentCertificate';
import type {OwnedStoryPayment} from './story1AccountPaymentHistory';

export type StoredDashboardAllocation = {
  key: string;
  transactionId: string;
  batchId: string;
  date: string;
  year: string;
  category: string;
  amountMinor: number;
  taxpayerTin: string | null;
};
export type StoredDashboardProjection = {
  allocations: StoredDashboardAllocation[];
  incompleteCount: number;
};

const validYear=(year:unknown):year is string=>{
  if(typeof year!=='string')return false;
  const match=/^(20\d{2})-(20\d{2}|\d{2})$/.exec(year);
  if(!match)return false;
  const end=match[2].length===2?Number(match[1].slice(0,2)+match[2]):Number(match[2]);
  return Number(match[1])+1===end;
};
export const normalizedAssessmentYear=(year:string):string=>
  /^20\d{2}-\d{2}$/.test(year) ? year.slice(0,5)+'20'+year.slice(-2):year;
const validTin=(tin:unknown):tin is string=>typeof tin==='string'&&/^\d{12,13}$/.test(tin);

/**
 * Reconciled owner-session SQL items only, projected into one AY per allocation.
 * A combined payment may have several heads/recipients/years but is counted
 * once per batch. Missing original AY/amount attribution is not guessed.
 * No fabricated government credit, liability or beneficiary tag is produced.
 */
export function projectStoredDashboardAllocations(
  payments:readonly OwnedStoryPayment[],
):StoredDashboardProjection {
  const allocations:StoredDashboardAllocation[]=[];
  const seen=new Set<string>();
  let incompleteCount=0;
  for(const payment of payments) {
    if(seen.has(payment.id)) {incompleteCount++;continue;}
    seen.add(payment.id);
    try {
      const receipt=makeConfirmedReceipt(payment);
      const batchId=receipt.batchId??payment.id;
      const date=payment.createdAt.slice(0,10);
      if(!/^20\d{2}-(0[1-9]|1[0-2])-\d{2}$/.test(date))throw Error('Invalid date');
      const parts=receipt.allocationItems?.length
        ? receipt.allocationItems.map((item,index)=>({
            key:payment.id+':'+index,year:item.assessmentYear,
            amountMinor:item.amountMinor,taxpayerTin:item.taxpayerTin??null,
          }))
        : [{key:payment.id,year:receipt.assessmentYear,
            amountMinor:payment.amountMinor,taxpayerTin:receipt.taxpayerTin??null}];
      if(!parts.length || parts.some(item=>!validYear(item.year) ||
          !Number.isSafeInteger(item.amountMinor)||item.amountMinor<=0) ||
          parts.reduce((total,item)=>total+item.amountMinor,0)!==payment.amountMinor) {
        incompleteCount++;continue;
      }
      for(const item of parts)allocations.push({
        key:item.key,transactionId:payment.id,batchId,date,
        year:normalizedAssessmentYear(item.year),
        category:payment.service,amountMinor:item.amountMinor,
        taxpayerTin:validTin(item.taxpayerTin)?item.taxpayerTin:null,
      });
    }catch{incompleteCount++;}
  }
  return {allocations,incompleteCount};
}
export function summarizeStoredDashboardYear(
  projection:StoredDashboardProjection,year:string,
) {
  const selected=projection.allocations.filter(item=>item.year===year);
  return {
    allocations:selected,
    completedBatches:new Set(selected.map(item=>item.batchId)).size,
    amountMinor:selected.reduce((sum,item)=>sum+BigInt(item.amountMinor),0n),
    // Existing chart covers direct, advance and travel payments. Withholding
    // records are excluded because deposits are not payer-initiated income tax.
    monthlyPayments:selected.filter(item=>item.category!=='SOURCE_TAX_DEPOSIT')
      .map(item=>({date:item.date,amount:item.amountMinor/100})),
  };
}
