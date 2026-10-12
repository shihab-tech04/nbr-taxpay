import React, { useState } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  Download, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Building2,
  CreditCard,
  Plus
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { formatCurrency } from '../../services/numberFormat';
import { ASSESSMENT_YEARS } from '../../data/mockData';
import { PaymentCategory } from '../../types/tax';

export const PaymentHistory: React.FC = () => {
  const { receipts, selectReceipt, navigate, language, taxpayerProfile } = useTaxState();

  const [search, setSearch] = useState('');
  const [selectedAY, setSelectedAY] = useState<string>('ALL');
  const [selectedCat, setSelectedCat] = useState<string>('ALL');

  const filteredReceipts = receipts.filter(r => {
    // A sample taxpayer never lists another example profile's receipts.
    if (r.payerTin !== taxpayerProfile.tin) return false;
    const matchSearch = search
      ? r.challanNo.toLowerCase().includes(search.toLowerCase()) ||
        r.tokenNumber.toLowerCase().includes(search.toLowerCase()) ||
        r.payerName.toLowerCase().includes(search.toLowerCase())
      : true;
    const matchAY = selectedAY === 'ALL' || r.assessmentYear === selectedAY;
    const matchCat = selectedCat === 'ALL' || r.paymentCategory === selectedCat;
    return matchSearch && matchAY && matchCat;
  });

  const exportCsv = () => {
    const headers = ['Challan No', 'Token', 'Category', 'Assessment Year', 'Payer Name', 'TIN', 'Amount', 'Date', 'Treasury Status'];
    const rows = filteredReceipts.map(r => [
      r.challanNo,
      r.tokenNumber,
      r.paymentCategory,
      r.assessmentYear,
      `"${r.payerName}"`,
      r.payerTin,
      r.totalAmount,
      r.createdAt,
      r.treasuryStatus
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TaxPay_Challans_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-serif-fraunces text-2xl font-bold text-slate-900">
                Payment History & A-Challan Archive
              </h1>
              <p className="text-xs text-slate-500">
                Illustrative payment records for the selected sample taxpayer. Treasury and NBR records are not connected.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportCsv}
              className="px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => navigate('wizard')}
              className="px-4 py-2 bg-emerald-900 hover:bg-emerald-950 text-amber-300 font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>New Payment</span>
            </button>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5 text-xs">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search challan, token, or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 font-mono-plex"
            />
          </div>

          <div>
            <select
              value={selectedAY}
              onChange={(e) => setSelectedAY(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-medium"
            >
              <option value="ALL">All Assessment Years</option>
              {ASSESSMENT_YEARS.map(ay => (
                <option key={ay} value={ay}>{ay}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-medium"
            >
              <option value="ALL">All Payment Categories</option>
              <option value="TAX_WITH_RETURN">Tax with Return</option>
              <option value="ADVANCE_TAX">Advance Tax</option>
              <option value="ASSESSED_DEMAND">Assessed Demand</option>
              <option value="PENALTY">Penalty</option>
              <option value="SOURCE_TAX_DEPOSIT">Source Tax Deposit</option>
              <option value="APPELLATE_TRIBUNAL">Appellate Tribunal</option>
              <option value="OTHER_TAX_PAYMENT">Other Tax Payment</option>
            </select>
          </div>
        </div>

        {/* Mobile-native activity cards retain the same data/actions as the desktop table. */}
        <div className="grid gap-3 md:hidden">
          {filteredReceipts.length === 0 && <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No sample payments match your filters.</p>}
          {filteredReceipts.map(rcpt => (
            <article key={rcpt.id} className="rounded-xl border border-taxpay-border bg-white p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-mono-plex font-bold text-sm text-taxpay-dark break-all">{rcpt.challanNo}</h2>
                <strong className="text-sm text-taxpay-text">{formatCurrency(rcpt.totalAmount,language)}</strong>
              </div>
              <p className="text-xs text-slate-600">{rcpt.paymentCategory.replace(/_/g,' ')} · AY {rcpt.assessmentYear}</p>
              <p className="text-xs">Treasury: {rcpt.treasuryStatus}</p>
              <p className="text-xs">Tax credit: {rcpt.taxCreditStatus}</p>
              <button type="button" onClick={() => selectReceipt(rcpt.id)} className="min-h-11 w-full rounded-lg bg-taxpay-light text-taxpay-dark font-semibold text-sm">
                View demo receipt
              </button>
            </article>
          ))}
        </div>
        {/* Desktop financial table */}
        <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-lg">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold text-left">
              <tr>
                <th className="px-3 py-2.5">A-Challan Number</th>
                <th className="px-3 py-2.5">Token No</th>
                <th className="px-3 py-2.5">Category</th>
                <th className="px-3 py-2.5">Assessment Year</th>
                <th className="px-3 py-2.5">Payer / Deductee</th>
                <th className="px-3 py-2.5 text-right">Amount (BDT)</th>
                <th className="px-3 py-2.5 text-center">Treasury Status</th>
                <th className="px-3 py-2.5 text-center">Tax Credit Status</th>
                <th className="px-3 py-2.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredReceipts.map((rcpt) => (
                <tr key={rcpt.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-mono-plex font-bold text-emerald-950 whitespace-nowrap">
                    {rcpt.challanNo}
                  </td>
                  <td className="px-3 py-2.5 font-mono-plex text-slate-700 whitespace-nowrap">
                    {rcpt.tokenNumber}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-slate-900 whitespace-nowrap">
                    {rcpt.paymentCategory.replace(/_/g, ' ')}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
                    {rcpt.assessmentYear}
                  </td>
                  <td className="px-3 py-2.5 text-slate-800">
                    <div className="font-medium truncate max-w-[160px]">{rcpt.payerName}</div>
                    <div className="text-[10px] text-slate-500 font-mono-plex">{rcpt.payerTin}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono-plex font-bold text-slate-900 whitespace-nowrap">
                    {formatCurrency(rcpt.totalAmount, language)}
                  </td>
                  <td className="px-3 py-2.5 text-center whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      {rcpt.treasuryStatus}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      rcpt.taxCreditStatus === 'CREDITED_TO_LEDGER'
                        ? 'bg-emerald-100 text-emerald-800'
                        : rcpt.taxCreditStatus === 'NOT_APPLICABLE'
                        ? 'bg-slate-200 text-slate-700'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {rcpt.taxCreditStatus}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center whitespace-nowrap">
                    <button
                      onClick={() => selectReceipt(rcpt.id)}
                      className="px-2.5 py-1 rounded bg-slate-100 hover:bg-emerald-100 text-emerald-900 font-semibold cursor-pointer text-[11px]"
                    >
                      View Challan
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
