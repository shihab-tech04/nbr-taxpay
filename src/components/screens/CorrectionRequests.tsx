import React, { useState } from 'react';
import { 
  FileEdit, 
  Send, 
  CheckCircle2
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { ASSESSMENT_YEARS } from '../../data/mockData';
import { MASTER_PAYMENT_HEADS } from '../../data/paymentHeads';
import { useAccountIdentity } from '../../services/accountIdentity';
import { taxpayerPreviewReceipts } from '../../services/taxpayerEvidence';

export const CorrectionRequests: React.FC = () => {
  const { corrections, receipts, taxpayerProfile, userRole, demoUser, addCorrectionRequest } = useTaxState();
  const {user:authenticatedUser}=useAccountIdentity();
  const visibleReceipts = taxpayerPreviewReceipts(receipts,taxpayerProfile.tin,userRole,demoUser,Boolean(authenticatedUser));
  const visibleCorrections = corrections.filter(c=>visibleReceipts.some(r=>r.challanNo===c.challanNo && r.payerTin===c.taxpayerTin));

  const [challanNo, setChallanNo] = useState('');
  const selectedReceipt = visibleReceipts.find(r=>r.challanNo===challanNo) ?? visibleReceipts[0];
  const selectedChallanNo = selectedReceipt?.challanNo ?? '';
  const currentAY = selectedReceipt?.assessmentYear ?? '';
  const [proposedAY, setProposedAY] = useState('2025-2026');
  const currentCircle = selectedReceipt?.taxCircle ?? '';
  const [proposedCircle, setProposedCircle] = useState(taxpayerProfile.taxCircle);
  const currentHeadCode = selectedReceipt?.items[0]?.economicCode ?? '';
  const [proposedHeadCode, setProposedHeadCode] = useState('');
  const proposedHead = proposedHeadCode || currentHeadCode;
  const [reason, setReason] = useState('');
  const [submittedTicket, setSubmittedTicket] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChallanNo || !visibleReceipts.some(r=>r.challanNo===selectedChallanNo) || !reason.trim()) {
      setError('Select a payment reference belonging to this preview and provide an explanation.');
      return;
    }
    if (currentAY === proposedAY && currentCircle === proposedCircle && currentHeadCode === proposedHead) {
      setError('Choose at least one proposed change to the year, circle or payment head.');
      return;
    }
    setError('');

    const ticketNo = addCorrectionRequest({
      challanNo: selectedChallanNo,
      taxpayerTin: taxpayerProfile.tin,
      taxpayerName: taxpayerProfile.nameEn,
      requestedBy: `${taxpayerProfile.nameEn} (Self)`,
      requestDate: new Date().toISOString().split('T')[0],
      currentAssessmentYear: currentAY,
      proposedAssessmentYear: proposedAY,
      currentCircle,
      proposedCircle,
      currentHeadCode,
      proposedHeadCode: proposedHead,
      reason,
      workflowStage: 'MAKER_SUBMITTED',
      makerRemarks: 'Local sample request only. No official petition or Revenue Officer workflow initiated.'
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
              Review a sample request to correct a payment year, circle or head. No official petition is submitted from this screen.
            </p>
          </div>
        </div>

        {submittedTicket && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-taxpay-dark space-y-1">
            <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Sample correction request saved: {submittedTicket}</span>
            </div>
            <p className="text-xs text-emerald-700">
              This request remains in the local preview. It has not entered an official review queue.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            {error}
          </div>
        )}

        {/* New Correction Form */}
        {visibleReceipts.length ? <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="correction-challan" className="block font-semibold text-slate-700 mb-1">
                Select A-Challan for Rectification *
              </label>
              <select
                id="correction-challan"
                value={selectedChallanNo}
                onChange={(e) => {
                  const receipt = visibleReceipts.find(r => r.challanNo === e.target.value);
                  setChallanNo(e.target.value);
                  setProposedCircle(receipt?.taxCircle ?? '');
                  setProposedHeadCode('');
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono-plex"
              >
                {visibleReceipts.map(r => (
                  <option key={r.id} value={r.challanNo}>
                    {r.challanNo} — BDT {r.totalAmount} ({r.assessmentYear})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="correction-tin" className="block font-semibold text-slate-700 mb-1">
                Taxpayer e-TIN
              </label>
              <input
                id="correction-tin"
                type="text"
                disabled
                value={taxpayerProfile.tin}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-100 font-mono-plex text-slate-500"
              />
            </div>

            <div>
              <label htmlFor="correction-current-year" className="block font-semibold text-slate-700 mb-1">
                Current Assessment Year
              </label>
              <input
                id="correction-current-year"
                value={currentAY}
                readOnly
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 font-medium"
              />
            </div>

            <div>
              <label htmlFor="correction-proposed-year" className="block font-semibold text-taxpay-dark mb-1">
                Proposed Correct Assessment Year *
              </label>
              <select
                id="correction-proposed-year"
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
              <label htmlFor="correction-current-circle" className="block font-semibold text-slate-700 mb-1">
                Current Circle
              </label>
              <input
                id="correction-current-circle"
                type="text"
                value={currentCircle}
                readOnly
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50"
              />
            </div>

            <div>
              <label htmlFor="correction-proposed-circle" className="block font-semibold text-taxpay-dark mb-1">
                Proposed Correct Circle
              </label>
              <input
                id="correction-proposed-circle"
                type="text"
                value={proposedCircle}
                onChange={(e) => setProposedCircle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-50/50"
              />
            </div>

            <div>
              <label htmlFor="correction-current-head" className="block font-semibold text-slate-700 mb-1">
                Current payment head (sample reference)
              </label>
              <input id="correction-current-head" value={currentHeadCode} readOnly
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 font-mono-plex" />
            </div>
            <div>
              <label htmlFor="correction-proposed-head" className="block font-semibold text-taxpay-dark mb-1">
                Proposed payment head (unverified options)
              </label>
              <select id="correction-proposed-head" value={proposedHead}
                onChange={(e) => setProposedHeadCode(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-50/50 text-taxpay-dark">
                {MASTER_PAYMENT_HEADS.filter(head => head.status !== 'BLOCKED').map(head => (
                  <option key={head.id} value={head.economicCode}>{head.economicCode} — {head.nameEn}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="correction-reason" className="block font-semibold text-slate-700 mb-1">
              Detailed Reason for Amendment & Supporting Evidence *
            </label>
            <textarea
              id="correction-reason"
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
              <span>Save Sample Correction Request</span>
            </button>
          </div>
        </form> : <p role="status" className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No payment record is available for a sample correction in this account view.</p>}
      </div>

      {/* Existing Correction Requests Status */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <h3 className="font-serif-fraunces font-bold text-lg text-slate-900">
          Sample correction requests
        </h3>

        <div className="space-y-3 text-xs">
          {visibleCorrections.map((corr) => (
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
                  <strong>Sample review note:</strong> {corr.approverRemarks}
                </div>
              )}
            </div>
          ))}
          {!visibleCorrections.length && (
            <p role="status" className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-slate-600">
              No sample correction requests are available for this preview.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
