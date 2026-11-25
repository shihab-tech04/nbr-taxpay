import React,{useEffect,useMemo,useState} from 'react';
import {useTaxState} from '../../services/taxState';
import {useAccountIdentity} from '../../services/accountIdentity';
import {TaxpayerPageHeading} from '../layout/TaxpayerPageStructure';
import {DemoServiceRecordsPanel} from './DemoServiceRecordsPanel';
import {
  getBoundSimulationUser,getDemoStoryPaymentHistory,getPrivateSimulationHistory,
  simulationCategoryLabels,type SimulationTransaction
} from '../../services/simulatedPaymentsApi';
import {PaymentLifecycleDetails,type TaxAccountEvent,type PaymentLifecycleRecord} from './EventBasedTaxLedger';
import {MuiEventBasedTaxLedger} from './MuiEventBasedTaxLedger';
import {TaxPayModal} from '../ui/TaxPayModal';
import {escapeLedgerCsvCell,loadExternalLedgerEvents} from '../../services/externalLedgerRecords';

function projectRecordedEvents(rows:readonly SimulationTransaction[],language:'en'|'bn'):TaxAccountEvent[]{
  return rows.flatMap(tx=>{
    // Each allocation owns its assessment year and amount. A mixed-year payment
    // must never be hidden under "Multiple years" or counted against the wrong AY.
    const lines=tx.allocations.length?tx.allocations:[{
      id:'unallocated',assessmentYear:'Unavailable',amountMinor:tx.totalMinor,category:'UNALLOCATED'
    }];
    const recorded=tx.events.length?tx.events:[{
      id:'payment-record',occurredAt:tx.createdAt,
      action:'PAYMENT_RECORD_PRESENT',note:'Payment record present in SQL'
    }];
    return recorded.flatMap(event=>lines.map((line,index)=>({
      id:tx.transactionId+':'+event.id+':'+line.id+':'+index,
      occurredAt:event.occurredAt,
      code:event.action,
      title:event.action.replaceAll('_',' ').toLowerCase().replace(/^./,c=>c.toUpperCase()),
      assessmentYear:line.assessmentYear,
      component:simulationCategoryLabels[line.category as keyof typeof simulationCategoryLabels]?.[language]||line.category,
      amountMinor:line.amountMinor,
      // Recording a payment event never establishes a tax liability or credit.
      effectMinor:null,
      balanceAfterMinor:null,
      actor:'Not recorded',
      source:'Sohojkor payment event',
      taxEventId:undefined,
      paymentId:tx.transactionId,
      reference:tx.id,
      status:tx.state,
      reason:event.note,
      linkedReferences:[tx.id,tx.transactionId,line.id]
    })));
  });
}
function paymentRecord(tx:SimulationTransaction,language:'en'|'bn'):PaymentLifecycleRecord{
  return {
    reference:tx.id,transactionId:tx.transactionId,payerName:tx.payer,
    assessmentYear:[...new Set(tx.allocations.map(a=>a.assessmentYear))].join(', '),
    paymentType:[...new Set(tx.allocations.map(a=>simulationCategoryLabels[a.category]?.[language]||a.category))].join(', '),
    amountMinor:tx.totalMinor,createdAt:tx.createdAt,status:tx.state,
    financialReceiptStatus:'Not verified',taxCreditStatus:'Not verified',
    source:'TaxPay payment event',
    events:tx.events.map(e=>({id:String(e.id),title:e.action.replaceAll('_',' '),
      occurredAt:e.occurredAt,source:'Sohojkor SQL',note:e.note})),
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
  const [externalSnapshot,setExternalSnapshot]=useState<{key:string;events:TaxAccountEvent[];state:'loading'|'ready'|'unavailable'|'error'}>({key:'',events:[],state:'loading'});
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
  useEffect(()=>{
    let active=true;
    const key=ownerKey+':'+language;
    setExternalSnapshot({key,events:[],state:'loading'});
    if(!authenticatedUser){
      setExternalSnapshot({key,events:[],state:'unavailable'});
      return()=>{active=false;};
    }
    void loadExternalLedgerEvents(authenticatedUser.id,language).then(events=>{
      if(active)setExternalSnapshot({key,events,state:'ready'});
    }).catch(error=>{
      if(!active)return;
      // Existing deployments without the Phase 5 migration must keep the
      // Sohojkor ledger available, without implying the external feed is live.
      const code=(error as {code?:string})?.code;
      const state=code==='PGRST205'||code==='42P01'?'unavailable':'error';
      setExternalSnapshot({key,events:[],state});
    });
    return()=>{active=false;};
  },[ownerKey,language,revision]);
  const state=snapshot.key===ownerKey?snapshot:{key:ownerKey,rows:[],state:'loading' as const,error:''};
  const external=externalSnapshot.key===ownerKey+':'+language
    ?externalSnapshot:{key:'',events:[],state:'loading' as const};
  const events=useMemo(()=>[...projectRecordedEvents(state.rows,language),...external.events],
    [state.rows,language,external.events]);
  const exportLedger=()=>{
    if((state.state!=='ready'&&external.state!=='ready')||!events.length)return;
    const headers=['Date','Source','Dhara','Assessment year','Tax head','Event','Source status','Recorded amount (paisa)','Confirmed credit effect (paisa)','Challan','Reference','Credit evidence'];
    const lines=events.map(e=>[e.occurredAt,e.source,e.dhara,e.assessmentYear,e.component,e.code,e.status,
      e.creditEvidenceStatus==='OFFICIAL_POSTING'?null:e.amountMinor,e.effectMinor,e.challanNo,e.reference,e.creditEvidenceStatus].map(escapeLedgerCsvCell).join(','));
    const blob=new Blob(['\uFEFF',headers.map(escapeLedgerCsvCell).join(','),'\r\n',lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
    const href=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=href;a.download='sohojkor-tax-ledger.csv';a.click();
    URL.revokeObjectURL(href);
  };
  const openPayment=(id:string)=>{
    const tx=state.rows.find(r=>r.transactionId===id);
    if(tx)setSelected(paymentRecord(tx,language));
  };
  return <div data-taxpay-register-page="true" className="mx-auto w-full max-w-7xl space-y-4 pb-12" lang={language}>
    <TaxpayerPageHeading title={t('Tax ledger','কর লেজার')} description={t('Ledger information','লেজারের তথ্য')}
      actions={<button type="button" onClick={exportLedger}
        disabled={(state.state!=='ready'&&external.state!=='ready')||!events.length}
        className="min-h-11 rounded-lg border border-taxpay-border px-4 text-sm font-semibold text-taxpay-dark disabled:opacity-50">
        {t('Export ledger data','লেজারের তথ্য রপ্তানি')}
      </button>}/>
    {identityPending||(state.state==='loading'&&external.state!=='ready')?<p role="status" className="rounded-xl border border-taxpay-border bg-white p-5 text-sm text-taxpay-muted">
      {t('Loading recorded events…','নথিভুক্ত ঘটনা লোড হচ্ছে…')}</p>:
    state.state==='error'&&external.state!=='ready'?<section role="alert" className="space-y-3 rounded-xl border border-taxpay-border bg-white p-5">
      <p className="text-sm text-taxpay-muted">{t('Unable to verify this account’s event history.','অ্যাকাউন্টের ঘটনার ইতিহাস যাচাই করা যাচ্ছে না।')}</p>
      <button className="min-h-11 rounded-lg border border-taxpay-border px-4 text-sm font-semibold text-taxpay-dark" type="button" onClick={()=>setRevision(i=>i+1)}>
        {t('Retry','আবার চেষ্টা করুন')}</button>
    </section>:
    <>
      {state.state==='error'&&<section role="alert" className="space-y-3 rounded-xl border border-taxpay-border bg-white p-5">
        <p className="text-sm text-taxpay-muted">{t('Sohojkor event history could not be verified. Available external records remain separate.','সহজকরের ঘটনার ইতিহাস যাচাই করা যায়নি। উপলব্ধ বহিরাগত রেকর্ড আলাদাভাবে দেখানো হচ্ছে।')}</p>
        <button className="min-h-11 rounded-lg border border-taxpay-border px-4 text-sm font-semibold text-taxpay-dark" type="button" onClick={()=>setRevision(i=>i+1)}>{t('Retry','আবার চেষ্টা করুন')}</button>
      </section>}
      {authenticatedUser&&external.state!=='ready'&&<div role={external.state==='error'?'alert':'status'} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-taxpay-border bg-white p-3 text-sm text-taxpay-muted">
        <span>{external.state==='loading'
          ?t('Checking the external payment ledger…','বহিরাগত পেমেন্ট লেজার পরীক্ষা করা হচ্ছে…')
          :external.state==='unavailable'
            ?t('External source records are not connected yet. Sohojkor records are shown separately.','বহিরাগত উৎসের রেকর্ড এখনো সংযুক্ত নয়। সহজকরের রেকর্ড আলাদাভাবে দেখানো হচ্ছে।')
            :t('External records could not be read. Showing available Sohojkor records only.','বহিরাগত রেকর্ড পড়া যায়নি। শুধু সহজকরের উপলব্ধ রেকর্ড দেখানো হচ্ছে।')}</span>
        {external.state==='error'&&<button type="button" onClick={()=>setRevision(i=>i+1)}
          className="min-h-11 rounded-lg border border-taxpay-border px-3 font-semibold text-taxpay-dark">{t('Retry','আবার চেষ্টা করুন')}</button>}
      </div>}
      <MuiEventBasedTaxLedger events={events} language={language} onOpenPayment={openPayment} showExternalSources/>
      <p className="text-xs text-taxpay-muted">{t('Sohojkor and imported external records are kept by their original source. An official liability, settlement or tax credit requires independently verified postings.',
        'সহজকর ও বহিরাগত রেকর্ড মূল উৎস অনুযায়ী পৃথক রাখা হয়। সরকারি দায়, নিষ্পত্তি বা কর ক্রেডিটের জন্য স্বতন্ত্রভাবে যাচাইকৃত পোস্টিং প্রয়োজন।')}</p>
    </>}
    {previewAccount&&<DemoServiceRecordsPanel userId={previewAccount.id} language={language}/>}
    {selected&&<TaxPayModal title={t('Payment details','পেমেন্টের বিবরণ')} onClose={()=>setSelected(null)} hideFooter className="taxpayer-transaction-detail">
      <PaymentLifecycleDetails record={selected} language={language}/>
    </TaxPayModal>}
  </div>;
};
