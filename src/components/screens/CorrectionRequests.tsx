import React, { useState } from 'react';
import { 
  FileEdit, 
  Send, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ShieldCheck, 
  Upload, 
  ArrowRight,
  Info
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { ASSESSMENT_YEARS } from '../../data/mockData';
import { MASTER_PAYMENT_HEADS } from '../../data/paymentHeads';

export const CorrectionRequests: React.FC = () => {
  const { corrections, receipts, taxpayerProfile, addCorrectionRequest } = useTaxState();

  const [challanNo, setChallanNo] = useState(receipts[0]?.challanNo || '');
  const [currentAY, setCurrentAY] = useState('2024-2025');
  const [proposedAY, setProposedAY] = useState('2025-2026');
  const [currentCircle, setCurrentCircle] = useState(taxpayerProfile.taxCircle);
  const [proposedCircle, setProposedCircle] = useState(taxpayerProfile.taxCircle);
  const [currentHeadCode, setCurrentHeadCode] = useState('1-1141-0015-0201');
  const [proposedHeadCode, setProposedHeadCode] = useState('1-1141-0015-0201');
  const [reason, setReason] = useState('');
  const [submittedTicket, setSubmittedTicket] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!challanNo.trim() || !reason.trim()) {
      setError('Please provide the Challan number and an explanation of the requested amendment.');
      return;
    }
    setError('');

    const ticketNo = addCorrectionRequest({
      challanNo,
      taxpayerTin: taxpayerProfile.tin,
      taxpayerName: taxpayerProfile.nameEn,
      requestedBy: `${taxpayerProfile.nameEn} (Self)`,
      requestDate: new Date().toISOString().split('T')[0],
      currentAssessmentYear: currentAY,
      proposedAssessmentYear: proposedAY,
      currentCircle,
      proposedCircle,
      currentHeadCode,
      proposedHeadCode,
      reason,
      workflowStage: 'MAKER_SUBMITTED',
      makerRemarks: 'Submitted via taxpayer portal. Awaiting Revenue Officer initial scrutiny.'
    });

    setSubmittedTicket(ticketNo);
    setReason('');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4 mb-5">
          <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-800 flex items-center justify-center">
            <FileEdit className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-serif-fraunces text-2xl font-bold text-slate-900">
              Tax Payment Challan Correction Requests
            </h1>
            <p className="text-xs text-slate-500">
              Submit formal petition to rectify erroneous assessment years, tax circles, or economic payment heads under Section 296 administrative powers.
            </p>
          </div>
        </div>

        {submittedTicket && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-taxpay-dark space-y-1">
            <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Correction Ticket Logged: {submittedTicket}</span>
            </div>
            <p className="text-xs text-emerald-700">
              Your petition has entered the tripartite Maker → Reviewer → Approver statutory queue.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            {error}
          </div>
        )}

        {/* New Correction Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Select A-Challan for Rectification *
              </label>
              <select
                value={challanNo}
                onChange={(e) => setChallanNo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono-plex"
              >
                {receipts.map(r => (
                  <option key={r.id} value={r.challanNo}>
                    {r.challanNo} — BDT {r.totalAmount} ({r.assessmentYear})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Taxpayer e-TIN
              </label>
              <input
                type="text"
                disabled
                value={taxpayerProfile.tin}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-100 font-mono-plex text-slate-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Current Assessment Year
              </label>
              <select
                value={currentAY}
                onChange={(e) => setCurrentAY(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-medium"
              >
                {ASSESSMENT_YEARS.map(ay => (
                  <option key={ay} value={ay}>{ay}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-taxpay-dark mb-1">
                Proposed Correct Assessment Year *
              </label>
              <select
                value={proposedAY}
                onChange={(e) => setProposedAY(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-50/50 font-bold text-taxpay-dark"
              >
                {ASSESSMENT_YEARS.map(ay => (
                  <option key={ay} value={ay}>{ay}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Current Circle
              </label>
              <input
                type="text"
                value={currentCircle}
                onChange={(e) => setCurrentCircle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>

            <div>
              <label className="block font-semibold text-taxpay-dark mb-1">
                Proposed Correct Circle
              </label>
              <input
                type="text"
                value={proposedCircle}
                onChange={(e) => setProposedCircle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-50/50"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Detailed Reason for Amendment & Supporting Evidence *
            </label>
            <textarea
              rows={3}
              placeholder="State the clerical error or reason for misattribution (e.g., accidental dropdown selection of wrong year during bank payment)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 bg-taxpay-primary hover:bg-taxpay-dark text-amber-300 font-bold rounded-lg text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Send className="w-4 h-4" />
              <span>Submit Correction Petition</span>
            </button>
          </div>
        </form>
      </div>

      {/* Existing Correction Requests Status */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <h3 className="font-serif-fraunces font-bold text-lg text-slate-900">
          Track Existing Correction Petitions
        </h3>

        <div className="space-y-3 text-xs">
          {corrections.map((corr) => (
            <div key={corr.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono-plex font-bold text-slate-900">{corr.ticketNo}</span>
                  <span className="text-slate-400">•</span>
                  <span className="font-mono-plex text-taxpay-dark">{corr.challanNo}</span>
                </div>
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                  corr.workflowStage === 'APPROVER_FINALIZED' ? 'bg-emerald-100 text-emerald-800' :
                  corr.workflowStage === 'REVIEWER_CHECKED' ? 'bg-indigo-100 text-indigo-800' :
                  corr.workflowStage === 'REJECTED' ? 'bg-rose-100 text-rose-800' :
                  'bg-amber-100 text-amber-800'
                }`}>
                  {corr.workflowStage}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-600">
                <div>
                  <span className="text-slate-400 block text-[11px]">Amendment:</span>
                  <strong>AY {corr.currentAssessmentYear}</strong> ➔ <strong className="text-emerald-800">AY {corr.proposedAssessmentYear}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Jurisdiction:</span>
                  <span>{corr.currentCircle} ➔ {corr.proposedCircle}</span>
                </div>
              </div>

              <p className="text-slate-600 bg-white p-2 rounded border border-slate-200 text-[11px]">
                {corr.reason}
              </p>

              {corr.approverRemarks && (
                <div className="p-2 rounded bg-emerald-50 border border-emerald-200 text-[11px] text-taxpay-dark">
                  <strong>Commissioner Approver Sanction:</strong> {corr.approverRemarks}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
