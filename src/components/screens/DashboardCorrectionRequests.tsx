import React, {useEffect, useState} from 'react';
import {ArrowRight, RefreshCcw} from 'lucide-react';
import {supabase} from '../../services/supabaseClient';

type Props = {
  language: 'en' | 'bn';
  onOpen: () => void;
  ownerUid?: string | null;
};

type CountState = {ownerUid: string | null; phase: 'loading' | 'ready' | 'error'; count: number | null};

/**
 * Dashboard entry to the existing Correction Requests journey.
 * Counts are owner-scoped application inquiries, not approved Treasury corrections.
 * Sample accounts have no authenticated SQL ownership and never fetch another account's records.
 */
export function DashboardCorrectionRequests({language, onOpen, ownerUid}: Props) {
  const bn = language === 'bn';
  const tr = (en: string, bangla: string) => bn ? bangla : en;
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<CountState>({ownerUid: null, phase: 'loading', count: null});
  useEffect(() => {
    let active = true;
    if (!ownerUid) {
      setState({ownerUid: null, phase: 'ready', count: null});
      return () => { active = false; };
    }
    setState({ownerUid, phase: 'loading', count: null});
    void (async () => {
      if (!supabase) throw new Error('Database unavailable');
      const {data: before, error: beforeError} = await supabase.auth.getUser();
      if (beforeError || before.user?.id !== ownerUid) throw new Error('Account changed');
      const {count, error} = await supabase.from('taxpay_correction_inquiries')
        .select('inquiry_id', {head: true, count: 'exact'})
        .eq('requester_uid', ownerUid);
      if (error || count === null || !Number.isSafeInteger(count) || count < 0) throw new Error('Correction count unavailable');
      const {data: after, error: afterError} = await supabase.auth.getUser();
      if (afterError || after.user?.id !== ownerUid) throw new Error('Account changed');
      if (active) setState({ownerUid, phase: 'ready', count});
    })().catch(() => {
      if (active) setState({ownerUid, phase: 'error', count: null});
    });
    return () => { active = false; };
  }, [ownerUid, refresh]);

  const visible = state.ownerUid === (ownerUid ?? null) ? state : {ownerUid, phase: 'loading' as const, count: null};
  return <section data-testid="dashboard-correction-requests"
    aria-labelledby="dashboard-correction-requests-title"
    className="rounded-2xl border border-taxpay-border bg-white p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 id="dashboard-correction-requests-title" className="text-base font-semibold text-taxpay-text">
          {tr('Correction Requests', 'সংশোধনের অনুরোধ')}
        </h2>
        <p className="mt-1 text-sm text-taxpay-muted">
          {tr('View existing requests or submit a correction through the established process.',
            'বিদ্যমান অনুরোধ দেখুন অথবা প্রচলিত প্রক্রিয়ায় সংশোধনের আবেদন করুন।')}
        </p>
        {ownerUid && visible.phase === 'loading' &&
          <p className="mt-2 text-sm text-taxpay-muted" role="status">{tr('Loading your requests…', 'আপনার অনুরোধ লোড হচ্ছে…')}</p>}
        {ownerUid && visible.phase === 'ready' && visible.count !== null &&
          <p className="mt-2 text-sm text-taxpay-text" data-testid="dashboard-correction-request-count">
            {tr('Saved requests:', 'সংরক্ষিত অনুরোধ:')} <strong className="tabular-nums">{visible.count.toLocaleString(bn ? 'bn-BD' : 'en-BD')}</strong>
          </p>}
        {ownerUid && visible.phase === 'error' &&
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="text-sm text-taxpay-error" role="alert">{tr('Requests could not be loaded.', 'অনুরোধ লোড করা যায়নি।')}</p>
            <button type="button" onClick={() => setRefresh(value => value + 1)}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-taxpay-border px-3 text-sm text-taxpay-primary">
              <RefreshCcw size={15} aria-hidden="true"/>{tr('Retry', 'আবার চেষ্টা করুন')}
            </button>
          </div>}
      </div>
      <button type="button" onClick={onOpen}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-taxpay-border bg-white px-4 text-sm font-medium text-taxpay-primary hover:bg-taxpay-light">
        {tr('View correction requests', 'সংশোধনের অনুরোধ দেখুন')}<ArrowRight size={16} aria-hidden="true"/>
      </button>
    </div>
  </section>;
}
