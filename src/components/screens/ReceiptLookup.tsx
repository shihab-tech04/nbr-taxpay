import React, { useState } from 'react';
import { 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  QrCode, 
  ShieldCheck, 
  Building2, 
  ArrowRight,
  Printer
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { ChallanReceipt } from '../../types/tax';
import { ReceiptView } from '../common/ReceiptView';
import { formatCurrency } from '../../services/numberFormat';

export const ReceiptLookup: React.FC = () => {
  const { language, lookupReceipt, receipts, selectReceipt, navigate } = useTaxState();
  const [query, setQuery] = useState('');
  const [searchResult, setSearchResult] = useState<ChallanReceipt | null | 'NOT_FOUND'>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    const match = lookupReceipt(query);
    if (match) {
      setSearchResult(match);
    } else {
      setSearchResult('NOT_FOUND');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4 mb-5">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-serif-fraunces text-2xl font-bold text-slate-900">
              A-Challan & Token Verification Portal
            </h1>
            <p className="text-xs text-slate-500">
              Verify the authenticity, Treasury deposit scroll, and ledger credit status of any electronic tax challan.
            </p>
          </div>
        </div>

        {/* Search Input Box */}
        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Search by Challan Number, Token Number, or Gateway Transaction Reference
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Demo challan or token reference0 or BKSH-TXN-90283182"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 px-4 py-2.5 text-sm rounded-lg border border-slate-300 font-mono-plex focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
              <button
                type="submit"
                className="px-6 py-2.5 bg-emerald-900 hover:bg-emerald-950 text-amber-300 font-bold rounded-lg text-sm flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Search className="w-4 h-4" />
                <span>Verify Now</span>
              </button>
            </div>
          </div>

          {/* Quick Preset Queries for Demonstration Testing */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>Try sample records:</span>
            {receipts.slice(0, 3).map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setQuery(r.challanNo);
                  setSearchResult(r);
                }}
                className="font-mono text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded border border-slate-200 cursor-pointer"
              >
                {r.challanNo}
              </button>
            ))}
          </div>
        </form>

        {/* Not Found State */}
        {searchResult === 'NOT_FOUND' && (
          <div className="mt-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-rose-800">
              <AlertCircle className="w-5 h-5 text-rose-600" />
              <span>Challan Record Not Found in Treasury Register</span>
            </div>
            <p className="text-xs text-rose-700">
              No matching electronic payment was located for query: <strong className="font-mono">{query}</strong>.
            </p>
            <div className="text-[11px] text-rose-600 space-y-1 pt-1">
              <p>• If money was debited from your bank or MFS wallet without an A-Challan being generated, please report this incident immediately.</p>
              <button
                onClick={() => navigate('incident')}
                className="font-bold underline hover:text-rose-900 cursor-pointer"
              >
                File an Incident Report for Unreconciled Transaction
              </button>
            </div>
          </div>
        )}

        {/* Found Result Preview Card */}
        {searchResult && searchResult !== 'NOT_FOUND' && (
          <div className="mt-6 space-y-4">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-700" />
                <div>
                  <h3 className="font-bold text-sm">Authentic Bangladesh Treasury Challan Verified</h3>
                  <p className="text-xs text-emerald-800">
                    Scroll No: <strong className="font-mono">{searchResult.treasuryScrollNo}</strong> | Bank: Sonali Bank PLC
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => selectReceipt(searchResult.id)}
                  className="px-3.5 py-1.5 rounded bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Open Full Challan</span>
                </button>
              </div>
            </div>

            <ReceiptView receipt={searchResult} />
          </div>
        )}
      </div>
    </div>
  );
};
