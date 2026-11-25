import type {Beneficiary} from './beneficiaries';
import {beneficiaryFinalTagLabel} from './beneficiaryTags';
import {beneficiaryNameForDisplay} from './beneficiaryNames';
import type {ChallanReceipt} from '../types/tax';

export type ActivityBeneficiary={
  tin:string;name:string;tag:string|null;saved:boolean;
  amountMinor:number|null;assessmentYears:string[];heads:string[];
};
/** Read-only presentation of the payer's own receipt allocations. Do not
 * attribute a combined transaction by its payer TIN or mutate financial totals.
 * A profile link requires an exact TIN in this payer's saved beneficiary list. */
export function activityPaymentBeneficiaries(
  row:{beneficiaryTin?:string;sql?:{receipts:ChallanReceipt[]}},
  savedPeople:readonly Beneficiary[],language:'en'|'bn'
):ActivityBeneficiary[]{
  const validTin=(tin:unknown):tin is string=>typeof tin==='string'&&/^\d{12,13}$/.test(tin);
  type Parts={tin:string;name:string;amountMinor:number|null;years:Set<string>;heads:Set<string>};
  const byTin=new Map<string,Parts>();
  const add=(tin:string,name:string,amountMinor:number|null,year:string,head:string)=>{
    const previous=byTin.get(tin);
    if(previous){
      previous.amountMinor=previous.amountMinor===null||amountMinor===null?null:previous.amountMinor+amountMinor;
      if(year&&year!=='—')previous.years.add(year);
      if(head)previous.heads.add(head);
    }else byTin.set(tin,{tin,name,amountMinor,years:new Set(year&&year!=='—'?[year]:[]),
      heads:new Set(head?[head]:[])});
  };
  if(row.sql){
    // A receipt is one immutable payment item. The same item may be returned
    // twice during history recovery, but must never double a beneficiary's
    // allocation. Different items in one batch remain independently counted.
    const seen=new Map<string,string>();
    for(const receipt of row.sql.receipts){
      const id=[receipt.paymentTransactionId,receipt.id].find(value=>
        typeof value==='string'&&value.trim().length>0);
      if(id){
        const financialIdentity=JSON.stringify({
          batchId:receipt.batchId??null,batchItemIndex:receipt.batchItemIndex??null,
          taxpayerTin:receipt.taxpayerTin??null,payerName:receipt.payerName??null,
          assessmentYear:receipt.assessmentYear??null,
          allocations:receipt.allocationItems??null
        });
        const previous=seen.get(id);
        if(previous!==undefined){
          // Conflicting readbacks for one payment identity are not evidence of
          // distinct allocations. Fail closed rather than choose an amount.
          if(previous!==financialIdentity)return [];
          continue;
        }
        seen.set(id,financialIdentity);
      }
      if(receipt.allocationItems?.length){
        for(const allocation of receipt.allocationItems){
          if(!validTin(allocation.taxpayerTin))continue;
          add(allocation.taxpayerTin,allocation.taxpayerName,
            Number.isSafeInteger(allocation.amountMinor)&&allocation.amountMinor>0?allocation.amountMinor:null,
            allocation.assessmentYear,language==='bn'?allocation.paymentServiceBn:allocation.paymentServiceEn);
        }
      }else if(validTin(receipt.taxpayerTin)&&!receipt.batchId){
        // A legacy single-recipient receipt has no verified head-level split.
        // Show its identity, never manufacture separate beneficiary allocations.
        // Payer name is never proof of beneficiary identity.
        add(receipt.taxpayerTin,'',null,receipt.assessmentYear,'');
      }
    }
  }else if(validTin(row.beneficiaryTin)){
    // Explicitly linked example activity (not official or live SQL evidence).
    add(row.beneficiaryTin,'',null,'','');
  }
  return [...byTin.values()].map(entry=>{
    const matches=savedPeople.filter(person=>person.tin===entry.tin);
    const person=matches[0];
    const declaredTags=[...new Set(matches.map(saved=>beneficiaryFinalTagLabel(
      saved.tag,saved.relationship,language,saved.other_label)))];
    // The same TIN may live in multiple lists. Never choose one conflicting
    // classification arbitrarily; payment amounts still count only once.
    const tag=declaredTags.length===1?declaredTags[0]:null;
    const name=person?beneficiaryNameForDisplay(person.display_name,entry.name||entry.tin):(entry.name||entry.tin);
    return {tin:entry.tin,name,tag,saved:!!person,amountMinor:entry.amountMinor,
      assessmentYears:[...entry.years],heads:[...entry.heads]};
  });
}
