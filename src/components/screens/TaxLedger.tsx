import React,{useEffect,useMemo,useState} from 'react';
import {useTaxState} from '../../services/taxState';
import {useAccountIdentity} from '../../services/accountIdentity';
import {TaxpayerPageHeading} from '../layout/TaxpayerPageStructure';
import {
  getBoundSimulationUser,getDemoStoryPaymentHistory,getPrivateSimulationHistory,
  simulationCategoryLabels,type SimulationTransaction
} from '../../services/simulatedPaymentsApi';
import {EventBasedTaxLedger,PaymentLifecycleDetails,type TaxAccountEvent,type PaymentLifecycleRecord} from './EventBasedTaxLedger';
import {TaxPayModal} from '../ui/TaxPayModal';

function projectRecordedEvents(rows:readonly SimulationTransaction[]):TaxAccountEvent[]{
  return rows.flatMap(tx=>{
    const distinctYears=[...new Set(tx.allocations.map(a=>a.assessmentYear))];
    const component=[...new Set(tx.allocations.map(a=>simulationCategoryLabels[a.category]?.en||a.category))].join(', ');
    const year=distinctYears.length===1?distinctYears[0]:'Multiple years';
    return tx.events.map(event=>({
      id:tx.transactionId+':'+event.id,
      occurredAt:event.occurredAt,
      code:event.action,
      title:event.action.replaceAll('_',' ').toLowerCase().replace(/^./,c=>c.toUpperCase()),
      assessmentYear:year,
      component,
      amountMinor:tx.totalMinor,
      // Payment activity, even when mirrored to Office, is NOT authoritative credit.
      effectMinor:null,
      balanceAfterMinor:null,
      actor:'System',
      source:'TaxPay payment event',
      taxEventId:undefined,
      paymentId:tx.transactionId,
      reference:tx.id,
      status:tx.state,
      reason:event.note,
      linkedReferences:[tx.id,tx.transactionId]
    }));
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
        await getBoundSimulationUser();
        const [payer,beneficiary]=await Promise.all([
          getPrivateSimulationHistory('payer'),getPrivateSimulationHistory('beneficiary')
        ]);
        const keyed=new Map<string,SimulationTransaction>();
        [...payer,...beneficiary].forEach(tx=>keyed.set(tx.transactionId,tx));
        return [...keyed.values()];
      }
      if(previewAccount){
        const [payer,beneficiary]=await Promise.all([
          getDemoStoryPaymentHistory(previewAccount.id,'payer'),
          getDemoStoryPaymentHistory(previewAccount.id,'beneficiary')
        ]);
        const keyed=new Map<string,SimulationTransaction>();
        [...payer,...beneficiary].forEach(tx=>keyed.set(tx.transactionId,tx));
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
    <TaxpayerPageHeading title={t('Tax ledger','কর লেজার')} />
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
    {selected&&<TaxPayModal title={t('Payment details','পেমেন্টের বিবরণ')} onClose={()=>setSelected(null)} hideFooter className="taxpayer-transaction-detail">
      <PaymentLifecycleDetails record={selected} language={language}/>
    </TaxPayModal>}
  </div>;
};
