import { maskTinForDisplay } from '../../services/tinDisplay';
// Reuse the already approved payment head form and modal styles.
import '../../styles/taxpay-service-choice.css';
import '../../styles/taxpay-payment-form.css';
import '../../styles/taxpay-parallel-taxpayer-draft.css';
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, RotateCcw, Trash2, UsersRound } from 'lucide-react';
import { useAccountIdentity } from '../../services/accountIdentity';
import { usePaymentAccountProfile } from '../../services/paymentAccountProfile';
import { activePreviewSession } from '../../services/previewAccountSession';
import { useTaxState } from '../../services/taxState';
import { lookupSampleTaxpayer } from '../../services/sampleTaxpayerLookup';
import { parseGuestAmount } from '../../services/guestAmount';
import { fitsCombinedAllocationCapacity } from '../../services/otherTaxCombinedPayment';
import { OtherTaxBatchComposer, otherTaxAllocationHead, otherTaxAllocationTotal,
  isOtherTaxHeadEligible, OTHER_TAX_YEARS, type OtherTaxTaxpayer, type OtherTaxAllocation } from './OtherTaxBatchComposer';
import { TaxpayerTinLookup, TaxpayerTinSearchResultCard } from '../ui/TaxpayerTinLookup';
import { demoIncomeTaxTypeForTin } from '../../services/demoIncomeTaxType';
import { TaxPayModal } from '../ui/TaxPayModal';

type DraftTaxpayer = NonNullable<ReturnType<typeof lookupSampleTaxpayer>>;
type RemovedTaxpayer = { person: DraftTaxpayer; index: number; allocations: OtherTaxAllocation[] };
const maskedTin = maskTinForDisplay;
const MAX_TAXPAYERS = 30;

/** This owner-scoped session draft is not an issued taxpayer record or a payment. */
function restoreSessionDraft(raw: string | null): {taxpayers: DraftTaxpayer[]; lines: OtherTaxAllocation[]} {
  if (!raw) return {taxpayers: [], lines: []};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') throw Error('Invalid draft');
  const object = parsed as { version?: unknown; tins?: unknown; lines?: unknown };
  if (object.version !== 1 || !Array.isArray(object.tins) || object.tins.length > MAX_TAXPAYERS ||
    object.tins.some(tin => typeof tin !== 'string' || !/^\d{12,13}$/.test(tin))) throw Error('Invalid taxpayer list');
  const tins = object.tins as string[];
  if (new Set(tins).size !== tins.length) throw Error('Duplicate taxpayers');
  const people = tins.map(tin => lookupSampleTaxpayer(tin));
  if (people.some(person => !person)) throw Error('Taxpayer identity no longer found');
  if (!Array.isArray(object.lines) || !fitsCombinedAllocationCapacity(object.lines.length))
    throw Error('Invalid payment allocation list');
  const rows: OtherTaxAllocation[] = [];
  const keys = new Set<string>();
  for (const value of object.lines) {
    if (!value || typeof value !== 'object') throw Error('Invalid allocation');
    const line = value as Partial<OtherTaxAllocation>;
    if (typeof line.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(line.id) ||
      typeof line.taxpayerId !== 'string' || !tins.includes(line.taxpayerId) ||
      typeof line.headId !== 'number' || !isOtherTaxHeadEligible(line.headId) ||
      typeof line.assessmentYear !== 'string' || !OTHER_TAX_YEARS.some(year => year === line.assessmentYear) ||
      typeof line.amount !== 'string' || line.amount.length > 20) throw Error('Invalid allocation details');
    const unique = line.taxpayerId + ':' + line.headId + ':' + line.assessmentYear;
    if (keys.has(unique)) throw Error('Repeated allocation');
    keys.add(unique);
    rows.push({id: line.id, taxpayerId: line.taxpayerId, headId: line.headId,
      assessmentYear: line.assessmentYear, amount: line.amount});
  }
  return {taxpayers: people as DraftTaxpayer[], lines: rows};
}

/** The parallel entry shares the approved head composer and delegates checkout
 * to GuestPayment, so the established consent, payer and SQL gates still run. */
export function ParallelTaxpayerDraftDialog({ onClose }: { onClose: () => void }) {
  const { language, previewAccount, setPaymentBeneficiaryPrefill, setPaymentServiceChoiceOpen } = useTaxState();
  const {user, loading: checkingAccount} = useAccountIdentity();
  const paymentAccount = usePaymentAccountProfile(user?.id ?? null, previewAccount);
  const bn = language === 'bn';
  const t = (en: string, bangla: string) => bn ? bangla : en;
  const [stage, setStage] = useState<1 | 2 | 3>(1);
  const [tin, setTin] = useState('');
  const [searchedTin, setSearchedTin] = useState('');
  const [error, setError] = useState('');
  const [taxpayers, setTaxpayers] = useState<DraftTaxpayer[]>([]);
  const [lines, setLines] = useState<OtherTaxAllocation[]>([]);
  const [headError, setHeadError] = useState('');
  const [revealed, setRevealed] = useState<string[]>([]);
  const [lastRemoved, setLastRemoved] = useState<RemovedTaxpayer | null>(null);
  const [restoredScope, setRestoredScope] = useState<string | null>(null);
  const [restoreNotice, setRestoreNotice] = useState('');
  const undoRef = useRef<HTMLButtonElement>(null);

  const session = activePreviewSession();
  const scope = user?.id ? 'auth:' + user.id
    : previewAccount && session?.profileId === previewAccount.id
      ? 'preview:' + session.profileId + ':' + session.paymentSessionId : 'guest';
  const storageKey = 'sohojkor-parallel-entry-v1:' + scope;

  useEffect(() => {
    if (checkingAccount) return;
    setRestoredScope(null);
    setStage(1); setLastRemoved(null); setRevealed([]);
    try {
      const restored = restoreSessionDraft(sessionStorage.getItem(storageKey));
      setTaxpayers(restored.taxpayers);
      setLines(restored.lines);
      setRestoreNotice(restored.taxpayers.length
        ? t('Selection restored.', 'আগের তালিকা ফিরেছে।') : '');
    } catch {
      try { sessionStorage.removeItem(storageKey); } catch { /* Storage can be unavailable. */ }
      setTaxpayers([]); setLines([]);
      setRestoreNotice(t('Selection could not be restored. Start again.',
        'তালিকা ফেরানো যায়নি। আবার শুরু করুন।'));
    }
    setRestoredScope(scope);
  }, [scope, checkingAccount]);

  useEffect(() => {
    if (checkingAccount || restoredScope !== scope) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({
        version: 1, tins: taxpayers.map(person => person.tin), lines,
      }));
    } catch {
      setRestoreNotice(t('Draft not saved. Keep this tab open.',
        'খসড়া সংরক্ষিত হয়নি। ট্যাবটি খোলা রাখুন।'));
    }
  }, [checkingAccount, scope, restoredScope, storageKey, taxpayers, lines]);
  useEffect(() => { if (lastRemoved) undoRef.current?.focus(); }, [lastRemoved]);
  useEffect(() => {
    if (stage === 2) document.getElementById('parallel-heads-intro')?.focus();
    if (stage === 3) document.getElementById('parallel-review-heading')?.focus();
  }, [stage]);

  const result = searchedTin === tin ? lookupSampleTaxpayer(searchedTin) : null;
  const alreadyAdded = Boolean(result && taxpayers.some(person => person.tin === result.tin));
  const selectedCount = taxpayers.length;
  // Walk-ins use the approved 12-digit public TIN catalogue. Additional
  // 13-digit synthetic profile IDs are only available in signed-in scenarios.
  const canSearchTin = /^\d{12}$/.test(tin) ||
    (Boolean(user || previewAccount) && /^\d{13}$/.test(tin));
  const allAllocated = selectedCount > 0 &&
    taxpayers.every(person => lines.some(line => line.taxpayerId === person.tin));
  const uniqueLines = new Set(lines.map(line =>
    line.taxpayerId + ':' + line.headId + ':' + line.assessmentYear)).size === lines.length;
  const total = otherTaxAllocationTotal(lines);
  const allocationsValid = lines.length > 0 && allAllocated && uniqueLines &&
    fitsCombinedAllocationCapacity(lines.length) && total !== null && total > 0 &&
    lines.every(line => taxpayers.some(person => person.tin === line.taxpayerId) &&
      isOtherTaxHeadEligible(line.headId) &&
      OTHER_TAX_YEARS.some(year => year === line.assessmentYear) &&
      (parseGuestAmount(line.amount) ?? 0) > 0);

  const search = () => {
    setLastRemoved(null);
    setRestoreNotice('');
    setSearchedTin(tin);
    const found = canSearchTin ? lookupSampleTaxpayer(tin) : null;
    setError(found ? '' : t(
      'TIN not found. Check and try again.',
      'টিআইএন পাওয়া যায়নি। যাচাই করে আবার চেষ্টা করুন।'));
  };
  const addTaxpayer = () => {
    if (!result || alreadyAdded || taxpayers.length >= MAX_TAXPAYERS) return;
    setTaxpayers(current => [...current, result]);
    setTin(''); setSearchedTin(''); setError(''); setLastRemoved(null); setRestoreNotice('');
    document.getElementById('parallel-taxpayer-tin')?.focus();
  };
  const deleteTaxpayer = (selectedTin: string) => {
    const index = taxpayers.findIndex(person => person.tin === selectedTin);
    if (index < 0) return;
    setRestoreNotice('');
    setLastRemoved({person:taxpayers[index],index,
      allocations: lines.filter(line => line.taxpayerId === selectedTin)});
    setTaxpayers(current => current.filter(person => person.tin !== selectedTin));
    setLines(current => current.filter(line => line.taxpayerId !== selectedTin));
    setRevealed(current => current.filter(value => value !== selectedTin));
    setHeadError('');
  };
  const undoDelete = () => {
    if (!lastRemoved) return;
    setTaxpayers(current => {
      if (current.some(p => p.tin === lastRemoved.person.tin)) return current;
      const next = [...current];
      next.splice(Math.min(lastRemoved.index,next.length),0,lastRemoved.person);
      return next;
    });
    const restored = lastRemoved.allocations;
    setLines(current => [...current, ...restored.filter(line => !current.some(other =>
      other.taxpayerId === line.taxpayerId && other.headId === line.headId &&
      other.assessmentYear === line.assessmentYear))]);
    setLastRemoved(null);
    document.getElementById('parallel-taxpayer-tin')?.focus();
  };
  const toggleTin = (selectedTin: string) =>
    setRevealed(current => current.includes(selectedTin)
      ? current.filter(value => value !== selectedTin) : [...current, selectedTin]);
  const previewTaxpayers: OtherTaxTaxpayer[] = taxpayers.map(person => ({
    id: person.tin, tin: person.tin, name: person.nameEn,
  }));
  const advanceFromHeads = () => {
    if (!allocationsValid) {
      setHeadError(t('Add a valid payment head, assessment year and amount for every taxpayer.',
        'প্রতিটি করদাতার জন্য সঠিক খাত, করবর্ষ ও পরিমাণ যোগ করুন।'));
      return;
    }
    setHeadError('');
    setStage(3);
  };
  const continueToPayment = () => {
    if (!allocationsValid || !taxpayers.length || !lines.length) return;
    const ownTin = paymentAccount.status === 'ready' ? paymentAccount.profile?.tin : null;
    const parallelForSelf = Boolean(ownTin && taxpayers.some(person => person.tin === ownTin));
    const ordered = parallelForSelf
      ? [taxpayers.find(person => person.tin === ownTin)!, ...taxpayers.filter(person => person.tin !== ownTin)]
      : taxpayers;
    const [primary, ...additional] = ordered;
    // No client-side payment, credit, receipt, SQL writes, or invented authorization.
    // Existing GuestPayment validates taxpayer/payer identity, current saved list
    // ownership and submitted allocations before any simulated payment can persist.
    setPaymentBeneficiaryPrefill({
      tin:primary.tin, name:primary.nameEn,
      additional:additional.map(person => ({tin:person.tin,name:person.nameEn})),
      parallelSource:true,
      parallelForSelf,
      parallelAllocations: lines.map(line => ({
        taxpayerTin:line.taxpayerId, headId:line.headId,
        assessmentYear:line.assessmentYear, amount:line.amount,
      })),
    });
    onClose();
    setPaymentServiceChoiceOpen(true);
  };

  return <TaxPayModal service="parallel-taxpayer-draft" className="parallel-taxpayer-draft-modal"
    title={stage === 1 ? t('Taxpayer Information', 'করদাতার তথ্য') :
      stage === 2 ? t('Tax Head Selection', 'কর পরিশোধের খাত নির্বাচন') :
        t('Review Payment Allocation', 'পেমেন্ট বরাদ্দ পর্যালোচনা')}
    ariaLabel={t('All Tax Payments — parallel draft', 'সব ধরনের কর পরিশোধ — সমান্তরাল খসড়া')}
    closeIconLabel={t('Close parallel draft', 'সমান্তরাল খসড়া বন্ধ করুন')}
    initialFocusSelector={stage === 1 ? '#parallel-taxpayer-tin' : undefined}
    onClose={onClose} onBack={stage > 1 ? () => setStage(stage === 3 ? 2 : 1) : undefined}
    backLabel={t('Back', 'ফিরুন')}
    footer={<div className="parallel-taxpayer-draft__footer">
      <button type="button" className="parallel-taxpayer-draft__secondary"
        onClick={stage === 1 ? onClose : () => setStage(stage === 3 ? 2 : 1)}>
        {stage > 1 && <ArrowLeft size={17} aria-hidden="true"/>}
        {stage === 1 ? t('Close', 'বন্ধ করুন') : t('Back', 'ফিরুন')}
      </button>
      {stage === 1 && <button type="button" className="parallel-taxpayer-draft__primary"
        disabled={!selectedCount || restoredScope !== scope}
        onClick={() => {setStage(2);setLastRemoved(null);}} data-testid="parallel-taxpayer-continue">
        {t('Continue to Tax Heads', 'কর পরিশোধের খাতে এগিয়ে যান')}
        <ArrowRight size={17} aria-hidden="true"/>
      </button>}
      {stage === 2 && <button type="button" className="parallel-taxpayer-draft__primary"
        onClick={advanceFromHeads} data-testid="parallel-tax-head-continue">
        {t('Review Allocation', 'বরাদ্দ পর্যালোচনা')} <ArrowRight size={17} aria-hidden="true"/>
      </button>}
      {stage === 3 && <button type="button" className="parallel-taxpayer-draft__primary"
        onClick={continueToPayment} disabled={!allocationsValid} data-testid="parallel-payment-handoff">
        {t('Continue to Payment', 'পেমেন্টে এগিয়ে যান')} <ArrowRight size={17} aria-hidden="true"/>
      </button>}
    </div>}>
    <div className={`parallel-taxpayer-draft${stage === 1 ? ' parallel-taxpayer-draft--taxpayers' : ''}`}
      data-testid="parallel-taxpayer-draft" lang={language}>
      {stage === 1 ? <div className="parallel-taxpayer-draft__grid">
        <section className="parallel-taxpayer-draft__panel" aria-labelledby="parallel-draft-add-title">
          <header className="parallel-taxpayer-draft__panel-heading">
            <h3 id="parallel-draft-add-title">{t('Add taxpayer', 'করদাতা যোগ করুন')}</h3>
          </header>
          <p className="parallel-taxpayer-draft__intro">
            {t('Enter a TIN and search.',
              'টিআইএন লিখে খুঁজুন।')}
          </p>
          {restoreNotice && <p className="parallel-taxpayer-draft__notice" role="status">{restoreNotice}</p>}
          <div className="parallel-taxpayer-draft__panel-body">
              <TaxpayerTinLookup language={language} tinId="parallel-taxpayer-tin"
                nameId="parallel-taxpayer-name" tin={tin}
                name={result ? (bn ? result.nameBn : result.nameEn) : ''}
                maxTinLength={user || previewAccount ? 13 : 12}
                tinPlaceholder={user || previewAccount
                  ? t('12- or 13-digit TIN', '১২ বা ১৩ সংখ্যার টিআইএন')
                  : t('12-digit TIN', '১২ সংখ্যার টিআইএন')}
                hideNameField submitOnEnter
                onTinChange={value => {setTin(value);setSearchedTin('');setError('');setLastRemoved(null);setRestoreNotice('');}}
                onClear={() => {setTin('');setSearchedTin('');setError('');setLastRemoved(null);setRestoreNotice('');}}
                canSearch={canSearchTin}
                onSearch={search}
                searchLabel={t('Search taxpayer TIN', 'করদাতার টিআইএন খুঁজুন')}
                invalidTin={Boolean(error)} tinDescribedBy={error ? 'parallel-taxpayer-error' : undefined}
                error={error ? <p id="parallel-taxpayer-error"
                  className="parallel-taxpayer-draft__error" role="alert">{error}</p> : null} />
              {result && <TaxpayerTinSearchResultCard key={result.tin} language={language}
                testId="parallel-taxpayer-search-result" addButtonTestId="parallel-add-taxpayer"
                tin={result.tin} name={bn ? result.nameBn : result.nameEn}
                classification={demoIncomeTaxTypeForTin(result.tin) === 'COMPANY'
                  ? t('Company','কোম্পানি')
                  : demoIncomeTaxTypeForTin(result.tin) === 'NON_COMPANY'
                    ? t('Individual','ব্যক্তি') : undefined}
                onAdd={addTaxpayer} canAdd={!alreadyAdded && selectedCount < MAX_TAXPAYERS}
                addLabel={t('Add taxpayer','করদাতা যোগ করুন')}
                disabledAddLabel={alreadyAdded ? t('Already added','আগেই যোগ করা হয়েছে') : undefined}
              />}

          </div>
        </section>
        <section className="parallel-taxpayer-draft__panel" aria-labelledby="parallel-draft-selected-title">
            <header className="parallel-taxpayer-draft__panel-heading">
              <h3 id="parallel-draft-selected-title">{t('Taxpayers in this payment', 'এই পেমেন্টে করদাতারা')}
                <span className="parallel-taxpayer-draft__count">{selectedCount}</span>
              </h3>
            </header>
            {!selectedCount ? <div className="parallel-taxpayer-draft__empty" data-testid="parallel-taxpayer-empty">
              <UsersRound size={32} strokeWidth={1.5} aria-hidden="true"/>
              <strong>{t('No taxpayers added', 'কোনো করদাতা যোগ হয়নি')}</strong>
            </div> : <div className="parallel-taxpayer-draft__table-scroll">
              <table className="parallel-taxpayer-draft__table">
                <thead><tr><th scope="col">{t('Taxpayer', 'করদাতা')}</th>
                  <th scope="col">{t('TIN', 'টিআইএন')}</th>
                  <th scope="col">{t('Action', 'পদক্ষেপ')}</th></tr></thead>
                <tbody>{taxpayers.map(person => <tr key={person.tin}>
                  <td data-label={t('Taxpayer', 'করদাতা')}>{bn ? person.nameBn : person.nameEn}</td>
                  <td data-label={t('TIN', 'টিআইএন')}><div className="parallel-taxpayer-draft__tin-cell">
                    <span className="parallel-taxpayer-draft__mono">{revealed.includes(person.tin)
                      ? person.tin : maskedTin(person.tin)}</span>
                    <button type="button" className="parallel-taxpayer-draft__icon-button"
                      onClick={() => toggleTin(person.tin)}
                      aria-label={(revealed.includes(person.tin) ? t('Hide TIN', 'টিআইএন লুকান') : t('Reveal TIN', 'টিআইএন দেখান')) + ': ' + (bn ? person.nameBn : person.nameEn)}
                      title={(revealed.includes(person.tin) ? t('Hide TIN', 'টিআইএন লুকান') : t('Reveal TIN', 'টিআইএন দেখান')) + ': ' + (bn ? person.nameBn : person.nameEn)}>
                      {revealed.includes(person.tin) ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  </div></td>
                  <td data-label={t('Action', 'পদক্ষেপ')}><button type="button"
                    className="parallel-taxpayer-draft__delete" onClick={() => deleteTaxpayer(person.tin)}
                    aria-label={t('Remove taxpayer', 'করদাতা বাদ দিন') + ': ' + (bn ? person.nameBn : person.nameEn)}>
                    <Trash2 size={16} aria-hidden="true"/> {t('Delete', 'বাদ দিন')}
                  </button></td>
                </tr>)}</tbody>
              </table>
            </div>}
            {lastRemoved && <div className="parallel-taxpayer-draft__undo" role="status">
              <span>{t('Taxpayer removed.', 'করদাতা বাদ দেওয়া হয়েছে।')}</span>
              <button ref={undoRef} type="button" onClick={undoDelete}
                aria-label={t('Undo remove taxpayer', 'করদাতা বাদ দেওয়া ফিরিয়ে আনুন')}>
                <RotateCcw size={15} aria-hidden="true"/> {t('Undo', 'ফিরিয়ে আনুন')}
              </button>
            </div>}
        </section>
      </div> : stage === 2 ? <section data-testid="parallel-tax-head-boundary">
        <p id="parallel-heads-intro" tabIndex={-1} className="parallel-taxpayer-draft__intro">{t(
          'Choose payment heads, assessment years and amounts for each selected taxpayer.',
          'প্রতিটি করদাতার জন্য খাত, করবর্ষ ও পরিমাণ নির্বাচন করুন।')}</p>
        <OtherTaxBatchComposer language={language} taxpayers={previewTaxpayers} lines={lines} maskTaxpayerTin
          onChange={next => {setLines(next);setHeadError('');}} error={headError || undefined}/>
        <p className="parallel-taxpayer-draft__disclaimer">{t(
          'Tax with Return remains a separate, single-taxpayer service and cannot be combined with these heads.',
          'রিটার্নসহ কর আলাদা সেবা, শুধু একজন করদাতার জন্য; অন্য খাতের সঙ্গে মেশানো যাবে না।')}</p>
      </section> : <section className="parallel-taxpayer-draft__next"
        data-testid="parallel-allocation-review">
        <h3 id="parallel-review-heading" tabIndex={-1}>{t('Review selected allocations', 'নির্বাচিত বরাদ্দ পর্যালোচনা করুন')}</h3>
        <p>{t('Each row is kept with its taxpayer, payment head, assessment year and amount.',
          'প্রতিটি সারিতে করদাতা, করের খাত, করবর্ষ ও পরিমাণ সংরক্ষিত আছে।')}</p>
        <div className="parallel-taxpayer-draft__table-scroll">
          <table className="parallel-taxpayer-draft__table">
            <thead><tr><th>{t('Taxpayer', 'করদাতা')}</th><th>{t('Head / year', 'খাত / করবর্ষ')}</th><th>{t('Amount (৳)', 'পরিমাণ (৳)')}</th></tr></thead>
            <tbody>{lines.map(line => <tr key={line.id}>
              <td>{bn ? taxpayers.find(person=>person.tin===line.taxpayerId)?.nameBn :
                taxpayers.find(person=>person.tin===line.taxpayerId)?.nameEn}</td>
              <td>{bn ? otherTaxAllocationHead(line.headId)?.nameBn : otherTaxAllocationHead(line.headId)?.nameEn}
                <span className="parallel-taxpayer-draft__review-year"> · {line.assessmentYear}</span></td>
              <td>{line.amount}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <p className="parallel-taxpayer-draft__review-total">{t('Total', 'মোট')}: ৳{(total ?? 0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
        <p className="parallel-taxpayer-draft__disclaimer">{t(
          'Next you will confirm payer/receipt details in the approved payment wizard. Allocations are carried forward and revalidated there before any simulated payment.',
          'পরের ধাপে বিদ্যমান পেমেন্ট ফর্মে পরিশোধকারী ও রসিদের তথ্য নিশ্চিত করবেন। বরাদ্দগুলো সেখানে আবার যাচাই করা হবে।')}</p>
      </section>}
    </div>
  </TaxPayModal>;
}
