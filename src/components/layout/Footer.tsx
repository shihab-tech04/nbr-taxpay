import React from 'react';
import { Landmark, CheckCircle2 } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { UI_STRINGS } from '../../services/localization';
import { taxpayerBrandName } from '../../config/brand';

export const Footer: React.FC = () => {
  const { language, navigate, setIsParityModalOpen } = useTaxState();
  const t = UI_STRINGS[language];

  return (
    <footer className="no-print bg-slate-900 text-slate-300 border-t border-slate-800 text-sm mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand & Mandate */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2 text-white">
              <Landmark className="w-5 h-5 text-amber-400" />
              <span className="font-serif-fraunces font-bold text-base">
                {taxpayerBrandName(language)}
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{language === 'bn' ? 'স্বতন্ত্র কর পরিশোধ ওয়ার্কস্পেস' : 'Independent tax payment workspace'}</p>
            <div className="pt-1">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-1 rounded border border-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>v11 Migration Architecture</span>
              </span>
            </div>
          </div>

          {/* Quick Portals & Workspaces */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-mono">
              Portals & Services
            </h4>
            <ul className="space-y-1.5 text-xs">
              <li>
                <button onClick={() => navigate('guest')} className="hover:text-amber-400 transition-colors">
                  Guest Income Tax Payment
                </button>
              </li>
              <li>
                <button onClick={() => navigate('guestwh')} className="hover:text-amber-400 transition-colors">
                  Source Tax Deposit (Withholding TDS)
                </button>
              </li>
              <li>
                <button onClick={() => navigate('travel')} className="hover:text-amber-400 transition-colors">
                  Foreign Travel Tax Payment
                </button>
              </li>
              <li>
                <button onClick={() => navigate('verify')} className="hover:text-amber-400 transition-colors">
                  A-Challan & Token Verification
                </button>
              </li>
              <li>
                <button onClick={() => navigate('incident')} className="hover:text-amber-400 transition-colors">
                  Citizen Incident Reporting
                </button>
              </li>
              <li>
                <button onClick={() => navigate('taxpayer_home')} className="hover:text-amber-400 transition-colors">
                  Registered Taxpayer Services
                </button>
              </li>
            </ul>
          </div>

          {/* Officer & Governance */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-mono">
              Officer & Governance
            </h4>
            <ul className="space-y-1.5 text-xs">
              <li>
                <button onClick={() => navigate('officer_home')} className="hover:text-amber-400 transition-colors">
                  Revenue Officer Workspace
                </button>
              </li>
              <li>
                <button onClick={() => navigate('taxpayer_360')} className="hover:text-amber-400 transition-colors">
                  Taxpayer 360 View
                </button>
              </li>
              <li>
                <button onClick={() => navigate('correction_queue')} className="hover:text-amber-400 transition-colors">
                  Maker-Reviewer-Approver Queue
                </button>
              </li>
              <li>
                <button onClick={() => navigate('audit_trail')} className="hover:text-amber-400 transition-colors">
                  {t.auditDemoTitle}
                </button>
              </li>
              <li>
                <button onClick={() => navigate('monitoring')} className="hover:text-amber-400 transition-colors">
                  Gateway SLA & Health
                </button>
              </li>
              <li>
                <button onClick={() => setIsParityModalOpen(true)} className="text-amber-300 hover:underline">
                  Route Parity Register (29/29)
                </button>
              </li>
            </ul>
          </div>

          {/* Model & Architecture */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-mono">
              Knowledge & Architecture
            </h4>
            <ul className="space-y-1.5 text-xs">
              <li>
                <button onClick={() => navigate('architecture')} className="hover:text-amber-400 transition-colors">
                  Architecture & Integration Model
                </button>
              </li>
              <li>
                <button onClick={() => navigate('ontology')} className="hover:text-amber-400 transition-colors">
                  Tax Concept Ontology (Draft Model)
                </button>
              </li>
              <li>
                <button onClick={() => navigate('glossary')} className="hover:text-amber-400 transition-colors">
                  Statutory Terminology Glossary
                </button>
              </li>
              <li>
                <button onClick={() => navigate('guidance')} className="hover:text-amber-400 transition-colors">
                  Interactive Tax Guidance Assistant
                </button>
              </li>
              <li>
                <button onClick={() => navigate('services')} className="hover:text-amber-400 transition-colors">
                  Connected Systems (eReturn, eLedger, eTDS)
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-slate-800 text-xs text-slate-400"><p>{language === 'bn' ? '© ২০২৬ আমার কর' : '© 2026 Amar Kor'}</p></div>
      </div>
    </footer>
  );
};
