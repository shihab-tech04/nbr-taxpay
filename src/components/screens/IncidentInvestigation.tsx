import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Search, 
  CheckCircle2, 
  Clock, 
  FileText, 
  ArrowRight,
  ShieldAlert,
  Send
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { formatCurrency } from '../../services/numberFormat';

export const IncidentInvestigation: React.FC = () => {
  const { incidents, language, logAuditAction } = useTaxState();
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [findings, setFindings] = useState('');
  const [reconciledTickets, setReconciledTickets] = useState<Record<string, string>>({});

  const handleResolve = (id: string) => {
    if (!findings.trim()) {
      alert('Please specify officer investigation findings.');
      return;
    }
    setReconciledTickets(prev => ({ ...prev, [id]: findings }));
    logAuditAction('INCIDENT_RESOLVED', id, `Incident resolved with findings: ${findings}`);
    setFindings('');
    setSelectedIncidentId(null);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4 mb-5">
          <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-800 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-serif-fraunces text-2xl font-bold text-slate-900">
              Gateway Settlement Incident Investigation & Triage
            </h1>
            <p className="text-xs text-slate-500">
              Revenue Officer investigation console for citizen payment discrepancies, timed out MFS debits, and wrong TIN allocations.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {incidents.map((inc) => {
            const isReconciled = Boolean(reconciledTickets[inc.id]) || inc.status === 'RECONCILED';
            const currentFindings = reconciledTickets[inc.id] || inc.officerFindings;
            const isEditing = selectedIncidentId === inc.id;

            return (
              <div key={inc.id} className="p-5 rounded-xl border border-slate-200 bg-white text-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-plex font-bold text-sm text-slate-900">{inc.incidentNumber}</span>
                      <span className="text-slate-400">•</span>
                      <span className="font-medium text-slate-800">{inc.reporterName}</span>
                      <span className="text-slate-500 font-mono">({inc.reporterContact})</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Reported: {inc.reportDate} | Channel: <strong>{inc.gateway}</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-mono-plex font-bold text-slate-900">
                      {formatCurrency(inc.amount, language)}
                    </span>
                    <span className={`px-2.5 py-1 rounded text-xs font-bold ${
                      isReconciled ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {isReconciled ? 'RECONCILED' : inc.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg text-slate-700">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Txn Reference:</span>
                    <strong className="font-mono-plex">{inc.transactionReference}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Category:</span>
                    <span>{inc.category.replace(/_/g, ' ')}</span>
                  </div>
                </div>

                <p className="text-slate-600 bg-white p-2.5 rounded border border-slate-200 leading-relaxed">
                  {inc.description}
                </p>

                {currentFindings && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950">
                    <strong className="block text-[11px] text-emerald-900">Officer Resolution Record:</strong>
                    <p className="mt-0.5">{currentFindings}</p>
                  </div>
                )}

                {!isReconciled && (
                  <div className="pt-2 flex justify-end">
                    {isEditing ? (
                      <div className="w-full space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-300">
                        <label className="block font-semibold text-slate-800">
                          Enter Settlement & Clearing Investigation Findings:
                        </label>
                        <textarea
                          rows={2}
                          placeholder="State matching bank batch ID, manual A-Challan token re-generation, or fund refund status..."
                          value={findings}
                          onChange={(e) => setFindings(e.target.value)}
                          className="w-full px-3 py-1.5 rounded border border-slate-300 bg-white text-xs"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setSelectedIncidentId(null)}
                            className="px-3 py-1 rounded bg-slate-200 text-slate-700 hover:bg-slate-300 cursor-pointer font-medium"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleResolve(inc.id)}
                            className="px-4 py-1 rounded bg-emerald-800 hover:bg-emerald-900 text-white font-bold cursor-pointer"
                          >
                            Mark Reconciled & Issue Challan
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setSelectedIncidentId(inc.id)}
                        className="px-3.5 py-1.5 rounded bg-emerald-900 hover:bg-emerald-950 text-amber-300 font-semibold cursor-pointer"
                      >
                        Investigate & Reconcile
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
