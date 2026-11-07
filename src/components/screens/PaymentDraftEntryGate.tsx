import React, { useEffect, useState } from 'react';
import { ArrowRight, FileCheck2, FolderOpen } from 'lucide-react';
import {
  listPaymentFormDrafts, type PaymentDraftActor, type PaymentDraftService,
  type PaymentFormDraft,
} from '../../services/accountPaymentFormDrafts';

type DraftEntryMode = 'choice' | 'list' | 'new';

type Props = {
  actor: PaymentDraftActor | null;
  ownerKey: string;
  enabled: boolean;
  mode: DraftEntryMode;
  onModeChange: (mode: DraftEntryMode) => void;
  language: 'en' | 'bn';
  serviceLabel: (service: PaymentDraftService) => string;
  onResume: (draft: PaymentFormDraft) => void;
  onBlockingChange: (blocking: boolean) => void;
  children: React.ReactNode;
};

type Catalog = {
  ownerKey: string;
  status: 'loading' | 'ready' | 'error';
  rows: PaymentFormDraft[];
};


/** Shared draft integrity gate for the payment chooser and dashboard cards. */
export function assertResumablePaymentDraft(draft: PaymentFormDraft, language: 'en' | 'bn'): void {
  const message = (en: string, bn: string) => language === 'bn' ? bn : en;
  if (draft.form_payload.schemaVersion !== 1)
    throw new Error(message('The draft format is unsupported.', 'এই খসড়ার বিন্যাস সমর্থিত নয়।'));
  if (draft.service === 'TRAVEL_TAX') {
    if (!Array.isArray(draft.form_payload.passengers))
      throw new Error(message('Saved passenger details could not be verified.', 'সংরক্ষিত যাত্রীর তথ্য যাচাই করা যায়নি।'));
  } else if (draft.form_payload.category !== draft.service ||
             (typeof draft.form_payload.forSelf !== 'boolean' && draft.form_payload.forSelf !== null)) {
    throw new Error(message('Saved taxpayer details could not be verified.', 'সংরক্ষিত করদাতার তথ্য যাচাই করা যায়নি।'));
  }
}

/** Show the start/resume decision only when the signed-in account actually has drafts.
 * A fresh payment still uses the original, unchanged payer/service selector.
 */
export function PaymentDraftEntryGate({
  actor, ownerKey, enabled, mode, onModeChange, language, serviceLabel, onResume, onBlockingChange, children,
}: Props) {
  const bn = language === 'bn';
  const tr = (en: string, bengali: string) => bn ? bengali : en;
  const [refresh, setRefresh] = useState(0);
  const [catalog, setCatalog] = useState<Catalog>({ ownerKey: '', status: 'loading', rows: [] });
  const [resuming, setResuming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    onModeChange('choice');
    setError(null);
    setCatalog({ ownerKey, status: 'loading', rows: [] });
    if (!enabled || !actor) return () => { active = false; };
    void listPaymentFormDrafts(actor).then(rows => {
      if (active) setCatalog({ ownerKey, status: 'ready', rows });
    }).catch(() => {
      if (active) setCatalog({ ownerKey, status: 'error', rows: [] });
    });
    return () => { active = false; };
    // The stable ownerKey identifies the actor; a render does not reload the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerKey, enabled, refresh, onModeChange]);

  const ready = catalog.ownerKey === ownerKey && catalog.status === 'ready';
  const blocking = enabled && mode !== 'new' && (!ready || catalog.rows.length > 0);

  useEffect(() => { onBlockingChange(blocking); }, [blocking, onBlockingChange]);

  const resume = async (draft: PaymentFormDraft) => {
    if (!actor || resuming) return;
    setError(null);
    setResuming(draft.id);
    try {
      // Never trust an earlier client snapshot; re-read the account-owned draft.
      const rows = await listPaymentFormDrafts(actor);
      const latest = rows.find(item => item.id === draft.id);
      if (!latest) throw new Error(tr('This draft is no longer available. Reload the list.', 'এই খসড়াটি আর পাওয়া যাচ্ছে না। তালিকা নতুন করে লোড করুন।'));
      assertResumablePaymentDraft(latest, language);
      setCatalog({ ownerKey, status: 'ready', rows });
      onResume(latest);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : tr('Draft could not be opened.', 'খসড়া খোলা যায়নি।'));
    } finally {
      setResuming(null);
    }
  };

  if (!blocking) return <>{children}</>;

  return <div className="space-y-3" data-testid="account-draft-entry">
    {catalog.ownerKey !== ownerKey || catalog.status === 'loading' ? (
      <p role="status" className="py-6 text-sm text-taxpay-muted">
        {tr('Checking your saved payment drafts…', 'আপনার সংরক্ষিত পেমেন্ট খসড়া খোঁজা হচ্ছে…')}
      </p>
    ) : catalog.status === 'error' ? (
      <>
        <p role="alert" className="text-sm text-taxpay-error">
          {tr('Saved drafts could not be loaded. Retry, or start a new payment.', 'সংরক্ষিত খসড়া লোড করা যায়নি। আবার চেষ্টা করুন অথবা নতুন পেমেন্ট শুরু করুন।')}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="tax-service-choice__cancel min-h-11 rounded-lg px-4" onClick={() => setRefresh(n => n + 1)}>
            {tr('Retry', 'আবার চেষ্টা করুন')}
          </button>
          <button type="button" className="tax-service-choice__continue min-h-11 rounded-lg px-4" onClick={() => onModeChange('new')}>
            {tr('Start new Tax payment', 'নতুন কর পরিশোধ শুরু করুন')}
          </button>
        </div>
      </>
    ) : mode === 'choice' ? (
      <>
        <h3 className="tax-service-choice__payer-focus">
          {tr('How would you like to proceed?', 'আপনি কীভাবে এগোতে চান?')}
        </h3>
        <div className="tax-service-choice__grid tax-service-choice__payer-grid" role="group" aria-label={tr('Payment start options', 'পেমেন্ট শুরুর বিকল্প')}>
          <button type="button" className="tax-service-choice__card" onClick={() => onModeChange('new')}>
            <span className="tax-service-choice__icon"><FileCheck2 size={23} aria-hidden="true" /></span>
            <span className="tax-service-choice__copy">
              <strong>{tr('Start new Tax payment', 'নতুন কর পরিশোধ শুরু করুন')}</strong>
              <span className="tax-service-choice__description">{tr('Follow the existing payment steps.', 'বিদ্যমান কর পরিশোধের ধাপ অনুসরণ করুন।')}</span>
            </span>
            <ArrowRight size={18} aria-hidden="true" />
          </button>
          <button type="button" className="tax-service-choice__card" onClick={() => onModeChange('list')}>
            <span className="tax-service-choice__icon"><FolderOpen size={23} aria-hidden="true" /></span>
            <span className="tax-service-choice__copy">
              <strong>{tr('Continue from draft', 'সংরক্ষিত খসড়া থেকে চালিয়ে যান')}</strong>
              <span className="tax-service-choice__description">
                {tr('Choose a saved payment (' + catalog.rows.length + ').', 'সংরক্ষিত পেমেন্ট (' + catalog.rows.length + ') থেকে বেছে নিন।')}
              </span>
            </span>
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </>
    ) : (
      <>
        <h3 className="tax-service-choice__payer-focus">{tr('Continue from draft', 'সংরক্ষিত খসড়া থেকে চালিয়ে যান')}</h3>
        <p className="text-sm text-taxpay-muted">{tr('Select a saved payment to review and edit.', 'যাচাই ও সম্পাদনার জন্য সংরক্ষিত পেমেন্ট বেছে নিন।')}</p>
        <div className="tax-service-choice__grid tax-service-choice__payer-grid" data-testid="saved-payment-draft-list">
          {catalog.rows.map(draft => {
            const payer = draft.service === 'TRAVEL_TAX' ? tr('Travel tax', 'ভ্রমণ কর')
              : draft.form_payload.forSelf === true ? tr('My Tax Liability', 'আমার করদায়')
                : tr('Another taxpayer', 'অন্য করদাতা');
            const date = new Date(draft.updated_at);
            const updated = Number.isNaN(date.getTime()) ? draft.updated_at
              : new Intl.DateTimeFormat(bn ? 'bn-BD' : 'en-BD',
                { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka' }).format(date);
            return <button type="button" key={draft.id} className="tax-service-choice__card"
              data-draft-id={draft.id} disabled={resuming !== null}
              onClick={() => void resume(draft)}>
              <span className="tax-service-choice__icon"><FolderOpen size={21} aria-hidden="true" /></span>
              <span className="tax-service-choice__copy">
                <strong>{serviceLabel(draft.service)}</strong>
                <span className="tax-service-choice__description">{payer} · {updated}</span>
              </span>
              {resuming === draft.id ? <span role="status">{tr('Opening…', 'খোলা হচ্ছে…')}</span>
                : <ArrowRight size={18} aria-hidden="true" />}
            </button>;
          })}
        </div>
      </>
    )}
    {error && <p role="alert" className="text-sm text-taxpay-error">{error}</p>}
  </div>;
}
