import React from 'react';
import { 
  BookOpen, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  CreditCard
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { formatCurrency } from '../../services/numberFormat';

export const TaxLedger: React.FC = () => {
  const { ledgerEntries, taxpayerProfile, language, navigate } = useTaxState();

  const totalDebits = ledgerEntries.reduce((acc, curr) => acc + curr.debit, 0);
  const totalCredits = ledgerEntries.reduce((acc, curr) => acc + curr.credit, 0);
  const netBalance = totalCredits - totalDebits;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-serif-fraunces text-2xl font-bold text-slate-900">
                Illustrative Tax Ledger (not NBR verified)
              </h1>
              <p className="text-xs text-slate-500">
                Taxpayer e-TIN: <strong className="font-mono-plex text-taxpay-dark">{taxpayerProfile.tin}</strong> | Circle: {taxpayerProfile.taxCircle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const element = document.createElement('a');
                const file = new Blob([JSON.stringify(ledgerEntries, null, 2)], { type: 'application/json' });
                element.href = URL.createObjectURL(file);
                element.download = `TaxLedger_${taxpayerProfile.tin}.json`;
                document.body.appendChild(element);
                element.click();
                document.body.removeChild(element);
              }}
              className="px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Ledger</span>
            </button>
            <button
              onClick={() => navigate('wizard')}
              className="px-4 py-2 bg-taxpay-primary hover:bg-taxpay-dark text-amber-300 font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <CreditCard className="w-4 h-4" />
              <span>Deposit Tax</span>
            </button>
          </div>
        </div>

        {/* Ledger Balance Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block">Total Assessed Debits (Liabilities):</span>
            <div className="flex items-center gap-2 mt-1">
              <TrendingDown className="w-4 h-4 text-rose-600" />
              <span className="font-mono-plex font-bold text-lg text-rose-800">
                {formatCurrency(totalDebits, language)}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block">Illustrative Credit Entries (unverified):</span>
            <div className="flex items-center gap-2 mt-1">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span className="font-mono-plex font-bold text-lg text-taxpay-dark">
                {formatCurrency(totalCredits, language)}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300">
            <span className="text-emerald-800 font-medium block">Example Net Position (not recognized):</span>
            <div className="font-mono-plex font-bold text-lg text-taxpay-dark mt-1">
              {netBalance >= 0 ? `+${formatCurrency(netBalance, language)}` : `-${formatCurrency(Math.abs(netBalance), language)}`}
            </div>
            <span className="text-[10px] text-emerald-700 block mt-0.5">
              {netBalance >= 0 ? 'Sample surplus, not carryforward entitlement' : 'Sample deficit; no verified demand'}
            </span>
          </div>
        </div>

        <p className="mb-4 text-xs text-slate-600">
          These are fictional shared ledger fixtures without verified taxpayer ownership. They must not be used as credit balances or reconciliation evidence.
        </p>
        <div className="grid gap-3 md:hidden">
          {ledgerEntries.map(entry => (
            <article key={entry.id} className="rounded-xl border border-taxpay-border bg-white p-4 space-y-2">
              <h2 className="text-sm font-semibold text-taxpay-text">{entry.headName}</h2>
              <p className="text-xs text-slate-600">{entry.date} · AY {entry.assessmentYear}</p>
              <p className="text-xs font-mono-plex break-all">{entry.headCode} · {entry.challanNo}</p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><p>Debit · illustrative</p><strong>{formatCurrency(entry.debit,language)}</strong></div>
                <div><p>Credit · illustrative</p><strong>{formatCurrency(entry.credit,language)}</strong></div>
              </div>
              <p className="text-xs font-semibold text-taxpay-dark">Demo status: {entry.status}</p>
            </article>
          ))}
        </div>
        {/* Ledger Entries Table */}
        <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-lg">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold text-left">
              <tr>
                <th className="px-3 py-2.5">Date</th>
                <th className="px-3 py-2.5">AY</th>
                <th className="px-3 py-2.5">Particulars & Economic Code</th>
                <th className="px-3 py-2.5">Challan Ref</th>
                <th className="px-3 py-2.5 text-right text-rose-700">Debit (Liability)</th>
                <th className="px-3 py-2.5 text-right text-emerald-800">Credit (Payment)</th>
                <th className="px-3 py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {ledgerEntries.map((entry) => (
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
                  <td className="px-3 py-2 text-right font-mono-plex font-bold text-emerald-800">
                    {entry.credit > 0 ? formatCurrency(entry.credit, language) : '—'}
                  </td>
                  <td className="px-3 py-2 text-center whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                      <CheckCircle2 className="w-3 h-3" />
                      DEMO RECORD
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
