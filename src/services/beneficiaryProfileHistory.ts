import type {ChallanReceipt} from '../types/tax';
import type {SimulationTransaction,SimulationUser} from '../contracts/paymentSimulationContract';
import {simulationCategoryLabels} from '../contracts/paymentSimulationContract';
import {sampleTinForUserNumber} from '../data/sampleTinSuggestions';
import {activePreviewSession} from './previewAccountSession';
import {getAccountStoryPayments,getDetailedStorySessionPayments,beneficiaryPaymentEntries,type OwnedStoryPayment} from './story1AccountPaymentHistory';
import {getBoundSimulationUser,getPrivateSimulationHistory,getDemoStoryPaymentHistory} from './simulatedPaymentsApi';

export type BeneficiaryProfilePayment = {
  key:string; paymentId:string; transactionId:string; createdAt:string;
  taxpayerTin:string; assessmentYear:string; paymentHead:string; amountMinor:number;
  status:'SIMULATED_SUCCESS'|'SIMULATED'|'PENDING'|'FAILED'|'REVERSED';
  source:'recorded'|'simulation'; receipt?:ChallanReceipt;
  batchId?:string; batchItemIndex?:number; batchItemCount?:number;
};
export const countsTowardBeneficiaryPaidTotal=(row:BeneficiaryProfilePayment):boolean=>
  row.status==='SIMULATED_SUCCESS'||row.status==='SIMULATED';

/** Read-model only; exact TIN and payer scope. Never join by a mutable name or tag. */
export function beneficiaryProfilePayments(
  tin:string, story:readonly OwnedStoryPayment[], simulations:readonly SimulationTransaction[],
  payerId:SimulationUser|null, language:'en'|'bn'
):BeneficiaryProfilePayment[] {
  if(!/^\d{12,13}$/.test(tin))throw Error('Invalid beneficiary TIN');
  const storyDates=new Map(story.map(record=>[record.id,record.createdAt]));
  const stored=beneficiaryPaymentEntries([...story]).filter(entry=>entry.taxpayerTin===tin)
    .map(entry=>({
      key:'recorded:'+entry.key,paymentId:entry.paymentId,
      transactionId:entry.batchId??entry.paymentId,
      createdAt:storyDates.get(entry.paymentId)??'',
      taxpayerTin:entry.taxpayerTin,assessmentYear:entry.assessmentYear,
      paymentHead:entry.paymentHead,amountMinor:entry.amountMinor,
      status:'SIMULATED_SUCCESS' as const,source:'recorded' as const,
      receipt:entry.receipt,batchId:entry.batchId,
      batchItemIndex:entry.batchItemIndex,batchItemCount:entry.batchItemCount
    }));
  const knownStoryIds=new Set(story.map(record=>record.id));
  const ledger:BeneficiaryProfilePayment[]=[];
  for(const tx of simulations){
    if(!payerId || tx.payer!==payerId || tx.simulationOnly!==true ||
      !Number.isSafeInteger(tx.totalMinor)||tx.totalMinor<=0 ||
      !Number.isFinite(Date.parse(tx.createdAt)) ||
      !['SIMULATED','PENDING','FAILED','REVERSED'].includes(tx.state))
      throw Error('Invalid payer-scoped payment activity');
    if(knownStoryIds.has(tx.transactionId))continue;
    for(const [index,entry] of tx.allocations.entries()){
      if(!Number.isSafeInteger(entry.amountMinor)||entry.amountMinor<=0)
        throw Error('Invalid beneficiary allocation amount');
      const match=/^user(\d+)$/.exec(entry.beneficiary);
      const matchedTin=match?sampleTinForUserNumber(Number(match[1])):null;
      if(matchedTin!==tin)continue;
      ledger.push({
        key:'simulation:'+tx.transactionId+':'+(entry.id??index),
        paymentId:tx.transactionId,transactionId:tx.transactionId,
        createdAt:tx.createdAt,taxpayerTin:tin,
        assessmentYear:entry.assessmentYear,
        paymentHead:simulationCategoryLabels[entry.category]?.[language]??entry.category,
        amountMinor:entry.amountMinor,status:tx.state,source:'simulation'
      });
    }
  }
  return [...stored,...ledger].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)||
    a.key.localeCompare(b.key));
}

/** An authenticated taxpayer can own saved payments without a fictional simulator binding.
 * Only the explicit 'unbound' business condition makes simulator rows optional.
 * Never swallow authentication, RLS, transport or malformed-profile failures. */
export const missingOptionalSimulationBinding=(error:unknown):boolean=>
  error instanceof Error && error.message==='No approved synthetic profile binding';

async function optionalSimulationProfile():Promise<SimulationUser|null>{
  try{return await getBoundSimulationUser();}
  catch(error){
    if(missingOptionalSimulationBinding(error))return null;
    throw error;
  }
}

/** No new tables, grants, profile identity or financial writes.
 * Server-side owner RLS and the preview capability remain authoritative. */
export async function loadBeneficiaryProfilePayments(
  tin:string, ownerUid:string|null, previewId:SimulationUser|null, language:'en'|'bn'
):Promise<BeneficiaryProfilePayment[]> {
  if(ownerUid){
    const [story,boundId]=await Promise.all([getAccountStoryPayments(ownerUid),optionalSimulationProfile()]);
    const simulations=boundId?await getPrivateSimulationHistory('payer'):[];
    return beneficiaryProfilePayments(tin,story,simulations,boundId,language);
  }
  const before=activePreviewSession();
  if(!previewId||!before||before.profileId!==previewId)
    throw Error('Sign in to view this beneficiary profile.');
  const [story,simulations]=await Promise.all([
    getDetailedStorySessionPayments(),getDemoStoryPaymentHistory(previewId,'payer')
  ]);
  const after=activePreviewSession();
  if(!after||after.profileId!==previewId||after.capability!==before.capability)
    throw Error('Account changed while loading beneficiary history');
  return beneficiaryProfilePayments(tin,story,simulations,previewId,language);
}
