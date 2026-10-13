import React,{useCallback,useEffect,useRef,useState} from 'react';
import {useTaxState} from '../../services/taxState';
import {useAccountIdentity} from '../../services/accountIdentity';
import {CATEGORY_LABELS} from '../../data/paymentHeads';
import {
  simulationUsers,simulationCategories,
  parseSimulatedAmount,formatSimulatedAmount,getBoundSimulationUser,getPrivateSimulationHistory,submitPrivateSimulationPayment,
  type SimulationUser,type SimulationCategory,type SimulationTransaction,type SimulationLine
} from '../../services/simulatedPaymentsApi';

type EditableLine={beneficiary:SimulationUser;category:SimulationCategory;assessmentYear:string;amount:string};
const freshLine=(user:SimulationUser):EditableLine=>({beneficiary:user,category:'TAX_WITH_RETURN',assessmentYear:'2026-27',amount:''});
const categoryHelp:Record<SimulationCategory,{en:string;bn:string}>={
  TAX_WITH_RETURN:{en:'A payment entered in connection with an income tax return. Confirm the return and relevant assessment year before proceeding.',bn:'আয়কর রিটার্নের সঙ্গে সম্পর্কিত পেমেন্ট। এগোনোর আগে রিটার্ন ও প্রযোজ্য করবর্ষ যাচাই করুন।'},
  ADVANCE_TAX:{en:'An advance payment entry. Check the period and payer before entering an amount.',bn:'অগ্রিম পেমেন্টের এন্ট্রি। পরিমাণ দেওয়ার আগে সময়কাল ও প্রদানকারী যাচাই করুন।'},
  ASSESSED_DEMAND:{en:'A payment against an assessed demand. Keep the relevant assessment notice available for reference.',bn:'ধার্যকৃত দাবির বিপরীতে পেমেন্ট। সংশ্লিষ্ট কর নির্ধারণের নোটিশ যাচাই করুন।'},
  PENALTY:{en:'A penalty or interest payment entry. The amount must come from an independently verified obligation.',bn:'জরিমানা বা সুদের পেমেন্ট এন্ট্রি। স্বাধীনভাবে যাচাইকৃত দায় অনুযায়ী পরিমাণ নির্ধারণ করুন।'},
  SOURCE_TAX_DEPOSIT:{en:'A withholding-related deposit entry. Check the deductor, recipient, period and supporting records.',bn:'উৎসে কর সম্পর্কিত জমার এন্ট্রি। কর্তনকারী, প্রাপক, সময়কাল ও প্রমাণ যাচাই করুন।'},
  APPELLATE_TRIBUNAL:{en:'An appeal-related payment entry. Verify the relevant order, notice and applicable payment requirement.',bn:'আপিল-সম্পর্কিত পেমেন্ট এন্ট্রি। সংশ্লিষ্ট আদেশ, নোটিশ ও পেমেন্টের শর্ত যাচাই করুন।'},
  OTHER_TAX_PAYMENT:{en:'An additional payment category. Verify the precise payment purpose before continuing.',bn:'অন্যান্য পেমেন্টের খাত। এগোনোর আগে নির্দিষ্ট উদ্দেশ্য যাচাই করুন।'}
};
const guidedSteps=[
  {en:'Payment category',bn:'পেমেন্টের ধরন'},
  {en:'Category information',bn:'বিভাগের তথ্য'},
  {en:'Make payment',bn:'পেমেন্টের তথ্য'},
  {en:'Payment simulation',bn:'পেমেন্ট সিমুলেশন'},
  {en:'Result',bn:'ফলাফল'}
];
/** Protected SQL simulation; public fictional profiles use isolated in-memory preview only. */
export const DemoPaymentActivity:React.FC=()=>{
  const {demoUser,language,routeParams,navigate}=useTaxState();
  const {user:authenticatedUser,loading:authLoading}=useAccountIdentity();
  const [boundId,setBoundId]=useState<SimulationUser|null>(null);
  const [bindingError,setBindingError]=useState('');
  const privateMode=Boolean(authenticatedUser);
  const id=(privateMode?boundId:demoUser?.id) as SimulationUser|undefined;
  const bn=language==='bn';
  const txt=(en:string,bengali:string)=>bn?bengali:en;
  const [view,setView]=useState<'beneficiary'|'payer'>('beneficiary');
  const [rows,setRows]=useState<SimulationTransaction[]>([]);
  const demoTransactions=useRef<SimulationTransaction[]>([]);
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState('');
  const [revision,setRevision]=useState(0);
  const [lines,setLines]=useState<EditableLine[]>([freshLine('user1')]);
  const [nonce,setNonce]=useState(()=>crypto.randomUUID());
  const [saving,setSaving]=useState(false);
  const [submitMessage,setSubmitMessage]=useState('');
  const [flowError,setFlowError]=useState('');
  const [stage,setStage]=useState<1|2|3|4|5>(1);
  const [parentCategory,setParentCategory]=useState<SimulationCategory>(()=>{
    const candidate=routeParams?.initialCategory as SimulationCategory;
    return simulationCategories.includes(candidate)?candidate:'TAX_WITH_RETURN';
  });
  const [confirmation,setConfirmation]=useState<{reference:string;totalMinor:number;count:number}|null>(null);

  useEffect(()=>{
    if(!authenticatedUser){setBoundId(null);setBindingError('');return;}
    let active=true;setBoundId(null);setBindingError('');
    getBoundSimulationUser().then(profile=>{if(active)setBoundId(profile);})
      .catch(e=>{if(active)setBindingError(e instanceof Error?e.message:'Profile authorization unavailable');});
    return()=>{active=false;};
  },[authenticatedUser?.id]);
  useEffect(()=>{if(!id)return;setLines([{...freshLine(id),category:parentCategory}]);setNonce(crypto.randomUUID());setSubmitMessage('');setConfirmation(null);setStage(1);},[id]);
  useEffect(()=>{
    if(!id)return;
    if(!privateMode){
      // The hosted simulation RPCs intentionally exclude anon. Never weaken SQL grants.
      // These demo rows live only in this mounted component, not SQL or shared persistence.
      const local=demoTransactions.current.filter(t=>view==='payer'?t.payer===id:t.allocations.some(a=>a.beneficiary===id));
      setRows(local);setLoading(false);setLoadError('');
      return;
    }
    let active=true;
    setRows([]);setLoading(true);setLoadError('');
    const run=async()=>{
      try{
        const next=await getPrivateSimulationHistory(view);
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
    setNonce(crypto.randomUUID());setSubmitMessage('');setFlowError('');
  };
  const addLine=()=>{if(id&&lines.length<20){setLines(old=>[...old,{...freshLine(id),category:parentCategory}]);setNonce(crypto.randomUUID());setSubmitMessage('');}};
  const removeLine=(index:number)=>{if(lines.length>1){setLines(old=>old.filter((_,i)=>i!==index));setNonce(crypto.randomUUID());setSubmitMessage('');}};
  const submit=useCallback(async()=>{
    if(!id||saving||stage!==4)return;
    setSaving(true);setSubmitMessage('');setFlowError('');
    try{
      const checked:SimulationLine[]=lines.map(l=>({
        beneficiary:l.beneficiary,category:l.category,assessmentYear:l.assessmentYear,
        amountMinor:parseSimulatedAmount(l.amount)
      }));
      const expected=checked.reduce((sum,l)=>sum+l.amountMinor,0);
      if(!Number.isSafeInteger(expected)||expected<=0)throw new Error('Invalid total amount.');
      if(privateMode){
        const result=await submitPrivateSimulationPayment(checked,nonce);
        const readback=await getPrivateSimulationHistory('payer');
        const confirmed=readback.find(t=>t.transactionId===result.transactionId);
        if(!confirmed||confirmed.totalMinor!==expected||confirmed.allocations.length!==checked.length)throw new Error('SQL write may have succeeded, but read-back did not reconcile. Retry using the same form.');
        setConfirmation({reference:result.reference,totalMinor:expected,count:checked.length});
        setSubmitMessage(txt('Simulation saved and reconciled with shared SQL. No funds moved or official tax credit was created.','সিমুলেশন সংরক্ষিত এবং SQL রিড-ব্যাকে মিলেছে। কোনো অর্থ স্থানান্তর বা সরকারি কর ক্রেডিট তৈরি হয়নি।'));
      }else{
        const localId=crypto.randomUUID();
        const reference='DEMO-'+localId.slice(0,8).toUpperCase();
        const time=new Date().toISOString();
        const row:SimulationTransaction={
          id:reference,transactionId:localId,payer:id,state:'SIMULATED',createdAt:time,
          simulationOnly:true,totalMinor:expected,reviewStatus:'LOCAL_PREVIEW_ONLY',
          allocations:checked.map((line,index)=>({...line,id:localId+'-'+(index+1),lineNo:index+1})),
          events:[{id:1,action:'LOCAL_DEMO_PREVIEW',note:'In-memory only. No shared SQL or government payment.',occurredAt:time}]
        };
        demoTransactions.current=[row,...demoTransactions.current];
        setConfirmation({reference,totalMinor:expected,count:checked.length});
        setSubmitMessage(txt('Demo preview created in this browser session only. Nothing saved to shared SQL; no funds moved or tax credit was created.','ডেমো প্রিভিউ শুধু এই ব্রাউজারে তৈরি হয়েছে। SQL-এ কিছু সংরক্ষিত হয়নি; অর্থ স্থানান্তর বা কর ক্রেডিট তৈরি হয়নি।'));
      }
      setView('payer');setRevision(v=>v+1);setStage(5);
    }catch(err){setFlowError(err instanceof Error?err.message:'Submission could not be verified');}
    finally{setSaving(false);}
  },[id,lines,nonce,saving,language,privateMode,stage]);
  const chooseCategory=(value:SimulationCategory)=>{
    if(saving)return;
    setParentCategory(value);
    setLines(old=>old.map((line,index)=>index===0?{...line,category:value}:line));
    setNonce(crypto.randomUUID());setFlowError('');
  };
  const goReview=()=>{
    try{
      if(!lines.length)throw Error(txt('Add at least one allocation.','অন্তত একটি বরাদ্দ যোগ করুন।'));
      const parsed=lines.map(line=>parseSimulatedAmount(line.amount));
      const total=parsed.reduce((sum,n)=>sum+n,0);
      if(!Number.isSafeInteger(total)||total<=0)throw Error(txt('Enter a valid positive amount.','সঠিক ধনাত্মক পরিমাণ লিখুন।'));
      setFlowError('');setStage(4);
    }catch(e){setFlowError(e instanceof Error?e.message:'Check the payment amounts');}
  };
  const restart=()=>{
    if(!id)return;
    setLines([{...freshLine(id),category:parentCategory}]);setNonce(crypto.randomUUID());setConfirmation(null);
    setFlowError('');setSubmitMessage('');setStage(1);
  };

  if(authLoading&&!demoUser)return <main className="mx-auto max-w-5xl p-6"><p role="status">Checking protected account…</p></main>;
  if(privateMode&&!id)return <main className="mx-auto max-w-5xl space-y-3 p-6">
    <h1 className="text-xl font-semibold text-taxpay-text">Protected simulation payment account</h1>
    <p role="status">{bindingError||'Checking your verified account assignment…'}</p>
    <p className="text-sm text-taxpay-muted">An authorized Approver must assign one fictional user1–user10 profile to this authenticated account. No other profile can be selected by URL.</p>
  </main>;
  if(!id)return null;
  return <main className="taxpay-guided-payment mx-auto max-w-5xl space-y-5 pb-12" lang={language}>
    <header className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-6">
      <p className="text-sm font-semibold text-taxpay-dark">{id} · {privateMode?txt('Connected simulation workspace','সংযুক্ত সিমুলেশন ওয়ার্কস্পেস'):txt('Local demo preview','স্থানীয় ডেমো প্রিভিউ')}</p>
      <h1 className="mt-2 text-2xl font-bold text-taxpay-text">{txt('Make Payment','পেমেন্ট করুন')}</h1>
      <p className="mt-2 text-sm text-taxpay-muted">{privateMode?txt('Protected account — verified server-side profile assignment. All changes sync with Office Management. Simulation only; no payment or credit.','সুরক্ষিত অ্যাকাউন্ট — সার্ভারে প্রোফাইল যাচাইকৃত। সব তথ্য অফিস ম্যানেজমেন্টে সমন্বিত। শুধু সিমুলেশন।'):txt('Simulation only: no real payment, government challan or tax credit.','শুধু সিমুলেশন: বাস্তব পেমেন্ট, সরকারি চালান বা কর ক্রেডিট নেই।')}</p>
      {!privateMode&&<p className="mt-2 text-sm text-taxpay-muted">{txt('Local preview only — nothing is sent to SQL or Office Management. Sample accounts are fictional. Do not enter personal data. Sign in to access your authorized connected simulation.','শুধু স্থানীয় প্রিভিউ — SQL বা অফিস ম্যানেজমেন্টে কিছু পাঠানো হয় না। নমুনা অ্যাকাউন্ট কাল্পনিক। ব্যক্তিগত তথ্য লিখবেন না। সংযুক্ত সিমুলেশনের জন্য সাইন ইন করুন।')}</p>}
    </header>

    <nav className="taxpay-guided-steps" aria-label={txt('Payment progress','পেমেন্টের অগ্রগতি')}>
      {guidedSteps.map((item,index)=><div key={index} className="taxpay-guided-step" aria-current={stage===index+1?'step':undefined} data-done={stage>index+1}>
        <span className="taxpay-guided-step__number">{stage>index+1?'✓':index+1}</span>
        <span>{bn?item.bn:item.en}</span>
      </div>)}
    </nav>
    <section className="taxpay-guided-panel rounded-xl border border-taxpay-border bg-white p-4 sm:p-6" aria-label={txt('Guided payment','নির্দেশিত পেমেন্ট')}>
      <h2 className="text-lg font-bold text-taxpay-text">{bn?guidedSteps[stage-1].bn:guidedSteps[stage-1].en}</h2>
      <p className="mt-1 text-sm text-taxpay-muted">{txt('Complete each step in order. This is a simulation, not a real tax payment.','প্রতিটি ধাপ পর্যায়ক্রমে সম্পন্ন করুন। এটি সিমুলেশন, প্রকৃত কর পরিশোধ নয়।')}</p>
      {stage===1&&<div className="taxpay-guided-body">
        <h3>{txt('What would you like to pay?','আপনি কোন ধরনের কর পরিশোধ করতে চান?')}</h3>
        <div className="taxpay-guided-categories" role="group" aria-label={txt('Parent payment category','মূল পেমেন্টের ধরন')}>
          {simulationCategories.map(cat=><button type="button" key={cat} className="taxpay-guided-category" aria-pressed={parentCategory===cat} onClick={()=>chooseCategory(cat)}>
            <span className="taxpay-guided-category__check" aria-hidden="true">{parentCategory===cat?'✓':''}</span>
            <strong>{bn?CATEGORY_LABELS[cat].bn:CATEGORY_LABELS[cat].en}</strong>
            <span>{bn?categoryHelp[cat].bn:categoryHelp[cat].en}</span>
          </button>)}
        </div>
        <div className="taxpay-guided-footer">
          <button type="button" className="taxpay-guided-secondary" onClick={()=>navigate('taxpayer_home')}>{txt('Cancel','বাতিল')}</button>
          <button type="button" className="taxpay-guided-primary" onClick={()=>setStage(2)}>{txt('Continue','এগিয়ে যান')} <span aria-hidden="true">→</span></button>
        </div>
      </div>}
      {stage===2&&<div className="taxpay-guided-body">
        <h3>{bn?CATEGORY_LABELS[parentCategory].bn:CATEGORY_LABELS[parentCategory].en}</h3>
        <p>{bn?categoryHelp[parentCategory].bn:categoryHelp[parentCategory].en}</p>
        <div className="taxpay-guided-information">
          <h4>{txt('Before you continue','এগোনোর আগে')}</h4>
          <ul>
            <li>{txt('Confirm who the payment is for, and the correct assessment year.','কার জন্য পেমেন্ট ও সঠিক করবর্ষ যাচাই করুন।')}</li>
            <li>{txt('Enter the amount from your own supporting records. Tax liability is not calculated here.','নিজের প্রমাণপত্র অনুযায়ী পরিমাণ লিখুন। এখানে কর দায় গণনা করা হয় না।')}</li>
            <li>{txt('You can add multiple beneficiaries and categories in one simulated transaction.','একটি সিমুলেটেড লেনদেনে একাধিক করদাতা ও খাত যোগ করতে পারবেন।')}</li>
            <li>{privateMode?txt('Only a successful server read-back will show the simulation result.','সার্ভার থেকে সফল রিড-ব্যাকের পরই সিমুলেশনের ফলাফল দেখানো হবে।'):txt('Public demo previews run only in browser memory, without a server write.','পাবলিক ডেমো শুধু ব্রাউজারের মেমরিতে চলে, সার্ভারে সংরক্ষণ হয় না।')}</li>
          </ul>
        </div>
        <div className="taxpay-guided-footer">
          <button type="button" className="taxpay-guided-secondary" onClick={()=>setStage(1)}>{txt('Back','পূর্ববর্তী')}</button>
          <button type="button" className="taxpay-guided-primary" onClick={()=>setStage(3)}>{txt('Make payment','পেমেন্টের তথ্য দিন')} <span aria-hidden="true">→</span></button>
        </div>
      </div>}
      {stage===3&&<p className="taxpay-guided-context">{bn?CATEGORY_LABELS[parentCategory].bn:CATEGORY_LABELS[parentCategory].en} · {txt('Enter your allocations','বরাদ্দের তথ্য দিন')}</p>}
      {flowError&&<p className="taxpay-guided-error" role="alert">{flowError}</p>}
      {stage===3&&<form onSubmit={e=>{e.preventDefault();goReview();}} className="mt-4 space-y-4">
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
              <input inputMode="decimal" autoComplete="off" className="mt-1 min-h-11 w-full rounded-lg border border-taxpay-border bg-white px-3" value={line.amount} onChange={e=>modify(index,'amount',e.target.value)} placeholder="100.00"/>
            </label>
          </div>
          {lines.length>1&&<button type="button" onClick={()=>removeLine(index)} className="mt-3 min-h-11 rounded-lg border border-taxpay-border px-3 text-sm font-semibold">{txt('Remove allocation','বরাদ্দ বাদ দিন')}</button>}
        </fieldset>)}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={lines.length>=20||saving} onClick={addLine} className="min-h-11 rounded-lg border border-taxpay-border px-4 font-semibold disabled:opacity-50">{txt('Add beneficiary / category','বরাদ্দ যোগ করুন')}</button>
          <button type="submit" disabled={saving} className="taxpay-guided-primary">{txt('Review payment','পেমেন্ট পর্যালোচনা')} <span aria-hidden="true">→</span></button>
        </div>
        <div className="taxpay-guided-footer">
          <button type="button" className="taxpay-guided-secondary" onClick={()=>setStage(2)}>{txt('Back','পূর্ববর্তী')}</button>
        </div>
      </form>}
      {stage===4&&<div className="taxpay-guided-body">
        <h3>{txt('Review and run simulation','পর্যালোচনা করে সিমুলেশন চালান')}</h3>
        <p>{txt('No money is transferred. Confirm the category, beneficiary, year and amount for each allocation.','অর্থ স্থানান্তর হবে না। প্রতিটি বরাদ্দের খাত, করদাতা, করবর্ষ ও পরিমাণ যাচাই করুন।')}</p>
        <div className="taxpay-guided-review">
          {lines.map((line,index)=><article key={index}>
            <strong>{txt('Allocation','বরাদ্দ')} {index+1}</strong>
            <p>{bn?CATEGORY_LABELS[line.category].bn:CATEGORY_LABELS[line.category].en}</p>
            <p>{line.beneficiary} · {txt('Assessment year','করবর্ষ')} {line.assessmentYear}</p>
            <strong>{formatSimulatedAmount(parseSimulatedAmount(line.amount))}</strong>
          </article>)}
        </div>
        <p className="taxpay-guided-total"><span>{txt('Total simulated amount','মোট সিমুলেটেড অর্থ')}</span>
          <strong>{formatSimulatedAmount(lines.reduce((sum,line)=>sum+parseSimulatedAmount(line.amount),0))}</strong></p>
        <p className="taxpay-guided-safety">{txt('Simulation only. No banking gateway, official challan, Treasury settlement or tax credit.','শুধু সিমুলেশন। ব্যাংকিং গেটওয়ে, সরকারি চালান, ট্রেজারি নিষ্পত্তি বা কর ক্রেডিট নয়।')}</p>
        <div className="taxpay-guided-footer">
          <button type="button" className="taxpay-guided-secondary" disabled={saving} onClick={()=>setStage(3)}>{txt('Back','পূর্ববর্তী')}</button>
          <button type="button" className="taxpay-guided-primary" disabled={saving} onClick={()=>void submit()} >{saving?privateMode?txt('Checking server…','সার্ভার যাচাই চলছে…'):txt('Creating preview…','প্রিভিউ তৈরি হচ্ছে…'):txt('Run payment simulation','পেমেন্ট সিমুলেশন চালান')} <span aria-hidden="true">→</span></button>
        </div>
      </div>}
      {stage===5&&confirmation&&<div className="taxpay-guided-body" role="status" aria-live="polite">
        <div className="taxpay-guided-result-icon" aria-hidden="true">✓</div>
        <h3>{privateMode?txt('Simulation saved successfully','সিমুলেশন সফলভাবে সংরক্ষিত'):txt('Demo preview created','ডেমো প্রিভিউ তৈরি হয়েছে')}</h3>
        <p>{submitMessage}</p>
        <div className="taxpay-guided-information">
          <h4>{txt('Simulation reference','সিমুলেশন রেফারেন্স')}</h4>
          <p className="taxpay-guided-reference">{confirmation.reference}</p>
          <p>{txt('Allocations','বরাদ্দ')}: {confirmation.count}</p>
          <p>{txt('Simulated amount','সিমুলেটেড অর্থ')}: {formatSimulatedAmount(confirmation.totalMinor)}</p>
          <p>{privateMode?txt('Office review may remain pending. This is not a government receipt.','অফিসের পর্যালোচনা অপেক্ষমাণ থাকতে পারে। এটি সরকারি রসিদ নয়।'):txt('Local preview only. Not an Office Management record or a government receipt.','শুধু স্থানীয় প্রিভিউ। অফিস ম্যানেজমেন্টের রেকর্ড বা সরকারি রসিদ নয়।')}</p>
        </div>
        <div className="taxpay-guided-footer">
          <a className="taxpay-guided-secondary" href="#taxpay-guided-history">{txt('View transaction activity','লেনদেনের ইতিহাস দেখুন')}</a>
          <button type="button" className="taxpay-guided-primary" onClick={restart}>{txt('Make another payment','আরেকটি পেমেন্ট করুন')} <span aria-hidden="true">→</span></button>
        </div>
      </div>}
    </section>

<nav id="taxpay-guided-history" className="flex flex-wrap gap-2" aria-label={txt('History perspective','ইতিহাসের ধরন')}>
      {(['beneficiary','payer'] as const).map(mode=><button key={mode} type="button" aria-pressed={view===mode} onClick={()=>setView(mode)}
        className="min-h-11 rounded-lg border border-taxpay-border bg-white px-4 font-semibold text-taxpay-dark">
        {mode==='beneficiary'?txt('Payments allocated to me','আমার হিসাবে বরাদ্দ'):txt('Payments I initiated','আমার শুরু করা পেমেন্ট')}
      </button>)}
    </nav>
    <section className="space-y-3" aria-label={privateMode?txt('Shared SQL transaction history','SQL লেনদেনের ইতিহাস'):txt('Local preview activity','স্থানীয় প্রিভিউ ইতিহাস')}>
      {loading?<p role="status">{txt('Loading shared transactions…','সংযুক্ত লেনদেন লোড হচ্ছে…')}</p>:loadError?<p role="alert">{txt('Could not synchronize transaction history: ','লেনদেনের তথ্য সমন্বয় করা যায়নি: ')}{loadError}</p>:
        rows.length===0?<section className="rounded-xl border border-taxpay-border bg-white p-5"><h2 className="font-bold">{txt('No transactions yet','এখনো কোনো লেনদেন নেই')}</h2><p className="mt-2 text-sm text-taxpay-muted">{txt('Create a local demo preview to populate this activity. Shared SQL and Admin remain unchanged.','স্থানীয় ডেমো প্রিভিউ তৈরি করলে এখানে দেখা যাবে। SQL বা অ্যাডমিনে পরিবর্তন হবে না।')}</p></section>:
        rows.map(tx=><article key={tx.transactionId} className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><h2 className="font-semibold text-taxpay-text">{tx.id} · {tx.state}</h2>
              <p className="text-sm text-taxpay-muted">{txt('Payer','প্রদানকারী')}: {tx.payer} · <time dateTime={tx.createdAt}>{new Date(tx.createdAt).toLocaleString(bn?'bn-BD':'en-GB')}</time></p></div>
            <p className="font-bold tabular-nums text-taxpay-text">{formatSimulatedAmount(tx.allocations.reduce((n,a)=>n+a.amountMinor,0))}</p>
          </div>
          <p className="mt-2 text-sm font-semibold text-taxpay-dark">{privateMode?txt('Office review','অফিস পর্যালোচনা'):txt('Preview state','প্রিভিউ অবস্থা')}: {tx.reviewStatus}</p>
          <p className="mt-2 text-xs text-taxpay-muted">{privateMode?txt('Shared SQL transaction · no Treasury settlement or tax credit','SQL লেনদেন · সরকারি পেমেন্ট বা কর ক্রেডিট নয়'):txt('Local browser preview only · not stored in SQL, no payment or tax credit','শুধু স্থানীয় প্রিভিউ · SQL-এ সংরক্ষিত নয়, পেমেন্ট বা কর ক্রেডিট নয়')}</p>
          <h3 className="mt-4 font-semibold text-taxpay-text">{txt('Allocation details','বরাদ্দের বিবরণ')}</h3>
          <ul className="mt-2 divide-y divide-taxpay-border">{tx.allocations.map(a=><li key={a.id} className="flex justify-between gap-2 py-2 text-sm">
            <div><p>{a.beneficiary} · {a.category.replace(/_/g,' ')}</p><p className="text-taxpay-muted">AY {a.assessmentYear}</p></div>
            <p className="font-semibold tabular-nums">{formatSimulatedAmount(a.amountMinor)}</p></li>)}</ul>
          <details className="mt-3 rounded-lg border border-taxpay-border p-3"><summary className="cursor-pointer font-semibold">{txt('Transaction timeline','লেনদেনের সময়রেখা')}</summary>
            <ol className="mt-2 space-y-2">{tx.events.map(e=><li key={e.id} className="text-sm"><p className="font-semibold">{e.action}</p><p className="text-taxpay-muted"><time dateTime={e.occurredAt}>{new Date(e.occurredAt).toLocaleString()}</time> · {e.note}</p></li>)}</ol>
          </details>
        </article>)}
    </section>
  </main>;
};