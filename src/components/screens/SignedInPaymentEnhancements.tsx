import { useEffect, useState } from 'react';
import type { Language } from '../../types/tax';
import type { PaymentAccountProfile } from '../../services/paymentAccountProfile';
import { getDemoUser, type DemoUserId } from '../../data/demoUsers';
import { getHostedAuthorizations, performHostedAuthorization, userIdForHostedTin, type HostedAuthorization } from '../../services/hostedDemoAuthorizations';
import { useDemoSqlProfileAndServiceRecords, type DemoServiceCode } from '../../services/demoSqlProfiles';
import { activeAuthorizedTaxpayers, accountPaymentSuggestions } from '../../services/signedInPaymentContext';

const title: Record<DemoServiceCode, { en: string; bn: string }> = {
  TAX_WITH_RETURN: { en: 'Tax with Return', bn: 'রিটার্নসহ কর' },
  ADVANCE_TAX: { en: 'Advance Tax', bn: 'অগ্রিম কর' },
  ASSESSED_DEMAND: { en: 'Assessed Demand', bn: 'নির্ধারিত কর দাবি' },
  PENALTY: { en: 'Penalty', bn: 'জরিমানা' },
  SOURCE_TAX_DEPOSIT: { en: 'Source Tax Deposit', bn: 'উৎসে কর জমা' },
  APPELLATE_TRIBUNAL: { en: 'Appellate Tribunal', bn: 'আপিল ট্রাইব্যুনাল' },
  OTHER_TAX_PAYMENT: { en: 'Other Tax Payment', bn: 'অন্যান্য কর' },
  TRAVEL_TAX: { en: 'Travel Tax', bn: 'ভ্রমণ কর' },
};

export function SignedInTaxpayerCard({ profile, language, id = 'guest-tin' }: {
  profile: PaymentAccountProfile | null; language: Language; id?: string;
}) {
  const tr = (en: string, bn: string) => language === 'bn' ? bn : en;
  return <section id={id} tabIndex={-1} aria-label={tr('Account taxpayer details', 'অ্যাকাউন্টের করদাতার তথ্য')}
    className="account-taxpayer-summary col-span-full">
    <div className="account-taxpayer-summary__heading mb-3 flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-taxpay-text">{tr('Taxpayer details', 'করদাতার তথ্য')}</h3>
      <p className="account-taxpayer-summary__source">{tr('Account information', 'অ্যাকাউন্টের তথ্য')}</p>
    </div>
    {!profile ? <p role="status" className="text-sm text-slate-600">{tr('Your linked taxpayer profile is unavailable. Check your account before continuing.', 'সংযুক্ত করদাতার তথ্য পাওয়া যায়নি। এগোনোর আগে অ্যাকাউন্ট দেখুন।')}</p> :
    <dl className="account-taxpayer-summary__fields grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2">
      {([
        [tr('Taxpayer name', 'করদাতার নাম'), language === 'bn' ? profile.nameBn : profile.nameEn],
        [tr('Taxpayer TIN', 'করদাতার টিআইএন'), profile.tin],
        [tr('Receipt mobile', 'রসিদের মোবাইল'), profile.receiptMobile],
        [tr('Taxes Zone', 'কর অঞ্চল'), profile.taxZone],
        [tr('Taxes Circle', 'কর সার্কেল'), profile.taxCircle],
      ] as const).map(([label, value]) =>
        <div key={label} className="min-w-0">
          <dt className="text-xs font-medium text-slate-500">{label}</dt>
          <dd className="mt-1 break-words text-sm font-semibold text-slate-800">{value || '—'}</dd>
        </div>
      )}
    </dl>}
  </section>;
}

/** Hosted demonstration consent only. This component does not grant payment authorization. */
export function AuthorizedTaxpayerChoices({ actor, language, selectedTin, addedTins = [], allowAdd = false, onSelect, onManage }: {
  actor: DemoUserId | null; language: Language; selectedTin: string;
  addedTins?: readonly string[]; allowAdd?: boolean;
  onSelect: (tin: string, name: string) => void; onManage: () => void;
}) {
  const [records, setRecords] = useState<HostedAuthorization[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [now, setNow] = useState(() => Date.now());
  const [requesting, setRequesting] = useState(false);
  const [requestFeedback, setRequestFeedback] = useState<string | null>(null);
  const tr = (en: string, bn: string) => language === 'bn' ? bn : en;
  useEffect(() => {
    if (!actor) { setRecords([]); setStatus('ready'); return; }
    let mounted = true;
    const refresh = async () => {
      try {
        const latest = await getHostedAuthorizations(actor);
        if (mounted) { setRecords(latest); setStatus('ready'); setNow(Date.now()); }
      } catch {
        if (mounted) { setRecords([]); setStatus('error'); }
      }
    };
    setRecords([]); setStatus('loading'); void refresh();
    const timer = window.setInterval(() => void refresh(), 10000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, [actor]);
  const choices = actor && status === 'ready' ? activeAuthorizedTaxpayers(records, actor, now) : [];
  const candidate = userIdForHostedTin(selectedTin);
  const canRequest = actor && candidate && actor !== candidate &&
    !records.some(record => record.payerId === actor && record.taxpayerId === candidate &&
      (record.status === 'PENDING' || record.status === 'CODE_ISSUED' || record.status === 'ACTIVE')) &&
    !choices.some(choice => choice.tin === selectedTin);
  const requestConsent = async () => {
    if (!actor || !canRequest || requesting) return;
    setRequestFeedback(null); setRequesting(true);
    try {
      await performHostedAuthorization(actor, 'request', { tin: selectedTin });
      setRequestFeedback(tr('Authorization requested. The taxpayer must approve before you can continue.', 'অনুমোদনের অনুরোধ পাঠানো হয়েছে। এগোনোর আগে করদাতাকে অনুমোদন দিতে হবে।'));
      setRecords(await getHostedAuthorizations(actor));
      setStatus('ready'); setNow(Date.now());
    } catch (error) {
      setRequestFeedback(error instanceof Error ? error.message : tr('Unable to request authorization.', 'অনুমোদন অনুরোধ ব্যর্থ হয়েছে।'));
    } finally { setRequesting(false); }
  };
  return <section aria-label={tr('Authorized taxpayers', 'অনুমোদিত করদাতা')}
    className="account-authorizations col-span-full" data-testid="authorized-taxpayer-choices">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-taxpay-text">{tr('Authorized taxpayers', 'অনুমোদিত করদাতা')}</h3>
      <button type="button" className="min-h-10 text-sm font-semibold text-taxpay-primary no-underline"
        onClick={onManage}>{tr('Manage authorization', 'অনুমোদন পরিচালনা করুন')}</button>
    </div>
    <p className="mt-1 text-sm text-slate-600">{tr('Select an active authorization or enter a new taxpayer TIN below.', 'সক্রিয় অনুমোদন বেছে নিন অথবা নিচে নতুন করদাতার টিআইএন লিখুন।')}</p>
    {status === 'loading' && <p role="status" className="mt-3 text-sm text-slate-600">{tr('Checking authorizations…', 'অনুমোদন যাচাই হচ্ছে…')}</p>}
    {status === 'error' && <p role="alert" className="mt-3 text-sm text-rose-700">{tr('Authorizations could not be verified. Try Manage authorization.', 'অনুমোদন যাচাই করা যায়নি। অনুমোদন পরিচালনা করুন-এ যান।')}</p>}
    {status === 'ready' && choices.length > 0 && <p className="mt-3 text-sm font-semibold text-taxpay-dark">{tr('You can pay for these taxpayers', 'এই করদাতাদের জন্য পরিশোধ করতে পারবেন')}: {choices.length}</p>}
    {choices.length > 0 && <div role="group" aria-label={tr('Choose authorized taxpayer', 'অনুমোদিত করদাতা নির্বাচন')} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {choices.map(choice => <button key={choice.authorizationId} type="button" aria-pressed={selectedTin === choice.tin}
        disabled={addedTins.includes(choice.tin) && choice.tin !== selectedTin}
        onClick={() => onSelect(choice.tin, language === 'bn' ? choice.nameBn : choice.nameEn)}
        className={`min-h-16 rounded-lg border p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-taxpay-primary ${selectedTin === choice.tin ? 'border-taxpay-primary bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
        <p className="text-sm font-semibold text-taxpay-text">{language === 'bn' ? choice.nameBn : choice.nameEn}</p>
        <p className="mt-1 text-xs text-slate-600">{tr('TIN', 'টিআইএন')}: {choice.tin}</p>
        <p className="mt-1 text-xs font-semibold text-taxpay-primary">{addedTins.includes(choice.tin)
          ? tr('Already in this payment', 'এই পেমেন্টে ইতিমধ্যে যুক্ত')
          : allowAdd ? tr('Add to this payment', 'এই পেমেন্টে যোগ করুন')
          : tr('Use this taxpayer', 'এই করদাতাকে নির্বাচন করুন')}</p>
      </button>)}
    </div>}
    {status === 'ready' && !choices.length && <div className="account-authorizations__empty" role="status">
      <p className="font-semibold">{tr('You have no approved taxpayers yet', 'এখনও কোনো অনুমোদিত করদাতা নেই')}</p>
      <p>{tr('Enter the taxpayer’s TIN below. If authorization is available, request it before proceeding with an account payment.', 'নিচে করদাতার টিআইএন দিন। অনুমোদনের সুযোগ থাকলে অ্যাকাউন্ট থেকে পরিশোধের আগে অনুরোধ করুন।')}</p>
    </div>}
    {status === 'ready' && selectedTin && !choices.some(choice => choice.tin === selectedTin) && !canRequest && <p className="account-authorizations__selection-note" role="status">{tr('This TIN is not on your approved list. Choose an approved taxpayer or manage access before continuing.', 'এই টিআইএন অনুমোদিত তালিকায় নেই। অনুমোদিত করদাতা বাছুন অথবা এগোনোর আগে অনুমোদন পরিচালনা করুন।')}</p>}
    {canRequest && <button type="button" disabled={requesting} onClick={() => void requestConsent()}
      className="mt-3 min-h-11 rounded-lg border border-taxpay-primary px-4 text-sm font-semibold text-taxpay-primary hover:bg-blue-50 disabled:opacity-60">
      {requesting ? tr('Requesting…', 'অনুরোধ পাঠানো হচ্ছে…') : tr('Request authorization for this TIN', 'এই টিআইএন-এর জন্য অনুমোদন চান')}
    </button>}
    {requestFeedback && <p role="status" className="mt-2 text-sm text-slate-600">{requestFeedback}</p>}
    {!actor && <p className="mt-2 text-xs text-slate-600">{tr('Account-based authorization suggestions require a verified, supported account.', 'অ্যাকাউন্টভিত্তিক অনুমোদনের জন্য যাচাইকৃত সমর্থিত অ্যাকাউন্ট প্রয়োজন।')}</p>}
  </section>;
}

/** The SQL fixture shows prior activity, not legally payable amounts or credit. */
export function AccountPaymentSuggestions({ userId, language, mode, onChoose }: {
  userId: DemoUserId | null; language: Language; mode: 'TAX_WITH_RETURN' | 'OTHER_TAX_PAYMENT';
  onChoose?: (code: DemoServiceCode) => void;
}) {
  const data = useDemoSqlProfileAndServiceRecords(userId);
  const suggestions = data.userId === userId && data.status === 'ready'
    ? accountPaymentSuggestions(data.records, mode) : [];
  const tr = (en: string, bn: string) => language === 'bn' ? bn : en;
  if (!userId || (data.status === 'ready' && suggestions.length === 0)) return null;
  return <section className="mb-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4"
    aria-label={tr('Payment suggestions', 'পরিশোধের পরামর্শ')} data-testid="payment-suggestions">
    <h3 className="text-sm font-semibold text-taxpay-text">{tr('Suggested payment heads', 'প্রস্তাবিত পেমেন্ট খাত')}</h3>
    <p className="mt-1 text-xs text-slate-600">{tr('Based on earlier records. Choose a head only if it applies to this payment.', 'আগের রেকর্ড অনুযায়ী। এই পেমেন্টে প্রযোজ্য হলে খাত নির্বাচন করুন।')}</p>
    {data.status === 'loading' && <p className="mt-2 text-sm text-slate-600">{tr('Loading account records…', 'অ্যাকাউন্টের রেকর্ড লোড হচ্ছে…')}</p>}
    {data.status === 'error' && <p className="mt-2 text-sm text-slate-600">{tr('Record suggestions are unavailable. Continue by choosing a payment head below.', 'রেকর্ডভিত্তিক পরামর্শ পাওয়া যাচ্ছে না। নিচে পরিশোধ খাত নির্বাচন করুন।')}</p>}
    {suggestions.length > 0 && <ul className="mt-3 grid list-none gap-2">
      {suggestions.map(suggestion => <li key={suggestion.serviceCode} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">{title[suggestion.serviceCode][language]}</p>
          <p className="mt-1 text-xs text-slate-600">{suggestion.requiresReview
            ? tr('Check the existing record before paying again.', 'আবার পরিশোধের আগে আগের রেকর্ডটি দেখুন।')
            : tr('Previously selected. Choose again if applicable.', 'আগে নির্বাচিত হয়েছিল। প্রযোজ্য হলে আবার বেছে নিন।')}
            {suggestion.assessmentYear ? ` · ${suggestion.assessmentYear}` : ''}
          </p>
        </div>
        {!suggestion.requiresReview && onChoose && <button type="button" onClick={() => onChoose(suggestion.serviceCode)}
          className="min-h-10 rounded-lg border border-taxpay-primary px-3 text-xs font-semibold text-taxpay-primary hover:bg-blue-50">
          {tr('View payment heads', 'পেমেন্ট খাত দেখুন')}</button>}
      </li>)}
    </ul>}
  </section>;
}
