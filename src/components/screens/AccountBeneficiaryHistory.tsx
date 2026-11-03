import {TaxPayTableViewport,TaxPayMobileTableCards,TaxPayMobileTableCard,TaxPayTableState} from '../ui/TaxPayDataTable';
import React, { useEffect, useMemo, useState } from 'react';
import { Search, FileText } from 'lucide-react';
import { getAccountStoryPayments, beneficiaryPaymentEntries, type BeneficiaryPaymentEntry } from '../../services/story1AccountPaymentHistory';
import { formatCurrency } from '../../services/numberFormat';
import { TaxPayModal } from '../ui/TaxPayModal';
import { ReceiptView } from '../common/ReceiptView';

/** History of SQL-recorded payments initiated by this signed-in payer.
 * Each beneficiary allocation keeps its own TIN, assessment year, head and
 * amount; never present the combined batch total as an individual's payment.
 */
export function AccountBeneficiaryHistory({ ownerUid, language }: { ownerUid: string; language: 'en'|'bn' }) {
  const [rows,setRows]=useState<BeneficiaryPaymentEntry[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [revision,setRevision]=useState(0);
  const [search,setSearch]=useState('');
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
  const filtered=useMemo(()=>{
    const q=search.trim().toLocaleLowerCase();
    return rows.filter(row=>!q||[
      row.beneficiaryName,row.taxpayerTin,row.paymentHead,row.assessmentYear,
      row.paymentId,row.batchId||''
    ].some(value=>value.toLocaleLowerCase().includes(q)));
  },[rows,search]);
  return <section className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-5" data-testid="beneficiary-payment-history"
    aria-label={tr('Individual beneficiary payment history','প্রতিটি উপকারভোগীর পেমেন্টের ইতিহাস')}>
    <div className="taxpay-table-toolbar">
      <div className="taxpay-table-toolbar__actions">
        <h2 className="taxpay-table-toolbar__title">{tr('Beneficiary payment history','উপকারভোগীর পেমেন্ট ইতিহাস')}</h2>
        <p className="taxpay-table-count" aria-live="polite">{filtered.length} {tr('records','রেকর্ড')}</p>
      </div>
      <div className="taxpay-table-toolbar__search flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-taxpay-border bg-white px-3">
        <Search size={17} className="shrink-0 text-taxpay-muted" aria-hidden="true"/>
        <input type="search" value={search} onChange={event=>setSearch(event.target.value)}
          aria-label={tr('Search beneficiary, TIN or payment reference','উপকারভোগী, টিআইএন বা রেফারেন্স খুঁজুন')}
          placeholder={tr('Search beneficiary, TIN or reference','নাম, টিআইএন বা রেফারেন্স খুঁজুন')}
          className="min-h-11 w-full min-w-0 bg-transparent text-sm outline-none"/>
      </div>
    </div>
    {loading&&<p className="mt-4 text-sm text-taxpay-muted" role="status">{tr('Loading saved payments…','সংরক্ষিত পেমেন্ট লোড হচ্ছে…')}</p>}
    {error&&<div className="mt-4" role="alert">
      <p className="text-sm text-taxpay-error">{tr('Payment history could not be verified.','পেমেন্টের ইতিহাস যাচাই করা যায়নি।')}</p>
      <button className="mt-2 min-h-11 rounded-lg border border-taxpay-border px-3 text-sm font-semibold text-taxpay-primary"
        type="button" onClick={()=>setRevision(v=>v+1)}>{tr('Try again','আবার চেষ্টা করুন')}</button>
    </div>}
    {!loading&&!error&&filtered.length===0&&<TaxPayTableState className="mt-4 rounded-lg bg-slate-50 p-4">
      <p>{tr('No matching recorded payments.','মিল পাওয়া যায়নি।')}</p></TaxPayTableState>}
    {!loading&&!error&&filtered.length>0&&<>
    <TaxPayTableViewport className="mt-4 hidden md:block">
      <table className="taxpay-unified-table w-full min-w-[680px] text-left text-sm">
        <thead className="bg-taxpay-background text-taxpay-muted">
          <tr>
            <th scope="col" className="px-3 py-3">{tr('Beneficiary / TIN','উপকারভোগী / টিআইএন')}</th>
            <th scope="col" className="px-3 py-3">{tr('Payment head / year','খাত / করবর্ষ')}</th>
            <th scope="col" className="px-3 py-3">{tr('Reference','রেফারেন্স')}</th>
            <th scope="col" className="px-3 py-3 text-right">{tr('Amount','পরিমাণ')}</th>
            <th scope="col" className="px-3 py-3">{tr('Receipt','রসিদ')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-taxpay-border">
          {filtered.map(row=><tr key={row.key}>
            <td className="px-3 py-3">
              <p className="font-semibold text-taxpay-text">{row.beneficiaryName}</p>
              <p className="break-all font-mono-plex text-xs text-taxpay-muted">{row.taxpayerTin||'—'}</p>
            </td>
            <td className="px-3 py-3">
              <p className="text-taxpay-text">{row.paymentHead}</p>
              {row.economicCode&&<p className="text-xs text-taxpay-muted">{row.economicCode}</p>}
              <p className="text-taxpay-muted">{row.assessmentYear}</p>
            </td>
            <td className="px-3 py-3">
              <p className="break-all font-mono-plex text-xs">{row.paymentId}</p>
              {row.batchItemIndex&&row.batchItemCount&&<p className="text-xs text-taxpay-muted">
                {tr('Batch item','ব্যাচের রেকর্ড')} {row.batchItemIndex}/{row.batchItemCount}</p>}
            </td>
            <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatCurrency(row.amountMinor/100,language)}</td>
            <td className="px-3 py-3">
              <button type="button" className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-taxpay-border px-3 font-semibold text-taxpay-primary"
                onClick={()=>setSelected(row)}><FileText size={16} aria-hidden="true"/>{tr('View','দেখুন')}</button>
            </td>
          </tr>)}
        </tbody>
      </table>
    </TaxPayTableViewport>
    <TaxPayMobileTableCards className="mt-3 md:hidden" data-testid="beneficiary-payment-mobile-cards">
      {filtered.map(row=><TaxPayMobileTableCard key={row.key}>
        <div className="taxpay-mobile-table-card__header">
          <p className="taxpay-mobile-table-card__title">{row.beneficiaryName}</p>
          <p className="shrink-0 font-semibold tabular-nums">{formatCurrency(row.amountMinor/100,language)}</p>
        </div>
        <p className="taxpay-mobile-table-card__meta">{tr('TIN','টিআইএন')}: {row.taxpayerTin||'—'}</p>
        <p className="taxpay-mobile-table-card__meta">{row.paymentHead} · {row.assessmentYear}</p>
        <p className="taxpay-mobile-table-card__meta">{tr('Reference','রেফারেন্স')}: {row.paymentId}</p>
        <div className="taxpay-mobile-table-card__actions">
          <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-taxpay-border px-3 font-semibold text-taxpay-primary"
            onClick={()=>setSelected(row)}><FileText size={16} aria-hidden="true"/>{tr('View receipt','রসিদ দেখুন')}</button>
        </div>
      </TaxPayMobileTableCard>)}
    </TaxPayMobileTableCards>
    </>}
    {selected&&<TaxPayModal title={tr('Payment receipt','পেমেন্ট রসিদ')} service="status"
      className="receipt-modal" onClose={()=>setSelected(null)} footer={<></>}>
      <ReceiptView receipt={selected.receipt} embedded/>
    </TaxPayModal>}
  </section>;
}
