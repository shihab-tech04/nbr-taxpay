import {TaxPayDataGrid} from '../ui/TaxPayDataTable';
import React, { useState } from 'react';
import { 
  ScrollText, 
  Search, 
  ShieldCheck, 
  Lock, 
  Filter, 
  Download,
  Clock,
  UserCheck
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';

export const AuditTrail: React.FC = () => {
  const { auditLogs } = useTaxState();
  const [query, setQuery] = useState('');

  const filteredLogs = auditLogs.filter(l => 
    query 
      ? l.actor.toLowerCase().includes(query.toLowerCase()) ||
        l.action.toLowerCase().includes(query.toLowerCase()) ||
        l.targetId.toLowerCase().includes(query.toLowerCase()) ||
        l.details.toLowerCase().includes(query.toLowerCase())
      : true
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center">
              <ScrollText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-serif-fraunces text-2xl font-bold text-slate-900">
                Officer Action Log
              </h1>
              <p className="text-xs text-slate-500">
                Actions are held in memory. No cryptographically verifiable or tamper-resistant audit chain has been established.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded border border-emerald-300 font-bold flex items-center gap-1">
              <Lock className="w-3.5 h-3.5" />
              <span>UNVERIFIED LOG</span>
            </span>
          </div>
        </div>

        {/* Filter Input */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search audit trail by actor, action, ticket, or details..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-mono-plex"
          />
        </div>

        {/* Audit Log Table */}

        <TaxPayDataGrid variant="tabular" rows={filteredLogs} getRowKey={log=>log.id}
          ariaLabel="Officer action log" mobileTestId="audit-trail-mobile-cards"
          columns={[
            {key:'timestamp',header:'Timestamp',renderCell:log=><p className="whitespace-nowrap text-taxpay-muted">{log.timestamp}</p>},
            {key:'actor',header:'Officer / Actor',renderCell:log=><p className="font-semibold">{log.actor}</p>},
            {key:'action',header:'Action code',renderCell:log=><p>{log.action}</p>},
            {key:'target',header:'Target ID',renderCell:log=><p className="break-all font-semibold">{log.targetId}</p>},
            {key:'details',header:'Details',renderCell:log=><p>{log.details}</p>},
            {key:'token',header:'Record token (not SHA-256)',renderCell:log=><p className="max-w-40 break-all text-taxpay-muted" title={log.immutableHash}>{log.immutableHash}</p>}
          ]}
          renderMobileCard={log=><>
            <div className="taxpay-mobile-table-card__header"><p className="taxpay-mobile-table-card__title">{log.actor}</p><p className="text-sm text-taxpay-muted">{log.timestamp}</p></div>
            <p className="taxpay-mobile-table-card__meta">{log.action} · {log.targetId}</p>
            <p className="taxpay-mobile-table-card__meta">{log.details}</p>
            <p className="taxpay-mobile-table-card__meta break-all" title={log.immutableHash}>{log.immutableHash}</p>
          </>}/>
        {filteredLogs.length===0&&<p className="taxpay-table-state" role="status">No matching audit records.</p>}
      </div>
    </div>
  );
};
