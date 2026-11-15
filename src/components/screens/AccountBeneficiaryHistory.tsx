import {TaxPayDataGrid,TaxPayTableState,TaxPayOfficeRegisterToolbar,TaxPayOfficeRegisterFilters,TaxPayOfficeRegisterFooter,TaxPayActiveFilterChips} from '../ui/TaxPayDataTable';
import React, { useEffect, useMemo, useState } from 'react';
import { Search, FileText, Download, UserPlus } from 'lucide-react';
import { getAccountStoryPayments, beneficiaryPaymentEntries, type BeneficiaryPaymentEntry } from '../../services/story1AccountPaymentHistory';
import { formatCurrency } from '../../services/numberFormat';
import {loadBeneficiaries,type Beneficiary} from '../../services/beneficiaries';
import {beneficiaryFinalTagLabel} from '../../services/beneficiaryTags';
import {beneficiaryNameForDisplay,beneficiaryNameForPrefill} from '../../services/beneficiaryNames';
import {PAYMENT_TAG_GROUPS,paymentTagGroupForTin,paymentTagGroupLabels,type PaymentTagGroup} from '../../services/beneficiaryPaymentTags';
import { TaxPayModal } from '../ui/TaxPayModal';
import { ReceiptView } from '../common/ReceiptView';
import {useTaxState} from '../../services/taxState';
import {usePaymentAccountProfile} from '../../services/paymentAccountProfile';
import {reuseRecordedPayment} from '../../services/paymentReuse';
import {paymentDateInRange} from '../../services/paymentDateFilter';
import {buildAccountBeneficiaryHistoryCsv} from '../../services/accountBeneficiaryHistoryCsv';

type StoredHistoryFilters={
  search:string;
  tagFilter:'all'|PaymentTagGroup;
  beneficiaryFilter:string;
  yearFilter:string;
  headFilter:string;
  dateFrom:string;
  dateTo:string;
};
const emptyHistoryFilters:StoredHistoryFilters={
  search:'',tagFilter:'all',beneficiaryFilter:'all',yearFilter:'all',headFilter:'all',dateFrom:'',dateTo:''
};
const historyFiltersStorageKey=(ownerUid:string)=>'taxpay:beneficiary-history-filters:v1:'+ownerUid;
function validHistoryDate(value:unknown):value is string {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const [year,month,day]=value.split('-').map(Number);
  const parsed=new Date(year,month-1,day);
  return parsed.getFullYear()===year&&parsed.getMonth()===month-1&&parsed.getDate()===day;
}
function readHistoryFilters(ownerUid:string):StoredHistoryFilters {
  if(typeof window==='undefined'||!ownerUid)return {...emptyHistoryFilters};
  try{
    const stored=JSON.parse(window.sessionStorage.getItem(historyFiltersStorageKey(ownerUid))||'null') as
      Partial<StoredHistoryFilters>|null;
    if(!stored||typeof stored!=='object')return {...emptyHistoryFilters};
    const tag=stored.tagFilter;
    const tagFilter:StoredHistoryFilters['tagFilter']=tag==='all'||
      typeof tag==='string'&&(PAYMENT_TAG_GROUPS as readonly string[]).includes(tag)
        ?tag as StoredHistoryFilters['tagFilter']:'all';
    const beneficiaryFilter=stored.beneficiaryFilter==='all'||
      typeof stored.beneficiaryFilter==='string'&&/^\d{12,13}$/.test(stored.beneficiaryFilter)
        ?stored.beneficiaryFilter:'all';
    return {
      search:typeof stored.search==='string'?stored.search.slice(0,160):'',
      tagFilter,
      beneficiaryFilter,
      yearFilter:stored.yearFilter==='all'||typeof stored.yearFilter==='string'&&/^\d{4}-\d{2}$/.test(stored.yearFilter)
        ?stored.yearFilter:'all',
      headFilter:typeof stored.headFilter==='string'?stored.headFilter.slice(0,160):'all',
      dateFrom:validHistoryDate(stored.dateFrom)?stored.dateFrom:'',
      dateTo:validHistoryDate(stored.dateTo)?stored.dateTo:''
    };
  }catch{return {...emptyHistoryFilters};}
}

/** History of SQL-recorded payments initiated by this signed-in payer.
 * Each beneficiary allocation keeps its own TIN, assessment year, head and
 * amount; never present the combined batch total as an individual's payment.
 */
export function AccountBeneficiaryHistory({ ownerUid, language }: { ownerUid: string; language: 'en'|'bn' }) {
  const [rows,setRows]=useState<BeneficiaryPaymentEntry[]>([]);
  const {startPaymentReuse,startBeneficiarySave,navigate}=useTaxState();
  const profile=usePaymentAccountProfile(ownerUid,null);
  const [reuseError,setReuseError]=useState('');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [exportError,setExportError]=useState('');
  const [revision,setRevision]=useState(0);
  const [restoredFilters]=useState(()=>readHistoryFilters(ownerUid));
  const [search,setSearch]=useState(restoredFilters.search);
  const [filtersOpen,setFiltersOpen]=useState(false);
  const [tagFilter,setTagFilter]=useState<'all'|PaymentTagGroup>(restoredFilters.tagFilter);
  const [beneficiaryFilter,setBeneficiaryFilter]=useState(restoredFilters.beneficiaryFilter);
  const [yearFilter,setYearFilter]=useState(restoredFilters.yearFilter);
  const [headFilter,setHeadFilter]=useState(restoredFilters.headFilter);
  const [dateFrom,setDateFrom]=useState(restoredFilters.dateFrom);
  const [dateTo,setDateTo]=useState(restoredFilters.dateTo);
  const [tags,setTags]=useState<{owner:string|null;status:'loading'|'ready'|'error';people:Beneficiary[]}>({owner:null,status:'loading',people:[]});
  const [selected,setSelected]=useState<BeneficiaryPaymentEntry|null>(null);
  useEffect(()=>{
    try{
      window.sessionStorage.setItem(historyFiltersStorageKey(ownerUid),JSON.stringify({
        search,tagFilter,beneficiaryFilter,yearFilter,headFilter,dateFrom,dateTo
      }));
    }catch{/* Private browsing may disable session storage; history remains usable. */}
  },[ownerUid,search,tagFilter,beneficiaryFilter,yearFilter,headFilter,dateFrom,dateTo]);
  const bn=language==='bn';
  const tr=(en:string,other:string)=>bn?other:en;
  useEffect(()=>{
    let active=true;
    setRows([]);setLoading(true);setError('');setSelected(null);
    void getAccountStoryPayments(ownerUid).then(payments=>{
      if(active){setRows(beneficiaryPaymentEntries(payments));setLoading(false);}
    }).catch(reason=>{
      if(active){setError(reason instanceof Error?reason.message:'Payment history unavailable');setLoading(false);}
    });
    return ()=>{active=false;};
  },[ownerUid,revision]);
  useEffect(()=>{
    let active=true;setTags({owner:ownerUid,status:'loading',people:[]});
    void loadBeneficiaries(ownerUid).then(result=>{
      if(active)setTags({owner:ownerUid,status:'ready',people:result.people});
    }).catch(()=>{if(active)setTags({owner:ownerUid,status:'error',people:[]});});
    return()=>{active=false;};
  },[ownerUid,revision]);
  const payAgain=(entry:BeneficiaryPaymentEntry)=>{
    try{
      setReuseError('');
      if (profile.status === 'loading' || profile.status === 'idle')
        throw Error('Taxpayer profile is still loading. Try again after your account is verified.');
      const matching = entry.batchId ? rows.filter(r=>r.batchId===entry.batchId) : [entry];
      const unique = [...new Map(matching.map(r=>[r.paymentId,r.receipt])).values()];
      startPaymentReuse(reuseRecordedPayment(unique,ownerUid,profile.profile?.tin??null,entry.batchId??entry.paymentId));
      setSelected(null);
    }catch(reason){setReuseError(reason instanceof Error?reason.message:'The original payment could not be reconstructed.');}
  };
  const canReuse=(row:BeneficiaryPaymentEntry)=>Boolean(row.receipt.items.length) &&
    (row.receipt.paymentCategory!=='TRAVEL_TAX' || Boolean(row.receipt.travelDetails?.passengers.length));
  const visibleTags=tags.owner===ownerUid?tags:{owner:ownerUid,status:'loading' as const,people:[]};
  const savedPerson=(tin:string)=>visibleTags.status==='ready'?
    visibleTags.people.find(person=>person.tin===tin):undefined;
  const canSaveBeneficiary=(entry:BeneficiaryPaymentEntry)=>
    /^\d{12}$/.test(entry.taxpayerTin)&&visibleTags.status==='ready'&&!savedPerson(entry.taxpayerTin);
  const saveBeneficiary=(entry:BeneficiaryPaymentEntry)=>{
    if(!canSaveBeneficiary(entry))return;
    const storedName=beneficiaryNameForPrefill(entry.beneficiaryName);
    const name=storedName==='—'||storedName===`TIN ${entry.taxpayerTin}`?'':storedName;
    startBeneficiarySave({ownerUid,tin:entry.taxpayerTin,name});
    setSelected(null);
  };
  const personLabel=(row:BeneficiaryPaymentEntry)=>{
    const person=savedPerson(row.taxpayerTin);
    const name=person?beneficiaryNameForDisplay(person.display_name,row.beneficiaryName):row.beneficiaryName;
    const tag=person?beneficiaryFinalTagLabel(person.tag,person.relationship,language,person.other_label):null;
    return <div>
      {person?<button type="button"
        onClick={()=>navigate('beneficiaries',{openBeneficiaryTin:row.taxpayerTin,returnTo:'history'})}
        className="min-h-9 text-left font-semibold text-taxpay-primary hover:underline"
        aria-label={tr('Open beneficiary profile for ','উপকারভোগীর প্রোফাইল খুলুন: ')+name}>{name}</button>
      :<p className="font-semibold text-taxpay-text">{name}</p>}
      {tag&&<p className="text-sm text-taxpay-muted">{tag}</p>}
    </div>;
  };
  const years=[...new Set(rows.map(row=>row.assessmentYear))].sort().reverse();
  const heads=[...new Set(rows.map(row=>row.paymentHead))].sort();
  const recipientTins=[...new Set(rows.map(row=>row.taxpayerTin).filter(Boolean))];
  const invalidDateRange=Boolean(dateFrom&&dateTo&&dateFrom>dateTo);
  const filtered=useMemo(()=>{
    const q=search.trim().toLocaleLowerCase();
    return rows.filter(row=>!invalidDateRange&&paymentDateInRange(row.receipt.createdAt,dateFrom,dateTo)&&
      (tagFilter==='all'||(visibleTags.status==='ready'&&
      paymentTagGroupForTin(row.taxpayerTin,visibleTags.people)===tagFilter))&&
      (beneficiaryFilter==='all'||row.taxpayerTin===beneficiaryFilter)&&
      (yearFilter==='all'||row.assessmentYear===yearFilter)&&
      (headFilter==='all'||row.paymentHead===headFilter)&&
      (!q||[row.beneficiaryName,row.taxpayerTin,row.paymentHead,row.assessmentYear,
        row.paymentId,row.batchId||'',
        ...(visibleTags.status==='ready'?visibleTags.people.filter(person=>person.tin===row.taxpayerTin)
          .flatMap(person=>[person.display_name,
            beneficiaryFinalTagLabel(person.tag,person.relationship,language,person.other_label)||'']):[])
      ].some(value=>value.toLocaleLowerCase().includes(q))));
  },[rows,search,tagFilter,visibleTags,beneficiaryFilter,yearFilter,headFilter,language,dateFrom,dateTo,invalidDateRange]);
  const exportHistory=()=>{
    setExportError('');
    try{
      const csv=buildAccountBeneficiaryHistoryCsv(filtered,language);
      const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
      const link=document.createElement('a');
      link.href=url;link.download='Sohojkor_payment_history.csv';
      document.body.appendChild(link);link.click();link.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),0);
    }catch{
      setExportError(tr('Export could not be prepared. Try again.','রপ্তানি তৈরি করা যায়নি। আবার চেষ্টা করুন।'));
    }
  };
  return <section className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-5" data-testid="beneficiary-payment-history"
    aria-label={tr('Individual beneficiary payment history','প্রতিটি উপকারভোগীর পেমেন্টের ইতিহাস')}>
    <TaxPayOfficeRegisterToolbar title={tr('Beneficiary payment history','উপকারভোগীর পেমেন্ট ইতিহাস')}
      count={filtered.length} total={rows.length} countLabel={tr('records','রেকর্ড')}
      searchValue={search} onSearchChange={setSearch}
      searchLabel={tr('Search beneficiary, TIN or payment reference','উপকারভোগী, টিআইএন বা রেফারেন্স খুঁজুন')}
      searchPlaceholder={tr('Search beneficiary, TIN or reference','নাম, টিআইএন বা রেফারেন্স খুঁজুন')}
      filtersOpen={filtersOpen} onToggleFilters={()=>setFiltersOpen(open=>!open)}
      filterLabel={tr('Filter','ফিল্টার')}
      actions={<button type="button" data-testid="account-beneficiary-history-export"
        aria-label={tr('Export filtered payment history as CSV','ফিল্টার করা পেমেন্টের ইতিহাস CSV হিসেবে নিন')}
        disabled={loading||Boolean(error)||filtered.length===0} onClick={exportHistory}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-taxpay-border bg-white px-3 text-sm font-semibold text-taxpay-primary hover:bg-taxpay-light disabled:cursor-not-allowed disabled:opacity-50">
        <Download size={16} aria-hidden="true"/>{tr('Export CSV','CSV রপ্তানি')}
      </button>}/>
    <TaxPayOfficeRegisterFilters open={filtersOpen}>
      <label className="taxpayer-transaction-filter">
        <span>{tr('Beneficiary tag','উপকারভোগীর ট্যাগ')}</span>
        <select value={tagFilter} onChange={event=>setTagFilter(event.target.value as 'all'|PaymentTagGroup)}
          aria-label={tr('Filter beneficiary payments by tag','ট্যাগ দিয়ে উপকারভোগীর পেমেন্ট ফিল্টার')}
          className="min-h-11 rounded-lg border border-taxpay-border bg-white px-3 text-sm text-taxpay-text">
          <option value="all">{tr('All tags','সব ট্যাগ')}</option>
          {PAYMENT_TAG_GROUPS.map(group=><option key={group} value={group}>{paymentTagGroupLabels[group][language]}</option>)}
        </select>
      </label>
      <label className="taxpayer-transaction-filter">
        <span>{tr('Beneficiary','উপকারভোগী')}</span>
        <select aria-label={tr('Filter beneficiary payments by recipient','উপকারভোগী অনুযায়ী পেমেন্ট ফিল্টার')}
          value={beneficiaryFilter} onChange={e=>setBeneficiaryFilter(e.target.value)}
          className="min-h-11 rounded-lg border border-taxpay-border bg-white px-3 text-sm">
          <option value="all">{tr('All beneficiaries','সব উপকারভোগী')}</option>
          {recipientTins.map(tin=><option key={tin} value={tin}>{savedPerson(tin)?.display_name||tin} · {tin}</option>)}
        </select>
      </label>
      <label className="taxpayer-transaction-filter">
        <span>{tr('Assessment year','করবর্ষ')}</span>
        <select aria-label={tr('Filter beneficiary payments by year','করবর্ষ অনুযায়ী পেমেন্ট ফিল্টার')}
          value={yearFilter} onChange={e=>setYearFilter(e.target.value)}
          className="min-h-11 rounded-lg border border-taxpay-border bg-white px-3 text-sm">
          <option value="all">{tr('All years','সব করবর্ষ')}</option>
          {years.map(year=><option key={year} value={year}>{year}</option>)}
        </select>
      </label>
      <label className="taxpayer-transaction-filter">
        <span>{tr('Tax head','করের খাত')}</span>
        <select aria-label={tr('Filter beneficiary payments by head','করের খাত অনুযায়ী পেমেন্ট ফিল্টার')}
          value={headFilter} onChange={e=>setHeadFilter(e.target.value)}
          className="min-h-11 rounded-lg border border-taxpay-border bg-white px-3 text-sm">
          <option value="all">{tr('All tax heads','সব করের খাত')}</option>
          {heads.map(head=><option key={head} value={head}>{head}</option>)}
        </select>
      </label>
      <label className="taxpayer-transaction-filter">
        <span>{tr('From date','শুরুর তারিখ')}</span>
        <input type="date" value={dateFrom} max={dateTo||undefined}
          aria-label={tr('Filter payments from date','শুরুর তারিখ থেকে পেমেন্ট ফিল্টার করুন')}
          onChange={event=>setDateFrom(event.target.value)}
          className="min-h-11 w-full rounded-lg border border-taxpay-border bg-white px-3 text-sm"/>
      </label>
      <label className="taxpayer-transaction-filter">
        <span>{tr('To date','শেষ তারিখ')}</span>
        <input type="date" value={dateTo} min={dateFrom||undefined}
          aria-label={tr('Filter payments to date','শেষ তারিখ পর্যন্ত পেমেন্ট ফিল্টার করুন')}
          onChange={event=>setDateTo(event.target.value)}
          className="min-h-11 w-full rounded-lg border border-taxpay-border bg-white px-3 text-sm"/>
      </label>
    </TaxPayOfficeRegisterFilters>
    {invalidDateRange&&<p className="mt-2 text-sm text-taxpay-error" role="alert">
      {tr('From date must be on or before the to date.','শুরুর তারিখ শেষ তারিখের পরে হতে পারবে না।')}
    </p>}
    <TaxPayActiveFilterChips clearLabel={tr('Clear all','সব ফিল্টার মুছুন')}
      onClear={()=>{setSearch('');setTagFilter('all');setBeneficiaryFilter('all');setYearFilter('all');setHeadFilter('all');setDateFrom('');setDateTo('');}}
      filters={[
        ...(search.trim()?[{key:'search',label:tr('Search: ','অনুসন্ধান: ')+search.trim(),onRemove:()=>setSearch('')}]:[]),
        ...(tagFilter!=='all'?[{key:'tag',label:paymentTagGroupLabels[tagFilter][language],onRemove:()=>setTagFilter('all')}]:[]),
        ...(beneficiaryFilter!=='all'?[{key:'beneficiary',label:beneficiaryFilter,onRemove:()=>setBeneficiaryFilter('all')}]:[]),
        ...(yearFilter!=='all'?[{key:'year',label:yearFilter,onRemove:()=>setYearFilter('all')}]:[]),
        ...(headFilter!=='all'?[{key:'head',label:headFilter,onRemove:()=>setHeadFilter('all')}]:[]),
        ...(dateFrom||dateTo?[{key:'date',label:tr('Date: ','তারিখ: ')+(dateFrom||'…')+' – '+(dateTo||'…'),onRemove:()=>{setDateFrom('');setDateTo('');}}]:[])
      ]}/>
    {visibleTags.status==='error'&&<p className="mt-2 text-sm text-taxpay-error" role="alert">{tr('Saved tags unavailable; categories were not guessed.','সংরক্ষিত ট্যাগ পাওয়া যায়নি; শ্রেণি অনুমান করা হয়নি।')}</p>}
    {reuseError&&<p className="mt-3 text-sm text-taxpay-error" role="alert">{reuseError}</p>}
    {exportError&&<p className="mt-3 text-sm text-taxpay-error" role="alert">{exportError}</p>}
    {loading&&<p className="mt-4 text-sm text-taxpay-muted" role="status">{tr('Loading saved payments…','সংরক্ষিত পেমেন্ট লোড হচ্ছে…')}</p>}
    {error&&<div className="mt-4" role="alert">
      <p className="text-sm text-taxpay-error">{tr('Payment history could not be verified.','পেমেন্টের ইতিহাস যাচাই করা যায়নি।')}</p>
      <button className="mt-2 min-h-11 rounded-lg border border-taxpay-border px-3 text-sm font-semibold text-taxpay-primary"
        type="button" onClick={()=>setRevision(v=>v+1)}>{tr('Try again','আবার চেষ্টা করুন')}</button>
    </div>}
    {!loading&&!error&&filtered.length===0&&<TaxPayTableState className="mt-4 rounded-lg bg-slate-50 p-4">
      <p>{tr('No matching recorded payments.','মিল পাওয়া যায়নি।')}</p></TaxPayTableState>}
    {!loading&&!error&&filtered.length>0&&<>

    <div className="mt-4">
      <TaxPayDataGrid variant="tabular" rows={filtered} getRowKey={row=>row.key}
        ariaLabel={tr('Individual beneficiary payment records','প্রতিটি উপকারভোগীর পেমেন্ট রেকর্ড')}
        mobileTestId="beneficiary-payment-mobile-cards"
        columns={[
          {key:'beneficiary',header:tr('Beneficiary / TIN','উপকারভোগী / টিআইএন'),renderCell:row=><div>
            {personLabel(row)}
            <p className="break-all font-mono-plex text-sm text-taxpay-muted">{row.taxpayerTin||'—'}</p>
          </div>},
          {key:'head',header:tr('Payment head / year','খাত / করবর্ষ'),renderCell:row=><div>
            <p className="text-taxpay-text">{row.paymentHead}</p>
            {row.economicCode&&<p className="text-sm text-taxpay-muted">{row.economicCode}</p>}
            <p className="text-sm text-taxpay-muted">{row.assessmentYear}</p>
          </div>},
          {key:'reference',header:tr('Reference','রেফারেন্স'),renderCell:row=><div>
            <p className="break-all font-mono-plex text-sm">{row.paymentId}</p>
            {row.batchItemIndex&&row.batchItemCount&&<p className="text-sm text-taxpay-muted">
              {tr('Batch item','ব্যাচের রেকর্ড')} {row.batchItemIndex}/{row.batchItemCount}</p>}
          </div>},
          {key:'amount',header:tr('Amount','পরিমাণ'),headerClassName:'text-right',cellClassName:'text-right tabular-nums',renderCell:row=><p className="font-semibold">{formatCurrency(row.amountMinor/100,language)}</p>},
          {key:'receipt',header:tr('Receipt','রসিদ'),renderCell:row=><div className="flex flex-wrap gap-2">
            <button type="button" className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-taxpay-border px-3 font-semibold text-taxpay-primary"
              onClick={()=>setSelected(row)}><FileText size={16} aria-hidden="true"/>{tr('View','দেখুন')}</button>
            {canReuse(row)&&<button type="button" data-testid="account-pay-again-desktop"
              className="min-h-11 rounded-lg border border-taxpay-border px-3 font-semibold text-taxpay-primary"
              onClick={()=>payAgain(row)}>{tr('Pay Again','আবার পরিশোধ')}</button>}
          </div>}
        ]}
        renderMobileCard={row=><>
          <div className="taxpay-mobile-table-card__header">
            <div className="taxpay-mobile-table-card__title">{personLabel(row)}</div>
            <p className="shrink-0 font-semibold tabular-nums">{formatCurrency(row.amountMinor/100,language)}</p>
          </div>
          <p className="taxpay-mobile-table-card__meta">{tr('TIN','টিআইএন')}: {row.taxpayerTin||'—'}</p>
          <p className="taxpay-mobile-table-card__meta">{row.paymentHead} · {row.assessmentYear}</p>
          {row.economicCode&&<p className="taxpay-mobile-table-card__meta">{row.economicCode}</p>}
          <p className="taxpay-mobile-table-card__meta">{tr('Reference','রেফারেন্স')}: {row.paymentId}</p>
          {row.batchItemIndex&&row.batchItemCount&&<p className="taxpay-mobile-table-card__meta">{tr('Batch item','ব্যাচের রেকর্ড')} {row.batchItemIndex}/{row.batchItemCount}</p>}
          <div className="taxpay-mobile-table-card__actions"><button type="button"
            className="min-h-11 rounded-lg border border-taxpay-border px-3 font-semibold text-taxpay-primary"
            onClick={()=>setSelected(row)}><FileText size={16} aria-hidden="true"/>{tr('View receipt','রসিদ দেখুন')}</button>
            {canReuse(row)&&<button type="button" data-testid="account-pay-again-mobile"
              className="min-h-11 rounded-lg border border-taxpay-border px-3 font-semibold text-taxpay-primary"
              onClick={()=>payAgain(row)}>{tr('Pay Again','আবার পরিশোধ')}</button>}
          </div>
        </>}/>
    </div>

    </>}
    <TaxPayOfficeRegisterFooter shown={filtered.length} total={rows.length}
      labels={{showing:tr('Showing','দেখানো হচ্ছে'),of:tr('of','মোট'),records:tr('records','রেকর্ড')}}/>
    {selected&&<TaxPayModal title={tr('Payment receipt','পেমেন্ট রসিদ')} service="status"
      className="receipt-modal" onClose={()=>setSelected(null)} footer={<></>}>
      <ReceiptView receipt={selected.receipt} embedded/>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {canSaveBeneficiary(selected)&&<button type="button" data-testid="account-save-beneficiary-receipt"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-taxpay-border px-4 font-semibold text-taxpay-primary"
          onClick={()=>saveBeneficiary(selected)}><UserPlus size={16} aria-hidden="true"/>{tr('Save Beneficiary','উপকারভোগী সংরক্ষণ করুন')}</button>}
        {canReuse(selected)&&<button type="button" data-testid="account-pay-again-receipt"
          className="min-h-11 rounded-lg border border-taxpay-border px-4 font-semibold text-taxpay-primary"
          onClick={()=>payAgain(selected)}>{tr('Pay Again','আবার পরিশোধ')}</button>}
      </div>
    </TaxPayModal>}
  </section>;
}
