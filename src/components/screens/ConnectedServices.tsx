import React from 'react';
import { 
  Link2, 
  ExternalLink, 
  CheckCircle2, 
  RefreshCw, 
  ShieldCheck, 
  Database,
  Building2,
  Server
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';

export const ConnectedServices: React.FC = () => {
  const services = [
    {
      name: 'NBR e-Return Portal (etaxnbr.gov.bd)',
      acronym: 'eReturn',
      role: 'Annual Income Tax Return Electronic Filing',
      status: 'LINKED',
      lastSync: '10 mins ago',
      features: 'Automatic tax credit sync, Form 173 payment attachment'
    },
    {
      name: 'Central Tax Ledger (e-Ledger Core)',
      acronym: 'eLedger',
      role: 'Tax Credit & Demand Reconciliation Accounting Engine',
      status: 'LINKED',
      lastSync: 'Real-time via webhook',
      features: 'Double-entry debit/credit posting, advance tax credit recognition'
    },
    {
      name: 'e-TDS Withholding Tax Monitoring System',
      acronym: 'eTDS',
      role: 'Chapter VII Withholding Deductee Credit Verification',
      status: 'LINKED',
      lastSync: 'Real-time via webhook',
      features: 'Deductee TIN matching, Form 54 certificate verification'
    },
    {
      name: 'Automated Challan System (ACS A-Challan)',
      acronym: 'A-Challan',
      role: 'Bangladesh Bank Government Treasury Collection Engine',
      status: 'LINKED',
      lastSync: 'Active gateway session',
      features: 'Instant treasury scroll assignment, 13-digit code validation'
    },
    {
      name: 'Central e-TIN Registry (incometax.gov.bd)',
      acronym: 'e-TIN',
      role: 'Taxpayer Master Identification & Jurisdiction Lookup',
      status: 'LINKED',
      lastSync: 'On-demand verification',
      features: '12-digit format check, circle & zone routing'
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4 mb-5">
          <div className="w-10 h-10 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center">
            <Link2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-serif-fraunces text-2xl font-bold text-slate-900">
              Connected National Tax e-Services
            </h1>
            <p className="text-xs text-slate-500">
              Integrated national tax infrastructure status, single sign-on federation, and automatic data exchange.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {services.map((srv, idx) => (
            <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-slate-900">{srv.name}</h3>
                  <span className="font-mono text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-700">
                    {srv.acronym}
                  </span>
                </div>
                <p className="text-slate-600">{srv.role}</p>
                <div className="text-[11px] text-slate-500 font-mono">
                  Capabilities: {srv.features}
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{srv.status}</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Sync: {srv.lastSync}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
