import React,{useEffect,useMemo,useState} from 'react';
import {ArrowLeft,CalendarDays,CreditCard,FileText,RefreshCw} from 'lucide-react';
import type {SimulationUser} from '../../contracts/paymentSimulationContract';
import type {Beneficiary} from '../../services/beneficiaries';
import {beneficiaryNameForDisplay} from '../../services/beneficiaryNames';
import {beneficiaryFinalTagLabel} from '../../services/beneficiaryTags';
import {loadBeneficiaryProfilePayments,countsTowardBeneficiaryPaidTotal,type BeneficiaryProfilePayment} from '../../services/beneficiaryProfileHistory';
import {formatCurrency,formatNumber} from '../../services/numberFormat';
import {UiButton} from '../ui/Controls';
import {TaxPayModal} from '../ui/TaxPayModal';
import {ReceiptView} from '../common/ReceiptView';

type Props={
  person:Beneficiary;ownerUid:string|null;previewId:SimulationUser|null;
  language:'en'|'bn';onBack:()=>void;onMakePayment:()=>void;backToActivity?:boolean;
};
const paymentStatus=(status:BeneficiaryProfilePayment['status'],bn:boolean)=>
  status==='SIMULATED_SUCCESS'||status==='SIMULATED'
    ?(bn?'নথিভুক্ত':'Recorded')
    :status==='PENDING'?(bn?'অপেক্ষমাণ':'Pending')
    :status==='FAILED'?(bn?'ব্যর্থ':'Failed'):(bn?'বাতিল / ফেরত':'Reversed');

export const BeneficiaryProfile:React.FC<Props>=({person,ownerUid,previewId,language,onBack,onMakePayment,backToActivity=false})=>{
  const bn=language==='bn';
  const tr=(en:string,bengali:string)=>bn?bengali:en;
  const [snapshot,setSnapshot]=useState<{identity:string;state:'loading'|'ready'|'error';rows:BeneficiaryProfilePayment[]}>({
    identity:'',state:'loading',rows:[]
  });
  const [revision,setRevision]=useState(0);
  const [search,setSearch]=useState('');
  const [year,setYear]=useState('all');
  const [head,setHead]=useState('all');
  const [status,setStatus]=useState('all');
  const [selected,setSelected]=useState<BeneficiaryProfilePayment|null>(null);
  const identity=(ownerUid??previewId??'')+':'+person.id+':'+person.tin;
  useEffect(()=>{
    let active=true;
    setSnapshot({identity,state:'loading',rows:[]});setSelected(null);
    void loadBeneficiaryProfilePayments(person.tin,ownerUid,previewId,language).then(rows=>{
      if(active)setSnapshot({identity,state:'ready',rows});
    }).catch(()=>{
      if(active)setSnapshot({identity,state:'error',rows:[]});
    });
    return()=>{active=false;};
  },[identity,ownerUid,previewId,language,revision]);
  const state=snapshot.identity===identity?snapshot:{identity,state:'loading' as const,rows:[]};
  const paidRows=useMemo(()=>state.rows.filter(countsTowardBeneficiaryPaidTotal),[state.rows]);
  const years=useMemo(()=>Array.from(new Set(state.rows.map(row=>row.assessmentYear))).sort().reverse(),[state.rows]);
  const heads=useMemo(()=>Array.from(new Set(state.rows.map(row=>row.paymentHead))).sort(),[state.rows]);
  const filtered=useMemo(()=>state.rows.filter(row=>
    (year==='all'||row.assessmentYear===year)&&
    (head==='all'||row.paymentHead===head)&&
    (status==='all'||(status==='recorded'?countsTowardBeneficiaryPaidTotal(row):row.status===status))&&
    (!search.trim()||[row.paymentId,row.transactionId,row.assessmentYear,row.paymentHead].some(
      value=>value.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())))
  ),[state.rows,search,year,head,status]);
  const totalMinor=paidRows.reduce((total,row)=>total+BigInt(row.amountMinor),0n);
  const totalMoney=totalMinor<=BigInt(Number.MAX_SAFE_INTEGER)
    ?formatCurrency(Number(totalMinor)/100,language):tr('Amount unavailable','পরিমাণ পাওয়া যায়নি');
  const uniqueTransactions=new Set(paidRows.map(row=>row.transactionId)).size;
  const paidYears=new Set(paidRows.map(row=>row.assessmentYear)).size;
  const paidHeads=new Set(paidRows.map(row=>row.paymentHead)).size;
  const name=beneficiaryNameForDisplay(person.display_name,tr('Name not provided','নাম দেওয়া হয়নি'));
  const tag=beneficiaryFinalTagLabel(person.tag,person.relationship,language,person.other_label);
  const date=(value:string)=>Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat(bn?'bn-BD':'en-GB',
    {day:'2-digit',month:'short',year:'numeric'}).format(new Date(value)):'—';
  // A timeline is ordered by the date the payer actually made the payment.
  // Assessment years remain separate allocation metadata and filter values.
  const calendarYear=(value:string)=>Number.isFinite(Date.parse(value))?
    String(new Date(value).getUTCFullYear()):tr('Date unknown','তারিখ অজানা');
  const groups=[...new Set(filtered.map(row=>calendarYear(row.createdAt)))];
  return <section lang={language} aria-labelledby="beneficiary-profile-title" data-testid="beneficiary-profile"
    className="mx-auto w-full max-w-7xl space-y-5">
    <div>
      <UiButton type="button" variant="quiet" className="gap-2" onClick={onBack}>
        <ArrowLeft size={17} aria-hidden="true"/>{backToActivity
          ?tr('Back to activity','লেনদেনের তালিকায় ফিরুন')
          :tr('Back to beneficiaries','উপকারভোগীর তালিকায় ফিরুন')}
      </UiButton>
    </div>
    <header className="rounded-xl border border-taxpay-border bg-taxpay-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-taxpay-muted">{tr('Beneficiary profile','উপকারভোগীর প্রোফাইল')}</p>
          <h1 id="beneficiary-profile-title" className="mt-1 break-words text-2xl font-bold text-taxpay-text sm:text-3xl">{name}</h1>
          {tag&&<p className="mt-1 text-sm text-taxpay-muted">{tag}</p>}
          <p className="mt-1 break-all text-sm tabular-nums text-taxpay-muted">{person.tin}</p>
        </div>
        <UiButton type="button" variant="primary" className="gap-2" onClick={onMakePayment}>
          <CreditCard size={17} aria-hidden="true"/>{tr('Make payment','পেমেন্ট করুন')}
        </UiButton>
      </div>
      <p className="mt-3 text-sm text-taxpay-muted">
        {tr('Only payments made by your account for this saved TIN are shown. Amounts reflect recorded TaxPay simulations, not verified government tax credits.',
        'এই সংরক্ষিত টিআইএনের জন্য আপনার অ্যাকাউন্ট থেকে করা পেমেন্ট দেখানো হয়েছে। পরিমাণগুলো করবৃত্তের নথিভুক্ত সিমুলেশন, সরকারি কর জমার প্রমাণ নয়।')}
      </p>
    </header>
    {state.state==='loading'&&<p role="status" className="rounded-xl border border-taxpay-border bg-white p-5 text-sm text-taxpay-muted">
      {tr('Loading beneficiary payment history…','উপকারভোগীর পেমেন্ট ইতিহাস লোড হচ্ছে…')}</p>}
    {state.state==='error'&&<div role="alert" className="rounded-xl border border-taxpay-border bg-white p-5">
      <p className="text-sm text-taxpay-error">{tr('This beneficiary’s payment history could not be verified. No partial totals are shown.',
      'এই উপকারভোগীর পেমেন্ট ইতিহাস যাচাই করা যায়নি। অসম্পূর্ণ মোট দেখানো হচ্ছে না।')}</p>
      <UiButton type="button" variant="outline" className="mt-3 gap-2" onClick={()=>setRevision(value=>value+1)}>
        <RefreshCw size={16} aria-hidden="true"/>{tr('Try again','আবার চেষ্টা করুন')}</UiButton>
    </div>}
    {state.state==='ready'&&<>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={tr('Payment overview','পেমেন্টের সারসংক্ষেপ')}>
        {[
          {label:tr('Total recorded','মোট নথিভুক্ত'),value:totalMoney},
          {label:tr('Transactions','লেনদেন'),value:formatNumber(uniqueTransactions,language)},
          {label:tr('Assessment years','করবর্ষ'),value:formatNumber(paidYears,language)},
          {label:tr('Tax heads','করের খাত'),value:formatNumber(paidHeads,language)}
        ].map(item=><div key={item.label} className="rounded-xl border border-taxpay-border bg-white p-4">
          <p className="text-sm text-taxpay-muted">{item.label}</p>
          <p className="mt-2 break-words text-xl font-semibold tabular-nums text-taxpay-text">{item.value}</p>
        </div>)}
      </div>
      <section aria-label={tr('Beneficiary payment timeline','উপকারভোগীর পেমেন্ট সময়রেখা')}
        className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-taxpay-text">{tr('Payment timeline','পেমেন্টের সময়রেখা')}</h2>
          <span className="text-sm text-taxpay-muted">{formatNumber(filtered.length,language)} {tr('entries · newest first','রেকর্ড · সর্বশেষ আগে')}</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm text-taxpay-text">{tr('Search','অনুসন্ধান')}
            <input type="search" value={search} onChange={e=>setSearch(e.target.value)}
              placeholder={tr('Head or reference','খাত বা রেফারেন্স')}
              className="mt-1 min-h-11 w-full rounded-lg border border-taxpay-border bg-white px-3 text-sm"/>
          </label>
          <label className="text-sm text-taxpay-text">{tr('Assessment year','করবর্ষ')}
            <select value={year} onChange={e=>setYear(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border border-taxpay-border bg-white px-3 text-sm">
              <option value="all">{tr('All years','সব করবর্ষ')}</option>
              {years.map(item=><option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm text-taxpay-text">{tr('Tax head','করের খাত')}
            <select value={head} onChange={e=>setHead(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border border-taxpay-border bg-white px-3 text-sm">
              <option value="all">{tr('All tax heads','সব করের খাত')}</option>
              {heads.map(item=><option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm text-taxpay-text">{tr('Status','অবস্থা')}
            <select value={status} onChange={e=>setStatus(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border border-taxpay-border bg-white px-3 text-sm">
              <option value="all">{tr('All statuses','সব অবস্থা')}</option>
              <option value="recorded">{tr('Recorded','নথিভুক্ত')}</option>
              <option value="PENDING">{tr('Pending','অপেক্ষমাণ')}</option>
              <option value="FAILED">{tr('Failed','ব্যর্থ')}</option>
              <option value="REVERSED">{tr('Reversed','বাতিল / ফেরত')}</option>
            </select>
          </label>
        </div>
        {state.rows.length===0&&<p data-testid="beneficiary-profile-empty" className="mt-5 rounded-lg border border-dashed border-taxpay-border p-5 text-sm text-taxpay-muted">
          {tr('No payment history yet for this beneficiary from your account.','আপনার অ্যাকাউন্ট থেকে এই উপকারভোগীর জন্য এখনো কোনো পেমেন্টের ইতিহাস নেই।')}
        </p>}
        {state.rows.length>0&&filtered.length===0&&<div className="mt-5 rounded-lg border border-taxpay-border p-5 text-sm text-taxpay-muted">
          {tr('No payments match these filters.','এই ফিল্টারে কোনো পেমেন্ট নেই।')}
          <UiButton type="button" variant="quiet" onClick={()=>{setSearch('');setYear('all');setHead('all');setStatus('all');}}>
            {tr('Clear filters','ফিল্টার মুছুন')}</UiButton>
        </div>}
        {groups.map(item=>{
          const entries=filtered.filter(row=>calendarYear(row.createdAt)===item);
          const yearTotal=entries.filter(countsTowardBeneficiaryPaidTotal)
            .reduce((sum,row)=>sum+row.amountMinor,0);
          return <div key={item} className="mt-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-taxpay-border pb-2">
              <h3 className="font-semibold text-taxpay-text">{item} · {tr('Payment date','পেমেন্টের তারিখ')}</h3>
              <span className="text-sm tabular-nums text-taxpay-muted">
                {tr('Recorded','নথিভুক্ত')}: {formatCurrency(yearTotal/100,language)}
              </span>
            </div>
            <ol className="relative ms-2 mt-4 space-y-3 border-s-2 border-taxpay-primary/30 ps-5"
              data-testid="beneficiary-chronological-timeline">
              {entries.map(row=><li key={row.key} className="relative rounded-lg border border-taxpay-border p-3 sm:p-4">
                <span aria-hidden="true" className="absolute -start-[29px] top-4 h-3 w-3 rounded-full border-2 border-white bg-taxpay-primary"/>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-taxpay-text">{row.paymentHead}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-taxpay-muted">
                      <CalendarDays size={14} aria-hidden="true"/><time dateTime={row.createdAt}>{date(row.createdAt)}</time> · {paymentStatus(row.status,bn)}
                    </p>
                    <p className="mt-1 text-xs text-taxpay-muted">{tr('Assessment year','করবর্ষ')}: {row.assessmentYear}</p>
                    <p className="mt-1 break-all text-xs text-taxpay-muted">
                      {tr('Reference','রেফারেন্স')}: {row.transactionId}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums text-taxpay-text">{formatCurrency(row.amountMinor/100,language)}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <UiButton type="button" variant="outline" className="gap-2"
                    onClick={()=>setSelected(row)}><FileText size={16} aria-hidden="true"/>
                    {row.receipt?tr('View original record','মূল রেকর্ড দেখুন'):tr('View details','বিস্তারিত দেখুন')}
                  </UiButton>
                </div>
              </li>)}
            </ol>
          </div>;
        })}
      </section>
    </>}
    {selected&&<TaxPayModal title={tr('Payment details','পেমেন্টের বিবরণ')} service="status"
      className="receipt-modal" onClose={()=>setSelected(null)} footer={<></>}>
      {selected.receipt?<>
        {selected.batchId&&<p className="mb-3 text-sm text-taxpay-muted">
          {tr('This allocation belongs to an original combined transaction. It is not a separate payment.',
          'এই বরাদ্দটি মূল সমন্বিত লেনদেনের অংশ; এটি আলাদা পেমেন্ট নয়।')} {selected.batchId}
        </p>}
        <ReceiptView receipt={selected.receipt} embedded/>
      </>:<div className="space-y-3 text-sm text-taxpay-text">
        <p>{tr('This is recorded simulator activity, not an official payment receipt.',
          'এটি সিমুলেটরে নথিভুক্ত কার্যক্রম, সরকারি পেমেন্ট রসিদ নয়।')}</p>
        <p>{tr('Head','খাত')}: {selected.paymentHead}</p>
        <p>{tr('Assessment year','করবর্ষ')}: {selected.assessmentYear}</p>
        <p>{tr('Status','অবস্থা')}: {paymentStatus(selected.status,bn)}</p>
        <p className="break-all">{tr('Transaction','লেনদেন')}: {selected.transactionId}</p>
        <p>{tr('Amount','পরিমাণ')}: {formatCurrency(selected.amountMinor/100,language)}</p>
      </div>}
    </TaxPayModal>}
  </section>;
};
