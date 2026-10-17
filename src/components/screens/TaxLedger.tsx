import React from 'react';
import { BookOpen, Download, CheckCircle2, TrendingDown, TrendingUp } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { hasVerifiedTaxLedgerSource } from '../../services/taxpayerEvidence';
import { formatCurrency } from '../../services/numberFormat';

export const TaxLedger: React.FC = () => {
  const { ledgerEntries, language } = useTaxState();
  const bn = language === 'bn';

  const visibleEntries = hasVerifiedTaxLedgerSource ? ledgerEntries : [];
  const hasEntries = visibleEntries.length > 0;
  const totalDebits = visibleEntries.reduce((acc, curr) => acc + curr.debit, 0);
  const totalCredits = visibleEntries.reduce((acc, curr) => acc + curr.credit, 0);
  const netBalance = totalCredits - totalDebits;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-taxpay-light text-taxpay-dark flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-sans text-2xl font-bold text-slate-900">
                {bn ? 'কর লেজার' : 'Tax ledger'}
              </h1>
              <p className="text-xs text-slate-500">
                {bn ? 'লেজার তথ্য' : 'Ledger information'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!hasEntries}
              onClick={() => {
                const element = document.createElement('a');
                const file = new Blob([JSON.stringify(visibleEntries, null, 2)], { type: 'application/json' });
                element.href = URL.createObjectURL(file);
                element.download = 'TaxPay_shared_ledger_sample_NOT_OFFICIAL.json';
                document.body.appendChild(element);
                element.click();
                document.body.removeChild(element);
                URL.revokeObjectURL(element.href);
              }}
              className="px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{bn ? 'লেজার তথ্য নিন' : 'Export ledger data'}</span>
            </button>

          </div>
        </div>

        {/* Ledger Balance Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block">{bn ? 'ডেবিট' : 'Debits'}</span>
            <div className="flex items-center gap-2 mt-1">
              <TrendingDown className="w-4 h-4 text-rose-600" />
              <span className="font-mono-plex font-bold text-lg text-rose-800">
                {hasEntries ? formatCurrency(totalDebits, language) : (bn ? 'পাওয়া যাচ্ছে না' : 'Not available')}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block">{bn ? 'ক্রেডিট' : 'Credits'}</span>
            <div className="flex items-center gap-2 mt-1">
              <TrendingUp className="w-4 h-4 text-taxpay-primary" />
              <span className="font-mono-plex font-bold text-lg text-taxpay-dark">
                {hasEntries ? formatCurrency(totalCredits, language) : (bn ? 'পাওয়া যাচ্ছে না' : 'Not available')}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-taxpay-light border border-taxpay-border">
            <span className="text-taxpay-dark font-medium block">{bn ? 'পার্থক্য' : 'Difference'}</span>
            <div className="font-mono-plex font-bold text-lg text-taxpay-dark mt-1">
              {hasEntries ? netBalance >= 0 ? `+${formatCurrency(netBalance, language)}` : `-${formatCurrency(Math.abs(netBalance), language)}` : (bn ? 'পাওয়া যাচ্ছে না' : 'Not available')}
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:hidden">
          {visibleEntries.map(entry => (
            <article key={entry.id} className="rounded-xl border border-taxpay-border bg-white p-4 space-y-2">
              <h2 className="text-sm font-semibold text-taxpay-text">{entry.headName}</h2>
              <p className="text-xs text-slate-600">{entry.date} · AY {entry.assessmentYear}</p>
              <p className="text-xs font-mono-plex break-all">{entry.headCode} · {entry.challanNo}</p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><p>{bn ? 'ডেবিট' : 'Debit'}</p><strong>{formatCurrency(entry.debit,language)}</strong></div>
                <div><p>{bn ? 'ক্রেডিট' : 'Credit'}</p><strong>{formatCurrency(entry.credit,language)}</strong></div>
              </div>
              <p className="text-xs font-semibold text-taxpay-dark">{bn ? 'অবস্থা' : 'Status'}: {entry.status}</p>
            </article>
          ))}
        </div>
        {/* Ledger Entries Table */}
        {!hasEntries && (
          <p role="status" className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
            {bn ? 'এই অ্যাকাউন্টে এখনো কোনো লেজার রেকর্ড নেই।' : 'No ledger records are available for this account yet.'}
          </p>
        )}
        <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-lg">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold text-left">
              <tr>
                <th className="px-3 py-2.5">{bn ? 'তারিখ' : 'Date'}</th>
                <th className="px-3 py-2.5">{bn ? 'করবর্ষ' : 'AY'}</th>
                <th className="px-3 py-2.5">{bn ? 'বিবরণ ও অর্থনৈতিক কোড' : 'Particulars & Economic Code'}</th>
                <th className="px-3 py-2.5">{bn ? 'চালান রেফারেন্স' : 'Challan Ref'}</th>
                <th className="px-3 py-2.5 text-right text-rose-700">{bn ? 'ডেবিট (দায়)' : 'Debit (Liability)'}</th>
                <th className="px-3 py-2.5 text-right text-taxpay-dark">{bn ? 'ক্রেডিট (পেমেন্ট)' : 'Credit (Payment)'}</th>
                <th className="px-3 py-2.5 text-center">{bn ? 'অবস্থা' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {visibleEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-slate-600 whitespace-nowrap">
                    {entry.date}
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap">
                    {entry.assessmentYear}
                  </td>
                  <td className="px-3 py-2 text-slate-800">
                    <div className="font-medium">{entry.headName}</div>
                    <div className="text-[10px] text-slate-500 font-mono-plex">{entry.headCode}</div>
                  </td>
                  <td className="px-3 py-2 font-mono-plex text-taxpay-dark font-bold whitespace-nowrap">
                    {entry.challanNo}
                  </td>
                  <td className="px-3 py-2 text-right font-mono-plex font-bold text-rose-700">
                    {entry.debit > 0 ? formatCurrency(entry.debit, language) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono-plex font-bold text-taxpay-dark">
                    {entry.credit > 0 ? formatCurrency(entry.credit, language) : '—'}
                  </td>
                  <td className="px-3 py-2 text-center whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-taxpay-dark bg-taxpay-light px-2 py-0.5 rounded border border-taxpay-border">
                      <CheckCircle2 className="w-3 h-3" />
                      {bn ? 'যাচাই হয়নি' : 'NOT VERIFIED'}
                    </span>
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
