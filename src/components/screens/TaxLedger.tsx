import React,{useEffect,useMemo,useState} from 'react';
import {useTaxState} from '../../services/taxState';
import {useAccountIdentity} from '../../services/accountIdentity';
import {TaxpayerPageHeading} from '../layout/TaxpayerPageStructure';
import {DemoServiceRecordsPanel} from './DemoServiceRecordsPanel';
import {
  getBoundSimulationUser,getDemoStoryPaymentHistory,getPrivateSimulationHistory,
  simulationCategoryLabels,type SimulationTransaction
} from '../../services/simulatedPaymentsApi';
import {EventBasedTaxLedger,PaymentLifecycleDetails,type TaxAccountEvent,type PaymentLifecycleRecord} from './EventBasedTaxLedger';
import {TaxPayModal} from '../ui/TaxPayModal';

function projectRecordedEvents(rows:readonly SimulationTransaction[]):TaxAccountEvent[]{
  return rows.flatMap(tx=>{
    // Each allocation owns its assessment year and amount. A mixed-year payment
    // must never be hidden under "Multiple years" or counted against the wrong AY.
    const lines=tx.allocations.length?tx.allocations:[{
      id:'unallocated',assessmentYear:'Unavailable',amountMinor:tx.totalMinor,category:'UNALLOCATED'
    }];
    return tx.events.flatMap(event=>lines.map((line,index)=>({
      id:tx.transactionId+':'+event.id+':'+line.id+':'+index,
      occurredAt:event.occurredAt,
      code:event.action,
      title:event.action.replaceAll('_',' ').toLowerCase().replace(/^./,c=>c.toUpperCase()),
      assessmentYear:line.assessmentYear,
      component:simulationCategoryLabels[line.category as keyof typeof simulationCategoryLabels]?.en||line.category,
      amountMinor:line.amountMinor,
      // Recording a payment event never establishes a tax liability or credit.
      effectMinor:null,
      balanceAfterMinor:null,
      actor:'Not recorded',
      source:'TaxPay payment event',
      taxEventId:undefined,
      paymentId:tx.transactionId,
      reference:tx.id,
      status:tx.state,
      reason:event.note,
      linkedReferences:[tx.id,tx.transactionId,line.id]
    })));
  });
}
function paymentRecord(tx:SimulationTransaction):PaymentLifecycleRecord{
  return {
    reference:tx.id,transactionId:tx.transactionId,payerName:tx.payer,
    assessmentYear:[...new Set(tx.allocations.map(a=>a.assessmentYear))].join(', '),
    paymentType:[...new Set(tx.allocations.map(a=>simulationCategoryLabels[a.category]?.en||a.category))].join(', '),
    amountMinor:tx.totalMinor,createdAt:tx.createdAt,status:tx.state,
    financialReceiptStatus:'Not verified',taxCreditStatus:'Not verified',
    source:'TaxPay payment event',
    events:tx.events.map(e=>({id:String(e.id),title:e.action.replaceAll('_',' '),
      occurredAt:e.occurredAt,source:'TaxPay SQL',note:e.note})),
    allocations:tx.allocations.map(a=>({id:a.id,title:a.beneficiary+' · '+(simulationCategoryLabels[a.category]?.en||a.category),
      assessmentYear:a.assessmentYear,amountMinor:a.amountMinor}))
  };
}
export const TaxLedger:React.FC=()=>{
  const {language,previewAccount}=useTaxState();
  const {user:authenticatedUser,loading:identityPending}=useAccountIdentity();
  const [snapshot,setSnapshot]=useState<{key:string;rows:SimulationTransaction[];state:'loading'|'ready'|'error';error:string}>({
    key:'',rows:[],state:'loading',error:''
  });
  const [revision,setRevision]=useState(0);
  const [selected,setSelected]=useState<PaymentLifecycleRecord|null>(null);
  const bn=language==='bn',t=(en:string,other:string)=>bn?other:en;
  const ownerKey=authenticatedUser?'auth:'+authenticatedUser.id:previewAccount?'preview:'+previewAccount.id:'unbound';
  useEffect(()=>{
    let live=true;
    setSnapshot({key:ownerKey,rows:[],state:'loading',error:''});
    setSelected(null);
    async function load(){
      if(authenticatedUser){
        // Do not read public user IDs as a substitute for a signed-in, owner-scoped query.
        try { await getBoundSimulationUser(); }
        catch(error) {
          if(error instanceof Error && error.message.includes('No approved synthetic profile binding'))return [];
          throw error;
        }
        const [payer,beneficiary]=await Promise.all([
          getPrivateSimulationHistory('payer'),getPrivateSimulationHistory('beneficiary')
        ]);
        const keyed=new Map<string,SimulationTransaction>();
        [...beneficiary,...payer].forEach(tx=>keyed.set(tx.transactionId,tx));
        return [...keyed.values()];
      }
      if(previewAccount){
        const [payer,beneficiary]=await Promise.all([
          getDemoStoryPaymentHistory(previewAccount.id,'payer'),
          getDemoStoryPaymentHistory(previewAccount.id,'beneficiary')
        ]);
        const keyed=new Map<string,SimulationTransaction>();
        [...beneficiary,...payer].forEach(tx=>keyed.set(tx.transactionId,tx));
        return [...keyed.values()];
      }
      return [];
    }
    void load().then(rows=>{if(live)setSnapshot({key:ownerKey,rows,state:'ready',error:''});})
      .catch(error=>{if(live)setSnapshot({key:ownerKey,rows:[],state:'error',
        error:error instanceof Error?error.message:'History unavailable'});});
    return()=>{live=false;};
  },[ownerKey,revision]);
  const state=snapshot.key===ownerKey?snapshot:{key:ownerKey,rows:[],state:'loading' as const,error:''};
  const events=useMemo(()=>projectRecordedEvents(state.rows),[state.rows]);
  const openPayment=(id:string)=>{
    const tx=state.rows.find(r=>r.transactionId===id);
    if(tx)setSelected(paymentRecord(tx));
  };
  return <div className="mx-auto max-w-7xl space-y-4 pb-12" lang={language}>
    <TaxpayerPageHeading title={t('Tax ledger','কর লেজার')} description={t('Ledger information','লেজারের তথ্য')} />
    <div className="flex justify-end"><button type="button" disabled className="min-h-11 rounded-lg border border-taxpay-border px-4 text-sm font-semibold text-taxpay-muted opacity-50">{t('Export ledger data','লেজারের তথ্য রপ্তানি')}</button></div>
    <p role="status" className="text-sm text-taxpay-muted">{t('No ledger records are available for this account yet.','এই অ্যাকাউন্টে এখনো কোনো লেজার রেকর্ড নেই।')}</p>
    {identityPending||state.state==='loading'?<p role="status" className="rounded-xl border border-taxpay-border bg-white p-5 text-sm text-taxpay-muted">
      {t('Loading recorded events…','নথিভুক্ত ঘটনা লোড হচ্ছে…')}</p>:
    state.state==='error'?<section role="alert" className="space-y-3 rounded-xl border border-taxpay-border bg-white p-5">
      <p className="text-sm text-taxpay-muted">{t('Unable to verify this account’s event history.','অ্যাকাউন্টের ঘটনার ইতিহাস যাচাই করা যাচ্ছে না।')}</p>
      <button className="min-h-11 rounded-lg border border-taxpay-border px-4 text-sm font-semibold text-taxpay-dark" type="button" onClick={()=>setRevision(i=>i+1)}>
        {t('Retry','আবার চেষ্টা করুন')}</button>
    </section>:
    <>
      <EventBasedTaxLedger events={events} language={language} onOpenPayment={openPayment}/>
      <p className="text-xs text-taxpay-muted">{t('TaxPay and Office activity may be recorded here. An official liability, settlement or credit balance requires verified source events.',
        'এখানে ট্যাক্সপে ও অফিসের কার্যক্রম দেখা যেতে পারে। সরকারি দায়, নিষ্পত্তি বা ক্রেডিট ব্যালেন্সের জন্য যাচাইকৃত ঘটনা প্রয়োজন।')}</p>
    </>}
    {previewAccount&&<DemoServiceRecordsPanel userId={previewAccount.id} language={language}/>}
    {selected&&<TaxPayModal title={t('Payment details','পেমেন্টের বিবরণ')} onClose={()=>setSelected(null)} hideFooter className="taxpayer-transaction-detail">
      <PaymentLifecycleDetails record={selected} language={language}/>
    </TaxPayModal>}
  </div>;
};
