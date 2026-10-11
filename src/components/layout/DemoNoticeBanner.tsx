import React from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { UI_STRINGS } from '../../services/localization';

export const DemoNoticeBanner: React.FC = () => {
  const { language, setIsParityModalOpen } = useTaxState();
  const t = UI_STRINGS[language];

  return (
    <div className="no-print bg-amber-500/15 border-b border-amber-500/30 text-amber-950 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
        <span className="font-semibold tracking-wide">
          {t.demoNotice}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsParityModalOpen(true)}
          className="underline hover:text-amber-800 font-medium cursor-pointer inline-flex items-center gap-1"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>v11 Route Parity Register (29/29)</span>
        </button>
        <span className="text-amber-800/80">|</span>
        <span className="font-mono text-[11px] text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300">
          SHA-256: f99f15...da7b
        </span>
      </div>
    </div>
  );
};
