import React from 'react';
import { 
  FileText, 
  CreditCard, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Building2,
  Receipt
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { formatCurrency } from '../../services/numberFormat';

export const TaxpayerDashboard: React.FC = () => {
  const { taxpayerProfile, receipts, ledgerEntries, navigate, language } = useTaxState();

  const userReceipts = receipts.filter(r => r.payerTin === taxpayerProfile.tin);
  const totalPaid = userReceipts.reduce((sum, r) => sum + r.totalAmount, 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 mb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              Assessment & Compliance Overview
            </span>
            <h1 className="font-serif-fraunces text-2xl font-bold text-slate-900">
              Taxpayer Obligations Dashboard
            </h1>
            <p className="text-xs text-slate-500">
              Taxpayer: <strong className="text-slate-800">{taxpayerProfile.nameEn}</strong> (TIN: {taxpayerProfile.tin})
            </p>
          </div>

          <button
            onClick={() => navigate('wizard')}
            className="px-4 py-2 bg-emerald-900 hover:bg-emerald-950 text-amber-300 font-bold rounded-lg text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <CreditCard className="w-4 h-4" />
            <span>Pay Current Obligation</span>
          </button>
        </div>

        {/* 3 Overview Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-slate-500 block">Total Tax Deposited (FY 2024-2026):</span>
            <span className="font-mono-plex font-bold text-xl text-emerald-950 block">
              {formatCurrency(totalPaid, language)}
            </span>
            <span className="text-emerald-700 font-semibold block text-[11px]">
              {userReceipts.length} Scrolled A-Challans
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-slate-500 block">Current Ledger Credit Balance:</span>
            <span className="font-mono-plex font-bold text-xl text-blue-900 block">
              {formatCurrency(ledgerEntries.reduce((acc, curr) => acc + curr.credit, 0), language)}
            </span>
            <span className="text-blue-700 font-semibold block text-[11px]">
              Available for e-Return AY 2025-2026
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-slate-500 block">Active Assessed Demands (S.214):</span>
            <span className="font-mono-plex font-bold text-xl text-amber-800 block">
              BDT 47,400
            </span>
            <span className="text-amber-700 font-semibold block text-[11px]">
              Demand Notice DN-2023-164-90 Pending
            </span>
          </div>
        </div>
      </div>

      {/* Advance Tax Four-Quarter Roadmap */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-800" />
            <h3 className="font-serif-fraunces font-bold text-lg text-slate-900">
              Statutory Advance Tax Calendar (Section 154 ITA 2023)
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-500">
            Assessment Year 2025-2026
          </span>
        </div>

        <p className="text-xs text-slate-600">
          Individual and corporate taxpayers with latest assessed income exceeding statutory thresholds are obligated to remit advance tax in four equal quarterly installments.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          {/* Q1 */}
          <div className="p-3.5 rounded-lg border bg-emerald-50/70 border-emerald-300 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-950">1st Quarter (25%)</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="text-[11px] text-slate-600">Due: 15 September 2025</div>
            <div className="font-mono-plex font-bold text-emerald-900 text-sm">BDT 25,000</div>
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-200 text-emerald-900">
              PAID & SCROLLED
            </span>
          </div>

          {/* Q2 */}
          <div className="p-3.5 rounded-lg border bg-amber-50/60 border-amber-300 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900">2nd Quarter (25%)</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-[11px] text-slate-600">Due: 15 December 2025</div>
            <div className="font-mono-plex font-bold text-slate-900 text-sm">BDT 25,000</div>
            <button
              onClick={() => navigate('wizard', { initialCategory: 'ADVANCE_TAX' })}
              className="w-full py-1 bg-amber-400 hover:bg-amber-300 text-emerald-950 font-bold rounded text-[11px] cursor-pointer"
            >
              Pay Q2 Now
            </button>
          </div>

          {/* Q3 */}
          <div className="p-3.5 rounded-lg border bg-slate-50 border-slate-200 space-y-2 opacity-80">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">3rd Quarter (25%)</span>
              <Clock className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-[11px] text-slate-500">Due: 15 March 2026</div>
            <div className="font-mono-plex font-bold text-slate-700 text-sm">BDT 25,000</div>
            <span className="text-[10px] text-slate-400 block">Upcoming</span>
          </div>

          {/* Q4 */}
          <div className="p-3.5 rounded-lg border bg-slate-50 border-slate-200 space-y-2 opacity-80">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">4th Quarter (25%)</span>
              <Clock className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-[11px] text-slate-500">Due: 15 June 2026</div>
            <div className="font-mono-plex font-bold text-slate-700 text-sm">BDT 25,000</div>
            <span className="text-[10px] text-slate-400 block">Upcoming</span>
          </div>
        </div>
      </div>

      {/* Source Tax Withholding Credits Realized on Your TIN */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-serif-fraunces font-bold text-lg text-slate-900">
              Verified TDS Credits Withheld by Third Parties
            </h3>
            <p className="text-xs text-slate-500">
              Taxes deducted at source under Chapter VII by your clients, employer, or banks and scrolled into Treasury.
            </p>
          </div>
          <button
            onClick={() => navigate('ledger')}
            className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
          >
            <span>View Full Ledger</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold text-left">
              <tr>
                <th className="px-3 py-2.5">Date</th>
                <th className="px-3 py-2.5">Deducting Authority</th>
                <th className="px-3 py-2.5">Head & Section</th>
                <th className="px-3 py-2.5">Challan Ref</th>
                <th className="px-3 py-2.5 text-right">Credit Amount (BDT)</th>
                <th className="px-3 py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              <tr className="hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-500 font-mono">2025-09-20</td>
                <td className="px-3 py-2 font-medium text-slate-900">Bengal Tech Innovations Ltd.</td>
                <td className="px-3 py-2 text-slate-600">S.94 (Professional IT Consultancy TDS)</td>
                <td className="px-3 py-2 font-mono-plex text-emerald-900 font-bold">AC-2025-09-99482103</td>
                <td className="px-3 py-2 text-right font-mono-plex font-bold text-emerald-900">
                  {formatCurrency(12000, language)}
                </td>
                <td className="px-3 py-2 text-center">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    VERIFIED & CREDITED
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-500 font-mono">2025-06-30</td>
                <td className="px-3 py-2 font-medium text-slate-900">Eastern Bank PLC</td>
                <td className="px-3 py-2 text-slate-600">S.102 (Bank Interest on Savings Account)</td>
                <td className="px-3 py-2 font-mono-plex text-emerald-900 font-bold">AC-2025-06-44102918</td>
                <td className="px-3 py-2 text-right font-mono-plex font-bold text-emerald-900">
                  {formatCurrency(3450, language)}
                </td>
                <td className="px-3 py-2 text-center">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    VERIFIED & CREDITED
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
