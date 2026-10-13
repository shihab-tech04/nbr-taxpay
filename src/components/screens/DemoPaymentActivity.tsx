import React,{useCallback,useEffect,useState} from 'react';
import {useTaxState} from '../../services/taxState';
import {useAccountIdentity} from '../../services/accountIdentity';
import {formatCurrency} from '../../services/numberFormat';
import {
  simulationUsers,simulationCategories,simulationCategoryLabels,loadSimulationHistory,submitSimulatedPayment,
  parseSimulatedAmount,formatSimulatedAmount,getBoundSimulationUser,getPrivateSimulationHistory,submitPrivateSimulationPayment,
  type SimulationUser,type SimulationCategory,type SimulationTransaction,type SimulationLine
} from '../../services/simulatedPaymentsApi';

type EditableLine={beneficiary:SimulationUser;category:SimulationCategory;assessmentYear:string;amount:string};
const freshLine=(user:SimulationUser):EditableLine=>({beneficiary:user,category:'TAX_WITH_RETURN',assessmentYear:'2026-27',amount:'100.00'});
/** Public, persistent synthetic transaction workspace. NEVER official payment evidence. */
export const DemoPaymentActivity:React.FC=()=>{
  const {demoUser,language,navigate}=useTaxState();
  const {user:authenticatedUser,loading:authLoading}=useAccountIdentity();
  const [boundId,setBoundId]=useState<SimulationUser|null>(null);
  const [bindingError,setBindingError]=useState('');
  const privateMode=Boolean(authenticatedUser);
  const id=(privateMode?boundId:undefined) as SimulationUser|undefined;
  const bn=language==='bn';
  const txt=(en:string,bengali:string)=>bn?bengali:en;
  const [view,setView]=useState<'beneficiary'|'payer'>('beneficiary');
  const [rows,setRows]=useState<SimulationTransaction[]>([]);
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState('');
  const [revision,setRevision]=useState(0);
  const [lines,setLines]=useState<EditableLine[]>([freshLine('user1')]);
  const [nonce,setNonce]=useState(()=>crypto.randomUUID());
  const [saving,setSaving]=useState(false);
  const [submitMessage,setSubmitMessage]=useState('');
  const [paymentStage,setPaymentStage]=useState<0|1|2|3>(0);
  const [parentCategory,setParentCategory]=useState<SimulationCategory>('TAX_WITH_RETURN');
  const [completedReference,setCompletedReference]=useState('');
  const chooseCategory=(category:SimulationCategory)=>{setParentCategory(category);setLines(old=>old.map(line=>({...line,category})));setPaymentStage(1);};

  useEffect(()=>{
    if(!authenticatedUser){setBoundId(null);setBindingError('');return;}
    let active=true;setBoundId(null);setBindingError('');
    getBoundSimulationUser().then(profile=>{if(active)setBoundId(profile);})
      .catch(e=>{if(active)setBindingError(e instanceof Error?e.message:'Profile authorization unavailable');});
    return()=>{active=false;};
  },[authenticatedUser?.id]);
  useEffect(()=>{if(!id)return;setLines([freshLine(id)]);setNonce(crypto.randomUUID());setSubmitMessage('');setPaymentStage(0);},[id]);
  useEffect(()=>{
    if(!id||!privateMode)return;
    let active=true;
    setRows([]);setLoading(true);setLoadError('');
    const run=async()=>{
      try{
        const next=privateMode?await getPrivateSimulationHistory(view):await loadSimulationHistory(id,view);
        if(active){setRows(next);setLoadError('');setLoading(false);}
      }catch(e){
        if(active){setLoadError(e instanceof Error?e.message:'Read failed');setLoading(false);}
      }
    };
    void run();
    const timer=window.setInterval(()=>void run(),7000);
    return()=>{active=false;window.clearInterval(timer);};
  },[id,view,revision,privateMode]);

  const modify=(index:number,field:keyof EditableLine,value:string)=>{
    setLines(before=>before.map((l,i)=>i===index?{...l,[field]:value}:l));
    setNonce(crypto.randomUUID());setSubmitMessage('');
  };
  const addLine=()=>{if(id&&lines.length<20){setLines(old=>[...old,freshLine(id)]);setNonce(crypto.randomUUID());setSubmitMessage('');}};
  const removeLine=(index:number)=>{if(lines.length>1){setLines(old=>old.filter((_,i)=>i!==index));setNonce(crypto.randomUUID());setSubmitMessage('');}};
  const submit=useCallback(async(e:React.FormEvent)=>{
    e.preventDefault();if(!id||saving)return;
    setSaving(true);setSubmitMessage('');
    try{
      const checked:SimulationLine[]=lines.map(l=>({
        beneficiary:l.beneficiary,category:l.category,assessmentYear:l.assessmentYear,
        amountMinor:parseSimulatedAmount(l.amount)
      }));
      const result=privateMode?await submitPrivateSimulationPayment(checked,nonce):await submitSimulatedPayment(id,checked,nonce);
      const readback=privateMode?await getPrivateSimulationHistory('payer'):await loadSimulationHistory(id,'payer');
      const confirmed=readback.find(t=>t.transactionId===result.transactionId);
      const expected=checked.reduce((sum,l)=>sum+l.amountMinor,0);
      if(!confirmed||confirmed.totalMinor!==expected||confirmed.allocations.length!==checked.length)throw new Error('SQL write may have succeeded, but read-back did not reconcile. Retry using the same form.');
      setView('payer');setRevision(v=>v+1);setLines([freshLine(id)]);setNonce(crypto.randomUUID());
      setCompletedReference(result.reference);setPaymentStage(3);
      setSubmitMessage(txt('Simulation saved and verified: ','সিমুলেশন সংরক্ষিত ও যাচাইকৃত: ')+result.reference+(result.replayed?' (idempotent replay)':''));
    }catch(err){setSubmitMessage(err instanceof Error?err.message:'Submission could not be verified');}
    finally{setSaving(false);}
  },[id,lines,nonce,saving,language,privateMode]);

  if(authLoading)return <main className="mx-auto max-w-5xl p-6"><p role="status">Checking protected account…</p></main>;
  // Anonymous simulator RPCs were revoked. Fail closed with an explicit sign-in
  // journey, rather than attempting a permanently rejected public transaction.
  if(!authenticatedUser)return <main className="mx-auto max-w-5xl space-y-4 rounded-xl border border-taxpay-border bg-white p-6" lang={language}>
    <h1 className="text-2xl font-bold text-taxpay-text">{txt('Sign in to simulate a payment','পেমেন্ট সিমুলেশনের জন্য সাইন ইন করুন')}</h1>
    <p className="text-sm text-taxpay-muted">{txt('Payment records are stored in a shared database. A verified account and an authorized fictional profile assignment are required before creating or viewing them. No real money, government receipt, or tax credit is involved.','পেমেন্টের তথ্য যৌথ ডাটাবেসে সংরক্ষিত হয়। পেমেন্ট তৈরি বা দেখার আগে যাচাইকৃত অ্যাকাউন্ট এবং অনুমোদিত কাল্পনিক প্রোফাইলের সংযোগ প্রয়োজন। কোনো বাস্তব অর্থ বা কর ক্রেডিট জড়িত নয়।')}</p>
    <button type="button" className="min-h-11 rounded-lg bg-taxpay-primary px-5 font-semibold text-white" onClick={()=>navigate('secure_workspace')}>{txt('Open secure sign-in','নিরাপদ সাইন ইন খুলুন')}</button>
  </main>;
  if(privateMode&&!id)return <main className="mx-auto max-w-5xl space-y-3 p-6">
    <h1 className="text-xl font-semibold text-taxpay-text">Protected simulation payment account</h1>
    <p role="status">{bindingError||'Checking your verified account assignment…'}</p>
    <p className="text-sm text-taxpay-muted">An authorized Approver must assign one fictional user1–user10 profile to this authenticated account. No other profile can be selected by URL.</p>
  </main>;
  if(!id)return null;
  return <main className="mx-auto max-w-5xl space-y-5 pb-12" lang={language}>
    <header className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-6">
      <p className="text-sm font-semibold text-taxpay-dark">{id} · {txt('Connected simulation workspace','সংযুক্ত সিমুলেশন ওয়ার্কস্পেস')}</p>
      <h1 className="mt-2 text-2xl font-bold text-taxpay-text">{txt('Payments and transaction history','পেমেন্ট ও লেনদেনের ইতিহাস')}</h1>
      <p className="mt-2 text-sm text-taxpay-muted">{privateMode?txt('Protected account — verified server-side profile assignment. All changes sync with Office Management. Simulation only; no payment or credit.','সুরক্ষিত অ্যাকাউন্ট — সার্ভারে প্রোফাইল যাচাইকৃত। সব তথ্য অফিস ম্যানেজমেন্টে সমন্বিত। শুধু সিমুলেশন।'):txt('Simulation only: no real payment, government challan or tax credit.','শুধু সিমুলেশন: বাস্তব পেমেন্ট, সরকারি চালান বা কর ক্রেডিট নেই।')}</p>
      {!privateMode&&<p className="mt-2 text-sm text-taxpay-muted">{txt('Public fictional sandbox. All sample accounts are unverified examples; do not enter personal data.','উন্মুক্ত কাল্পনিক নমুনা। ব্যক্তিগত তথ্য প্রবেশ করাবেন না।')}</p>}
    </header>

    <section className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-6" aria-label={txt('New simulated payment','নতুন সিমুলেটেড পেমেন্ট')}>
      <ol aria-label={txt('Payment steps','পেমেন্টের ধাপ')} className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[txt('Category','শ্রেণি'),txt('Information','তথ্য'),txt('Make payment','পেমেন্ট'),txt('Simulation','সিমুলেশন'),txt('Result','ফলাফল')].map((name,index)=>
          <li key={name} aria-current={(paymentStage===0&&index===0)||(paymentStage===1&&index===1)||(paymentStage===2&&index===2)||(paymentStage===3&&index===4)?'step':undefined}
            className={`rounded-lg border px-3 py-3 text-xs font-semibold ${(paymentStage===0&&index===0)||(paymentStage===1&&index===1)||(paymentStage===2&&(index===2||index===3))||(paymentStage===3&&index===4)?'border-taxpay-primary bg-taxpay-primary text-white':'border-taxpay-border bg-slate-50 text-taxpay-muted'}`}>
            {index+1}. {name}</li>)}
      </ol>
      {paymentStage===0&&<div className="space-y-4">
        <h2 className="text-xl font-bold text-taxpay-text">{txt('Choose payment category','পেমেন্টের শ্রেণি নির্বাচন করুন')}</h2>
        <p className="text-sm text-taxpay-muted">{txt('Select the main category before entering payment details.','পেমেন্টের বিস্তারিত দেওয়ার আগে মূল শ্রেণি নির্বাচন করুন।')}</p>
        <div className="grid gap-3 sm:grid-cols-2">{simulationCategories.map(category=>
          <button key={category} type="button" onClick={()=>chooseCategory(category)} className="min-h-20 rounded-xl border border-taxpay-border p-4 text-left font-semibold text-taxpay-dark hover:border-taxpay-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-taxpay-primary">
            <span className="block">{simulationCategoryLabels[category][bn?'bn':'en']}</span>
            <span className="mt-2 block text-xs font-normal text-taxpay-muted">{txt('View category information →','শ্রেণির তথ্য দেখুন →')}</span>
          </button>)}</div>
      </div>}
      {paymentStage===1&&<div className="space-y-4">
        <h2 className="text-xl font-bold text-taxpay-text">{txt('Information before payment','পেমেন্টের আগে প্রয়োজনীয় তথ্য')}</h2>
        <p className="font-semibold text-taxpay-dark">{simulationCategoryLabels[parentCategory][bn?'bn':'en']}</p>
        <p className="text-sm text-taxpay-muted">{txt('For this test transaction, supply the beneficiary, assessment year, payment category and BDT amount. Additional allocations can be added to one simulated transaction.','পরীক্ষামূলক লেনদেনের জন্য সুবিধাভোগী, করবর্ষ, পেমেন্টের শ্রেণি এবং টাকার পরিমাণ দিন। একই সিমুলেশনে একাধিক বরাদ্দ যোগ করা যায়।')}</p>
        <p className="rounded-lg border border-taxpay-border bg-slate-50 p-4 text-sm">{txt('Simulation only: this does not move money, establish a tax liability, grant tax credit or issue a government challan.','শুধু সিমুলেশন: এতে অর্থ স্থানান্তর, কর দায় নির্ধারণ, কর ক্রেডিট বা সরকারি চালান তৈরি হয় না।')}</p>
        <div className="flex flex-wrap justify-between gap-3">
          <button type="button" onClick={()=>setPaymentStage(0)} className="min-h-11 rounded-lg border border-taxpay-border px-5 font-semibold">{txt('Back','পূর্ববর্তী')}</button>
          <button type="button" onClick={()=>setPaymentStage(2)} className="min-h-11 rounded-lg bg-taxpay-primary px-5 font-semibold text-white">{txt('Make Payment →','পেমেন্ট করুন →')}</button>
        </div>
      </div>}
      {paymentStage===3&&<div className="space-y-4" role="status">
        <h2 className="text-xl font-bold text-taxpay-text">{txt('Payment simulation completed','পেমেন্ট সিমুলেশন সম্পন্ন')}</h2>
        <p className="text-sm text-taxpay-muted">{txt('The simulated transaction was read back from the test database. This is not a real payment or government receipt.','পরীক্ষামূলক ডাটাবেসে লেনদেনটি যাচাই করা হয়েছে। এটি বাস্তব পেমেন্ট বা সরকারি রসিদ নয়।')}</p>
        <p className="rounded-lg border border-taxpay-border p-4 font-mono text-sm break-all">{completedReference}</p>
        <button type="button" onClick={()=>{setPaymentStage(0);setSubmitMessage('');}} className="min-h-11 rounded-lg bg-taxpay-primary px-5 font-semibold text-white">{txt('Make another payment','আরও একটি পেমেন্ট করুন')}</button>
      </div>}
      {paymentStage===2&&<>
      <h2 className="text-lg font-bold text-taxpay-text">{txt('Create a combined payment','একাধিক বরাদ্দের পেমেন্ট তৈরি করুন')}</h2>
      <p className="mt-1 text-sm text-taxpay-muted">{txt('Combine your own and other beneficiaries, categories and years in one atomic transaction.','একটি লেনদেনে নিজের ও অন্যের, একাধিক খাত ও একাধিক করবর্ষের বরাদ্দ রাখুন।')}</p>
      <form onSubmit={e=>void submit(e)} className="mt-4 space-y-4">
        <button type="button" onClick={()=>setPaymentStage(1)} className="min-h-11 rounded-lg border border-taxpay-border px-4 text-sm font-semibold">{txt('← Category information','← শ্রেণির তথ্য')}</button>
        {lines.map((line,index)=><fieldset key={index} className="rounded-lg border border-taxpay-border p-3 sm:p-4">
          <legend className="px-2 text-sm font-semibold text-taxpay-text">{txt('Allocation','বরাদ্দ')} {index+1}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-taxpay-text">{txt('Pay for','যার জন্য পেমেন্ট')}
              <select className="mt-1 min-h-11 w-full rounded-lg border border-taxpay-border bg-white px-3" value={line.beneficiary} onChange={e=>modify(index,'beneficiary',e.target.value)}>
                {simulationUsers.map(u=><option key={u} value={u}>{u}{u===id?txt(' (self)',' (নিজের)'):''}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold text-taxpay-text">{txt('Payment category','পেমেন্টের খাত')}
              <select className="mt-1 min-h-11 w-full rounded-lg border border-taxpay-border bg-white px-3" value={line.category} onChange={e=>modify(index,'category',e.target.value)}>
                {simulationCategories.map(c=><option value={c} key={c}>{c.replace(/_/g,' ')}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold text-taxpay-text">{txt('Assessment year','করবর্ষ')}
              <select className="mt-1 min-h-11 w-full rounded-lg border border-taxpay-border bg-white px-3" value={line.assessmentYear} onChange={e=>modify(index,'assessmentYear',e.target.value)}>
                {['2024-25','2025-26','2026-27','2027-28'].map(y=><option key={y} value={y}>{y}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold text-taxpay-text">{txt('Amount (BDT)','টাকার পরিমাণ (৳)')}
              <input required inputMode="decimal" autoComplete="off" className="mt-1 min-h-11 w-full rounded-lg border border-taxpay-border bg-white px-3" value={line.amount} onChange={e=>modify(index,'amount',e.target.value)} placeholder="100.00"/>
            </label>
          </div>
          {lines.length>1&&<button type="button" onClick={()=>removeLine(index)} className="mt-3 min-h-11 rounded-lg border border-taxpay-border px-3 text-sm font-semibold">{txt('Remove allocation','বরাদ্দ বাদ দিন')}</button>}
        </fieldset>)}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={lines.length>=20||saving} onClick={addLine} className="min-h-11 rounded-lg border border-taxpay-border px-4 font-semibold disabled:opacity-50">{txt('Add beneficiary / category','বরাদ্দ যোগ করুন')}</button>
          <button type="submit" disabled={saving} className="min-h-11 rounded-lg bg-taxpay-primary px-5 font-semibold text-white disabled:opacity-50">{saving?txt('Saving…','সংরক্ষণ হচ্ছে…'):txt('Simulate and save payment','পেমেন্ট সিমুলেট করে সংরক্ষণ করুন')}</button>
        </div>
        {submitMessage&&<p role="status" aria-live="polite" className="text-sm font-semibold text-taxpay-text">{submitMessage}</p>}
      </form></>}
    </section>

    <nav className="flex flex-wrap gap-2" aria-label={txt('History perspective','ইতিহাসের ধরন')}>
      {(['beneficiary','payer'] as const).map(mode=><button key={mode} type="button" aria-pressed={view===mode} onClick={()=>setView(mode)}
        className="min-h-11 rounded-lg border border-taxpay-border bg-white px-4 font-semibold text-taxpay-dark">
        {mode==='beneficiary'?txt('Payments allocated to me','আমার হিসাবে বরাদ্দ'):txt('Payments I initiated','আমার শুরু করা পেমেন্ট')}
      </button>)}
    </nav>
    <section className="space-y-3" aria-label={txt('Shared SQL transaction history','SQL লেনদেনের ইতিহাস')}>
      {loading?<p role="status">{txt('Loading shared transactions…','সংযুক্ত লেনদেন লোড হচ্ছে…')}</p>:loadError?<p role="alert">{txt('Could not synchronize transaction history: ','লেনদেনের তথ্য সমন্বয় করা যায়নি: ')}{loadError}</p>:
        rows.length===0?<section className="rounded-xl border border-taxpay-border bg-white p-5"><h2 className="font-bold">{txt('No transactions yet','এখনো কোনো লেনদেন নেই')}</h2><p className="mt-2 text-sm text-taxpay-muted">{txt('Create a simulated payment to populate this history and the admin ledger.','পেমেন্ট সিমুলেট করলে এই হিসাব এবং অ্যাডমিন লেজারে দেখা যাবে।')}</p></section>:
        rows.map(tx=><article key={tx.transactionId} className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><h2 className="font-semibold text-taxpay-text">{tx.id} · {tx.state}</h2>
              <p className="text-sm text-taxpay-muted">{txt('Payer','প্রদানকারী')}: {tx.payer} · <time dateTime={tx.createdAt}>{new Date(tx.createdAt).toLocaleString(bn?'bn-BD':'en-GB')}</time></p></div>
            <p className="font-bold tabular-nums text-taxpay-text">{formatSimulatedAmount(tx.allocations.reduce((n,a)=>n+a.amountMinor,0))}</p>
          </div>
          <p className="mt-2 text-sm font-semibold text-taxpay-dark">{txt('Office review','অফিস পর্যালোচনা')}: {tx.reviewStatus}</p>
          <p className="mt-2 text-xs text-taxpay-muted">{txt('Shared SQL transaction · no Treasury settlement or tax credit','SQL লেনদেন · সরকারি পেমেন্ট বা কর ক্রেডিট নয়')}</p>
          <h3 className="mt-4 font-semibold text-taxpay-text">{txt('Allocation details','বরাদ্দের বিবরণ')}</h3>
          <ul className="mt-2 divide-y divide-taxpay-border">{tx.allocations.map(a=><li key={a.id} className="flex justify-between gap-2 py-2 text-sm">
            <div><p>{a.beneficiary} · {a.simulationCategoryLabels[category][bn?'bn':'en']}</p><p className="text-taxpay-muted">AY {a.assessmentYear}</p></div>
            <p className="font-semibold tabular-nums">{formatSimulatedAmount(a.amountMinor)}</p></li>)}</ul>
          <details className="mt-3 rounded-lg border border-taxpay-border p-3"><summary className="cursor-pointer font-semibold">{txt('Transaction timeline','লেনদেনের সময়রেখা')}</summary>
            <ol className="mt-2 space-y-2">{tx.events.map(e=><li key={e.id} className="text-sm"><p className="font-semibold">{e.action}</p><p className="text-taxpay-muted"><time dateTime={e.occurredAt}>{new Date(e.occurredAt).toLocaleString()}</time> · {e.note}</p></li>)}</ol>
          </details>
        </article>)}
    </section>
  </main>;
};