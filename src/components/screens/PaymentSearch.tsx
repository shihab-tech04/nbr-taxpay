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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-5 text-xs">
          <div className="md:col-span-2">
            <label className="block text-slate-600 mb-1 font-semibold">Search Query (Challan, Token, TIN, Name)</label>
            <input
              type="text"
              placeholder="e.g. AC-2025... or DEMO-TIN-001"
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
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Found <strong>{filtered.length}</strong> matching electronic Treasury records</span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold text-left">
                <tr>
                  <th className="px-3 py-2.5">Challan Number</th>
                  <th className="px-3 py-2.5">AY</th>
                  <th className="px-3 py-2.5">Payer Name</th>
                  <th className="px-3 py-2.5">TIN</th>
                  <th className="px-3 py-2.5 text-right">Amount (BDT)</th>
                  <th className="px-3 py-2.5">Scroll Number</th>
                  <th className="px-3 py-2.5 text-center">Status</th>
                  <th className="px-3 py-2.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filtered.map(rcpt => (
                  <tr key={rcpt.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono-plex font-bold text-emerald-950 whitespace-nowrap">
                      {rcpt.challanNo}
                    </td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{rcpt.assessmentYear}</td>
                    <td className="px-3 py-2 text-slate-900 font-medium">{rcpt.payerName}</td>
                    <td className="px-3 py-2 font-mono-plex text-slate-600">{rcpt.payerTin}</td>
                    <td className="px-3 py-2 text-right font-mono-plex font-bold text-slate-900 whitespace-nowrap">
                      {formatCurrency(rcpt.totalAmount, language)}
                    </td>
                    <td className="px-3 py-2 font-mono-plex text-slate-600 whitespace-nowrap">
                      {rcpt.treasuryScrollNo || 'Pending'}
                    </td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {rcpt.treasuryStatus}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <button
                        onClick={() => selectReceipt(rcpt.id)}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-emerald-100 text-emerald-900 font-semibold cursor-pointer text-[11px]"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
