import React, { useState } from 'react';
import { 
  Briefcase, 
  Search, 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Building2, 
  FileText,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { formatCurrency } from '../../services/numberFormat';

export const CaseManagement: React.FC = () => {
  const { cases, language } = useTaxState();
  const [stageFilter, setStageFilter] = useState('ALL');

  const filteredCases = cases.filter(c => stageFilter === 'ALL' || c.stage === stageFilter);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4 mb-5">
          <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-serif-fraunces text-2xl font-bold text-slate-900">
              Revenue Audit & Dispute Case Management
            </h1>
            <p className="text-xs text-slate-500">
              Proceedings under Section 214 assessment scrutiny, Commissioner (Appeals), Taxes Appellate Tribunal, and High Court.
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 text-xs">
          {['ALL', 'ASSESSMENT_ORDER', 'TRIBUNAL', 'APPEAL_COMMISSIONER'].map(st => (
            <button
              key={st}
              onClick={() => setStageFilter(st)}
              className={`px-3 py-1.5 rounded-lg font-medium cursor-pointer ${
                stageFilter === st
                  ? 'bg-purple-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {st.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        {/* Case Dossiers */}
        <div className="space-y-4">
          {filteredCases.map(cs => (
            <div key={cs.caseId} className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm text-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono-plex font-bold text-sm text-slate-900">{cs.caseId}</span>
                    <span className="text-slate-400">•</span>
                    <span className="font-semibold text-slate-800">{cs.taxpayerName}</span>
                    <span className="font-mono text-slate-500">({cs.tin})</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Assessment Year: <strong>{cs.assessmentYear}</strong> | Due Date: {cs.dueDate}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono-plex font-bold text-sm text-rose-800 bg-rose-50 px-2.5 py-1 rounded border border-rose-200">
                    Disputed: {formatCurrency(cs.disputedAmount, language)}
                  </span>
                  <span className="px-2 py-1 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                    {cs.status}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 text-slate-700 space-y-1">
                <strong>Subject Matter & Contested Issue:</strong>
                <p className="text-slate-600 leading-relaxed">{cs.issue}</p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-1">
                <div>
                  Assigned Revenue Officer: <strong className="text-slate-800">{cs.assignedOfficer}</strong>
                </div>
                <div>
                  Statutory Proceeding Stage: <strong className="text-purple-900">{cs.stage}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
