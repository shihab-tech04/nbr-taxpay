import React, { useEffect, useState } from 'react';
import { ArrowRight, FileText, RefreshCw, Trash2 } from 'lucide-react';
import { useAccountIdentity } from '../../services/accountIdentity';
import { useTaxState } from '../../services/taxState';
import { CATEGORY_LABELS } from '../../data/paymentHeads';
import {
  deletePaymentFormDraft, listPaymentFormDrafts,
  type PaymentFormDraft, type PaymentDraftActor,
} from '../../services/accountPaymentFormDrafts';
import { assertResumablePaymentDraft } from './PaymentDraftEntryGate';

type Catalog = {
  ownerKey: string;
  status: 'loading' | 'ready' | 'error';
  rows: PaymentFormDraft[];
};

/** Reuse the original account-owned SQL drafts and the existing payment modal.
 * No separate draft storage, routes, or restore implementation is introduced.
 */
export const DashboardPaymentDrafts: React.FC<{
  language: 'en' | 'bn';
  onResume: (draft: PaymentFormDraft) => void;
}> = ({ language, onResume }) => {
  const { user, loading: authLoading } = useAccountIdentity();
  const { previewAccount, isPaymentServiceChoiceOpen } = useTaxState();
  const actor: PaymentDraftActor | null = user
    ? { kind: 'authenticated', userId: user.id }
    : previewAccount ? { kind: 'preview', profileId: previewAccount.id } : null;
  const ownerKey = actor ? actor.kind + ':' +
    (actor.kind === 'authenticated' ? actor.userId : actor.profileId) : '';
  const [catalog, setCatalog] = useState<Catalog>({ ownerKey: '', status: 'loading', rows: [] });
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bn = language === 'bn';
  const tr = (en: string, bangla: string) => bn ? bangla : en;

  useEffect(() => {
    let active = true;
    // Re-query on modal close to include newly saved, updated or settled drafts.
    if (isPaymentServiceChoiceOpen) return () => { active = false; };
    // Preserve the rendered cards while the dialog opens and during its close refresh.
    // Clear old rows immediately only when the account owner changes.
    setCatalog(previous => previous.ownerKey === ownerKey && previous.status === 'ready'
      ? previous : { ownerKey, status: 'loading', rows: [] });
    setPendingDelete(null);
    setBusyId(null);
    setError(null);
    if (!actor || authLoading) return () => { active = false; };
    void listPaymentFormDrafts(actor).then(rows => {
      if (active) setCatalog({ ownerKey, status: 'ready', rows });
    }).catch(() => {
      if (active) setCatalog({ ownerKey, status: 'error', rows: [] });
    });
    return () => { active = false; };
    // Recheck only on identity or modal lifecycle changes, not ordinary rerenders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerKey, authLoading, isPaymentServiceChoiceOpen]);

  if (!actor || authLoading ||
      (catalog.ownerKey !== ownerKey && catalog.status !== 'loading')) return null;

  const retry = () => {
    if (busyId) return;
    setCatalog({ ownerKey, status: 'loading', rows: [] });
    setError(null);
    void listPaymentFormDrafts(actor).then(rows => {
      setCatalog(previous => previous.ownerKey === ownerKey
        ? { ownerKey, status: 'ready', rows } : previous);
    }).catch(() => {
      setCatalog(previous => previous.ownerKey === ownerKey
        ? { ownerKey, status: 'error', rows: [] } : previous);
    });
  };

  const resume = async (draft: PaymentFormDraft) => {
    if (busyId) return;
    setBusyId(draft.id); setError(null); setPendingDelete(null);
    try {
      const current = (await listPaymentFormDrafts(actor)).find(item => item.id === draft.id);
      if (!current) throw new Error(tr('This draft is no longer available. Refresh your drafts.', 'এই খসড়াটি আর পাওয়া যাচ্ছে না। খসড়াগুলো নতুন করে লোড করুন।'));
      assertResumablePaymentDraft(current, language);
      onResume(current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : tr('Draft could not be opened.', 'খসড়া খোলা যায়নি।'));
    } finally { setBusyId(null); }
  };

  const remove = async (draft: PaymentFormDraft) => {
    if (busyId) return;
    if (pendingDelete !== draft.id) { setPendingDelete(draft.id); return; }
    setBusyId(draft.id); setError(null);
    try {
      // SQL enforces owner and revision; a changed draft is not silently deleted.
      await deletePaymentFormDraft(actor, draft);
      setCatalog(previous => previous.ownerKey === ownerKey
        ? { ...previous, rows: previous.rows.filter(item => item.id !== draft.id) }
        : previous);
      setPendingDelete(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : tr('Draft could not be deleted.', 'খসড়া মুছে ফেলা যায়নি।'));
      setPendingDelete(null);
    } finally { setBusyId(null); }
  };

  const loading = catalog.ownerKey !== ownerKey || catalog.status === 'loading';
  if (!loading && catalog.status === 'ready' && catalog.rows.length === 0) return null;

  return <section data-testid="dashboard-payment-drafts" aria-labelledby="dashboard-payment-drafts-title"
    className="rounded-2xl border border-taxpay-border bg-white p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <FileText size={20} className="text-taxpay-primary" aria-hidden="true" />
        <h2 id="dashboard-payment-drafts-title" className="text-lg font-semibold text-taxpay-text">
          {tr('Saved payment drafts', 'সংরক্ষিত পেমেন্ট খসড়া')}
        </h2>
        {!loading && catalog.status === 'ready' &&
          <span className="text-sm text-taxpay-muted">({catalog.rows.length})</span>}
      </div>
      {!loading && <button type="button" onClick={retry} disabled={Boolean(busyId)}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-taxpay-primary hover:bg-taxpay-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-taxpay-primary">
        <RefreshCw size={16} aria-hidden="true" />{tr('Refresh', 'নতুন করে লোড')}
      </button>}
    </div>
    {loading ? <p role="status" className="mt-3 text-sm text-taxpay-muted">
      {tr('Loading saved drafts…', 'সংরক্ষিত খসড়া লোড হচ্ছে…')}
    </p> : catalog.status === 'error' ? <p role="alert" className="mt-3 text-sm text-taxpay-error">
      {tr('Drafts could not be loaded. Try again.', 'খসড়াগুলো লোড করা যায়নি। আবার চেষ্টা করুন।')}
    </p> : <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="list">
      {catalog.rows.map(draft => {
        const updatedAt = new Date(draft.updated_at);
        const updated = Number.isNaN(updatedAt.getTime()) ? draft.updated_at
          : new Intl.DateTimeFormat(bn ? 'bn-BD' : 'en-BD', {
              dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka',
            }).format(updatedAt);
        const payer = draft.service === 'TRAVEL_TAX'
          ? tr('Travel tax', 'ভ্রমণ কর')
          : draft.form_payload.forSelf === true ? tr('My Tax Liability', 'আমার করদায়')
            : tr('Another taxpayer', 'অন্য করদাতা');
        return <article role="listitem" key={draft.id} data-draft-id={draft.id}
          className="flex min-w-0 flex-col rounded-xl border border-taxpay-border p-4">
          <h3 className="text-base font-semibold text-taxpay-text">
            {CATEGORY_LABELS[draft.service]?.[language] ?? draft.service}
          </h3>
          <p className="mt-1 text-sm text-taxpay-muted">{payer}</p>
          <p className="mt-2 text-xs text-taxpay-muted">
            {tr('Last saved:', 'সর্বশেষ সংরক্ষণ:')} <time dateTime={draft.updated_at}>{updated}</time>
          </p>
          <div className="mt-auto flex flex-wrap gap-2 pt-4">
            <button type="button" disabled={Boolean(busyId)} onClick={() => void resume(draft)}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-taxpay-primary px-4 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taxpay-primary">
              {busyId === draft.id ? tr('Opening…', 'খোলা হচ্ছে…') : tr('Continue', 'চালিয়ে যান')}
              {busyId !== draft.id && <ArrowRight size={16} aria-hidden="true" />}
            </button>
            {pendingDelete === draft.id ? <>
              <button type="button" disabled={Boolean(busyId)} onClick={() => void remove(draft)}
                className="min-h-11 rounded-lg border border-taxpay-error px-3 text-sm font-medium text-taxpay-error">
                {tr('Confirm delete', 'মুছে ফেলা নিশ্চিত করুন')}
              </button>
              <button type="button" disabled={Boolean(busyId)} onClick={() => setPendingDelete(null)}
                className="min-h-11 rounded-lg px-3 text-sm font-medium text-taxpay-text">
                {tr('Cancel', 'বাতিল')}
              </button>
            </> : <button type="button" disabled={Boolean(busyId)} onClick={() => void remove(draft)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-taxpay-border px-3 text-sm font-medium text-taxpay-text hover:bg-taxpay-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-taxpay-primary">
              <Trash2 size={16} aria-hidden="true" />{tr('Delete', 'মুছুন')}
            </button>}
          </div>
        </article>;
      })}
    </div>}
    {error && <p role="alert" className="mt-3 text-sm text-taxpay-error">{error}</p>}
  </section>;
};
