import React from 'react';
import { 
  Compass, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  FileText, 
  Award, 
  ArrowRight,
  ShieldCheck,
  Building2,
  CreditCard
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';

export const TaxJourney: React.FC = () => {
  const { taxpayerProfile, navigate } = useTaxState();

  const milestones = [
    {
      id: 1,
      title: 'e-TIN Registration & Circle Assignment',
      desc: 'Registered under Section 261. Jurisdiction permanently attached to Taxes Zone-08, Circle-164.',
      status: 'COMPLETED',
      date: '2020-03-15',
      badge: 'VERIFIED'
    },
    {
      id: 2,
      title: 'Advance Tax Payment Installment 1 (AY 2025-2026)',
      desc: 'Section 154 requirement fulfilled. Deposited BDT 25,000 via Nagad Postal A-Challan.',
      status: 'COMPLETED',
      date: '2025-09-14',
      badge: 'SCROLLED'
    },
    {
      id: 3,
      title: 'Advance Tax Payment Installment 2 (AY 2025-2026)',
      desc: 'Second quarterly installment due by 15 December 2025 under statutory rules.',
      status: 'UPCOMING_ACTION',
      date: 'Due: 15 Dec 2025',
      badge: 'ACTION DUE'
    },
    {
      id: 4,
      title: 'Annual Income Tax Return Filing & Section 173 Tax',
      desc: 'Universal self-assessment return under Section 180 accompanied by tax with return receipt.',
      status: 'PENDING',
      date: 'Deadline: 30 Nov 2025',
      badge: 'SCHEDULED'
    },
    {
      id: 5,
      title: 'Assessment Order & Ledger Auto-Reconciliation',
      desc: 'Automated audit checklist match and ledger booking without officer demand notice.',
      status: 'PENDING',
      date: 'AY 2025-2026',
      badge: 'SYSTEM'
    },
    {
      id: 6,
      title: 'Issuance of Income Tax Clearance Certificate',
      desc: 'Official clearance certificate under Section 240 for bank credit and tender eligibility.',
      status: 'PENDING',
      date: 'Final Milestone',
      badge: 'CLEARANCE'
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4 mb-5">
          <div className="w-10 h-10 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-serif-fraunces text-2xl font-bold text-slate-900">
              Taxpayer Lifecycle & Assessment Journey
            </h1>
            <p className="text-xs text-slate-500">
              Step-by-step statutory milestones for taxpayer <strong className="text-slate-800">{taxpayerProfile.nameEn}</strong> (AY 2025-2026).
            </p>
          </div>
        </div>

        {/* Milestone Timeline */}
        <div className="space-y-6 relative before:absolute before:inset-0 before:left-5 before:w-0.5 before:bg-slate-200 pl-4 py-2">
          {milestones.map((m) => {
            const isDone = m.status === 'COMPLETED';
            const isAction = m.status === 'UPCOMING_ACTION';

            return (
              <div key={m.id} className="relative flex items-start gap-4 text-xs">
                {/* Milestone Node Dot */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 font-bold border-2 ${
                  isDone
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                    : isAction
                    ? 'bg-amber-400 text-emerald-950 border-amber-500 animate-pulse'
                    : 'bg-white text-slate-400 border-slate-300'
                }`}>
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : m.id}
                </div>

                {/* Milestone Card */}
                <div className={`flex-1 p-4 rounded-xl border ${
                  isDone
                    ? 'bg-slate-50 border-slate-200'
                    : isAction
                    ? 'bg-amber-50/70 border-amber-300 shadow-sm'
                    : 'bg-white border-slate-200 opacity-75'
                }`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <h3 className="font-bold text-sm text-slate-900">
                      {m.title}
                    </h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      isDone
                        ? 'bg-emerald-100 text-emerald-800'
                        : isAction
                        ? 'bg-amber-200 text-amber-900'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {m.badge}
                    </span>
                  </div>

                  <p className="text-slate-600 text-xs leading-relaxed">
                    {m.desc}
                  </p>

                  <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>{m.date}</span>
                    {isAction && (
                      <button
                        onClick={() => navigate('wizard', { initialCategory: 'ADVANCE_TAX' })}
                        className="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-emerald-950 font-bold rounded text-xs cursor-pointer flex items-center gap-1"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Pay Advance Tax Installment</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
