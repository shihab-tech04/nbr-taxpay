import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  Building2, 
  ShieldCheck, 
  CreditCard, 
  FileText, 
  AlertCircle,
  Briefcase,
  MapPin,
  Calendar,
  CheckCircle2
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { DEMO_TAXPAYERS } from '../../data/mockData';
import { formatCurrency } from '../../services/numberFormat';
import { CATEGORY_LABELS } from '../../data/paymentHeads';
import { ServiceCategoryTag } from '../ui/ServiceCategoryTag';

export const Taxpayer360: React.FC = () => {
  const { receipts, ledgerEntries, cases, selectReceipt, language } = useTaxState();
  const [tinQuery, setTinQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState<string>('INDIVIDUAL_REGULAR');

  const profile = DEMO_TAXPAYERS[selectedKey] || DEMO_TAXPAYERS['INDIVIDUAL_REGULAR'];
  const userReceipts = receipts.filter(r => r.payerTin === profile.tin);
  const userCases = cases.filter(c => c.tin === profile.tin);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const foundEntry = Object.entries(DEMO_TAXPAYERS).find(([_, p]) => p.tin === tinQuery.trim());
    if (foundEntry) {
      setSelectedKey(foundEntry[0]);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4 mb-5">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-serif-fraunces text-2xl font-bold text-slate-900">
              Taxpayer 360° Comprehensive Profile
            </h1>
            <p className="text-xs text-slate-500">
              Holistic revenue officer dossier integrating master TIN registration, linked A-Challans, ledger balances, and assessment cases.
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-6">
          <input
            type="text"
            placeholder="Search by 12-digit e-TIN..."
            value={tinQuery}
            onChange={(e) => setTinQuery(e.target.value)}
            className="flex-1 px-4 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 font-mono-plex"
          />
          <button
            type="submit"
            className="px-5 py-2 bg-emerald-900 text-amber-300 font-bold rounded-lg text-xs sm:text-sm cursor-pointer shadow-sm"
          >
            Load Dossier
          </button>
        </form>

        {/* Quick Sample Selector */}
        <div className="flex flex-wrap items-center gap-2 mb-6 text-xs text-slate-500">
          <span>Preset Profiles:</span>
          {Object.entries(DEMO_TAXPAYERS).map(([k, p]) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setSelectedKey(k);
                setTinQuery(p.tin);
              }}
              className={`px-2.5 py-1 rounded border text-[11px] cursor-pointer ${
                selectedKey === k ? 'bg-emerald-900 text-white border-emerald-900' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {p.nameEn} ({p.tin})
            </button>
          ))}
        </div>

        {/* Dossier Header Card */}
        <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif-fraunces font-bold text-lg text-slate-900">
                  {profile.nameEn}
                </h2>
                <span className="font-mono text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                  {profile.type}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-bengali">{profile.nameBn}</div>
            </div>

            <div className="flex items-center gap-3 font-mono">
              <div>
                <span className="text-slate-400 block text-[10px]">TIN:</span>
                <strong className="text-emerald-900 text-sm">{profile.tin}</strong>
              </div>
              {profile.nid && (
                <div>
                  <span className="text-slate-400 block text-[10px]">NID:</span>
                  <strong className="text-slate-800 text-sm">{profile.nid}</strong>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-200 pt-3">
            <div>
              <span className="text-slate-400 block">Jurisdiction:</span>
              <strong className="text-slate-800">{profile.taxZone}</strong>
              <div className="text-slate-600">{profile.taxCircle}</div>
            </div>
            <div>
              <span className="text-slate-400 block">Contact Particulars:</span>
              <span className="text-slate-800">{profile.phone}</span>
              <div className="text-slate-600">{profile.email}</div>
            </div>
            <div>
              <span className="text-slate-400 block">Representative Scope:</span>
              {profile.representativeScope?.isAuthorized ? (
                <div className="text-amber-800 font-medium">
                  Authorized: {profile.representativeScope.representativeName}
                  <div className="text-[10px] text-slate-500">Exp: {profile.representativeScope.mandateExpiryDate}</div>
                </div>
              ) : (
                <span className="text-slate-600">Direct Taxpayer Self-Management</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Linked Challans & Cases */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Linked Challans */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="font-serif-fraunces font-bold text-base text-slate-900">
            Treasury A-Challans Linked to TIN ({userReceipts.length})
          </h3>
          <div className="space-y-2 text-xs max-h-72 overflow-y-auto">
            {userReceipts.map(rcpt => (
              <button
                key={rcpt.id} 
                type="button"
                onClick={() => selectReceipt(rcpt.id)}
                className="block w-full text-left p-3 rounded-lg border border-slate-200 hover:border-emerald-700 bg-slate-50 cursor-pointer space-y-1"
              >
                <span className="flex items-center justify-between">
                  <span className="font-mono-plex font-bold text-emerald-950">{rcpt.challanNo}</span>
                  <span className="font-mono-plex font-bold text-slate-900">{formatCurrency(rcpt.totalAmount, language)}</span>
                </span>
                <span className="flex items-center justify-between text-[11px] text-slate-500">
                  <span><ServiceCategoryTag code={rcpt.paymentCategory}>{CATEGORY_LABELS[rcpt.paymentCategory]?.[language] ?? rcpt.paymentCategory}</ServiceCategoryTag> (AY {rcpt.assessmentYear})</span>
                  <span className="text-emerald-700 font-semibold">{rcpt.treasuryStatus}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Active Cases / Demands */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="font-serif-fraunces font-bold text-base text-slate-900">
            Assessment Disputes & Notices ({userCases.length})
          </h3>
          <div className="space-y-2 text-xs">
            {userCases.length === 0 ? (
              <p className="text-slate-500 text-xs">No active dispute proceedings for this taxpayer.</p>
            ) : (
              userCases.map(cs => (
                <div key={cs.caseId} className="p-3 rounded-lg border border-amber-200 bg-amber-50/60 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono-plex font-bold text-slate-900">{cs.caseId}</span>
                    <span className="font-mono-plex font-bold text-rose-800">{formatCurrency(cs.disputedAmount, language)}</span>
                  </div>
                  <div className="text-[11px] text-slate-700">{cs.issue}</div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                    <span>Stage: <strong>{cs.stage}</strong></span>
                    <span className="font-semibold text-amber-800">{cs.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
