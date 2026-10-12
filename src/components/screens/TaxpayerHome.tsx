import React from 'react';
import { 
  User, 
  CreditCard, 
  History, 
  BookOpen, 
  Award, 
  Bell, 
  Link, 
  ShieldCheck, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  FileText,
  MapPin,
  Building2,
  HelpCircle,
  FileEdit
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { formatCurrency, formatNumber } from '../../services/numberFormat';

export const TaxpayerHome: React.FC = () => {
  const { 
    taxpayerProfile, 
    receipts, 
    ledgerEntries, 
    navigate, 
    selectReceipt, 
    language 
  } = useTaxState();

  const userReceipts = receipts.filter(r => r.payerTin === taxpayerProfile.tin);
  const totalPaid = userReceipts.reduce((acc, curr) => acc + curr.totalAmount, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <section className="citizen-financial-intro" aria-label={language === 'bn' ? 'নমুনা কর অবস্থান' : 'Sample tax position'}>
        <p className="citizen-eyebrow">{language === 'bn' ? 'করদাতার মূল পাতা · নমুনা তথ্য' : 'Taxpayer home · sample data'}</p>
        <h1>{language === 'bn' ? 'আপনার কর অবস্থান' : 'Your tax position'}</h1>
        <p>{language === 'bn' ? 'এখানের অঙ্কসমূহ উদাহরণমাত্র। কোনো কর দাবি, ট্রেজারি জমা বা স্বীকৃত কর ক্রেডিট যাচাই করা হয়নি।' : 'Amounts below are illustrative. No live liability, Treasury settlement or recognized tax credit has been verified.'}</p>
        <div className="citizen-financial-links">
          <button onClick={() => navigate('history')}>{language === 'bn' ? 'লেনদেন ও রসিদ' : 'Payments & activity'} →</button>
          <button onClick={() => navigate('ledger')}>{language === 'bn' ? 'কর লেজার' : 'Tax ledger'} →</button>
        </div>
      </section>
      {/* Top Taxpayer Profile Banner */}
      <div className="citizen-overview text-white rounded-2xl p-5 shadow-sm border">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-emerald-800 border-2 border-amber-400/60 flex items-center justify-center text-amber-300 font-bold text-xl">
              {taxpayerProfile.nameEn.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif-fraunces text-xl sm:text-2xl font-bold">
                  {language === 'bn' ? taxpayerProfile.nameBn : taxpayerProfile.nameEn}
                </h2>
                <span className="text-[10px] bg-emerald-800 text-emerald-200 px-2 py-0.5 rounded-full font-mono border border-emerald-700">
                  {taxpayerProfile.type}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-emerald-200 mt-1 font-mono">
                <span>e-TIN: <strong className="text-amber-300 font-mono-plex">{taxpayerProfile.tin}</strong></span>
                {taxpayerProfile.nid && <span>NID: {taxpayerProfile.nid}</span>}
                {taxpayerProfile.bin && <span>BIN: {taxpayerProfile.bin}</span>}
              </div>
              <p className="text-xs text-emerald-300/80 mt-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                <span>{taxpayerProfile.taxZone} — {taxpayerProfile.taxCircle}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('wizard')}
              className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-emerald-950 font-bold rounded-lg text-xs sm:text-sm flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <CreditCard className="w-4 h-4 text-emerald-950" />
              <span>Make Tax Payment</span>
            </button>
            <button
              onClick={() => navigate('dashboard')}
              className="px-4 py-2.5 bg-emerald-800/80 hover:bg-emerald-800 text-white font-medium rounded-lg text-xs sm:text-sm border border-emerald-700 cursor-pointer"
            >
              <span>Dashboard</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 block">Total Payments (FY 2024-26):</span>
          <span className="font-mono-plex font-bold text-lg text-emerald-950 mt-1 block">
            {formatCurrency(totalPaid, language)}
          </span>
          <span className="text-[10px] text-emerald-700 block mt-0.5 font-medium">
            {userReceipts.length} illustrative receipts
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 block">Sample Ledger Entries:</span>
          <span className="font-mono-plex font-bold text-lg text-indigo-900 mt-1 block">
            {formatCurrency(ledgerEntries.reduce((sum, item) => sum + item.credit, 0), language)}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            Not reconciled with eReturn / NBR
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 block">Advance Tax (example):</span>
          <span className="font-mono-plex font-bold text-lg text-amber-700 mt-1 block">
            Q1 Deposited
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            Dates and entitlement unverified
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 block">Sample Account Profile:</span>
          <span className="inline-flex items-center gap-1 font-bold text-emerald-700 text-sm mt-1">
            <CheckCircle2 className="w-4 h-4" />
            <span>Demonstration only</span>
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            Not connected to actual return records
          </span>
        </div>
      </div>

      {/* Taxpayer Services Grid (All 11 Sub-Screens) */}
      <div className="space-y-3">
        <h2 className="font-serif-fraunces font-bold text-xl text-slate-900">
          More taxpayer services
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
          {[
            {
              title: 'Obligations Dashboard',
              desc: 'Annual liability schedule, advance tax quarters, and TDS ledger summaries.',
              route: 'dashboard',
              icon: FileText,
              color: 'text-emerald-700 bg-emerald-50'
            },
            {
              title: 'New Payment Wizard',
              desc: 'Explore 170 source-unverified payment heads and illustrative amounts.',
              route: 'wizard',
              icon: CreditCard,
              color: 'text-amber-700 bg-amber-50'
            },
            {
              title: 'Payment History & Receipts',
              desc: 'Search and view illustrative receipts and bank-scroll status.',
              route: 'history',
              icon: History,
              color: 'text-blue-700 bg-blue-50'
            },
            {
              title: 'Tax Ledger Account',
              desc: 'Running ledger balance of debits (assessments) and credits (payments).',
              route: 'ledger',
              icon: BookOpen,
              color: 'text-indigo-700 bg-indigo-50'
            },
            {
              title: 'Tax Assessment Journey',
              desc: 'Track milestones from registration to advance tax, return, and tax clearance.',
              route: 'journey',
              icon: MapPin,
              color: 'text-teal-700 bg-teal-50'
            },
            {
              title: 'Payment Certificates',
              desc: 'Download annual tax payment certificates, withholding proofs, and travel tax slips.',
              route: 'certificates',
              icon: Award,
              color: 'text-purple-700 bg-purple-50'
            },
            {
              title: 'Correction Requests',
              desc: 'Submit and track correction requests for erroneous assessment years or circles.',
              route: 'corrections',
              icon: FileEdit,
              color: 'text-rose-700 bg-rose-50'
            },
            {
              title: 'Notices & Demand Alerts',
              desc: 'View statutory demand notices, penalty warnings, and commissioner orders.',
              route: 'notifications',
              icon: Bell,
              color: 'text-amber-800 bg-amber-50'
            },
            {
              title: 'Connected e-Services',
              desc: 'Direct interoperability status with NBR eReturn, eLedger, and eTDS systems.',
              route: 'services',
              icon: Link,
              color: 'text-slate-700 bg-slate-100'
            }
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                onClick={() => navigate(item.route)}
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
                  <span>Open Screen</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Challans Quick Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-serif-fraunces font-bold text-lg text-slate-900">
            Recent Sample Payment Records
          </h3>
          <button
            onClick={() => navigate('history')}
            className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
          >
            <span>View All ({userReceipts.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold text-left">
              <tr>
                <th className="px-3 py-2.5">Challan Number</th>
                <th className="px-3 py-2.5">Category</th>
                <th className="px-3 py-2.5">Assessment Year</th>
                <th className="px-3 py-2.5 text-right">Amount (BDT)</th>
                <th className="px-3 py-2.5 text-center">Treasury Status</th>
                <th className="px-3 py-2.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {userReceipts.map((rcpt) => (
                <tr key={rcpt.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono-plex font-bold text-emerald-900">
                    {rcpt.challanNo}
                  </td>
                  <td className="px-3 py-2 text-slate-800 font-medium">
                    {rcpt.paymentCategory}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {rcpt.assessmentYear}
                  </td>
                  <td className="px-3 py-2 text-right font-mono-plex font-semibold text-slate-900">
                    {formatCurrency(rcpt.totalAmount, language)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      {rcpt.treasuryStatus}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => selectReceipt(rcpt.id)}
                      className="px-2.5 py-1 rounded bg-slate-100 hover:bg-emerald-100 text-emerald-900 font-semibold cursor-pointer text-[11px]"
                    >
                      View Receipt
                    </button>
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
