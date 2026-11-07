import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { useAccountIdentity } from '../../services/accountIdentity';
import { useTaxState } from '../../services/taxState';
import {
  deletePaymentFormDraft, listPaymentFormDrafts, savePaymentFormDraft,
  type PaymentFormDraft, type PaymentDraftActor, type PaymentDraftService,
} from '../../services/accountPaymentFormDrafts';

type Props = {
  service: PaymentDraftService;
  language: 'en' | 'bn';
  snapshot: () => Record<string, unknown>;
  restore: (value: Record<string, unknown>) => void;
  selectedDraft: PaymentFormDraft | null;
  onSelectedDraft: (draft: PaymentFormDraft | null) => void;
  /** When the payment is embedded, action buttons belong in its shared modal footer. */
  actionTarget?: HTMLElement | null;
};

/** Keep owner-scoped drafts inside the existing payment form; no extra login,
 * duplicate payment flow, URL state or browser-local draft storage. */
export const AccountPaymentDraftControls: React.FC<Props> = ({
  service, language, snapshot, restore, selectedDraft, onSelectedDraft, actionTarget,
}) => {
  const { previewAccount } = useTaxState();
  const { user: realUser, loading: authLoading } = useAccountIdentity();
  const bn = language === 'bn';
  const actor: PaymentDraftActor | null = realUser
    ? { kind: 'authenticated', userId: realUser.id }
    : previewAccount ? { kind: 'preview', profileId: previewAccount.id } : null;
  const ownerKey = actor ? actor.kind + ':' + (actor.kind === 'preview' ? actor.profileId : actor.userId) : '';
  const [rows, setRows] = useState<PaymentFormDraft[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setRows([]);
    setPendingDelete(null);
    setError(null);
    setFeedback(null);
    setSavedSnapshot(null);
    if (!actor) return () => { active = false; };
    setLoading(true);
    void listPaymentFormDrafts(actor, service).then(result => {
      if (active) setRows(result);
    }).catch(() => {
      if (active) setError(bn ? 'সংরক্ষিত খসড়া লোড করা যায়নি। আবার চেষ্টা করুন।' : 'Saved drafts could not be loaded. Retry.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  // A new owner cannot see stale rows while an async query is pending.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerKey, service]);

  if (!actor || authLoading) return null;

  const refresh = async () => {
    if (!actor) return;
    const result = await listPaymentFormDrafts(actor, service);
    setRows(result);
  };

  const save = async () => {
    if (!actor || busy) return;
    setBusy(true); setError(null); setFeedback(null); setSavedSnapshot(null);
    try {
      const payload = snapshot();
      const existing = selectedDraft?.service === service ? selectedDraft : undefined;
      const result = await savePaymentFormDraft(actor, service, payload, existing);
      onSelectedDraft(result);
      setRows(rows => [result, ...rows.filter(row => row.id !== result.id)].sort(
        (a, b) => b.updated_at.localeCompare(a.updated_at)));
      // The SQL write and readback have already completed. Show success only in
      // the button; no extra success banner below the payment form.
      setSavedSnapshot(JSON.stringify(payload));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Save was not confirmed.');
    } finally { setBusy(false); }
  };

  const resume = async (draft: PaymentFormDraft) => {
    if (!actor || busy) return;
    setBusy(true); setError(null); setFeedback(null);
    try {
      const latest = await listPaymentFormDrafts(actor, service);
      const current = latest.find(row => row.id === draft.id);
      if (!current) throw new Error(bn ? 'খসড়াটি আর পাওয়া যাচ্ছে না।' : 'Draft was not found.');
      restore(current.form_payload);
      setSavedSnapshot(null);
      onSelectedDraft(current);
      setRows(latest);
      setExpanded(false);
      setPendingDelete(null);
      setFeedback(bn ? 'সংরক্ষিত তথ্য ফর্মে ফিরিয়ে আনা হয়েছে। জমা দেওয়ার আগে যাচাই করুন।'
        : 'Saved form restored. Review details before submitting.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Draft could not be resumed.');
    } finally { setBusy(false); }
  };

  const remove = async (draft: PaymentFormDraft) => {
    if (!actor || busy) return;
    if (pendingDelete !== draft.id) { setPendingDelete(draft.id); return; }
    setBusy(true); setError(null); setFeedback(null);
    try {
      await deletePaymentFormDraft(actor, draft);
      if (selectedDraft?.id === draft.id) onSelectedDraft(null);
      await refresh();
      setPendingDelete(null);
      setFeedback(bn ? 'খসড়া মুছে ফেলা হয়েছে।' : 'Draft deleted.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Draft deletion was not confirmed.');
    } finally { setBusy(false); }
  };

  const savedNow = savedSnapshot !== null && savedSnapshot === JSON.stringify(snapshot());
  const actions = <div className="payment-form-draft-controls__actions">
    <button type="button" className="payment-form-draft-controls__save"
      onClick={() => void save()} disabled={busy || loading}>
      <span aria-live="polite" className="inline-flex items-center justify-center gap-1.5">
        {busy ? (bn ? 'সংরক্ষণ হচ্ছে…' : 'Saving…')
          : savedNow ? <><Check size={16} strokeWidth={2.5} aria-hidden="true" />{bn ? 'খসড়া সংরক্ষিত' : 'Draft Saved'}</>
          : (bn ? 'খসড়া সংরক্ষণ করুন' : 'Save Draft')}
      </span>
    </button>
    {actionTarget === undefined && <button type="button" className="payment-form-draft-controls__open"
      onClick={() => setExpanded(open => !open)} disabled={busy} aria-expanded={expanded}>
      <span className="payment-form-draft-controls__open-long">{bn ? 'সংরক্ষিত খসড়া' : 'Continue Draft'}</span>
      <span className="payment-form-draft-controls__open-short">{bn ? 'খসড়া' : 'Drafts'}</span>
      {!loading ? ' (' + rows.length + ')' : ''}
    </button>}
  </div>;

  return <section className="payment-form-draft-controls" aria-label={bn ? 'আমার পেমেন্ট খসড়া' : 'My payment drafts'}>
    {actionTarget ? createPortal(actions, actionTarget) : actionTarget === undefined ? actions : null}
    {feedback && <p className="mt-2 text-sm text-taxpay-dark" role="status">{feedback}</p>}
    {error && <p className="mt-2 text-sm text-taxpay-error" role="alert">{error}</p>}
    {expanded && <div className="mt-3 rounded-lg border border-taxpay-border bg-white p-3">
      {loading ? <p role="status">{bn ? 'খসড়া লোড হচ্ছে…' : 'Loading saved drafts…'}</p>
        : rows.length === 0 ? <p role="status" className="text-sm text-slate-600">{bn ? 'এই সেবায় কোনো খসড়া নেই।' : 'No saved drafts for this service.'}</p>
        : <ul className="divide-y divide-taxpay-border">
          {rows.map(row => <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-taxpay-dark">{bn ? 'পেমেন্ট খসড়া' : 'Payment draft'}</p>
              <p className="text-xs text-slate-600">
                {bn ? 'সর্বশেষ সংরক্ষণ:' : 'Last saved:'} {new Date(row.updated_at).toLocaleString(bn ? 'bn-BD' : 'en-BD')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => void resume(row)}
                className="min-h-11 rounded-lg border border-taxpay-primary px-3 text-sm font-medium text-taxpay-primary">
                {bn ? 'চালিয়ে যান' : 'Continue'}
              </button>
              <button type="button" disabled={busy} onClick={() => void remove(row)}
                className="min-h-11 rounded-lg border border-taxpay-border px-3 text-sm font-medium text-taxpay-dark">
                {pendingDelete === row.id ? (bn ? 'মুছে ফেলা নিশ্চিত করুন' : 'Confirm delete')
                  : (bn ? 'মুছুন' : 'Delete')}
              </button>
              {pendingDelete === row.id && <button type="button" onClick={() => setPendingDelete(null)}
                className="min-h-11 px-2 text-sm text-taxpay-dark">{bn ? 'বাতিল' : 'Cancel'}</button>}
            </div>
          </li>)}
        </ul>}
      <button type="button" disabled={loading || busy} onClick={() => {
        setLoading(true); setError(null);
        void refresh().catch(() => setError(bn ? 'আবার লোড করা যায়নি।' : 'Could not reload drafts.'))
          .finally(() => setLoading(false));
      }} className="mt-3 min-h-11 text-sm font-medium text-taxpay-primary">
        {bn ? 'আবার লোড করুন' : 'Refresh drafts'}
      </button>
    </div>}
  </section>;
};
