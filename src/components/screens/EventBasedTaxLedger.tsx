import {TaxPayDataGrid,TaxPayTableViewport,TaxPayTablePanel,TaxPayTableControls,TaxPayTableFilterToggle,TaxPayActiveFilterChips,TaxPayOfficeRegisterToolbar,TaxPayOfficeRegisterFilters,TaxPayOfficeRegisterFooter} from '../ui/TaxPayDataTable';
import React, {useMemo, useState} from 'react';
import {ArrowRight, Clock3, FileText} from 'lucide-react';
import {TaxPayModal} from '../ui/TaxPayModal';
import type {Language} from '../../types/tax';

/** Read-only event projection. Monetary effects exist only when the source explicitly
 * supplies a tax-account posting; a payment attempt or receipt is not a credit. */
export type TaxAccountEvent = {
  id:string;
  occurredAt:string;
  code:string;
  title:string;
  assessmentYear:string;
  component:string;
  amountMinor:number|null;
  effectMinor:number|null;
  balanceAfterMinor:number|null;
  actor:string;
  source:string;
  taxEventId?:string;
  paymentId?:string;
  challanNo?:string;
  reference?:string;
  status?:string;
  reason?:string;
  linkedReferences?:string[];
};
export type PaymentHistoryMilestone = {
  id:string; title:string; occurredAt:string; actor?:string; source?:string; note?:string;
};
export type PaymentLifecycleRecord = {
  reference:string;
  taxEventId?:string;
  transactionId?:string;
  challanNo?:string;
  payerName?:string;
  payerTin?:string;
  taxpayerName?:string;
  taxpayerTin?:string;
  assessmentYear?:string;
  incomeYear?:string;
  paymentType?:string;
  taxZone?:string;
  taxCircle?:string;
  channel?:string;
  amountMinor:number;
  createdAt:string;
  status:string;
  financialReceiptStatus?:string;
  taxCreditStatus?:string;
  liabilitySettled?:string;
  remainingBalance?:string;
  source?:string;
  events:PaymentHistoryMilestone[];
  allocations?:{id:string; title:string; assessmentYear:string; amountMinor:number}[];
};
const filters = [
  ['all','All'], ['liabilities','Liabilities'], ['credits','Credits'],
  ['payments','Payment lifecycle'], ['corrections','Corrections'], ['refunds','Refunds']
] as const;
export function ledgerEventClass(code:string): typeof filters[number][0] {
  if(/LIABILITY|DEMAND|INTEREST|PENALTY/i.test(code))return 'liabilities';
  if(/REFUND/i.test(code))return 'refunds';
  if(/CORRECTION|ADJUST|DISPUT|REVERSE/i.test(code))return 'corrections';
  if(/CREDIT|WITHHOLD|TDS|AIT|ADVANCE_TAX_PAID/i.test(code))return 'credits';
  return 'payments';
}
const money=(minor:number,language:Language)=>'৳ '+new Intl.NumberFormat(language==='bn'?'bn-BD':'en-BD',{
  minimumFractionDigits:minor%100===0?0:2,maximumFractionDigits:2
}).format(minor/100);
const dateTime=(value:string,language:Language)=>{
  const d=new Date(value);
  return Number.isFinite(d.getTime())
    ? new Intl.DateTimeFormat(language==='bn'?'bn-BD':'en-GB',{dateStyle:'medium',timeStyle:'short'}).format(d)
    : '—';
};
const pair=(en:string,bn:string,language:Language)=>language==='bn'?bn:en;
const unavailable=(language:Language)=>pair('Not available','পাওয়া যায়নি',language);
const Field=({title,value}:{title:string;value:React.ReactNode})=><div className="min-w-0">
  <dt className="text-xs text-taxpay-muted">{title}</dt>
  <dd className="mt-1 break-words text-sm font-medium text-taxpay-text">{value||'—'}</dd>
</div>;
const FactGrid=({children}:{children:React.ReactNode})=><dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>;

export function PaymentLifecycleDetails({record,language}:{record:PaymentLifecycleRecord;language:Language}){
  const t=(en:string,bn:string)=>pair(en,bn,language);
  const stateText=(value?:string)=>{
    if(!value)return t('Not verified','যাচাই হয়নি');
    const known:Record<string,[string,string]>={
      'Not verified':['Not verified','যাচাই হয়নি'],
      'SIMULATED':['Recorded','রেকর্ড হয়েছে'],
      'SIMULATED_SUCCESS':['Payment record saved','পেমেন্ট রেকর্ড সংরক্ষিত'],
      'POSTED':['Recorded','রেকর্ড হয়েছে'],
      'PENDING':['Pending','অপেক্ষমাণ'],
      'FAILED':['Failed','ব্যর্থ'],
      'REVERSED':['Reversed','প্রত্যাবর্তিত'],
      'DISPUTED':['Disputed','বিরোধপূর্ণ']
    };
    return known[value]?t(...known[value]):value;
  };
  return <div className="space-y-4 text-taxpay-text" data-testid="payment-lifecycle-details">
    <section className="rounded-xl border border-taxpay-border bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div><p className="text-xs text-taxpay-muted">{t('Payment record','পেমেন্ট রেকর্ড')}</p>
          <h2 className="mt-1 break-all text-base font-semibold">{record.reference}</h2></div>
        <strong className="text-xl tabular-nums">{money(record.amountMinor,language)}</strong>
      </div>
      <h3 className="mb-3 text-sm font-semibold">{t('Payment identity','পেমেন্ট পরিচিতি')}</h3>
      <FactGrid>
        <Field title={t('Tax event ID','কর ঘটনার আইডি')} value={record.taxEventId||unavailable(language)}/>
        <Field title={t('Payment transaction ID','পেমেন্ট লেনদেন আইডি')} value={record.transactionId||unavailable(language)}/>
        <Field title={t('Challan / receipt no.','চালান / রসিদ নম্বর')} value={record.challanNo||unavailable(language)}/>
      </FactGrid>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-taxpay-muted">{t('Financial receipt status','আর্থিক রসিদের অবস্থা')}</p><p className="mt-1 text-sm font-semibold">{stateText(record.financialReceiptStatus)}</p></div>
        <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-taxpay-muted">{t('Tax-credit status','কর ক্রেডিটের অবস্থা')}</p><p className="mt-1 text-sm font-semibold">{stateText(record.taxCreditStatus)}</p></div>
      </div>
    </section>
    <section className="rounded-xl border border-taxpay-border bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold">{t('Payer & taxpayer','পরিশোধকারী ও করদাতা')}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-taxpay-border p-3"><p className="text-xs text-taxpay-muted">{t('Payer','পরিশোধকারী')}</p><p className="mt-1 font-semibold">{record.payerName||unavailable(language)}</p><p className="break-all text-xs text-taxpay-muted">{t('TIN','টিআইএন')}: {record.payerTin||'—'}</p></div>
        <div className="rounded-lg border border-taxpay-border p-3"><p className="text-xs text-taxpay-muted">{t('Taxpayer','করদাতা')}</p><p className="mt-1 font-semibold">{record.taxpayerName||unavailable(language)}</p><p className="break-all text-xs text-taxpay-muted">{t('TIN','টিআইএন')}: {record.taxpayerTin||'—'}</p></div>
      </div>
      <FactGrid>
        <Field title={t('Assessment year','করবর্ষ')} value={record.assessmentYear}/>
        <Field title={t('Income year','আয়বর্ষ')} value={record.incomeYear||unavailable(language)}/>
        <Field title={t('Payment type','পেমেন্টের ধরন')} value={record.paymentType}/>
        <Field title={t('Tax zone','কর অঞ্চল')} value={record.taxZone||unavailable(language)}/>
        <Field title={t('Tax circle','কর সার্কেল')} value={record.taxCircle||unavailable(language)}/>
        <Field title={t('Payment channel','পেমেন্ট মাধ্যম')} value={record.channel||unavailable(language)}/>
        <Field title={t('Date','তারিখ')} value={dateTime(record.createdAt,language)}/>
        <Field title={t('Current status','বর্তমান অবস্থা')} value={stateText(record.status)}/>
      </FactGrid>
    </section>
    {Boolean(record.allocations?.length)&&<section className="rounded-xl border border-taxpay-border bg-white p-4">
      <h3 className="mb-2 text-sm font-semibold">{t('Taxpayer allocations','করদাতা অনুযায়ী বরাদ্দ')}</h3>
      <ul className="divide-y divide-taxpay-border">{record.allocations!.map(a=><li key={a.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
        <span>{a.title} · {a.assessmentYear}</span><strong className="tabular-nums">{money(a.amountMinor,language)}</strong>
      </li>)}</ul>
    </section>}
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-taxpay-border bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold">{t('Payment lifecycle','পেমেন্টের ধাপসমূহ')}</h3>
        <ol className="space-y-3">{record.events.length?record.events.map(e=><li key={e.id} className="border-l-2 border-taxpay-primary py-1 pl-3 text-sm">
          <p className="font-semibold">{e.title}</p><p className="text-xs text-taxpay-muted">{dateTime(e.occurredAt,language)}</p>
          {e.note&&<p className="mt-1 text-xs text-taxpay-muted">{e.note}</p>}
        </li>):<li className="text-sm text-taxpay-muted">{t('No lifecycle events recorded.','কোনো পেমেন্ট ধাপ পাওয়া যায়নি।')}</li>}</ol>
      </section>
      <section className="rounded-xl border border-taxpay-border bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold">{t('Activity history','কার্যক্রমের ইতিহাস')}</h3>
        {record.events.length?<ol className="space-y-3">{record.events.map(e=><li key={e.id} className="text-sm">
          <p className="font-medium">{e.title}</p>
          <p className="text-xs text-taxpay-muted">{e.actor||t('Actor unavailable','কার্যকারী অনুপস্থিত')} · {e.source||record.source||t('Source unavailable','উৎস পাওয়া যায়নি')}</p>
          <p className="text-xs text-taxpay-muted">{dateTime(e.occurredAt,language)}</p>
        </li>)}</ol>:<p className="text-sm text-taxpay-muted">{t('No recorded history.','কোনো ইতিহাস নেই।')}</p>}
      </section>
    </div>
    <section className="rounded-xl border border-taxpay-border bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold">{t('Tax treatment','কর সমন্বয়')}</h3>
      <FactGrid>
        <Field title={t('Liability settled','নিষ্পত্তিকৃত করদায়')} value={stateText(record.liabilitySettled)}/>
        <Field title={t('Tax credit','কর ক্রেডিট')} value={stateText(record.taxCreditStatus)}/>
        <Field title={t('Remaining balance','অবশিষ্ট ব্যালেন্স')} value={stateText(record.remainingBalance)}/>
      </FactGrid>
      <h3 className="mb-2 mt-4 text-sm font-semibold">{t('Where this payment counts','এই পেমেন্ট কোথায় গণনা হয়')}</h3>
      <p className="text-sm text-taxpay-muted">{t('A saved payment record is separate from Treasury settlement and tax-ledger credit. Credit is shown only when verified source events establish it.',
        'সংরক্ষিত পেমেন্ট, ট্রেজারি নিষ্পত্তি ও কর লেজারের ক্রেডিট পৃথক। যাচাইকৃত উৎসে নিশ্চিত হলেই ক্রেডিট দেখানো হয়।')}</p>
    </section>
  </div>;
}

export function EventBasedTaxLedger({events,language,year,onYearChange,financialBalanceVerified=false,showRecordedScenarioBalance=false,onOpenPayment}:{
  events:readonly TaxAccountEvent[];language:Language;year?:string;
  onYearChange?:(year:string)=>void;financialBalanceVerified?:boolean;showRecordedScenarioBalance?:boolean;onOpenPayment?:(paymentId:string)=>void;
}){
  const t=(en:string,bn:string)=>pair(en,bn,language);
  const [selectedYear,setSelectedYear]=useState('all');
  const [type,setType]=useState<typeof filters[number][0]>('all');
  const [ledgerFiltersExpanded,setLedgerFiltersExpanded]=useState(false);
  const [ledgerSearch,setLedgerSearch]=useState('');
  const [selected,setSelected]=useState<TaxAccountEvent|null>(null);
  const allYears=useMemo(()=>[...new Set(events.map(e=>e.assessmentYear))].filter(Boolean).sort().reverse(),[events]);
  const currentYear=year??selectedYear;
  const visible=useMemo(()=>events.filter(e=>(currentYear==='all'||e.assessmentYear===currentYear)
    &&(type==='all'||ledgerEventClass(e.code)===type)
    &&(!ledgerSearch.trim()||(e.title+' '+e.reference+' '+e.taxEventId+' '+e.id+' '+e.component+' '+e.source)
      .toLocaleLowerCase().includes(ledgerSearch.trim().toLocaleLowerCase())))
    .sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)||b.id.localeCompare(a.id)),[events,currentYear,type,ledgerSearch]);
  const canShowBalance=financialBalanceVerified||showRecordedScenarioBalance;
  const balance=canShowBalance&&currentYear!=='all'
    ? events.filter(e=>e.assessmentYear===currentYear&&e.balanceAfterMinor!==null)
      .sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt))[0]?.balanceAfterMinor??null
    : null;
  return <section className="space-y-4" data-testid="event-tax-ledger">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-sm text-taxpay-muted">{t('Recorded ledger activity','নথিভুক্ত লেজার কার্যক্রম')}</p>
        <p className="mt-1 text-xs text-taxpay-muted">{t('A payment record alone does not confirm a tax credit.','শুধু পেমেন্ট রেকর্ড থাকলেই কর ক্রেডিট নিশ্চিত হয় না।')}</p></div>
      <div className="rounded-xl border border-taxpay-border bg-white p-3 text-right">
        <p className="text-xs text-taxpay-muted">{showRecordedScenarioBalance?t('Calculated balance for selected year','নির্বাচিত করবর্ষের হিসাবকৃত ব্যালেন্স'):t('Balance after eligible entries','যোগ্য এন্ট্রির পর ব্যালেন্স')}</p>
        <p className="mt-1 text-xl font-semibold tabular-nums">{balance===null?t('Not verified','যাচাই হয়নি'):money(balance,language)}</p>
        <p className="text-xs text-taxpay-muted">{visible.length} {t('events','ঘটনা')}</p>
      </div>
    </div>
    <TaxPayOfficeRegisterToolbar title={t('Tax event register','কর ঘটনার তালিকা')}
      count={visible.length} total={events.length} countLabel={t('records','রেকর্ড')}
      searchValue={ledgerSearch} onSearchChange={setLedgerSearch}
      searchLabel={t('Search ledger events','লেজারের ঘটনা খুঁজুন')}
      searchPlaceholder={t('Search event or reference','ঘটনা বা রেফারেন্স খুঁজুন')}
      filterLabel={t('Filter','ফিল্টার')} filtersOpen={ledgerFiltersExpanded}
      onToggleFilters={()=>setLedgerFiltersExpanded(open=>!open)}/>
    <TaxPayTableControls className="taxpay-table-toolbar taxpay-table-filters">
      <nav className="taxpay-table-tabs flex max-w-full gap-2 overflow-x-auto" aria-label={t('Event categories','ঘটনার শ্রেণি')}>
        {filters.map(([key,label])=><button type="button" key={key} aria-pressed={type===key} onClick={()=>setType(key)}
          className={'min-h-10 shrink-0 rounded-full border px-3 text-xs font-medium '+(type===key?'border-taxpay-primary bg-taxpay-primary text-white':'border-taxpay-border bg-white text-taxpay-text')}>
          {language==='bn'?({all:'সব',liabilities:'দায়',credits:'ক্রেডিট',payments:'পেমেন্টের ধাপ',corrections:'সংশোধন',refunds:'ফেরত'} as Record<string,string>)[key]:label}
        </button>)}
      </nav>
    </TaxPayTableControls>
    <TaxPayOfficeRegisterFilters open={ledgerFiltersExpanded}>
      <label className="flex items-center gap-2 text-xs text-taxpay-muted">
        {t('Assessment year','করবর্ষ')}
        <select aria-label={t('Filter ledger by year','করবর্ষ অনুযায়ী লেজার')}
          value={currentYear} onChange={e=>onYearChange?onYearChange(e.target.value):setSelectedYear(e.target.value)}
          className="min-h-10 rounded-lg border border-taxpay-border bg-white px-3 text-sm text-taxpay-text">
          <option value="all">{t('All years','সব করবর্ষ')}</option>
          {allYears.map(y=><option key={y} value={y}>{y}</option>)}
        </select>
      </label>
    </TaxPayOfficeRegisterFilters>
    <TaxPayActiveFilterChips clearLabel={t('Clear all','সব ফিল্টার মুছুন')}
      onClear={()=>{setType('all');setLedgerSearch('');onYearChange?onYearChange('all'):setSelectedYear('all');}}
      filters={[
        ...(ledgerSearch.trim()?[{key:'search',label:t('Search: ','অনুসন্ধান: ')+ledgerSearch.trim(),onRemove:()=>setLedgerSearch('')}]:[]),
        ...(type!=='all'?[{key:'type',label:language==='bn'?({liabilities:'দায়',credits:'ক্রেডিট',payments:'পেমেন্টের ধাপ',corrections:'সংশোধন',refunds:'ফেরত'} as Record<string,string>)[type]:filters.find(([key])=>key===type)?.[1]??type,onRemove:()=>setType('all')}]:[]),
        ...(currentYear!=='all'?[{key:'year',label:currentYear,onRemove:()=>onYearChange?onYearChange('all'):setSelectedYear('all')}]:[])
      ]}/>
    <TaxPayTablePanel className="taxpay-ledger-records">
    <TaxPayTableViewport>
      {visible.length===0&&<p role="status" className="taxpay-table-state p-6 text-sm text-taxpay-muted">{t('No recorded events match the selected filters.','নির্বাচিত ফিল্টারে কোনো ঘটনা পাওয়া যায়নি।')}</p>}
        {(events.length===0||visible.length>0)&&<TaxPayDataGrid variant="ledger" rows={visible} getRowKey={e=>e.id}
          testId="event-ledger-table" ariaLabel={t('Tax event ledger','কর ঘটনার লেজার')}
          columns={[
            {key:'date',header:t('Date / time','তারিখ / সময়'),cellClassName:'whitespace-nowrap',renderCell:e=>dateTime(e.occurredAt,language)},
            {key:'event',header:t('Event','ঘটনা'),renderCell:e=><button type="button" onClick={()=>setSelected(e)} className="text-left font-semibold text-taxpay-dark underline-offset-2 hover:underline focus-visible:underline">
              {e.title}<span className="mt-1 block break-all text-[11px] font-normal text-taxpay-muted">{e.code.replaceAll('_',' ')}</span><span className="mt-1 block break-all text-[11px] font-normal text-taxpay-muted">{e.reference||'—'}</span></button>},
            {key:'year',header:t('Year · component','বর্ষ · খাত'),renderCell:e=><>{e.assessmentYear}<span className="block text-taxpay-muted">{e.component}</span></>},
            {key:'particulars',header:t('Description / tax head','বিবরণ / কর খাত'),renderCell:e=><>{e.title}<span className="block text-taxpay-muted">{e.component}</span></>},
            {key:'debit',header:t('Debit (liability)','ডেবিট (দায়)'),headerClassName:'text-right',cellClassName:'whitespace-nowrap text-right tabular-nums',renderCell:e=>e.effectMinor!==null&&e.effectMinor>0?money(e.effectMinor,language):'—'},
            {key:'credit',header:t('Credit (payment)','ক্রেডিট (পরিশোধ)'),headerClassName:'text-right',cellClassName:'whitespace-nowrap text-right tabular-nums',renderCell:e=>e.effectMinor!==null&&e.effectMinor<0?money(-e.effectMinor,language):'—'},
            {key:'effect',header:t('Effect','প্রভাব'),headerClassName:'text-right',cellClassName:'whitespace-nowrap text-right tabular-nums',renderCell:e=>e.effectMinor===null?'—':(e.effectMinor>0?'+':'−')+money(Math.abs(e.effectMinor),language)},
            {key:'balance',header:t('Balance after','পরবর্তী ব্যালেন্স'),headerClassName:'text-right',cellClassName:'whitespace-nowrap text-right font-semibold tabular-nums',renderCell:e=>canShowBalance&&e.balanceAfterMinor!==null?money(e.balanceAfterMinor,language):'—'},
            {key:'actor',header:t('Actor · source','কার্যকারী · উৎস'),renderCell:e=><>{e.actor}<span className="block text-taxpay-muted">{e.source}</span></>},
            {key:'taxEvent',header:t('Tax event','কর ঘটনা'),cellClassName:'break-all font-mono',renderCell:e=>e.taxEventId||e.id}
          ]}
          renderMobileCard={e=><button type="button" onClick={()=>setSelected(e)} className="flex min-h-11 w-full flex-col gap-2 rounded-lg p-0 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-taxpay-primary">
            <span className="flex w-full items-center justify-between gap-2"><strong className="text-base">{e.title}</strong><ArrowRight aria-hidden="true" size={16}/></span>
            <span className="text-sm text-taxpay-muted">{dateTime(e.occurredAt,language)} · {e.assessmentYear} · {e.component}</span>
            <span className="break-all text-sm">{e.reference||e.taxEventId||e.id}</span>
            <span className="grid w-full grid-cols-2 gap-x-4 gap-y-2 border-t border-taxpay-border pt-2">
              <span className="min-w-0"><span className="block text-sm text-taxpay-muted">{t('Recorded amount','নথিভুক্ত পরিমাণ')}</span>
                <strong className="block break-words text-sm tabular-nums">{e.amountMinor===null?t('Not recorded','নথিভুক্ত নয়'):money(e.amountMinor,language)}</strong></span>
              <span className="min-w-0"><span className="block text-sm text-taxpay-muted">{t('Effect on balance','ব্যালেন্সের প্রভাব')}</span>
                <strong className="block break-words text-sm tabular-nums">{e.effectMinor===null?t('Not verified','যাচাই হয়নি'):(e.effectMinor>0?'+':e.effectMinor<0?'−':'')+money(Math.abs(e.effectMinor),language)}</strong></span>
              <span className="min-w-0"><span className="block text-sm text-taxpay-muted">{showRecordedScenarioBalance?t('Calculated balance after','হিসাবকৃত পরবর্তী ব্যালেন্স'):t('Balance after','পরবর্তী ব্যালেন্স')}</span>
                <strong className="block break-words text-sm tabular-nums">{canShowBalance&&e.balanceAfterMinor!==null?money(e.balanceAfterMinor,language):t('Not verified','যাচাই হয়নি')}</strong></span>
              <span className="min-w-0"><span className="block text-sm text-taxpay-muted">{t('Recorded status','নথিভুক্ত অবস্থা')}</span>
                <strong className="block break-words text-sm">{e.status||t('Not recorded','নথিভুক্ত নয়')}</strong></span>
            </span>
            <span className="w-full break-words text-sm text-taxpay-muted">{t('Source','উৎস')}: {e.source}</span>
          </button>}/>}

    </TaxPayTableViewport>
    </TaxPayTablePanel>
    <TaxPayOfficeRegisterFooter shown={visible.length} total={events.length}
      labels={{showing:t('Showing','দেখানো হচ্ছে'),of:t('of','মোট'),records:t('records','রেকর্ড')}}/>
    {selected&&<TaxPayModal title={selected.title} onClose={()=>setSelected(null)} hideFooter className="taxpayer-transaction-detail">
      <section className="space-y-4 p-1" data-testid="tax-event-details">
        <div className="flex items-center gap-2 text-xs text-taxpay-muted"><Clock3 size={16}/>{dateTime(selected.occurredAt,language)}</div>
        <p className="rounded-lg border border-taxpay-border bg-taxpay-light p-3 text-sm">{t('Ledger events retain their recorded source; corrections must be added as linked events.','লেজারের মূল ঘটনাটি অপরিবর্তিত থাকে; সংশোধন নতুন সংযুক্ত ঘটনা হিসেবে যোগ হয়।')}</p>
        <FactGrid>
          <Field title={t('Ledger entry ID','লেজার এন্ট্রি আইডি')} value={selected.id}/>
          <Field title={t('Tax event ID','কর ঘটনার আইডি')} value={selected.taxEventId||unavailable(language)}/>
          <Field title={t('Timestamp','সময়')} value={dateTime(selected.occurredAt,language)}/>
          <Field title={t('Effect on balance','ব্যালেন্সের প্রভাব')} value={selected.effectMinor===null?t('None confirmed','নিশ্চিত নয়'):money(selected.effectMinor,language)}/>
          <Field title={t('Actor','কার্যকারী')} value={selected.actor}/>
          <Field title={t('Source system','উৎস সিস্টেম')} value={selected.source}/>
          <Field title={t('Year · component','বর্ষ · খাত')} value={selected.assessmentYear+' · '+selected.component}/>
          <Field title={t('Amount','পরিমাণ')} value={selected.amountMinor===null?'—':money(selected.amountMinor,language)}/>
          <Field title={t('Payment transaction','পেমেন্ট লেনদেন')} value={selected.paymentId||unavailable(language)}/>
          <Field title={t('Challan','চালান')} value={selected.challanNo||unavailable(language)}/>
          <Field title={t('Reference','রেফারেন্স')} value={selected.reference||'—'}/>
          <Field title={t('Status','অবস্থা')} value={selected.status||'—'}/>
        </FactGrid>
        {selected.reason&&<p className="text-sm text-taxpay-muted">{selected.reason}</p>}
        {selected.linkedReferences?.length?<div className="text-sm"><h3 className="mb-1 font-semibold">{t('Related references','সংযুক্ত রেফারেন্স')}</h3>
          <p className="break-all text-taxpay-muted">{selected.linkedReferences.join(' · ')}</p></div>:null}
        {onOpenPayment&&selected.paymentId&&<button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-taxpay-primary px-4 text-sm font-semibold text-white"
          onClick={()=>{const id=selected.paymentId!;setSelected(null);onOpenPayment(id);}}>
          <FileText size={16}/>{t('Open payment','পেমেন্ট দেখুন')}<ArrowRight size={15}/></button>}
      </section>
    </TaxPayModal>}
  </section>;
}
