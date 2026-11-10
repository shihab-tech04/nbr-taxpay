import React,{useEffect,useMemo,useState} from 'react';
import {getDetailedStorySessionPayments,type OwnedStoryPayment} from '../../services/story1AccountPaymentHistory';
import {getDemoStoryPaymentHistory} from '../../services/simulatedPaymentsApi';
import {makeConfirmedReceipt} from '../../services/confirmedPaymentCertificate';
import {reuseRecordedPayment,type PaymentReuse} from '../../services/paymentReuse';
import {useTaxState} from '../../services/taxState';
import {activePreviewSession} from '../../services/previewAccountSession';
import {getDemoUser} from '../../data/demoUsers';
import {TaxPayDataGrid,TaxPayTableState} from '../ui/TaxPayDataTable';
import {TaxPayModal} from '../ui/TaxPayModal';
import {ReceiptView} from '../common/ReceiptView';
import type {DemoUserId} from '../../data/demoUsers';

/** Preserve the approved Transactions register; show only old session records
 * not already in its payer table. Never rewrite their payer/beneficiary fields. */
export function RecoveredStoryHistory({profileId,language,skipDemoRegister=false}:{profileId:DemoUserId;language:'en'|'bn';skipDemoRegister?:boolean}) {
  const [state,setState]=useState<{id:string;status:'loading'|'ready'|'error';rows:OwnedStoryPayment[]}>({
    id:profileId,status:'loading',rows:[]});
  const [selected,setSelected]=useState<OwnedStoryPayment|null>(null);
  const [reuseError,setReuseError]=useState('');
  const {startPaymentReuse}=useTaxState();
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    const refresh=()=>setRevision(value=>value+1);
    window.addEventListener('taxpay:story-payments-recovered',refresh);
    return()=>window.removeEventListener('taxpay:story-payments-recovered',refresh);
  },[]);
  const bn=language==='bn';
  const tr=(en:string,bengali:string)=>bn?bengali:en;
  useEffect(()=>{
    let active=true;
    setState({id:profileId,status:'loading',rows:[]});setSelected(null);
    void Promise.all([
      getDetailedStorySessionPayments(),
      // user1's approved Transactions are immutable non-SQL fixtures, so no
      // SQL register identity can duplicate a recovered UUID payment.
      skipDemoRegister ? Promise.resolve([] as Awaited<ReturnType<typeof getDemoStoryPaymentHistory>>) : getDemoStoryPaymentHistory(profileId,'payer')
    ]).then(([all,existing])=>{
      if(!active)return;
      const visible=new Set(existing.map(record=>record.transactionId));
      setState({id:profileId,status:'ready',
        rows:all.filter(payment=>!visible.has(payment.id))});
    }).catch(()=>{if(active)setState({id:profileId,status:'error',rows:[]});});
    return()=>{active=false;};
  },[profileId,revision,skipDemoRegister]);
  const current=state.id===profileId?state:{id:profileId,status:'loading' as const,rows:[]};
  const rows=useMemo(()=>current.rows,[current.rows]);
  // Only complete, SQL-confirmed receipts (or complete batches) may be reused.
  const reusable=useMemo(()=>{
    const results=new Map<string,PaymentReuse>();
    const receipts=rows.flatMap(payment=>{
      try{return [{id:payment.id,receipt:makeConfirmedReceipt(payment)}];}
      catch{return [];}
    });
    for(const item of receipts){
      const original=item.receipt;
      const batch=original.batchId
        ?receipts.filter(entry=>entry.receipt.batchId===original.batchId).map(entry=>entry.receipt)
        :[original];
      try{
        results.set(item.id,reuseRecordedPayment(batch,profileId,getDemoUser(profileId)?.tin??null,
          original.batchId??item.id));
      }catch{/* Incomplete allocations are not guessed. */}
    }
    return results;
  },[rows,profileId]);
  const payAgain=(payment:OwnedStoryPayment)=>{
    setReuseError('');
    if(activePreviewSession()?.profileId!==profileId){
      setReuseError(tr('Sign in to the matching account before repeating a payment.',
        'আগের পেমেন্ট আবার করতে সংশ্লিষ্ট অ্যাকাউন্টে সাইন ইন করুন।'));
      return;
    }
    const copy=reusable.get(payment.id);
    if(!copy){
      setReuseError(tr('The original record does not contain a complete repeatable payment.',
        'আগের রেকর্ডে পুনরায় পরিশোধের জন্য সম্পূর্ণ তথ্য নেই।'));
      return;
    }
    startPaymentReuse(copy);
    setSelected(null);
  };
  const money=(value:number)=>'৳ '+(value/100).toLocaleString(bn?'bn-BD':'en-BD',
    {minimumFractionDigits:2,maximumFractionDigits:2});
  // No extra UI at all for a verified empty account. Existing table is unchanged.
  if(current.status==='ready'&&rows.length===0)return null;
  if(current.status==='loading')return null;
  return <section className="mx-auto mt-4 max-w-7xl rounded-xl border border-taxpay-border bg-white p-4"
    aria-label={tr('Earlier saved payment records','আগের সংরক্ষিত পেমেন্টের রেকর্ড')}>
    {reuseError&&<p role="alert" className="mb-3 text-sm text-taxpay-error">{reuseError}</p>}
    <h2 className="mb-3 text-base font-semibold text-taxpay-text">
      {tr('Earlier saved payment records','আগের সংরক্ষিত পেমেন্টের রেকর্ড')}
    </h2>
    {current.status==='error'?<div role="alert" className="space-y-2">
      <p className="text-sm text-taxpay-error">{tr('Earlier payment records could not be verified.','আগের পেমেন্টের তথ্য যাচাই করা যায়নি।')}</p>
      <button type="button" className="min-h-11 rounded-lg border border-taxpay-border px-3"
        onClick={()=>setRevision(v=>v+1)}>{tr('Retry','আবার চেষ্টা করুন')}</button>
    </div>:rows.length>0?<TaxPayDataGrid variant="tabular" rows={rows} getRowKey={p=>p.id}
      ariaLabel={tr('Earlier payments','আগের পেমেন্ট')} testId="recovered-story-payments"
      mobileTestId="recovered-story-payment-cards" onViewRow={setSelected} columns={[
        {key:'reference',header:tr('Reference','রেফারেন্স'),renderCell:p=><span className="break-all text-sm">{p.id}</span>},
        {key:'service',header:tr('Payment type','পেমেন্টের ধরন'),renderCell:p=><span>{p.service.replaceAll('_',' ')}</span>},
        {key:'date',header:tr('Date','তারিখ'),renderCell:p=><span>{new Intl.DateTimeFormat(bn?'bn-BD':'en-GB',{dateStyle:'medium',timeZone:'Asia/Dhaka'}).format(new Date(p.createdAt))}</span>},
        {key:'amount',header:tr('Amount','পরিমাণ'),headerClassName:'text-right',cellClassName:'text-right',renderCell:p=><span>{money(p.amountMinor)}</span>}
      ]}/>:<TaxPayTableState>{tr('No earlier saved records.','আগের কোনো রেকর্ড নেই।')}</TaxPayTableState>}
    {selected&&<TaxPayModal title={tr('Payment receipt','পেমেন্ট রসিদ')}
      service="status" className="receipt-modal" onClose={()=>setSelected(null)} footer={<></>}>
      <ReceiptView receipt={makeConfirmedReceipt(selected)} embedded/>
    </TaxPayModal>}
  </section>;
}
