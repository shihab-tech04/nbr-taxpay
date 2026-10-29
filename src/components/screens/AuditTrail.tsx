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
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold text-left">
              <tr>
                <th className="px-3 py-2.5">Timestamp</th>
                <th className="px-3 py-2.5">Officer / Actor</th>
                <th className="px-3 py-2.5">Action Code</th>
                <th className="px-3 py-2.5">Target ID</th>
                <th className="px-3 py-2.5">Details</th>
                <th className="px-3 py-2.5 font-mono">Record Token (not SHA-256)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50 font-mono-plex text-[11px]">
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{log.timestamp}</td>
                  <td className="px-3 py-2 text-slate-900 font-semibold">{log.actor}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 text-[10px]">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-bold text-emerald-950 whitespace-nowrap">{log.targetId}</td>
                  <td className="px-3 py-2 font-sans text-slate-700 min-w-[220px]">{log.details}</td>
                  <td className="px-3 py-2 text-slate-400 text-[10px] truncate max-w-[120px]" title={log.immutableHash}>
                    {log.immutableHash}
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
