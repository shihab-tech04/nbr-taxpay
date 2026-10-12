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
    {name:'NBR e-Return',acronym:'eReturn',role:'Tax return service',status:'NOT CONNECTED',lastSync:'Never',features:'No return data or credit synchronization is configured.'},
    {name:'e-Ledger',acronym:'eLedger',role:'Tax ledger service',status:'NOT CONNECTED',lastSync:'Never',features:'No authoritative liability, payment, credit or reconciliation exchange is configured.'},
    {name:'e-TDS',acronym:'eTDS',role:'Withholding records',status:'NOT CONNECTED',lastSync:'Never',features:'No withholding certificate verification or deductee-credit import is configured.'},
    {name:'Automated Challan System',acronym:'A-Challan',role:'Treasury payment evidence',status:'NOT CONNECTED',lastSync:'Never',features:'No live Treasury scroll, official receipt or gateway session is available.'},
    {name:'e-TIN Registry',acronym:'e-TIN',role:'Taxpayer identification',status:'NOT CONNECTED',lastSync:'Never',features:'No real TIN registry verification or jurisdiction lookup is configured.'},
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
              External services — integration status
            </h1>
            <p className="text-xs text-slate-500">
              Planned connections only. This independent TaxPay demonstration has no authenticated exchange with these government systems.
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
                  Current boundary: {srv.features}
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{srv.status}</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Last successful sync: {srv.lastSync}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
