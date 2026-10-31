import React, { useState } from 'react';
import { 
  BrainCircuit, 
  AlertTriangle, 
  TrendingUp, 
  ShieldAlert, 
  Search, 
  ArrowRight,
  CheckCircle2,
  Filter
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { formatCurrency } from '../../services/numberFormat';

export const IntelligenceScreen: React.FC = () => {
  const { language } = useTaxState();

  const anomalies = [
    {
      id: 'ANOM-2026-081',
      tin: 'DEMO-TIN-001',
      taxpayerName: 'Md. Tariqul Islam Chowdhury',
      type: 'TDS_MISMATCH',
      severity: 'MEDIUM',
      detectedDiscrepancy: 'e-TDS deducted by clients totals ৳ 1,20,000; however return declared gross receipts reflect ৳ 80,000 difference.',
      potentialYield: 47400,
      confidenceScore: 94,
      action: 'Issued Demand Notice DN-2023-164-90'
    },
    {
      id: 'ANOM-2026-094',
      tin: 'DEMO-TIN-002',
      taxpayerName: 'Bengal Tech Innovations Ltd.',
      type: 'BIN_TURNOVER_VARIANCE',
      severity: 'HIGH',
      detectedDiscrepancy: 'VAT Return monthly sales reported ৳ 12.4 Cr; whereas Section 173 Return sales declared ৳ 9.1 Cr.',
      potentialYield: 825000,
      confidenceScore: 98,
      action: 'Flagged for Section 213 Comprehensive Audit'
    },
    {
      id: 'ANOM-2026-102',
      tin: 'DEMO-TIN-003',
      taxpayerName: 'Padma Bridge Railway Corp',
      type: 'WITHHOLDING_DEPOSIT_TIMING',
      severity: 'LOW',
      detectedDiscrepancy: 'TDS deducted on August payroll deposited on 24 September (8 days past statutory timeline). Simple interest applicable.',
      potentialYield: 15400,
      confidenceScore: 89,
      action: 'Notice under Section 271'
    }
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4 mb-5">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-serif-fraunces text-2xl font-bold text-slate-900">
              Revenue Intelligence & Anomaly Analytics
            </h1>
            <p className="text-xs text-slate-500">
              Automated data cross-matching between e-TDS withholding scrolls, bank transactions, and annual return filings.
            </p>
          </div>
        </div>

        {/* Intelligence Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block">Total Cross-System Mismatches:</span>
            <span className="font-mono-plex font-bold text-xl text-slate-900 mt-1 block">3 Active Flags</span>
            <span className="text-[10px] text-slate-400">Taxes Zone-08 Surveillance</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block">Potential Revenue Yield:</span>
            <span className="font-mono-plex font-bold text-xl text-emerald-900 mt-1 block">
              ৳ 8,87,800
            </span>
            <span className="text-[10px] text-emerald-700">Identified Unassessed Tax</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block">Algorithm Confidence:</span>
            <span className="font-mono-plex font-bold text-xl text-indigo-900 mt-1 block">94.8% Average</span>
            <span className="text-[10px] text-indigo-700">Deterministic Cross-Match</span>
          </div>
        </div>

        {/* Anomaly Cases */}
        <div className="space-y-4">
          {anomalies.map(anom => (
            <div key={anom.id} className="p-5 rounded-xl border border-slate-200 bg-white text-xs space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono-plex font-bold text-sm text-slate-900">{anom.id}</span>
                  <span className="text-slate-400">•</span>
                  <span className="font-bold text-slate-800">{anom.taxpayerName}</span>
                  <span className="font-mono text-slate-500">({anom.tin})</span>
                </div>

                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  anom.severity === 'HIGH' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                  anom.severity === 'MEDIUM' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {anom.severity} PRIORITY
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg text-slate-700">
                <strong>Anomaly Detail:</strong>
                <p className="mt-0.5 text-slate-600 leading-relaxed">{anom.detectedDiscrepancy}</p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-1">
                <div>
                  Potential Tax Yield: <strong className="font-mono-plex text-emerald-900">{formatCurrency(anom.potentialYield, language)}</strong>
                </div>
                <div className="text-indigo-950 font-semibold">
                  Officer Action: {anom.action}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
