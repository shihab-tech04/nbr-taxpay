import React from 'react';
import { 
  Bell, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  CreditCard, 
  ArrowRight,
  ShieldAlert,
  Building2
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';

export const NotificationsView: React.FC = () => {
  const { navigate } = useTaxState();

  const alerts = [
    {
      id: 'notif-1',
      title: 'Advance Tax 2nd Quarter Installment Due (AY 2025-2026)',
      type: 'URGENT_DEADLINE',
      date: 'Due: 15 December 2025',
      desc: 'Pursuant to Section 154 of the Income Tax Act 2023, second quarterly installment of advance tax is payable on or before 15 December 2025.',
      actionLabel: 'Pay Q2 Installment',
      actionRoute: 'wizard'
    },
    {
      id: 'notif-2',
      title: 'Demand Notice DN-2023-164-90 Served under Section 214',
      type: 'DEMAND_NOTICE',
      date: 'Issued: 15 July 2026',
      desc: 'Assessment demand of BDT 47,400 has been raised by Circle-164 following audit order. Disputed under Appeal Case CASE-2026-8812.',
      actionLabel: 'View Case & Pay Statutory Deposit',
      actionRoute: 'history'
    },
    {
      id: 'notif-3',
      title: 'Correction Request CORR-2026-00412 Endorsed by Reviewer',
      type: 'WORKFLOW_UPDATE',
      date: 'Updated: 02 October 2026',
      desc: 'Inspecting Joint Commissioner has reviewed and endorsed your petition to shift Challan AC-2025-06-11293847 to AY 2025-2026. Awaiting final Approver sanction.',
      actionLabel: 'Check Status',
      actionRoute: 'corrections'
    },
    {
      id: 'notif-4',
      title: 'Sonali Bank A-Challan Gateway Scheduled Maintenance',
      type: 'INFO',
      date: 'Notice: 08 October 2026',
      desc: 'Central treasury clearing batch synchronization scheduled on Saturday midnight 00:00 - 02:00. MFS gateways remain operational.',
      actionLabel: null,
      actionRoute: null
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4 mb-5">
          <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-serif-fraunces text-2xl font-bold text-slate-900">
              Statutory Alerts & Demand Notifications
            </h1>
            <p className="text-xs text-slate-500">
              Real-time communication from your assessment circle, demand notices, and advance tax deadlines.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {alerts.map((al) => (
            <div 
              key={al.id} 
              className={`p-4 rounded-xl border text-xs space-y-2 ${
                al.type === 'DEMAND_NOTICE'
                  ? 'bg-rose-50/70 border-rose-200'
                  : al.type === 'URGENT_DEADLINE'
                  ? 'bg-amber-50/70 border-amber-300'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    al.type === 'DEMAND_NOTICE' ? 'bg-rose-600' :
                    al.type === 'URGENT_DEADLINE' ? 'bg-amber-500' :
                    'bg-blue-500'
                  }`} />
                  <h3 className="font-bold text-sm text-slate-900">{al.title}</h3>
                </div>
                <span className="text-[11px] font-mono text-slate-500">{al.date}</span>
              </div>

              <p className="text-slate-600 leading-relaxed">
                {al.desc}
              </p>

              {al.actionLabel && (
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => al.actionRoute && navigate(al.actionRoute)}
                    className="px-3 py-1.5 rounded bg-taxpay-primary hover:bg-taxpay-dark text-amber-300 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>{al.actionLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
