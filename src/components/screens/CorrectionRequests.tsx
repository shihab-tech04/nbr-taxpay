import React, { useState } from 'react';
import {
  Send,
  CheckCircle2
} from 'lucide-react';
import {TaxpayerActivityTabs, TaxpayerPageHeading} from '../layout/TaxpayerPageStructure';
import { useTaxState } from '../../services/taxState';
import { ASSESSMENT_YEARS } from '../../data/mockData';
import { MASTER_PAYMENT_HEADS } from '../../data/paymentHeads';
import { useAccountIdentity } from '../../services/accountIdentity';
import { taxpayerPreviewReceipts } from '../../services/taxpayerEvidence';
import {TaxPayDataGrid,TaxPayTableControls,TaxPayTableCounter,TaxPayTableState} from '../ui/TaxPayDataTable';

export const CorrectionRequests: React.FC<{activityTabs?:boolean}> = ({activityTabs=false}) => {
  const { corrections, receipts, taxpayerProfile, userRole, demoUser, addCorrectionRequest, language } = useTaxState();
  const tr=(en:string,bn:string)=>language==='bn'?bn:en;
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
  const [caseSearch,setCaseSearch]=useState('');
  const [error, setError] = useState('');

  const caseNeedle=caseSearch.trim().toLocaleLowerCase();
  const filteredCases=visibleCorrections.filter(c=>!caseNeedle || [
    c.ticketNo,c.challanNo,c.workflowStage,c.reason,c.currentAssessmentYear,c.proposedAssessmentYear
  ].some(value=>String(value??'').toLocaleLowerCase().includes(caseNeedle)));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChallanNo || !visibleReceipts.some(r=>r.challanNo===selectedChallanNo) || !reason.trim()) {
      setError('Select a payment reference and provide an explanation.');
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
      <TaxpayerPageHeading title="Tax Payment Challan Correction Requests"
        description="Request a change to the assessment year, tax circle or payment head." />
      {activityTabs && <TaxpayerActivityTabs />}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        {submittedTicket && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-taxpay-dark space-y-1">
            <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Request saved locally: {submittedTicket}</span>
            </div>
            <p className="text-xs text-emerald-700">
              Not submitted to NBR or an official review queue.
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
                    {r.challanNo} — ৳ {r.totalAmount} ({r.assessmentYear})
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
                Current payment head
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
              <span>Save request locally</span>
            </button>
          </div>
        </form> : <p role="status" className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No payment records are available for correction.</p>}
      </div>

      <section className="taxpayer-records-panel rounded-xl border border-taxpay-border bg-white p-4 sm:p-6 space-y-3"
        data-testid="preview-correction-register" aria-label={tr('Saved correction requests','সংরক্ষিত সংশোধনের অনুরোধ')}>
        <div className="taxpay-table-toolbar">
          <h3 className="text-base font-semibold text-taxpay-text">{tr('Saved correction requests','সংরক্ষিত সংশোধনের অনুরোধ')}</h3>
          <TaxPayTableCounter label={tr('Requests','অনুরোধ')} shown={filteredCases.length} total={visibleCorrections.length}/>
        </div>
        <TaxPayTableControls className="taxpay-record-page-filters">
          <label className="taxpayer-transaction-filter">
            <span>{tr('Search correction requests','সংশোধনের অনুরোধ খুঁজুন')}</span>
            <input type="search" className="min-h-11 w-full rounded-lg border border-taxpay-border bg-white px-3 text-base"
              aria-label={tr('Search correction requests','সংশোধনের অনুরোধ খুঁজুন')}
              placeholder={tr('Search reference, reason or status','রেফারেন্স, কারণ বা অবস্থা খুঁজুন')}
              value={caseSearch} onChange={event=>setCaseSearch(event.target.value)}/>
          </label>
          {caseSearch&&<button type="button" className="min-h-11 rounded-lg border border-taxpay-border px-3 font-semibold text-taxpay-primary"
            onClick={()=>setCaseSearch('')}>{tr('Clear search','অনুসন্ধান মুছুন')}</button>}
        </TaxPayTableControls>
        {filteredCases.length===0?<TaxPayTableState>{visibleCorrections.length
          ?tr('No requests match your search.','অনুসন্ধানে কোনো অনুরোধ পাওয়া যায়নি।')
          :tr('No correction requests saved yet.','এখনো কোনো সংশোধনের অনুরোধ সংরক্ষিত হয়নি।')}</TaxPayTableState>:
          <TaxPayDataGrid variant="tabular" rows={filteredCases} getRowKey={c=>c.id}
            ariaLabel={tr('Correction request history','সংশোধনের অনুরোধের ইতিহাস')}
            testId="preview-correction-table" mobileTestId="preview-correction-cards"
            columns={[
              {key:'reference',header:tr('Case / challan','বিষয় / চালান'),renderCell:c=><div>
                <p className="break-all font-semibold text-taxpay-text">{c.ticketNo}</p>
                <p className="break-all font-mono-plex text-sm text-taxpay-muted">{c.challanNo}</p>
              </div>},
              {key:'change',header:tr('Proposed change','প্রস্তাবিত পরিবর্তন'),renderCell:c=><div>
                <p className="text-taxpay-text">{tr('Assessment year','করবর্ষ')}: {c.currentAssessmentYear} → {c.proposedAssessmentYear}</p>
                <p className="text-sm text-taxpay-muted">{tr('Circle','সার্কেল')}: {c.currentCircle} → {c.proposedCircle}</p>
              </div>},
              {key:'status',header:tr('Recorded status','নথিভুক্ত অবস্থা'),renderCell:c=><p className="font-semibold text-taxpay-text">{c.workflowStage.replaceAll('_',' ')}</p>},
              {key:'detail',header:tr('Details','বিস্তারিত'),renderCell:c=><details className="max-w-[22rem] rounded-lg border border-taxpay-border p-2">
                <summary className="min-h-11 cursor-pointer font-semibold text-taxpay-primary">{tr('View request','অনুরোধ দেখুন')}</summary>
                <div className="mt-2 space-y-2 text-sm text-taxpay-text">
                  <p className="break-words">{tr('Reason','কারণ')}: {c.reason}</p>
                  {c.approverRemarks&&<p className="break-words">{tr('Review note','পর্যালোচনার মন্তব্য')}: {c.approverRemarks}</p>}
                </div>
              </details>}
            ]}
            renderMobileCard={c=><div className="space-y-2">
              <div className="taxpay-mobile-table-card__header">
                <p className="taxpay-mobile-table-card__title">{c.ticketNo}</p>
                <p className="text-sm font-semibold text-taxpay-primary">{c.workflowStage.replaceAll('_',' ')}</p>
              </div>
              <p className="taxpay-mobile-table-card__meta break-all">{tr('Challan','চালান')}: {c.challanNo}</p>
              <p className="taxpay-mobile-table-card__meta">{tr('Year','করবর্ষ')}: {c.currentAssessmentYear} → {c.proposedAssessmentYear}</p>
              <p className="taxpay-mobile-table-card__meta">{tr('Circle','সার্কেল')}: {c.currentCircle} → {c.proposedCircle}</p>
              <details className="mt-2 rounded-lg border border-taxpay-border p-2">
                <summary className="min-h-11 cursor-pointer font-semibold text-taxpay-primary">{tr('View request','অনুরোধ দেখুন')}</summary>
                <p className="mt-2 break-words text-sm">{c.reason}</p>
                {c.approverRemarks&&<p className="mt-2 break-words text-sm">{tr('Review note','পর্যালোচনার মন্তব্য')}: {c.approverRemarks}</p>}
              </details>
            </div>}/>}
      </section>
    </div>
  );
};
