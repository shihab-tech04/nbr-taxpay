import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { sameAuthenticatedOwner } from '../../services/secureWorkspacePolicy';
import { validateSourceChangeProposal } from '../../services/sourceChangeProposal';
import { V11_SOURCE_HEADS } from '../../data/v11SourceHeads';
import { UiButton, UiInput, UiSelect, UiTextarea } from '../ui/Controls';

type Props = { readonly authenticatedUserId: string; readonly language: 'en' | 'bn' };
type ProposalRow = {
  proposal_id: string;
  source_head_id: number;
  proposal_state: string;
  created_at: string;
};
const allowedHeads = new Set(V11_SOURCE_HEADS.map(x => x.id));
const content = {
  en: {
    title: 'Submit a source-change proposal',
    intro: 'Review-only. This is NOT legal approval, an official accounting-code change or authority to collect tax.',
    search: 'Find original source head', choose: 'Select the source record to review',
    select: 'Choose a source record', hash: 'Document SHA-256 (64 hexadecimal characters)',
    label: 'Suggested English label (unverified)', reason: 'Reason for proposing this change',
    submit: 'Save unverified proposal', history: 'My submitted proposals',
    empty: 'No review-only proposals for this account.',
    pending: 'Proposed — unverified, not payable',
    saving: 'Saving your review-only proposal…',
    saved: 'Proposal saved to the protected register. Nothing has been approved or activated.',
    auth: 'Your authenticated session must match the proposal owner.',
    failure: 'Unable to save or load proposal. No legal change was made.'
  },
  bn: {
    title: 'উৎসের পরিবর্তনের প্রস্তাব জমা দিন',
    intro: 'শুধু পর্যালোচনার জন্য। এটি আইনি অনুমোদন, সরকারি অর্থনৈতিক কোড পরিবর্তন বা কর সংগ্রহের অনুমতি নয়।',
    search: 'মূল উৎসের খাত খুঁজুন', choose: 'পর্যালোচনার জন্য উৎসের তথ্য নির্বাচন করুন',
    select: 'উৎসের একটি তথ্য নির্বাচন করুন', hash: 'নথির SHA-256 (৬৪ অক্ষরের হেক্সাডেসিমাল)',
    label: 'প্রস্তাবিত ইংরেজি নাম (যাচাই হয়নি)', reason: 'পরিবর্তনের প্রস্তাবের কারণ',
    submit: 'অযাচাইকৃত প্রস্তাব সংরক্ষণ করুন', history: 'আমার জমা দেওয়া প্রস্তাব',
    empty: 'এই অ্যাকাউন্টে কোনো পর্যালোচনাধীন প্রস্তাব নেই।',
    pending: 'প্রস্তাবিত — যাচাই হয়নি, পরিশোধযোগ্য নয়',
    saving: 'শুধু পর্যালোচনার জন্য প্রস্তাব সংরক্ষণ হচ্ছে…',
    saved: 'প্রস্তাবটি সুরক্ষিত রেজিস্টারে সংরক্ষিত হয়েছে। কোনো অনুমোদন বা কার্যকরকরণ হয়নি।',
    auth: 'প্রস্তাবদাতার সাথে অ্যাপের অনুমোদিত সেশনের পরিচয় মিলতে হবে।',
    failure: 'প্রস্তাব সংরক্ষণ বা লোড করা যায়নি। কোনো আইনি পরিবর্তন হয়নি।'
  }
} as const;

export const SourceChangeProposals: React.FC<Props> = ({ authenticatedUserId, language }) => {
  const t = content[language];
  const [query, setQuery] = useState('');
  const [headId, setHeadId] = useState(0);
  const [sha, setSha] = useState('');
  const [suggestedLabel, setSuggestedLabel] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<ProposalRow[]>([]);
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return V11_SOURCE_HEADS.filter(head =>
      !q || String(head.id).includes(q) ||
      head.en.toLocaleLowerCase().includes(q) ||
      (head.bn || '').toLocaleLowerCase().includes(q) ||
      head.codeEn.toLocaleLowerCase().includes(q));
  }, [query]);

  const readHistory = async (isActive: () => boolean) => {
    if (!supabase) return;
    const { data: who, error: identityError } = await supabase.auth.getUser();
    if (identityError || !sameAuthenticatedOwner(who.user?.id, authenticatedUserId)) {
      throw new Error(t.auth);
    }
    const { data, error } = await supabase.from('taxpay_head_change_proposals')
      .select('proposal_id,source_head_id,proposal_state,created_at')
      .eq('proposer_uid', authenticatedUserId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    if (isActive()) setHistory((data ?? []) as ProposalRow[]);
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setHistory([]);
    readHistory(() => active)
      .catch(() => { if (active) setMessage(t.failure); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authenticatedUserId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || busy) return;
    const proposed = {
      sourceHeadId: headId,
      sourceDocumentSha256: sha.trim(),
      reason: reason.trim(),
      proposedPatch: { suggestedEnglishLabel: suggestedLabel.trim() }
    };
    const checked = validateSourceChangeProposal(proposed, allowedHeads);
    if (checked.error || !suggestedLabel.trim()) {
      setMessage(checked.error || t.label);
      return;
    }
    setBusy(true); setMessage(t.saving);
    try {
      const { data: who, error: identityError } = await supabase.auth.getUser();
      if (identityError || !sameAuthenticatedOwner(who.user?.id, authenticatedUserId)) {
        setMessage(t.auth); return;
      }
      const { error } = await supabase.from('taxpay_head_change_proposals').insert({
        proposer_uid: authenticatedUserId,
        source_key: 'V11-HTML-20261010',
        source_head_id: proposed.sourceHeadId,
        source_document_sha256: proposed.sourceDocumentSha256,
        proposed_patch: proposed.proposedPatch,
        submission_reason: proposed.reason
      });
      if (error) { setMessage(t.failure + ' ' + error.message); return; }
      setHeadId(0); setSha(''); setReason(''); setSuggestedLabel(''); setQuery('');
      await readHistory(() => true);
      setMessage(t.saved);
    } catch {
      setMessage(t.failure);
    } finally {
      setBusy(false);
    }
  };

  return <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-5" aria-labelledby="source-proposals-title">
    <header className="space-y-2">
      <h2 id="source-proposals-title" className="font-serif-fraunces text-xl font-bold text-emerald-950">{t.title}</h2>
      <p className="text-sm leading-6 text-amber-900">{t.intro}</p>
    </header>
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block text-sm font-semibold text-slate-800">
          {t.search}
          <UiInput type="search" value={query} onChange={e => setQuery(e.target.value)}
            className="mt-2 block min-h-11 w-full rounded-lg border border-slate-300 p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-800"/>
        </label>
        <label className="block text-sm font-semibold text-slate-800">
          {t.choose}
          <UiSelect required value={headId || ''} onChange={e => setHeadId(Number(e.target.value))}
            className="mt-2 block min-h-11 w-full rounded-lg border border-slate-300 p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-800">
            <option value="" disabled>{t.select}</option>
            {filtered.map(x => <option key={x.id} value={x.id}>{x.id} — {x.en}</option>)}
          </UiSelect>
        </label>
        <label className="block text-sm font-semibold text-slate-800">
          {t.hash}
          <UiInput required type="text" inputMode="text" spellCheck={false} minLength={64} maxLength={64}
            value={sha} onChange={e => setSha(e.target.value.toLowerCase())}
            className="mt-2 block min-h-11 w-full rounded-lg border border-slate-300 p-3 font-mono-plex text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-800"/>
        </label>
        <label className="block text-sm font-semibold text-slate-800">
          {t.label}
          <UiInput required type="text" value={suggestedLabel} maxLength={400}
            onChange={e => setSuggestedLabel(e.target.value)}
            className="mt-2 block min-h-11 w-full rounded-lg border border-slate-300 p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-800"/>
        </label>
      </div>
      <label className="block text-sm font-semibold text-slate-800">
        {t.reason}
        <UiTextarea required minLength={10} maxLength={1000} rows={3} value={reason}
          onChange={e => setReason(e.target.value)}
          className="mt-2 block w-full rounded-lg border border-slate-300 p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-800"/>
      </label>
      <UiButton type="submit" disabled={busy}
        className="min-h-11 rounded-lg bg-emerald-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500">
        {t.submit}
      </UiButton>
    </form>
    {message && <p role="status" aria-live="polite" className="rounded-lg border border-slate-200 p-3 text-sm text-slate-800 break-words">{message}</p>}
    <section aria-labelledby="source-proposal-history" className="space-y-3">
      <h3 id="source-proposal-history" className="font-serif-fraunces text-lg font-bold text-slate-900">{t.history}</h3>
      {loading ? <p role="status" className="text-sm text-slate-600">{t.saving}</p> :
        history.length === 0 ? <p className="text-sm text-slate-600">{t.empty}</p> :
        <ul className="divide-y divide-slate-200">
          {history.map(row => <li key={row.proposal_id} className="py-3">
            <p className="text-sm font-semibold text-slate-900">ID {row.source_head_id} · {t.pending}</p>
            <p className="text-xs text-slate-600">{row.created_at}</p>
          </li>)}
        </ul>}
    </section>
  </section>;
};
