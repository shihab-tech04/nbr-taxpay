import React from 'react';
import { 
  ShieldAlert, 
  Users, 
  Search, 
  FileCheck2, 
  Briefcase, 
  AlertTriangle, 
  FileText, 
  ScrollText, 
  Activity, 
  BrainCircuit, 
  ArrowRight,
  TrendingUp,
  Building2,
  Lock
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { UI_STRINGS } from '../../services/localization';
import { formatCurrency } from '../../services/numberFormat';

export const OfficerHome: React.FC = () => {
  const { userRole, setUserRole, navigate, language, corrections, incidents } = useTaxState();
  const t = UI_STRINGS[language];

  const pendingCorrections = corrections.filter(c => c.workflowStage !== 'APPROVER_FINALIZED');
  const pendingIncidents = incidents.filter(i => i.status !== 'RECONCILED');

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Officer Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-emerald-800">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-emerald-900 border-2 border-amber-400 flex items-center justify-center text-amber-300">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif-fraunces text-2xl font-bold">
                  Revenue Officer Administrative Workspace
                </h1>
                <span className="text-[10px] font-mono bg-amber-400 text-emerald-950 px-2 py-0.5 rounded font-bold uppercase">
                  {userRole}
                </span>
              </div>
              <p className="text-xs text-emerald-200 mt-1">
                Taxes Zone-08, Dhaka • Central Jurisdiction & Treasury Clearing Directorate
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={userRole}
              onChange={(e) => setUserRole(e.target.value as any)}
              className="bg-emerald-900/90 text-white border border-emerald-700 text-xs px-3 py-2 rounded-lg font-medium cursor-pointer"
            >
              <option value="OFFICER_MAKER">Maker: Assistant Commissioner (ACT Circle-164)</option>
              <option value="OFFICER_REVIEWER">Reviewer: Joint Commissioner (JCT Range-03)</option>
              <option value="OFFICER_APPROVER">Approver: Commissioner of Taxes (Zone-08)</option>
              <option value="COMMISSIONER_ADMIN">Director General / Admin LTU</option>
            </select>
          </div>
        </div>
      </div>

      {/* Target & Queue Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-slate-500 block">FY Collection Actual:</span>
          <span className="font-mono-plex font-bold text-lg text-emerald-950 mt-1 block">
            ৳ 148.5 Cr
          </span>
          <span className="text-emerald-700 font-semibold block text-[10px]">
            Target: ৳ 210 Cr (70.7%)
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-slate-500 block">Pending Correction Petitions:</span>
          <span className="font-mono-plex font-bold text-lg text-amber-700 mt-1 block">
            {pendingCorrections.length} Tickets
          </span>
          <span className="text-amber-800 font-medium block text-[10px]">
            Requires M-R-A Workflow
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-slate-500 block">Open Citizen Incidents:</span>
          <span className="font-mono-plex font-bold text-lg text-rose-700 mt-1 block">
            {pendingIncidents.length} Pending
          </span>
          <span className="text-rose-800 font-medium block text-[10px]">
            Gateway Clearing Mismatches
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-slate-500 block">Audit Register State:</span>
          <span className="font-mono-plex font-bold text-lg text-slate-800 mt-1 block">
            {t.auditDemoStatus}
          </span>
          <span className="text-slate-500 block text-[10px]">
            {t.auditDemoDetail}
          </span>
        </div>
      </div>

      {/* 10 Dedicated Officer Workspaces */}
      <div className="space-y-3">
        <h2 className="font-serif-fraunces font-bold text-xl text-slate-900">
          Revenue Administration Modules
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          {[
            {
              title: 'Taxpayer 360 Comprehensive View',
              desc: 'Deep inspection of taxpayer TIN profile, linked returns, assessments, and circle transfers.',
              route: 'taxpayer_360',
              icon: Users,
              color: 'text-emerald-700 bg-emerald-50'
            },
            {
              title: 'Universal Payment Search',
              desc: 'Cross-Treasury multi-criteria search across bank scrolls, token numbers, and payment heads.',
              route: 'payment_search',
              icon: Search,
              color: 'text-blue-700 bg-blue-50'
            },
            {
              title: 'Correction Approval Queue (M-R-A)',
              desc: 'Segregated Maker-Reviewer-Approver queue for re-attributing AY, circles, or payment heads.',
              route: 'correction_queue',
              icon: FileCheck2,
              color: 'text-amber-700 bg-amber-50'
            },
            {
              title: 'Revenue Dispute Case Management',
              desc: 'Track scrutiny demand notices, show-cause orders, appellate commissioner orders, and ADR.',
              route: 'case_management',
              icon: Briefcase,
              color: 'text-purple-700 bg-purple-50'
            },
            {
              title: 'Citizen Incident Triage',
              desc: 'Investigate failed MFS debits, bank timeouts, and duplicate payments for instant reconciliation.',
              route: 'incident_investigation',
              icon: AlertTriangle,
              color: 'text-rose-700 bg-rose-50'
            },
            {
              title: 'Offline Payment Evidence Verification',
              desc: 'Scrutinize and verify physical bank counterfoils, branch scrolls, and manual pay orders.',
              route: 'offline_evidence',
              icon: FileText,
              color: 'text-teal-700 bg-teal-50'
            },
            {
              title: t.auditDemoTitle,
              desc: t.auditDemoDetail,
              route: 'audit_trail',
              icon: ScrollText,
              color: 'text-slate-700 bg-slate-100'
            },
            {
              title: 'Revenue Intelligence & Anomaly',
              desc: 'Mismatch analytics between supplier e-TDS deduction deposits and claimed return credits.',
              route: 'intelligence',
              icon: BrainCircuit,
              color: 'text-indigo-700 bg-indigo-50'
            },
            {
              title: 'Gateway SLA & Health Monitoring',
              desc: 'Real-time telemetry, latency, and success rates for bKash, Nagad, Sonali, and BEFTN switches.',
              route: 'monitoring',
              icon: Activity,
              color: 'text-emerald-800 bg-emerald-100'
            }
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <a
                key={idx}
                href={'?action=' + item.route}
                onClick={event => {
                  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                  event.preventDefault();
                  navigate(item.route);
                }}
                className="bg-white border border-slate-200 hover:border-emerald-700 rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-lg ${item.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-sm text-slate-900 group-hover:text-emerald-900 transition-colors">
                      {item.title}
                    </h3>
                  </div>
                  <p className="text-slate-500 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
                <div className="mt-4 pt-2 border-t border-slate-100 flex items-center justify-between text-emerald-800 font-semibold group-hover:text-emerald-950">
                  <span>Enter Module</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
};
