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
  onCountChange?: (count: number | null) => void;
  showEmptyState?: boolean;
  onStartPayment?: () => void;
}> = ({ language, onResume, onCountChange, showEmptyState = false, onStartPayment }) => {
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

  // The Overview quick link is shown only when this account owns saved drafts.
  // Reuse the already loaded catalog: never duplicate SQL reads or share owners.
  useEffect(() => {
    onCountChange?.(catalog.ownerKey === ownerKey && catalog.status === 'ready' ? catalog.rows.length : null);
  }, [catalog.ownerKey, catalog.status, catalog.rows.length, ownerKey, onCountChange]);

  if (!actor || authLoading) {
    if (!showEmptyState) return null;
    return <section id="dashboard-payment-drafts" tabIndex={-1} data-testid="dashboard-payment-drafts"
      className="rounded-2xl border border-taxpay-border bg-white p-4 sm:p-5">
      <h2 className="text-base font-semibold text-taxpay-text">{tr('Saved payment drafts','সংরক্ষিত পেমেন্ট খসড়া')}</h2>
      <p className="mt-2 text-sm text-taxpay-muted" role="status">
        {authLoading?tr('Checking your saved drafts…','সংরক্ষিত খসড়া যাচাই হচ্ছে…'):
          tr('Sign in to a taxpayer account to load and continue its saved drafts.',
            'সংরক্ষিত খসড়া দেখতে ও আবার চালু করতে করদাতা অ্যাকাউন্টে সাইন ইন করুন।')}
      </p>
      {onStartPayment&&<button type="button" onClick={onStartPayment}
        className="mt-3 min-h-11 rounded-lg border border-taxpay-border bg-white px-4 text-sm font-medium text-taxpay-primary">
        {tr('Start a payment','পেমেন্ট শুরু করুন')}
      </button>}
    </section>;
  }
  if (catalog.ownerKey !== ownerKey && catalog.status !== 'loading') return null;

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
  if (!showEmptyState && !loading && catalog.status === 'ready' && catalog.rows.length === 0) return null;

  return <section id="dashboard-payment-drafts" tabIndex={-1} data-testid="dashboard-payment-drafts" aria-labelledby="dashboard-payment-drafts-title"
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
    <p className="mt-1 text-sm text-taxpay-muted">{tr('Saved drafts from all assessment years.','সব করবর্ষের সংরক্ষিত খসড়া।')}</p>
    {loading ? <p role="status" className="mt-3 text-sm text-taxpay-muted">
      {tr('Loading saved drafts…', 'সংরক্ষিত খসড়া লোড হচ্ছে…')}
    </p> : catalog.status === 'error' ? <p role="alert" className="mt-3 text-sm text-taxpay-error">
      {tr('Drafts could not be loaded. Try again.', 'খসড়াগুলো লোড করা যায়নি। আবার চেষ্টা করুন।')}
    </p> : catalog.rows.length===0 ? <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-taxpay-border bg-taxpay-light p-3" data-testid="dashboard-drafts-empty">
      <p className="min-w-0 text-sm text-taxpay-muted" role="status">
        {tr('No saved drafts yet. Save an unfinished payment to continue it here or in another browser.',
          'এখনও সংরক্ষিত খসড়া নেই। অসমাপ্ত পেমেন্ট সংরক্ষণ করলে এখান থেকে বা অন্য ব্রাউজারে আবার চালু করতে পারবেন।')}
      </p>
      {onStartPayment && <button type="button" onClick={onStartPayment}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-taxpay-border bg-white px-4 text-sm font-medium text-taxpay-primary hover:bg-taxpay-light">
        {tr('Start a payment','নতুন পেমেন্ট শুরু করুন')}<ArrowRight size={16} aria-hidden="true"/>
      </button>}
    </div> : <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="list">
      {catalog.rows.map((draft,index) => {
        const updatedAt = new Date(draft.updated_at);
        const updated = Number.isNaN(updatedAt.getTime()) ? draft.updated_at
          : new Intl.DateTimeFormat(bn ? 'bn-BD' : 'en-BD', {
              dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka',
            }).format(updatedAt);
        const payer = draft.service === 'TRAVEL_TAX'
          ? tr('Travel tax', 'ভ্রমণ কর')
          : draft.form_payload.forSelf === true ? tr('My Tax Liability', 'আমার করদায়')
            : tr('Another taxpayer', 'অন্য করদাতা');
        const savedText = (key: string) => typeof draft.form_payload[key] === 'string'
          ? String(draft.form_payload[key]).trim() : '';
        const name = draft.form_payload.forSelf === false ? savedText('otherTaxpayerName') : '';
        const tinDigits = draft.form_payload.forSelf === false ? savedText('tin').replace(/\D/g,'') : '';
        const payerIdentity = name || (tinDigits.length >= 4
          ? tr('TIN ending ', 'টিআইএন শেষ ') + tinDigits.slice(-4) : '');
        const assessmentYear = savedText('assessmentYear');
        const details = [payer, payerIdentity, assessmentYear
          ? tr('Assessment year ', 'করবর্ষ ') + assessmentYear : ''].filter(Boolean).join(' · ');
        return <article role="listitem" key={draft.id} data-draft-id={draft.id}
          className="flex min-w-0 flex-col rounded-xl border border-taxpay-border p-4">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-taxpay-text">{CATEGORY_LABELS[draft.service]?.[language] ?? draft.service}</h3>
            <span className="text-xs font-medium text-taxpay-muted" aria-label={tr('Draft ','খসড়া ')+(index+1)+' / '+catalog.rows.length}>
              {tr('Draft ','খসড়া ')}{index+1} / {catalog.rows.length}
            </span>
          </div>
          <p className="mt-1 text-sm text-taxpay-muted">{details}</p>
          <p className="mt-2 text-xs text-taxpay-muted">
            {tr('Last saved:', 'সর্বশেষ সংরক্ষণ:')} <time dateTime={draft.updated_at}>{updated}</time>
          </p>
          <div className="mt-auto flex flex-wrap gap-2 pt-4">
            <button type="button" disabled={Boolean(busyId)} onClick={() => void resume(draft)}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-taxpay-primary bg-white px-4 text-sm font-semibold text-taxpay-primary transition-colors hover:bg-taxpay-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taxpay-primary">
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
