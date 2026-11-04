import {TaxPayDataGrid} from '../ui/TaxPayDataTable';
import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  FileText, 
  CheckCircle2, 
  Clock, 
  Building2,
  Calendar,
  CreditCard
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { formatCurrency } from '../../services/numberFormat';
import { ASSESSMENT_YEARS } from '../../data/mockData';

export const PaymentSearch: React.FC = () => {
  const { receipts, selectReceipt, language } = useTaxState();

  const [term, setTerm] = useState('');
  const [ay, setAy] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [minAmount, setMinAmount] = useState<number | ''>('');
  const [maxAmount, setMaxAmount] = useState<number | ''>('');

  const filtered = receipts.filter(r => {
    const matchTerm = term
      ? r.challanNo.toLowerCase().includes(term.toLowerCase()) ||
        r.tokenNumber.toLowerCase().includes(term.toLowerCase()) ||
        r.payerName.toLowerCase().includes(term.toLowerCase()) ||
        r.payerTin.includes(term) ||
        (r.deducteeTin && r.deducteeTin.includes(term))
      : true;
    const matchAy = ay === 'ALL' || r.assessmentYear === ay;
    const matchStatus = status === 'ALL' || r.treasuryStatus === status;
    const matchMin = minAmount === '' || r.totalAmount >= Number(minAmount);
    const matchMax = maxAmount === '' || r.totalAmount <= Number(maxAmount);
    return matchTerm && matchAy && matchStatus && matchMin && matchMax;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4 mb-5">
          <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-serif-fraunces text-2xl font-bold text-slate-900">
              Universal Cross-Treasury Payment Search
            </h1>
            <p className="text-xs text-slate-500">
              Search across national treasury clearing accounts, Sonali Bank scrolls, and withholding credits.
            </p>
          </div>
        </div>

        {/* Multi-Criteria Filters Form */}
        <div className="taxpay-table-filters grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-5 text-xs">
          <div className="md:col-span-2">
            <label className="block text-slate-600 mb-1 font-semibold">Search Query (Challan, Token, TIN, Name)</label>
            <input
              type="text"
              placeholder="Transaction reference or TIN"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono-plex"
            />
          </div>

          <div>
            <label className="block text-slate-600 mb-1 font-semibold">Assessment Year</label>
            <select
              value={ay}
              onChange={(e) => setAy(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-medium"
            >
              <option value="ALL">All Assessment Years</option>
              {ASSESSMENT_YEARS.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-600 mb-1 font-semibold">Treasury Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="TREASURY_SCROLLED">TREASURY_SCROLLED</option>
              <option value="GATEWAY_PENDING">GATEWAY_PENDING</option>
              <option value="FAILED">FAILED</option>
            </select>
          </div>
        </div>

        {/* Results Count & Table */}
        <div className="space-y-3">
          <div className="taxpay-table-toolbar text-xs text-slate-500">
            <span>Found <strong>{filtered.length}</strong> matching electronic Treasury records</span>
          </div>


          <TaxPayDataGrid variant="tabular" rows={filtered} getRowKey={receipt=>receipt.id}
            ariaLabel={language==='bn'?'পেমেন্ট অনুসন্ধানের ফলাফল':'Payment search results'}
            mobileTestId="payment-search-mobile-cards"
            columns={[
              {key:'challan',header:language==='bn'?'চালান নম্বর':'Challan number',renderCell:rcpt=><p className="break-all font-mono-plex font-semibold text-taxpay-text">{rcpt.challanNo}</p>},
              {key:'ay',header:language==='bn'?'করবর্ষ':'AY',renderCell:rcpt=><p>{rcpt.assessmentYear}</p>},
              {key:'payer',header:language==='bn'?'পরিশোধকারী':'Payer name',renderCell:rcpt=><p className="font-semibold">{rcpt.payerName}</p>},
              {key:'tin',header:language==='bn'?'টিআইএন':'TIN',renderCell:rcpt=><p className="break-all font-mono-plex">{rcpt.payerTin}</p>},
              {key:'amount',header:language==='bn'?'পরিমাণ (৳)':'Amount (৳)',headerClassName:'text-right',cellClassName:'text-right tabular-nums',renderCell:rcpt=><p className="font-semibold">{formatCurrency(rcpt.totalAmount,language)}</p>},
              {key:'scroll',header:language==='bn'?'স্ক্রল নম্বর':'Scroll number',renderCell:rcpt=><p className="break-all font-mono-plex">{rcpt.treasuryScrollNo || (language==='bn'?'অপেক্ষমাণ':'Pending')}</p>},
              {key:'status',header:language==='bn'?'ট্রেজারির অবস্থা':'Treasury status',renderCell:rcpt=><p className="font-semibold">{rcpt.treasuryStatus.replaceAll('_',' ')}</p>},
              {key:'actions',header:language==='bn'?'কার্যক্রম':'Action',renderCell:rcpt=><button type="button" onClick={()=>selectReceipt(rcpt.id)}
                 className="min-h-11 rounded-lg border border-taxpay-border px-3 text-sm font-semibold text-taxpay-primary">{language==='bn'?'বিস্তারিত দেখুন':'Inspect'}</button>}
            ]}
            renderMobileCard={rcpt=><>
              <div className="taxpay-mobile-table-card__header">
                <p className="taxpay-mobile-table-card__title">{rcpt.challanNo}</p>
                <p className="shrink-0 font-semibold tabular-nums">{formatCurrency(rcpt.totalAmount,language)}</p>
              </div>
              <p className="taxpay-mobile-table-card__meta">{language==='bn'?'করবর্ষ':'AY'}: {rcpt.assessmentYear}</p>
              <p className="taxpay-mobile-table-card__meta">{rcpt.payerName} · {rcpt.payerTin}</p>
              <p className="taxpay-mobile-table-card__meta">{language==='bn'?'ট্রেজারির অবস্থা':'Treasury status'}: {rcpt.treasuryStatus.replaceAll('_',' ')}</p>
              <p className="taxpay-mobile-table-card__meta">{language==='bn'?'স্ক্রল নম্বর':'Scroll number'}: {rcpt.treasuryScrollNo||(language==='bn'?'অপেক্ষমাণ':'Pending')}</p>
              <div className="taxpay-mobile-table-card__actions"><button type="button" onClick={()=>selectReceipt(rcpt.id)}
                className="min-h-11 rounded-lg border border-taxpay-border px-3 font-semibold text-taxpay-primary">{language==='bn'?'বিস্তারিত দেখুন':'Inspect'}</button></div>
            </>}/>
          {filtered.length===0&&<div className="taxpay-table-state" role="status">{language==='bn'?'কোনো মিল পাওয়া যায়নি।':'No matching payment records.'}</div>}
        </div>
      </div>
    </div>
  );
};
