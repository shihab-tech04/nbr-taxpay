import React, { useState } from 'react';
import { 
  FileCheck2, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ShieldCheck, 
  UserCheck, 
  ArrowRight,
  XCircle,
  FileText,
  Lock
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';

export const CorrectionQueue: React.FC = () => {
  const { corrections, userRole, advanceCorrectionWorkflow, setUserRole } = useTaxState();
  const [remarks, setRemarks] = useState('');
  const [actionTicketId, setActionTicketId] = useState<string | null>(null);

  const canReview = userRole === 'OFFICER_REVIEWER' || userRole === 'OFFICER_APPROVER' || userRole === 'COMMISSIONER_ADMIN';
  const canApprove = userRole === 'OFFICER_APPROVER' || userRole === 'COMMISSIONER_ADMIN';

  const handleEndorse = (ticketId: string) => {
    if (!remarks.trim()) {
      alert('Please enter reviewer endorsement remarks.');
      return;
    }
    advanceCorrectionWorkflow(ticketId, 'REVIEWER_CHECKED', remarks);
    setRemarks('');
    setActionTicketId(null);
  };

  const handleApprove = (ticketId: string) => {
    if (!remarks.trim()) {
      alert('Please enter statutory sanction order remarks.');
      return;
    }
    advanceCorrectionWorkflow(ticketId, 'APPROVER_FINALIZED', remarks);
    setRemarks('');
    setActionTicketId(null);
  };

  const handleReject = (ticketId: string) => {
    if (!remarks.trim()) {
      alert('Please enter statutory rejection grounds.');
      return;
    }
    advanceCorrectionWorkflow(ticketId, 'REJECTED', remarks);
    setRemarks('');
    setActionTicketId(null);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-serif-fraunces text-2xl font-bold text-slate-900">
                Maker-Reviewer-Approver (M-R-A) Correction Queue
              </h1>
              <p className="text-xs text-slate-500">
                Statutory three-tier segregation of duties for tax payment ledger rectification and assessment year migration.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Active Officer Role:</span>
            <span className="font-bold px-2.5 py-1 rounded bg-emerald-950 text-amber-300 font-mono">
              {userRole}
            </span>
          </div>
        </div>

        {/* Segregation Rule Notice */}
        <div className="mb-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <span>Statutory Segregation of Duties Control:</span>
          </div>
          <p className="text-slate-600 leading-relaxed">
            • <strong>Maker (Assistant Commissioner):</strong> Submits clerical mismatch findings.<br />
            • <strong>Reviewer (Inspecting Joint Commissioner):</strong> Validates return status & endorses.<br />
            • <strong>Approver (Commissioner of Taxes):</strong> Exercises Section 296 administrative power to sanction ledger migration.
          </p>
          <div className="pt-1 flex items-center gap-2">
            <span className="text-slate-500 text-[11px]">Simulate role for testing:</span>
            <button
              onClick={() => setUserRole('OFFICER_REVIEWER')}
              className="text-[11px] underline font-semibold text-emerald-800 hover:text-emerald-950 cursor-pointer"
            >
              Switch to Reviewer
            </button>
            <span className="text-slate-300">|</span>
            <button
              onClick={() => setUserRole('OFFICER_APPROVER')}
              className="text-[11px] underline font-semibold text-emerald-800 hover:text-emerald-950 cursor-pointer"
            >
              Switch to Approver
            </button>
          </div>
        </div>

        {/* Correction Tickets List */}
        <div className="space-y-4">
          {corrections.map((corr) => {
            const isTargeted = actionTicketId === corr.id;

            return (
              <div key={corr.id} className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm text-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-plex font-bold text-sm text-slate-900">{corr.ticketNo}</span>
                      <span className="text-slate-400">•</span>
                      <span className="font-mono-plex font-bold text-emerald-900">{corr.challanNo}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Taxpayer: <strong className="text-slate-800">{corr.taxpayerName}</strong> (TIN: {corr.taxpayerTin})
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded text-xs font-bold ${
                    corr.workflowStage === 'APPROVER_FINALIZED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                    corr.workflowStage === 'REVIEWER_CHECKED' ? 'bg-indigo-100 text-indigo-800 border border-indigo-300' :
                    corr.workflowStage === 'REJECTED' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                    'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}>
                    {corr.workflowStage}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Requested Amendment:</span>
                    <strong className="text-slate-800">AY {corr.currentAssessmentYear}</strong> ➔ <strong className="text-emerald-800 font-bold">AY {corr.proposedAssessmentYear}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Jurisdiction Migration:</span>
                    <span>{corr.currentCircle} ➔ {corr.proposedCircle}</span>
                  </div>
                </div>

                <p className="text-slate-600 bg-white p-2 rounded border border-slate-200 text-[11px]">
                  <strong>Reason:</strong> {corr.reason}
                </p>

                {/* Audit trail of remarks */}
                <div className="space-y-1 text-[11px] text-slate-600">
                  {corr.makerRemarks && <div>• <strong>Maker Remarks:</strong> {corr.makerRemarks}</div>}
                  {corr.reviewerRemarks && <div>• <strong>Reviewer Remarks:</strong> {corr.reviewerRemarks}</div>}
                  {corr.approverRemarks && <div className="text-emerald-800 font-semibold">• <strong>Approver Sanction:</strong> {corr.approverRemarks}</div>}
                </div>

                {/* Action Area for Reviewer and Approver */}
                {corr.workflowStage !== 'APPROVER_FINALIZED' && corr.workflowStage !== 'REJECTED' && (
                  <div className="pt-3 border-t border-slate-200">
                    {isTargeted ? (
                      <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-300">
                        <label className="block font-bold text-slate-800">
                          Officer Statutory Remarks / Order Reference:
                        </label>
                        <input
                          type="text"
                          placeholder="Enter statutory grounds or order number..."
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          className="w-full px-3 py-1.5 rounded border border-slate-300 bg-white text-xs"
                        />
                        <div className="flex gap-2 justify-end pt-1">
                          <button
                            onClick={() => setActionTicketId(null)}
                            className="px-3 py-1 rounded bg-slate-200 text-slate-700 hover:bg-slate-300 cursor-pointer font-medium"
                          >
                            Cancel
                          </button>

                          {corr.workflowStage === 'MAKER_SUBMITTED' && canReview && (
                            <button
                              onClick={() => handleEndorse(corr.id)}
                              className="px-4 py-1 rounded bg-indigo-700 hover:bg-indigo-800 text-white font-bold cursor-pointer"
                            >
                              Endorse to Approver
                            </button>
                          )}

                          {corr.workflowStage === 'REVIEWER_CHECKED' && canApprove && (
                            <>
                              <button
                                onClick={() => handleReject(corr.id)}
                                className="px-3 py-1 rounded bg-rose-700 hover:bg-rose-800 text-white font-bold cursor-pointer"
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => handleApprove(corr.id)}
                                className="px-4 py-1 rounded bg-emerald-800 hover:bg-emerald-900 text-white font-bold cursor-pointer"
                              >
                                Sanction & Re-Attribute Challan
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        {corr.workflowStage === 'MAKER_SUBMITTED' && (
                          <button
                            onClick={() => setActionTicketId(corr.id)}
                            className="px-3 py-1 rounded bg-indigo-50 border border-indigo-200 text-indigo-900 font-semibold hover:bg-indigo-100 cursor-pointer"
                          >
                            Review & Endorse
                          </button>
                        )}
                        {corr.workflowStage === 'REVIEWER_CHECKED' && (
                          <button
                            onClick={() => setActionTicketId(corr.id)}
                            className="px-3 py-1 rounded bg-emerald-50 border border-emerald-300 text-emerald-950 font-bold hover:bg-emerald-100 cursor-pointer"
                          >
                            Approver Sanction Action
                          </button>
                        )}
                      </div>
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
