import {TaxPayDataGrid,TaxPayTableState,TaxPayOfficeRegisterToolbar,TaxPayOfficeRegisterFilters,TaxPayOfficeRegisterFooter,TaxPayActiveFilterChips} from '../ui/TaxPayDataTable';
import React, { useEffect, useMemo, useState } from 'react';
import { Search, FileText } from 'lucide-react';
import { getAccountStoryPayments, beneficiaryPaymentEntries, type BeneficiaryPaymentEntry } from '../../services/story1AccountPaymentHistory';
import { formatCurrency } from '../../services/numberFormat';
import {loadBeneficiaries,type Beneficiary} from '../../services/beneficiaries';
import {beneficiaryFinalTagLabel} from '../../services/beneficiaryTags';
import {PAYMENT_TAG_GROUPS,paymentTagGroupForTin,paymentTagGroupLabels,type PaymentTagGroup} from '../../services/beneficiaryPaymentTags';
import { TaxPayModal } from '../ui/TaxPayModal';
import { ReceiptView } from '../common/ReceiptView';
import {useTaxState} from '../../services/taxState';
import {usePaymentAccountProfile} from '../../services/paymentAccountProfile';
import {reuseRecordedPayment} from '../../services/paymentReuse';

/** History of SQL-recorded payments initiated by this signed-in payer.
 * Each beneficiary allocation keeps its own TIN, assessment year, head and
 * amount; never present the combined batch total as an individual's payment.
 */
export function AccountBeneficiaryHistory({ ownerUid, language }: { ownerUid: string; language: 'en'|'bn' }) {
  const [rows,setRows]=useState<BeneficiaryPaymentEntry[]>([]);
  const {startPaymentReuse,navigate}=useTaxState();
  const profile=usePaymentAccountProfile(ownerUid,null);
  const [reuseError,setReuseError]=useState('');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [revision,setRevision]=useState(0);
  const [search,setSearch]=useState('');
  const [filtersOpen,setFiltersOpen]=useState(false);
  const [tagFilter,setTagFilter]=useState<'all'|PaymentTagGroup>('all');
  const [beneficiaryTinFilter,setBeneficiaryTinFilter]=useState('all');
  const [yearFilter,setYearFilter]=useState('all');
  const [tags,setTags]=useState<{owner:string|null;status:'loading'|'ready'|'error';people:Beneficiary[]}>({owner:null,status:'loading',people:[]});
  const [selected,setSelected]=useState<BeneficiaryPaymentEntry|null>(null);
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
  const savedForTin=(tin:string)=>visibleTags.people.filter(person=>person.tin===tin);
  const tagText=(tin:string)=>{
    if(visibleTags.status!=='ready')return tr('Tag unavailable','ট্যাগ পাওয়া যায়নি');
    const tags=[...new Set(savedForTin(tin).map(person=>
      beneficiaryFinalTagLabel(person.tag,person.relationship,language,person.other_label)).filter(Boolean))];
    return tags.length===1?tags[0]:tags.length>1?tr('Conflicting tags','বিরোধপূর্ণ ট্যাগ'):tr('Not tagged','ট্যাগ নেই');
  };
  const openProfile=(tin:string)=>{
    if(savedForTin(tin).length)navigate('beneficiaries',{profileBeneficiaryTin:tin});
  };
  const filterTins=[...new Set(rows.map(row=>row.taxpayerTin).filter(Boolean))].sort();
  const filterYears=[...new Set(rows.map(row=>row.assessmentYear))].sort().reverse();
  const filtered=useMemo(()=>{
    const q=search.trim().toLocaleLowerCase();
    return rows.filter(row=>(beneficiaryTinFilter==='all'||row.taxpayerTin===beneficiaryTinFilter)&&
      (yearFilter==='all'||row.assessmentYear===yearFilter)&&
      (tagFilter==='all'||(visibleTags.status==='ready'&&
      paymentTagGroupForTin(row.taxpayerTin,visibleTags.people)===tagFilter))&&
      (!q||[row.beneficiaryName,row.taxpayerTin,row.paymentHead,row.assessmentYear,
        row.paymentId,row.batchId||''].some(value=>value.toLocaleLowerCase().includes(q))));
  },[rows,search,tagFilter,beneficiaryTinFilter,yearFilter,visibleTags]);
  return <section className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-5" data-testid="beneficiary-payment-history"
    aria-label={tr('Individual beneficiary payment history','প্রতিটি উপকারভোগীর পেমেন্টের ইতিহাস')}>
    <TaxPayOfficeRegisterToolbar title={tr('Beneficiary payment history','উপকারভোগীর পেমেন্ট ইতিহাস')}
      count={filtered.length} total={rows.length} countLabel={tr('records','রেকর্ড')}
      searchValue={search} onSearchChange={setSearch}
      searchLabel={tr('Search beneficiary, TIN or payment reference','উপকারভোগী, টিআইএন বা রেফারেন্স খুঁজুন')}
      searchPlaceholder={tr('Search beneficiary, TIN or reference','নাম, টিআইএন বা রেফারেন্স খুঁজুন')}
      filtersOpen={filtersOpen} onToggleFilters={()=>setFiltersOpen(open=>!open)}
      filterLabel={tr('Filter','ফিল্টার')}/>
    <TaxPayOfficeRegisterFilters open={filtersOpen}>
      <label className="taxpayer-transaction-filter">
        <span>{tr('Beneficiary','উপকারভোগী')}</span>
        <select value={beneficiaryTinFilter} onChange={event=>setBeneficiaryTinFilter(event.target.value)}
          aria-label={tr('Filter payments by beneficiary','উপকারভোগী দিয়ে পেমেন্ট ফিল্টার')}
          className="min-h-11 w-full rounded-lg border border-taxpay-border bg-white px-3 text-sm">
          <option value="all">{tr('All beneficiaries','সব উপকারভোগী')}</option>
          {filterTins.map(tin=><option key={tin} value={tin}>{savedForTin(tin)[0]?.display_name||tin} · {tin}</option>)}
        </select>
      </label>
      <label className="taxpayer-transaction-filter">
        <span>{tr('Assessment year','করবর্ষ')}</span>
        <select value={yearFilter} onChange={event=>setYearFilter(event.target.value)}
          aria-label={tr('Filter payments by assessment year','করবর্ষ দিয়ে পেমেন্ট ফিল্টার')}
          className="min-h-11 w-full rounded-lg border border-taxpay-border bg-white px-3 text-sm">
          <option value="all">{tr('All years','সব করবর্ষ')}</option>
          {filterYears.map(year=><option key={year} value={year}>{year}</option>)}
        </select>
      </label>
      <label className="taxpayer-transaction-filter">
        <span>{tr('Beneficiary tag','উপকারভোগীর ট্যাগ')}</span>
        <select value={tagFilter} onChange={event=>setTagFilter(event.target.value as 'all'|PaymentTagGroup)}
          aria-label={tr('Filter beneficiary payments by tag','ট্যাগ দিয়ে উপকারভোগীর পেমেন্ট ফিল্টার')}
          className="min-h-11 rounded-lg border border-taxpay-border bg-white px-3 text-sm text-taxpay-text">
          <option value="all">{tr('All tags','সব ট্যাগ')}</option>
          {PAYMENT_TAG_GROUPS.map(group=><option key={group} value={group}>{paymentTagGroupLabels[group][language]}</option>)}
        </select>
      </label>
    </TaxPayOfficeRegisterFilters>
    <TaxPayActiveFilterChips clearLabel={tr('Clear all','সব ফিল্টার মুছুন')}
      onClear={()=>{setSearch('');setTagFilter('all');setBeneficiaryTinFilter('all');setYearFilter('all');}}
      filters={[
        ...(search.trim()?[{key:'search',label:tr('Search: ','অনুসন্ধান: ')+search.trim(),onRemove:()=>setSearch('')}]:[]),
        ...(tagFilter!=='all'?[{key:'tag',label:paymentTagGroupLabels[tagFilter][language],onRemove:()=>setTagFilter('all')}]:[]),
        ...(beneficiaryTinFilter!=='all'?[{key:'beneficiary',label:beneficiaryTinFilter,onRemove:()=>setBeneficiaryTinFilter('all')}]:[]),
        ...(yearFilter!=='all'?[{key:'year',label:yearFilter,onRemove:()=>setYearFilter('all')}]:[])
      ]}/>
    {visibleTags.status==='error'&&<p className="mt-2 text-sm text-taxpay-error" role="alert">{tr('Saved tags unavailable; categories were not guessed.','সংরক্ষিত ট্যাগ পাওয়া যায়নি; শ্রেণি অনুমান করা হয়নি।')}</p>}
    {reuseError&&<p className="mt-3 text-sm text-taxpay-error" role="alert">{reuseError}</p>}
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
            <p className="font-semibold text-taxpay-text">{row.beneficiaryName}</p>
            <p className="break-all font-mono-plex text-sm text-taxpay-muted">{row.taxpayerTin||'—'}</p>
          </div>},
          {key:'tag',header:tr('Tag','ট্যাগ'),renderCell:row=>
            <span className="text-sm text-taxpay-muted">{tagText(row.taxpayerTin)}</span>},
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
            {savedForTin(row.taxpayerTin).length>0&&<button type="button"
              className="min-h-11 rounded-lg border border-taxpay-border px-3 font-semibold text-taxpay-primary"
              onClick={()=>openProfile(row.taxpayerTin)}>{tr('Profile','প্রোফাইল')}</button>}
            {canReuse(row)&&<button type="button" data-testid="account-pay-again-desktop"
              className="min-h-11 rounded-lg border border-taxpay-border px-3 font-semibold text-taxpay-primary"
              onClick={()=>payAgain(row)}>{tr('Pay Again','আবার পরিশোধ')}</button>}
          </div>}
        ]}
        renderMobileCard={row=><>
          <div className="taxpay-mobile-table-card__header">
            <p className="taxpay-mobile-table-card__title">{row.beneficiaryName}</p>
            <p className="shrink-0 font-semibold tabular-nums">{formatCurrency(row.amountMinor/100,language)}</p>
          </div>
          <p className="taxpay-mobile-table-card__meta">{tr('TIN','টিআইএন')}: {row.taxpayerTin||'—'}</p>
          <p className="taxpay-mobile-table-card__meta">{tr('Tag','ট্যাগ')}: {tagText(row.taxpayerTin)}</p>
          <p className="taxpay-mobile-table-card__meta">{row.paymentHead} · {row.assessmentYear}</p>
          {row.economicCode&&<p className="taxpay-mobile-table-card__meta">{row.economicCode}</p>}
          <p className="taxpay-mobile-table-card__meta">{tr('Reference','রেফারেন্স')}: {row.paymentId}</p>
          {row.batchItemIndex&&row.batchItemCount&&<p className="taxpay-mobile-table-card__meta">{tr('Batch item','ব্যাচের রেকর্ড')} {row.batchItemIndex}/{row.batchItemCount}</p>}
          <div className="taxpay-mobile-table-card__actions"><button type="button"
            className="min-h-11 rounded-lg border border-taxpay-border px-3 font-semibold text-taxpay-primary"
            onClick={()=>setSelected(row)}><FileText size={16} aria-hidden="true"/>{tr('View receipt','রসিদ দেখুন')}</button>
            {savedForTin(row.taxpayerTin).length>0&&<button type="button"
              className="min-h-11 rounded-lg border border-taxpay-border px-3 font-semibold text-taxpay-primary"
              onClick={()=>openProfile(row.taxpayerTin)}>{tr('Profile','প্রোফাইল')}</button>}
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
      {canReuse(selected)&&<div className="mt-3 flex justify-end">
        <button type="button" data-testid="account-pay-again-receipt"
          className="min-h-11 rounded-lg border border-taxpay-border px-4 font-semibold text-taxpay-primary"
          onClick={()=>payAgain(selected)}>{tr('Pay Again','আবার পরিশোধ')}</button>
      </div>}
    </TaxPayModal>}
  </section>;
}
