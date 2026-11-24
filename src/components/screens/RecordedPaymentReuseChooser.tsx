import React,{useEffect,useMemo,useState} from 'react';
import {getDetailedStorySessionPayments,type OwnedStoryPayment} from '../../services/story1AccountPaymentHistory';
import {makeConfirmedReceipt} from '../../services/confirmedPaymentCertificate';
import {oneChoicePerRecordedParent,reuseRecordedPayment,type PaymentReuse} from '../../services/paymentReuse';
import {useTaxState} from '../../services/taxState';
import {activePreviewSession} from '../../services/previewAccountSession';
import {getDemoUser,type DemoUserId} from '../../data/demoUsers';

/** A deliberate, inline choice inside the existing Pay Again modal.
 * Never adds a second History panel beneath the approved Transactions register.
 * Only a verified SQL session payment, never a fictional storybook row, is reusable.
 */
export function RecordedPaymentReuseChooser({profileId,language,onReuse}:{
 profileId:DemoUserId;language:'en'|'bn';onReuse:()=>void
}){
 const {startPaymentReuse}=useTaxState();
 const [revision,setRevision]=useState(0);
 const [state,setState]=useState<{status:'loading'|'ready'|'error';rows:OwnedStoryPayment[]}>({
   status:'loading',rows:[]
 });
 const [reuseError,setReuseError]=useState('');
 const tr=(en:string,bn:string)=>language==='bn'?bn:en;
 useEffect(()=>{
   let active=true;
   setState({status:'loading',rows:[]});setReuseError('');
   void getDetailedStorySessionPayments().then(rows=>{
     if(active)setState({status:'ready',rows});
   }).catch(()=>{
     if(active)setState({status:'error',rows:[]});
   });
   return()=>{active=false;};
 },[profileId,revision]);
 const records=useMemo(()=>oneChoicePerRecordedParent(state.rows,payment=>{
   try { return makeConfirmedReceipt(payment).batchId; }
   catch { return undefined; }
 }).map(payment=>{
   let copy:PaymentReuse|null=null;
   let displayId=payment.id;
   let displayAmountMinor:number|null=payment.amountMinor;
   try{
     const chosen=makeConfirmedReceipt(payment);
     displayId=chosen.batchId??payment.id;
     if(chosen.batchId) displayAmountMinor=null;
     const peers=state.rows.flatMap(other=>{
       try {
         const receipt=makeConfirmedReceipt(other);
         return chosen.batchId
           ? (receipt.batchId===chosen.batchId?[receipt]:[])
           : (other.id===payment.id?[receipt]:[]);
       } catch {
         // A malformed unrelated row must not block a valid recorded payment.
         // Missing members of the chosen batch still fail completeness checks.
         return [];
       }
     });
     copy=reuseRecordedPayment(peers,profileId,getDemoUser(profileId)?.tin??null,displayId);
     if(chosen.batchId){
       // Show the complete original batch amount only after every immutable
       // receipt row has passed the existing reconstruction validator.
       const total=peers.reduce((sum,receipt)=>sum+Math.round(receipt.totalAmount*100),0);
       if(!Number.isSafeInteger(total)||total<=0)throw Error('Incomplete original batch total');
       displayAmountMinor=total;
     }
   }catch{copy=null;/* Incomplete historic receipts cannot establish a new payment. */}
   return {payment,copy,displayId,displayAmountMinor};
 }),[state.rows,profileId]);
 const reuse=(copy:PaymentReuse)=>{
   setReuseError('');
   if(activePreviewSession()?.profileId!==profileId){
     setReuseError(tr('Sign in to the original payer account before repeating a payment.',
       'আবার পরিশোধের আগে মূল পরিশোধকারীর অ্যাকাউন্টে সাইন ইন করুন।'));
     return;
   }
   onReuse();
   startPaymentReuse(copy);
 };
 return <section aria-label={tr('Recorded payment choices','সংরক্ষিত পেমেন্ট নির্বাচন')}>
   <p className="mb-3 text-sm text-taxpay-muted">{tr(
     'Choose a complete, verified recorded payment. Illustrative transaction examples cannot be copied as paid records.',
     'সম্পূর্ণ যাচাইকৃত সংরক্ষিত পেমেন্ট নির্বাচন করুন। নমুনা লেনদেনকে পরিশোধিত রেকর্ড ধরে কপি করা যাবে না।')}</p>
   {reuseError&&<p role="alert" className="mb-3 text-sm text-taxpay-error">{reuseError}</p>}
   {state.status==='loading'&&<p role="status" className="py-3 text-sm text-taxpay-muted">
     {tr('Loading recorded payments…','সংরক্ষিত পেমেন্ট লোড হচ্ছে…')}</p>}
   {state.status==='error'&&<div role="alert" className="space-y-2">
     <p>{tr('Recorded payments could not be verified.','সংরক্ষিত পেমেন্ট যাচাই করা যাচ্ছে না।')}</p>
     <button type="button" className="min-h-11 rounded-lg border border-taxpay-border px-3"
       onClick={()=>setRevision(n=>n+1)}>{tr('Retry','আবার চেষ্টা করুন')}</button>
   </div>}
   {state.status==='ready'&&records.length===0&&<p role="status" className="py-3 text-sm text-taxpay-muted">
     {tr('No recorded payments are available for this account.',
       'এই অ্যাকাউন্টের জন্য কোনো সংরক্ষিত পেমেন্ট পাওয়া যায়নি।')}</p>}
   {state.status==='ready'&&records.length>0&&<ul className="divide-y divide-taxpay-border">
     {records.map(({payment,copy,displayId,displayAmountMinor})=><li key={payment.id}
       className="flex flex-wrap items-center justify-between gap-3 py-3">
       <div className="min-w-0">
         <p className="break-all text-sm font-medium">{displayId}</p>
         <p className="text-xs text-taxpay-muted">{payment.service.replaceAll('_',' ')} · {new Intl.DateTimeFormat(
           language==='bn'?'bn-BD':'en-BD',{dateStyle:'medium'}).format(new Date(payment.createdAt))}</p>
         <p className="font-semibold tabular-nums">{displayAmountMinor===null
           ? tr('Original batch amount unavailable','মূল ব্যাচের পরিমাণ পাওয়া যায়নি')
           : '৳ '+(displayAmountMinor/100).toLocaleString(
               language==='bn'?'bn-BD':'en-BD',{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
       </div>
       <button type="button" data-testid="recovered-pay-again"
         disabled={!copy} title={!copy?tr('Complete original payment details unavailable',
           'মূল পেমেন্টের সম্পূর্ণ বিবরণ পাওয়া যায়নি'):undefined}
         onClick={()=>copy&&reuse(copy)}
         className="min-h-11 rounded-lg border border-taxpay-border px-3 text-sm font-medium text-taxpay-primary disabled:cursor-not-allowed disabled:opacity-50">
         {tr('Pay Again','আবার পরিশোধ')}
       </button>
     </li>)}
   </ul>}
 </section>;
}
