import React, { useState } from 'react';
import { 
  Award, 
  Download, 
  Printer, 
  CheckCircle2, 
  FileText, 
  ShieldCheck, 
  QrCode,
  Building2,
  Calendar
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { formatCurrency } from '../../services/numberFormat';

export const CertificatesView: React.FC = () => {
  const { taxpayerProfile, receipts, language } = useTaxState();
  const [selectedCert, setSelectedCert] = useState<'ANNUAL_PAYMENT' | 'WITHHOLDING_PROOF' | 'TRAVEL_CLEARANCE'>('ANNUAL_PAYMENT');

  const userReceipts = receipts.filter(r => r.payerTin === taxpayerProfile.tin);
  const totalPaid = userReceipts.reduce((acc, curr) => acc + curr.totalAmount, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-serif-fraunces text-2xl font-bold text-slate-900">
                Official Tax Certificates & Clearance Slips
              </h1>
              <p className="text-xs text-slate-500">
                Statutory certificates generated directly from Government Treasury deposit scrolls.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3.5 py-1.5 bg-taxpay-primary hover:bg-taxpay-dark text-amber-300 font-semibold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Certificate</span>
            </button>
          </div>
        </div>

        {/* Certificate Type Selector Tabs */}
        <div className="flex gap-2 border-b border-slate-200 pb-4 mb-6 text-xs">
          {[
            { id: 'ANNUAL_PAYMENT', label: 'Annual Tax Payment Certificate (AY 2024-2025)' },
            { id: 'WITHHOLDING_PROOF', label: 'Withholding Tax Credit Statement' },
            { id: 'TRAVEL_CLEARANCE', label: 'Travel Tax Clearance Slip' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedCert(tab.id as any)}
              className={`px-3 py-2 rounded-lg font-semibold transition-colors cursor-pointer ${
                selectedCert === tab.id
                  ? 'bg-purple-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Certificate Printable Render Frame */}
        <div className="print-card border-2 border-slate-800 rounded-xl p-8 bg-slate-50/40 relative overflow-hidden text-slate-900 space-y-6">
          <div className="text-center space-y-1 border-b border-slate-300 pb-5">
            <div className="w-12 h-12 mx-auto rounded-full bg-taxpay-dark text-amber-400 flex items-center justify-center font-bold text-xl border border-amber-400">
              NBR
            </div>
            <h2 className="font-serif-fraunces text-xl font-bold uppercase tracking-tight text-taxpay-dark">
              Government of the People\'s Republic of Bangladesh
            </h2>
            <h3 className="text-sm font-semibold text-slate-800">
              National Board of Revenue — Taxes Zone-08, Dhaka
            </h3>
            <p className="text-xs text-slate-500 font-mono">
              Certificate Reference: NBR-CERT-{taxpayerProfile.tin}-2026
            </p>
          </div>

          <div className="text-center">
            <span className="inline-block px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-emerald-100 text-taxpay-dark border border-emerald-300">
              {selectedCert === 'ANNUAL_PAYMENT'
                ? 'Income Tax Payment & Clearance Certificate'
                : selectedCert === 'WITHHOLDING_PROOF'
                ? 'Consolidated Withholding Tax Statement'
                : 'Passenger Travel Tax Verification Certificate'}
            </span>
          </div>

          <div className="text-xs text-slate-700 leading-relaxed space-y-3">
            <p>
              This is to certify that <strong className="text-slate-950 font-bold">{taxpayerProfile.nameEn}</strong>, holder of Taxpayer Identification Number (e-TIN) <strong className="font-mono-plex text-taxpay-dark">{taxpayerProfile.tin}</strong>, assessed under Circle-164, Taxes Zone-08, has remitted the following statutory direct taxes into the Bangladesh Government Treasury through electronic A-Challan:
            </p>

            <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 block">Total Payments Verified:</span>
                  <span className="font-mono-plex font-bold text-base text-taxpay-dark">
                    {formatCurrency(totalPaid, language)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Assessment Year:</span>
                  <span className="font-bold text-slate-900">2024-2025 & 2025-2026</span>
                </div>
                <div>
                  <span className="text-slate-500 block">A-Challan Count:</span>
                  <span className="font-bold text-slate-900">{userReceipts.length} Scrolled Transactions</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Compliance Standing:</span>
                  <span className="font-bold text-emerald-700">In Good Standing</span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 italic">
              This electronic certificate is issued pursuant to Section 240 of the Income Tax Act 2023. Authenticity may be verified via the TaxPay portal using the reference token below.
            </p>
          </div>

          <div className="border-t border-slate-300 pt-5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <QrCode className="w-12 h-12 text-slate-800" />
              <div className="text-[10px] text-slate-500 font-mono">
                <div>TOKEN: NBR-TK-{taxpayerProfile.tin.substring(0, 6)}</div>
                <div>DATE: {new Date().toISOString().split('T')[0]}</div>
              </div>
            </div>

            <div className="text-right">
              <div className="font-serif-fraunces font-bold text-sm text-slate-800">
                Deputy Commissioner of Taxes
              </div>
              <p className="text-[10px] text-slate-500">
                Circle-164, Taxes Zone-08, Dhaka
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
