import React from 'react';
import { 
  Printer, 
  Download, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  ShieldCheck, 
  QrCode, 
  ArrowLeft,
  Building2,
  Copy,
  Info
} from 'lucide-react';
import { ChallanReceipt } from '../../types/tax';
import { formatCurrency, toBengaliNumeral } from '../../services/numberFormat';
import { useTaxState } from '../../services/taxState';

interface ReceiptViewProps {
  receipt: ChallanReceipt;
  onBack?: () => void;
}

export const ReceiptView: React.FC<ReceiptViewProps> = ({ receipt, onBack }) => {
  const { language, navigate } = useTaxState();

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Top Actions Bar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
        <button
          onClick={onBack || (() => navigate('history'))}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 hover:text-emerald-950 px-3 py-1.5 rounded bg-emerald-50 hover:bg-emerald-100 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Records</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-800 hover:bg-emerald-900 text-white px-3.5 py-1.5 rounded cursor-pointer shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Demo Receipt</span>
          </button>
          <button
            onClick={() => {
              const element = document.createElement('a');
              const file = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' });
              element.href = URL.createObjectURL(file);
              element.download = `${receipt.challanNo}.json`;
              document.body.appendChild(element);
              element.click();
              document.body.removeChild(element);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded cursor-pointer border border-slate-300"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Record (JSON)</span>
          </button>
        </div>
      </div>

      {/* Unofficial printable demonstration receipt; never proof of payment or credit. */}
      <div className="print-card bg-white border border-slate-300 rounded-xl shadow-md p-6 sm:p-8 relative overflow-hidden text-slate-800 font-sans">
        {/* Subtle Watermark Stamp */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5 select-none rotate-[-25deg]">
          <div className="text-center font-bold text-7xl font-mono border-8 border-slate-900 p-8 rounded-3xl">
            NBR TAXPAY DEMO SIMULATION
          </div>
        </div>

        {/* Challan Document Header */}
        <div className="text-center pb-6 border-b-2 border-taxpay-primary space-y-1 relative">
          <div className="flex items-center justify-center gap-2 text-taxpay-dark">
            <Building2 className="w-8 h-8 text-emerald-800" />
            <h1 className="font-serif-fraunces text-xl sm:text-2xl font-bold tracking-tight text-taxpay-dark">
              TaxPay — Unofficial Demonstration Receipt
            </h1>
          </div>
          <h2 className="text-sm sm:text-base font-semibold text-emerald-900">
            Illustrative A-Challan Layout (not issued by NBR)
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Fictional data — not a Treasury settlement confirmation or official Form TR-6
          </p>

          <div className="absolute right-0 top-0 hidden sm:flex flex-col items-end">
            <div className="border border-slate-300 rounded p-1 bg-slate-50">
              <QrCode className="w-14 h-14 text-slate-800" />
            </div>
            <span className="text-[10px] text-slate-500 font-mono mt-0.5">DEMO ONLY</span>
          </div>
        </div>

        {/* Challan Identifiers Ribbon */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3 my-5 text-xs">
          <div>
            <span className="text-slate-500 block">Challan Number:</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="font-mono-plex font-bold text-sm text-emerald-950">
                {receipt.challanNo}
              </span>
              <button 
                onClick={() => handleCopy(receipt.challanNo)}
                className="no-print text-slate-400 hover:text-slate-700" 
                title="Copy Challan No"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div>
            <span className="text-slate-500 block">Token Number:</span>
            <span className="font-mono-plex font-bold text-sm text-slate-900 mt-0.5 block">
              {receipt.tokenNumber}
            </span>
          </div>

          <div>
            <span className="text-slate-500 block">Deposit Timestamp:</span>
            <span className="font-mono-plex font-medium text-slate-800 mt-0.5 block">
              {receipt.completedAt || receipt.createdAt}
            </span>
          </div>
        </div>

        {/* Two-Column Parties & Jurisdictions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6 text-xs border-b border-slate-200 pb-6">
          <div className="space-y-2">
            <h3 className="font-bold text-xs uppercase tracking-wider text-emerald-900 border-b border-emerald-100 pb-1">
              Payer & Taxpayer Particulars
            </h3>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-slate-500">Payer Name:</span>
              <span className="col-span-2 font-semibold text-slate-900">{receipt.payerName}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-slate-500">e-TIN:</span>
              <span className="col-span-2 font-mono-plex font-bold text-emerald-900">{receipt.payerTin}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-slate-500">Assessment Year:</span>
              <span className="col-span-2 font-bold text-slate-800">{receipt.assessmentYear}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-slate-500">Taxes Zone:</span>
              <span className="col-span-2 text-slate-800">{receipt.taxZone}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-slate-500">Taxes Circle:</span>
              <span className="col-span-2 text-slate-800">{receipt.taxCircle}</span>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-bold text-xs uppercase tracking-wider text-emerald-900 border-b border-emerald-100 pb-1">
              Treasury & Settlement Clearing
            </h3>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-slate-500">Payment Gateway:</span>
              <span className="col-span-2 font-medium text-slate-900">{receipt.paymentMethod}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-slate-500">Gateway Txn ID:</span>
              <span className="col-span-2 font-mono-plex text-slate-700">{receipt.gatewayTransactionId}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-slate-500">Treasury Scroll:</span>
              <span className="col-span-2 font-mono-plex font-semibold text-emerald-900">
                {receipt.treasuryScrollNo || 'Pending Scroll Confirmation'}
              </span>
            </div>

            {/* WITHHOLDING SPECIFIC SEPARATION */}
            {receipt.isWithholding && (
              <div className="mt-3 p-2 rounded bg-amber-50 border border-amber-200 text-[11px] space-y-1">
                <span className="font-bold text-amber-900 block flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-amber-700" />
                  Withholding Tax Deposit Notice
                </span>
                <p className="text-amber-800 leading-tight">
                  Deposited on behalf of Deductee TIN: <strong className="font-mono">{receipt.deducteeTin || 'Unspecified Vendor'}</strong>.
                  This deposit does NOT constitute a personal income tax credit for the withholding agent.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Financial Line Items Table */}
        <div className="my-6">
          <h3 className="font-bold text-xs uppercase tracking-wider text-emerald-900 mb-2">
            Payment Breakdown & Head Classification
          </h3>
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold text-left">
                <tr>
                  <th className="px-3 py-2.5">Economic Head Code</th>
                  <th className="px-3 py-2.5">Head Description</th>
                  <th className="px-3 py-2.5 text-right">Tax (BDT)</th>
                  <th className="px-3 py-2.5 text-right">Penalty</th>
                  <th className="px-3 py-2.5 text-right">Surcharge</th>
                  <th className="px-3 py-2.5 text-right">Interest</th>
                  <th className="px-3 py-2.5 text-right font-bold">Total (BDT)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {receipt.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2 font-mono-plex text-emerald-900 font-medium whitespace-nowrap">
                      {item.economicCode}
                    </td>
                    <td className="px-3 py-2 text-slate-800">
                      <div className="font-medium">{item.headNameEn}</div>
                      {item.note && <div className="text-[11px] text-slate-500 italic">{item.note}</div>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono-plex">{formatCurrency(item.taxAmount, language)}</td>
                    <td className="px-3 py-2 text-right font-mono-plex">{formatCurrency(item.penaltyAmount, language)}</td>
                    <td className="px-3 py-2 text-right font-mono-plex">{formatCurrency(item.surchargeAmount, language)}</td>
                    <td className="px-3 py-2 text-right font-mono-plex">{formatCurrency(item.interestAmount, language)}</td>
                    <td className="px-3 py-2 text-right font-mono-plex font-bold text-slate-900">
                      {formatCurrency(item.totalAmount, language)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-emerald-50/60 font-bold border-t-2 border-slate-300">
                <tr>
                  <td colSpan={6} className="px-3 py-2.5 text-right text-emerald-950 uppercase">
                    Grand Total Remitted:
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono-plex text-sm text-emerald-950">
                    {formatCurrency(receipt.totalAmount, language)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Dual Financial Status Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs">
          {/* Treasury Status */}
          <div className="flex items-start gap-2.5">
            <div className="p-1.5 rounded-full bg-emerald-100 text-emerald-800 mt-0.5">
              <CheckCircle className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-slate-700 block">Treasury Status:</span>
              <span className="inline-block px-2 py-0.5 mt-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                {receipt.treasuryStatus}
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Simulated Treasury status only; no government funds were transferred.
              </p>
            </div>
          </div>

          {/* Tax Credit Entitlement Status */}
          <div className="flex items-start gap-2.5">
            <div className="p-1.5 rounded-full bg-blue-100 text-blue-800 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-slate-700 block">Tax Credit Recognition:</span>
              <span className={`inline-block px-2 py-0.5 mt-0.5 rounded text-[11px] font-bold border ${
                receipt.taxCreditStatus === 'CREDITED_TO_LEDGER'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : receipt.taxCreditStatus === 'NOT_APPLICABLE'
                  ? 'bg-slate-200 text-slate-700 border-slate-300'
                  : 'bg-amber-100 text-amber-800 border-amber-300'
              }`}>
                {receipt.taxCreditStatus}
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {receipt.taxCreditStatus === 'NOT_APPLICABLE'
                  ? 'No automatic agent credit; deductee entitlement requires separate verification.'
                  : 'No real NBR credit is established by this demonstration record.'}
              </p>
            </div>
          </div>
        </div>

        {/* Signatures & Certification Block */}
        <div className="mt-8 pt-6 border-t border-slate-200 flex flex-wrap justify-between items-end gap-4 text-xs text-slate-500">
          <div>
            <p className="font-mono text-[11px]">Demo reference (not a cryptographic verification hash):</p>
            <p className="font-mono text-[10px] text-slate-400">
              DEMO:{receipt.id}-{receipt.challanNo}
            </p>
          </div>
          <div className="text-right">
            <div className="font-serif-fraunces font-bold text-slate-700 text-sm">
              No official electronic signature
            </div>
            <p className="text-[10px] text-slate-400">
              Simulation only — not issued or signed by NBR or a bank
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
