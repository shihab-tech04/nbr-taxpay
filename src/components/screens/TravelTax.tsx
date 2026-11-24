import '../../styles/taxpay-service-choice.css';
import '../../styles/taxpay-payment-form.css';
import {TaxPayUnifiedTable} from '../ui/TaxPayDataTable';
import React, { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Building2, CreditCard, FileText, Flag, Globe2, Info, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { getStorySessionId, persistSimulatedPayment } from '../../services/simulatedPaymentStory';
import {parseRecoverableTravelPayment, type PendingTravelPayment} from '../../services/travelPendingPayment';
import { getConfirmedReceipt } from '../../services/confirmedPaymentCertificate';
import { matchesConfirmedTravelTaxReceipt } from '../../services/travelTaxReceiptReadback';
import { useTaxState } from '../../services/taxState';
import { useAccountIdentity } from '../../services/accountIdentity';
import { reuseRecordedPayment, type PaymentReuse } from '../../services/paymentReuse';
import {activePreviewSession} from '../../services/previewAccountSession';
import {TAXPAY_PUBLIC_ENDPOINT} from '../../config/publicBackend';
import { AccountPaymentDraftControls } from '../ui/AccountPaymentDraftControls';
import { deletePaymentFormDraft, type PaymentDraftActor, type PaymentFormDraft } from '../../services/accountPaymentFormDrafts';
import { TRAVEL_TAX_RATES } from '../../data/mockData';
import {
  LAND_PORT_NAMES, SAMPLE_BD_PASSPORTS, TRAVEL_TAX_ECONOMIC_CODE, TRAVEL_TAX_YEAR,
  makeTravelPassenger, travelPartyTotal, travelTaxRateEvidence, validateTravelParty, assessTravelPassenger, travelPassengerAge, dhakaTravelDate, isPlannedTravelDate,
  type TravelMode, type TravelPassenger, type TravellerNationality,
} from '../../data/travelTax2026';
import { TravelCurrency } from '../ui/TravelCurrency';
import { SelectedIdentityRail } from '../ui/SelectedIdentityRail';
import { amountInTakaWords } from '../../services/amountInWords';
import type { ChallanReceipt } from '../../types/tax';
import { ReceiptView } from '../common/ReceiptView';
import { PaymentFormSection } from '../ui/PaymentFormLayout';
import { PaymentMethodSelector, paymentMethodLabel, type PaymentMethodGroup } from '../ui/PaymentMethodSelector';
import { PaymentJourneyFooter } from '../ui/PaymentJourneyFooter';
import { TaxPayModalFooterTarget } from '../ui/TaxPayModal';

interface TravelTaxProps {
  embedded?: boolean;
  /** Previously verified account-owned draft selected at Pay Tax entry. */
  initialDraft?: PaymentFormDraft;
  initialReuse?: PaymentReuse;
  fourStepJourney?: boolean;
  onBackToService?: () => void;
  onStageChange?: (stage: 1 | 2 | 3 | 4) => void;
  registerHeaderBack?: (action: (() => void) | null) => void;
  onCheckoutChange?: (checkout: boolean) => void;
}

function maskPassport(passport: string) {
  return passport.length <= 4 ? '••••' : '••••' + passport.slice(-4);
}

function readPendingTravelPayment(key: string, sessionId: string): PendingTravelPayment | null {
  try { return parseRecoverableTravelPayment(sessionStorage.getItem(key), sessionId); }
  catch { return null; } // Storage may be unavailable in a private browser session.
}

/**
 * Four progressive stages in the existing TaxPay modal.
 * This is a UX/reference-data preview, not a real passport verification or
 * government A-Challan integration. An API owner can replace those boundaries.
 */
export const TravelTax: React.FC<TravelTaxProps> = ({ embedded = false, initialDraft, initialReuse, onBackToService, onStageChange, registerHeaderBack, onCheckoutChange }) => {
  const { language, navigate, addPaymentReceipt, previewAccount, startPaymentReuse, setPaymentServiceChoiceOpen } = useTaxState();
  const { user: authenticatedUser } = useAccountIdentity();
  // Keep the existing signed-in draft journey untouched. Unsigned guests
  // reuse WS3's current capability/session only when its backend is configured.
  const unsignedGuestDrafts = !authenticatedUser && !previewAccount &&
    Boolean(TAXPAY_PUBLIC_ENDPOINT.url && TAXPAY_PUBLIC_ENDPOINT.publishableKey);
  const modalFooterTarget = useContext(TaxPayModalFooterTarget);
  const bn = language === 'bn';
  const tr = (en: string, bangla: string) => bn ? bangla : en;
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [mode, setMode] = useState<TravelMode>('LAND');
  const [port, setPort] = useState('');
  const [waterPort, setWaterPort] = useState('');
  const [destination, setDestination] = useState('');
  const [travelDate, setTravelDate] = useState('');
  const [passengers, setPassengers] = useState<TravelPassenger[]>([makeTravelPassenger('first', 'BD')]);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const errorFocusRevision = useRef(0);
  const [editingPassengerId, setEditingPassengerId] = useState<string | null>('first');
  const [confirmedPassengerIds, setConfirmedPassengerIds] = useState<string[]>([]);
  // Keep a reversible snapshot while a confirmed passenger is being edited.
  // Confirmation is intentionally revoked until the payer saves or cancels.
  const [editBackup, setEditBackup] = useState<{ passenger: TravelPassenger; wasConfirmed: boolean } | null>(null);
  const [receiptReviewOpen, setReceiptReviewOpen] = useState(false);
  const [skipPostPaymentLogin, setSkipPostPaymentLogin] = useState(false);
  type PassengerIdentityIssue = {
    id: string;
    message: string;
    field?: 'passport' | 'name' | 'birth-date' | 'country' | 'medical';
  };
  const [passengerIssue, setPassengerIssue] = useState<PassengerIdentityIssue | null>(null);
  const [passportSuggestionsFor, setPassportSuggestionsFor] = useState<string | null>(null);
  const [passportSuggestionMaxHeight, setPassportSuggestionMaxHeight] = useState(210);
  // Keep the picker BELOW the field. A popup above intercepts the nationality
  // tabs and headings. Reserve scroll clearance and bring the field into view
  // instead; the approved two-column panel and fixed footer stay in place.
  useLayoutEffect(() => {
    if (!passportSuggestionsFor) return;
    const row = document.getElementById('travel-passport-' + passportSuggestionsFor)
      ?.closest<HTMLElement>('.travel-flow__passport-row');
    // In Step 1 the actual scroll owner is travel-flow__main; the outer
    // modal body intentionally has overflow:hidden to protect the fixed footer.
    const body = row?.closest<HTMLElement>('.travel-flow__main')
      ?? row?.closest<HTMLElement>('.taxpay-modal__body');
    if (!row || !body) return;
    const position = (ensureVisible: boolean) => {
      if (!row.isConnected) return;
      const visibleBottom = Math.min(
        body.getBoundingClientRect().bottom,
        row.closest('.taxpay-modal')?.querySelector<HTMLElement>('.taxpay-modal__footer')
          ?.getBoundingClientRect().top ?? window.innerHeight,
        window.innerHeight,
      );
      const limit = window.innerWidth <= 560 ? Math.min(190, window.innerHeight * .28) : 210;
      const needed = row.getBoundingClientRect().bottom + limit + 8 - visibleBottom;
      if (ensureVisible && needed > 0) body.scrollTop += Math.ceil(needed);
      const available = Math.max(0, visibleBottom - row.getBoundingClientRect().bottom - 8);
      setPassportSuggestionMaxHeight(old => {
        const height = Math.floor(Math.min(limit, available));
        return old === height ? old : height;
      });
    };
    // Scroll only when the popup OPENS. Never force-scroll back while the
    // person moves to another field/tab or clicks outside to dismiss it.
    const refresh = () => position(false);
    const frame = requestAnimationFrame(() => position(true));
    const observer = new ResizeObserver(refresh);
    observer.observe(body); observer.observe(row);
    window.addEventListener('resize', refresh);
    body.addEventListener('scroll', refresh, {passive: true});
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      window.removeEventListener('resize', refresh);
      body.removeEventListener('scroll', refresh);
    };
  }, [passportSuggestionsFor]);
  const [medicalHelpFor, setMedicalHelpFor] = useState<string | null>(null);
  const [paymentChannel, setPaymentChannel] = useState<'NOW' | 'OTC' | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<ChallanReceipt['paymentMethod'] | null>(null);
  const [methodGroup, setMethodGroup] = useState<PaymentMethodGroup | null>(null);
  const [simulateDecline, setSimulateDecline] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [bankSlipPending, setBankSlipPending] = useState(false);
  const [zeroTaxReviewFinished, setZeroTaxReviewFinished] = useState(false);
  const [createdReceipt, setCreatedReceipt] = useState<ChallanReceipt | null>(null);
  const [sourcePaymentId, setSourcePaymentId] = useState<string | null>(null);
  const [selectedAccountDraft, setSelectedAccountDraft] = useState<PaymentFormDraft | null>(null);
  const [draftFooterTarget, setDraftFooterTarget] = useState<HTMLDivElement | null>(null);
  const storySessionId = getStorySessionId();
  const pendingPaymentKey = 'taxpay-travel-payment:' + storySessionId + ':' +
    (authenticatedUser?.id ?? previewAccount?.id ?? 'walk-in');
  const [recoveringPayment, setRecoveringPayment] = useState<PendingTravelPayment | null>(null);
  const pendingPayment = useRef<PendingTravelPayment | null>(null);

  useEffect(() => {
    const saved = readPendingTravelPayment(pendingPaymentKey, storySessionId);
    pendingPayment.current = saved;
    setRecoveringPayment(saved);
  }, [pendingPaymentKey, storySessionId]);
  const [paymentNonce, setPaymentNonce] = useState(() => crypto.randomUUID());


  // Travel passports require reconfirmation on resume. Never persist plaintext
  // passport values under a public preview or unsigned guest capability.
  const snapshotTravelDraft = (): Record<string, unknown> => ({
    schemaVersion: 1, step: Math.min(step, 2), mode, port, waterPort,
    destination, travelDate, phone, sourcePaymentId,
    passengers: (previewAccount || unsignedGuestDrafts)
      ? passengers.map(person => ({ ...person, passport: '', identitySource: person.nationality === 'BD' ? 'PENDING' : 'MANUAL' }))
      : passengers,
  });
  const restoreTravelDraft = (saved: Record<string, unknown>) => {
    if (saved.schemaVersion !== 1 || !Array.isArray(saved.passengers))
      throw new Error('Saved travel form could not be verified.');
    const restored = saved.passengers.filter((person): person is TravelPassenger =>
      Boolean(person && typeof person.id === 'string' && typeof person.name === 'string' &&
      typeof person.passport === 'string' && typeof person.birthDate === 'string' &&
      (person.nationality === 'BD' || person.nationality === 'FOREIGN'))
    );
    // Never silently drop passengers from an older draft. A malformed row
    // must be reported rather than discarded during restoration.
    if (!restored.length || restored.length !== saved.passengers.length)
      throw new Error('Saved passenger information was incomplete.');
    // A new saved journey must never inherit an earlier unsaved edit/undo.
    setEditBackup(null);
    setMode(saved.mode === 'WATER' ? 'WATER' : 'LAND');
    setPort(typeof saved.port === 'string' ? saved.port : '');
    setWaterPort(typeof saved.waterPort === 'string' ? saved.waterPort : '');
    setDestination(typeof saved.destination === 'string' ? saved.destination : '');
    setTravelDate(typeof saved.travelDate === 'string' ? saved.travelDate : '');
    setPhone(typeof saved.phone === 'string' ? saved.phone : '');
    setSourcePaymentId(typeof saved.sourcePaymentId === 'string' && saved.sourcePaymentId.length
      ? saved.sourcePaymentId : null);
    setPassengers(restored.map(person => ({
      ...person, identitySource: person.nationality === 'BD' ? 'PENDING' : 'MANUAL',
    })));
    setConfirmedPassengerIds([]); setEditingPassengerId(restored[0].id);
    setPassportSuggestionsFor(null); setPassengerIssue(null);
    setPaymentChannel(null); setMethodGroup(null); setPaymentMethod(null);
    setAcknowledged(false); setSimulateDecline(false); setCreatedReceipt(null);
    setBankSlipPending(false); setZeroTaxReviewFinished(false); setReceiptReviewOpen(false); setProcessing(false);
    pendingPayment.current = null; setPaymentNonce(crypto.randomUUID()); setError(''); setStep(0);
  };
  useEffect(() => {
    if (!initialDraft) return;
    try {
      if (initialDraft.service !== 'TRAVEL_TAX') throw new Error('Saved travel payment service does not match.');
      restoreTravelDraft(initialDraft.form_payload);
      setSelectedAccountDraft(initialDraft);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Saved travel form could not be restored.');
    }
    // Reconfirm passenger identities; never restore prior approvals or gateway choices.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDraft?.id]);
  useEffect(() => {
    if (!initialReuse) return;
    const verifiedOwner = authenticatedUser?.id === initialReuse.ownerUid;
    const previewOwner = !authenticatedUser && previewAccount?.id === initialReuse.ownerUid &&
      activePreviewSession()?.profileId === initialReuse.ownerUid;
    if (initialReuse.service !== 'TRAVEL_TAX' || (!verifiedOwner && !previewOwner)) {
      setError('Account changed. Reopen your payment history before using Pay Again.');
      return;
    }
    try { restoreTravelDraft({ ...initialReuse.formPayload, sourcePaymentId: initialReuse.sourcePaymentId }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Previous travel payment could not be copied.'); }
    // A different history record remounts this form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialReuse?.sourcePaymentId,authenticatedUser?.id]);
  useEffect(() => {
    if (!selectedAccountDraft || !createdReceipt || bankSlipPending) return;
    const actor: PaymentDraftActor | null = authenticatedUser
      ? {kind:'authenticated',userId:authenticatedUser.id}
      : previewAccount ? {kind:'preview',profileId:previewAccount.id}
      : unsignedGuestDrafts ? {kind:'guest'} : null;
    if (!actor) return;
    let active = true;
    void deletePaymentFormDraft(actor,selectedAccountDraft).then(() => {
      if (active) setSelectedAccountDraft(null);
    }).catch(() => { /* preserve a recoverable draft if SQL cleanup fails */ });
    return () => { active = false; };
  }, [createdReceipt?.id, bankSlipPending, selectedAccountDraft?.id, authenticatedUser?.id, previewAccount?.id, unsignedGuestDrafts]);

  useEffect(() => { onStageChange?.((step + 1) as 1 | 2 | 3 | 4); }, [step, onStageChange]);
  // The receipt takes over the wizard. Reset its scroll position when it
  // mounts so the newly created receipt heading remains visible on mobile
  // and desktop, rather than inheriting the payment form's scroll offset.
  useEffect(() => {
    if (!createdReceipt || bankSlipPending) return;
    const modalBody = document.querySelector<HTMLElement>('.taxpay-modal__body');
    if (modalBody) {
      modalBody.scrollTop = 0;
    } else {
      document.querySelector<HTMLElement>('.travel-flow__main')?.scrollTo({ top: 0 });
      window.scrollTo({ top: 0 });
    }
  }, [createdReceipt, bankSlipPending]);


  // Preserve the existing simulation-only land and water rates until verified
  // statutory rate and age tables have been approved by the client.
  const selectedRouteIdx = mode === 'LAND' ? 4 : 5;
  const route = TRAVEL_TAX_RATES[selectedRouteIdx];
  const unitRate = route.amount;
  const assessments = passengers.map(passenger => ({ passenger, assessment: assessTravelPassenger(passenger, unitRate, travelDate) }));
  const selectedPort = mode === 'WATER' ? waterPort.trim() : port;
  const seenPassports = new Set<string>();
  const invalidPassengerIds = new Set<string>();
  passengers.forEach(item => {
    const passport = item.passport.trim().toUpperCase();
    const repeated = !!passport && seenPassports.has(passport);
    if (passport) seenPassports.add(passport);
    if (repeated || item.passport.trim().length < 6 || item.name.trim().length < 2 ||
        (item.nationality === 'BD' && item.identitySource !== 'PASSPORT_SAMPLE') ||
        (item.nationality === 'FOREIGN' && (!item.country.trim() || !item.birthDate)) ||
        item.medicalPortReferral) invalidPassengerIds.add(item.id);
  });
  const validAssessments = assessments.filter(({passenger, assessment}) =>
    assessment !== null && !invalidPassengerIds.has(passenger.id));
  const provisionalAmount = validAssessments.reduce((sum, item) => sum + (item.assessment?.amount ?? 0), 0);
  const allCalculated = !!travelDate && !!selectedPort && !!destination.trim() &&
    invalidPassengerIds.size === 0 && assessments.every(item => item.assessment !== null) &&
    validateTravelParty(passengers, travelDate) === null;
  const totalAmount = allCalculated ? travelPartyTotal(passengers, unitRate, travelDate) : provisionalAmount;
  const amountWords = allCalculated ? amountInTakaWords(totalAmount, language) : '';
  const receiptMobileComplete = /^01\d{9}$/.test(phone);
  const canSubmit = allCalculated && totalAmount > 0 && receiptMobileComplete && !processing && !!paymentMethod && !!paymentChannel && acknowledged;
  const routeOptions: { value: TravelMode; en: string; bn: string }[] = [
    { value: 'LAND', en: 'By land', bn: 'স্থলপথে' },
    { value: 'WATER', en: 'By water', bn: 'নৌপথে' },
  ];

  const showError = (message: string) => {
    const revision = ++errorFocusRevision.current;
    setError(message);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      // Never steal focus after someone has resumed editing the invalid field.
      if (revision !== errorFocusRevision.current) return;
      const alert = document.getElementById('travel-tax-error');
      alert?.scrollIntoView({ block: 'nearest' });
      alert?.focus();
    }));
  };
  const changePassenger = (id: string, patch: Partial<TravelPassenger>) => {
    errorFocusRevision.current += 1;
    setPassengerIssue(previous => previous?.id === id ? null : previous);
    setConfirmedPassengerIds(existing => existing.filter(confirmedId => confirmedId !== id));
    setPassengers(existing => existing.map(item => item.id === id ? { ...item, ...patch } : item));
    setError('');
    setAcknowledged(false);
  };
  const beginPassengerEdit = (person: TravelPassenger) => {
    // If the user edits another card, discard the unfinished previous edit
    // and return that passenger to its last confirmed record.
    if (editBackup && editBackup.passenger.id !== person.id) {
      setPassengers(existing => existing.map(item =>
        item.id === editBackup.passenger.id ? editBackup.passenger : item));
      if (editBackup.wasConfirmed) setConfirmedPassengerIds(ids =>
        [...new Set([...ids, editBackup.passenger.id])]);
    }
    setEditBackup({passenger: {...person}, wasConfirmed: confirmedPassengerIds.includes(person.id)});
    setConfirmedPassengerIds(ids => ids.filter(id => id !== person.id));
    setEditingPassengerId(person.id); setPassengerIssue(null); setError('');
    setAcknowledged(false);
  };
  const cancelPassengerEdit = () => {
    if (!editBackup) return;
    const {passenger, wasConfirmed} = editBackup;
    setPassengers(existing => existing.map(item => item.id === passenger.id ? passenger : item));
    setConfirmedPassengerIds(ids => wasConfirmed ? [...new Set([...ids, passenger.id])] :
      ids.filter(id => id !== passenger.id));
    setEditingPassengerId(null); setEditBackup(null); setPassengerIssue(null);
    setError(''); setAcknowledged(false);
  };
  const removeTravelPassenger = (person: TravelPassenger) => {
    setPassengers(existing => existing.filter(item => item.id !== person.id));
    setConfirmedPassengerIds(ids => ids.filter(id => id !== person.id));
    if (editingPassengerId === person.id) setEditingPassengerId(null);
    if (editBackup?.passenger.id === person.id) setEditBackup(null);
    setPassportSuggestionsFor(null); setPassengerIssue(null);
    setError(''); setAcknowledged(false);
  };
  const changePassengerType = (id: string, nationality: TravellerNationality) => {
    setPassportSuggestionsFor(null);
    changePassenger(id, { nationality, passport: '', name: '', birthDate: '',
      country: nationality === 'BD' ? 'Bangladesh' : '',
      identitySource: nationality === 'BD' ? 'PENDING' : 'MANUAL', medicalPortReferral: false });
  };
  const ageExplanation = (age: number) => age <= 5
    ? tr('Age ' + age + ' on travel date: no tax in this preview (5 or younger).',
         'ভ্রমণের তারিখে বয়স ' + age + ': এই প্রিভিউতে কর নেই (৫ বছর বা কম)।')
    : age <= 12
    ? tr('Age ' + age + ' on travel date: half rate (6–12).',
         'ভ্রমণের তারিখে বয়স ' + age + ': অর্ধেক হার (৬–১২ বছর)।')
    : tr('Age ' + age + ' on travel date: full rate (13+).',
         'ভ্রমণের তারিখে বয়স ' + age + ': পূর্ণ হার (১৩ বছর বা বেশি)।');

  const stepTo = (next: 0 | 1 | 2 | 3) => {
    setError('');
    if (next !== 2) setCheckoutOpen(false);
    if (next !== 3) setZeroTaxReviewFinished(false);
    if (createdReceipt) setReceiptReviewOpen(next === 2);
    setStep(next);
    document.querySelector<HTMLElement>('.travel-flow__main')?.scrollTo({ top: 0 });
  };
  useEffect(() => { onCheckoutChange?.(checkoutOpen); }, [checkoutOpen,onCheckoutChange]);
  // The shared modal body owns scrolling in Final Preview and checkout.
  // Each transition must start at the top, not inherit the previous form offset.
  useLayoutEffect(() => {
    if (embedded && step === 2) {
      document.querySelector<HTMLElement>('.taxpay-modal[data-public-service="travel"] .taxpay-modal__body')?.scrollTo({top:0});
    }
  }, [embedded, step, checkoutOpen]);
  // Dismiss the existing on-focus ten-sample picker without changing focus
  // or rerendering the modal between pointerdown and click. That early state
  // change can swallow clicks on Travel Tax's Edit passengers control.
  useEffect(() => {
    if (!passportSuggestionsFor) return;
    const field = document.getElementById('travel-passport-' + passportSuggestionsFor);
    const options = document.getElementById('travel-passport-suggestions-' + passportSuggestionsFor);
    const isOutside = (node: EventTarget | null) =>
      node instanceof Node && !field?.contains(node) && !options?.contains(node);
    const onOutsideClick = (event: MouseEvent) => {
      // Run after the clicked control's React handler, never at pointerdown.
      if (isOutside(event.target)) setPassportSuggestionsFor(null);
    };
    const onFocusMoved = (event: FocusEvent) => {
      if (!isOutside(event.target)) return;
      // Tab should close the picker, but pointer focus must not unmount
      // controls before their click is dispatched.
      requestAnimationFrame(() => {
        if (isOutside(document.activeElement)) setPassportSuggestionsFor(null);
      });
    };
    document.addEventListener('click', onOutsideClick);
    document.addEventListener('focusin', onFocusMoved);
    return () => {
      document.removeEventListener('click', onOutsideClick);
      document.removeEventListener('focusin', onFocusMoved);
    };
  }, [passportSuggestionsFor]);
  // The shared modal header owns Back, including receipt/review navigation.
  // Do not proxy through footer DOM buttons: they can disappear or be disabled.
  useEffect(() => {
    if (!registerHeaderBack) return;
    const back = () => {
      if (createdReceipt) {
        stepTo(receiptReviewOpen ? 3 : 2);
        return;
      }
      if (checkoutOpen) { setCheckoutOpen(false); return; }
      if (step > 0) stepTo((step - 1) as 0 | 1 | 2 | 3);
      else onBackToService?.();
    };
    registerHeaderBack(back);
    return () => registerHeaderBack(null);
  }, [registerHeaderBack, createdReceipt, receiptReviewOpen, checkoutOpen, step, onBackToService]);
  const validateTravelDetails = () => {
    if (!selectedPort) return tr('Select a departure port.', 'যাত্রা শুরুর বন্দর নির্বাচন করুন।');
    if (!destination.trim()) return tr('Select or enter a destination.', 'গন্তব্য নির্বাচন বা লিখুন।');
    if (!travelDate) return tr('Select your travel date.', 'ভ্রমণের তারিখ নির্বাচন করুন।');
    if (!isPlannedTravelDate(travelDate))
      return tr('Select today or a future travel date.', 'আজকের বা ভবিষ্যতের ভ্রমণের তারিখ নির্বাচন করুন।');
    return null;
  };
  const passengerIdentityIssue = (id: string): PassengerIdentityIssue | null => {
    const index = passengers.findIndex(item => item.id === id);
    const item = passengers[index];
    if (!item || index < 0) return {id, message: tr('Passenger details need correction.', 'যাত্রীর তথ্য সংশোধন প্রয়োজন।'), field: 'passport'};
    const prefix = tr('Passenger ', 'যাত্রী ') + (index + 1) + ': ';
    if (item.passport.trim().length < 6)
      return {id: item.id, message: prefix + tr('enter a valid passport number.', 'বৈধ পাসপোর্ট নম্বর দিন।'), field: 'passport'};
    const passport = item.passport.trim().toUpperCase();
    const duplicateEarlierPassenger = passengers.slice(0, index).some(
      other => other.passport.trim().toUpperCase() === passport,
    );
    if (duplicateEarlierPassenger)
      return {id: item.id, message: prefix + tr('this passport is already used by another passenger.', 'এই পাসপোর্ট অন্য যাত্রী ইতিমধ্যে ব্যবহার করেছেন।'), field: 'passport'};
    if (item.nationality === 'BD' && item.identitySource !== 'PASSPORT_SAMPLE')
      return {id: item.id, message: prefix + tr('check the selected sample passport first.', 'প্রথমে নির্বাচিত নমুনা পাসপোর্ট যাচাই করুন।'), field: 'passport'};
    if (item.name.trim().length < 2)
      return {id: item.id, message: prefix + tr('enter a passenger name.', 'যাত্রীর নাম লিখুন।'), field: 'name'};
    if (item.nationality === 'FOREIGN') {
      if (!item.country.trim())
        return {id: item.id, message: prefix + tr('enter the country of nationality.', 'জাতীয়তার দেশ দিন।'), field: 'country'};
      if (travelPassengerAge(item.birthDate, dhakaTravelDate()) === null)
        return {id: item.id, message: prefix + tr('enter a valid date of birth.', 'বৈধ জন্মতারিখ দিন।'), field: 'birth-date'};
    }
    if (item.medicalPortReferral)
      return {id: item.id, message: prefix + tr('medical exemption requires assessment at the departure port.', 'চিকিৎসাজনিত অব্যাহতির জন্য বন্দরে সরাসরি যাচাই প্রয়োজন।'), field: 'medical'};
    return null;
  };
  const firstIdentityIssue = (): PassengerIdentityIssue | null => {
    for (const item of passengers) {
      const issue = passengerIdentityIssue(item.id);
      if (issue) return issue;
    }
    return null;
  };
  // Keep the explicit confirmation action visible for the pending passenger.
  // Clicking it reports the precise missing field before any passenger is added.
  const pendingConfirmationId = editingPassengerId ??
    passengers.find(item => !confirmedPassengerIds.includes(item.id))?.id ?? null;
  const canShowAddPassenger = passengers.some(item => item.id === pendingConfirmationId &&
    (item.nationality === 'BD'
      ? item.identitySource === 'PASSPORT_SAMPLE'
      : !!(item.passport.trim() || item.name.trim() || item.birthDate.trim() || item.country.trim())));
  const allPassengersComplete = passengers.length > 0 && firstIdentityIssue() === null &&
    passengers.every(item => confirmedPassengerIds.includes(item.id));
  const canContinueToTravel = allPassengersComplete;
  const reportIdentityIssue = (issue: PassengerIdentityIssue) => {
    setEditingPassengerId(issue.id); setPassengerIssue(issue);
    showError(issue.message);
    const focusId = 'travel-' + (issue.field ?? 'passport') + '-' + issue.id;
    requestAnimationFrame(() => requestAnimationFrame(() =>
      document.getElementById(focusId)?.focus()));
  };
  const validatePassengers = () => {
    const problem = validateTravelParty(passengers, travelDate);
    if (problem) {
      const translated = problem.includes('same passport')
        ? tr(problem, 'একটি পাসপোর্ট একাধিকবার যোগ করা যাবে না।')
        : problem.includes('Medical')
        ? tr(problem, 'চিকিৎসাজনিত কর অব্যাহতির কাগজপত্র বন্দরে সরাসরি জমা দিতে হবে।')
        : problem.includes('verification')
        ? tr(problem, 'বাংলাদেশি পাসপোর্ট যাচাই API এখনো সংযুক্ত নয়। কেবল নমুনা পরিচয় দিয়ে প্রবাহ পরীক্ষা করা যাবে।')
        : tr(problem, 'প্রত্যেক যাত্রীর নাম ও বৈধ পাসপোর্ট তথ্য দিন।');
      return translated;
    }
    return null;
  };
  const validateReceiptContact = () => receiptMobileComplete ? null :
    tr('Enter a valid 11-digit receipt mobile number.', 'রসিদের জন্য ১১ সংখ্যার বৈধ মোবাইল নম্বর দিন।');
  const continueStep = () => {
    if (step === 0) {
      const issue = firstIdentityIssue();
      if (issue) { reportIdentityIssue(issue); return; }
      if (!allPassengersComplete) {
        showError(tr('Confirm each checked passenger with Add passenger first.', 'প্রতিটি যাচাইকৃত যাত্রী যোগ করুন বোতামে নিশ্চিত করুন।'));
        return;
      }
      setEditingPassengerId(null); stepTo(1); return;
    }
    const problem = validateTravelDetails() ?? validatePassengers();
    if (problem) { showError(problem); return; }
    stepTo(2);
  };
  const reset = () => {
    setStep(0); setCheckoutOpen(false); setMode('LAND'); setPort(''); setWaterPort('');
    setDestination(''); setTravelDate(''); setEditingPassengerId('first'); setPassengerIssue(null); setPassportSuggestionsFor(null);
    setPassengers([makeTravelPassenger('first', 'BD')]); setConfirmedPassengerIds([]);
    setEditBackup(null);
    setReceiptReviewOpen(false); setPhone(''); setError('');
    setPaymentChannel(null); setPaymentMethod(null); setMethodGroup(null);
    setSimulateDecline(false); setAcknowledged(false); setBankSlipPending(false);
    setZeroTaxReviewFinished(false); setCreatedReceipt(null); setProcessing(false); pendingPayment.current = null; setPaymentNonce(crypto.randomUUID());
  };

  const paymentReceipt = (pendingBank: boolean): ChallanReceipt => {
    const now = new Date().toISOString();
    const reference = 'SIM-TOKEN-' + paymentNonce;
    return {
      id: 'rcpt-trv-' + paymentNonce,
      taxEventId: 'SIM-EVENT-' + paymentNonce,
      paymentTransactionId: reference,
      challanNo: 'SIM-' + paymentNonce,
      tokenNumber: reference,
      paymentCategory: 'TRAVEL_TAX',
      assessmentYear: TRAVEL_TAX_YEAR,
      payerName: passengers[0].name,
      payerTin: 'NON-TIN-PASSENGER',
      receiptMobile: phone,
      isRepresentativePayment: false,
      taxZone: '',
      taxCircle: '',
      isWithholding: false,
      travelDetails: {
        mode, departurePort: selectedPort,
        destination: destination.trim(), travelDate,
        economicCode: TRAVEL_TAX_ECONOMIC_CODE,
        passengers: passengers.map(item => {
          const assessment = assessTravelPassenger(item, unitRate, travelDate);
          return { name: item.name.trim(), passportMasked: maskPassport(item.passport),
            nationality: item.nationality, country: item.country,
            ageBand: assessment?.ageBand ?? 'ADULT', age: assessment?.age,
            amount: assessment?.amount ?? 0 };
        }),
      },
      items: passengers.map((item, idx) => {
        const assessment = assessTravelPassenger(item, unitRate, travelDate);
        const amount = assessment?.amount ?? 0;
        return {
          headId: 155 + idx, economicCode: TRAVEL_TAX_ECONOMIC_CODE,
          headNameEn: 'Travel tax — ' + item.name.trim(),
          taxAmount: amount, penaltyAmount: 0, surchargeAmount: 0, interestAmount: 0,
          totalAmount: amount,
          note: mode + ' | ' + selectedPort + ' | ' + destination + ' | ' + travelDate +
            ' | age ' + (assessment?.age ?? 'unavailable') + ' | Passport ' + maskPassport(item.passport),
        };
      }),
      totalAmount,
      paymentMethod: paymentMethod ?? 'SIMULATED',
      gatewayTransactionId: 'SIM-TXN-' + paymentNonce,
      treasuryStatus: pendingBank ? 'INITIATED' : 'GATEWAY_SUCCESS',
      taxCreditStatus: 'NOT_APPLICABLE',
      createdAt: now,
      completedAt: pendingBank ? undefined : now,
      isSimulatedDemo: true,
    };
  };

  const persistPreview = async (receipt: ChallanReceipt) => {
    // Records are explicitly simulated: no real A-Challan is issued.
    let stored = receipt;
    if (import.meta.env.VITE_SUPABASE_DISABLED !== 'true') {
      pendingPayment.current ??= {
        idempotencyKey: paymentNonce,
        sessionId: storySessionId,
        service: 'TRAVEL_TAX',
        amountMinor: Math.round(totalAmount * 100),
        details: {
          ...(sourcePaymentId ? { sourcePaymentId } : {}),
          payerName: passengers[0].name.trim(),
          assessmentYear: TRAVEL_TAX_YEAR,
          paymentMethod, paymentChannel,
          receiptReference: receipt.tokenNumber, receiptMobile: phone,
          travelMode: mode, departurePort: selectedPort,
          destination: destination.trim(), travelDate,
          economicCode: TRAVEL_TAX_ECONOMIC_CODE,
          travelRateEvidence: travelTaxRateEvidence(mode, unitRate),
          passengers: receipt.travelDetails?.passengers,
          lines: receipt.items, receiptSnapshot: receipt,
        },
      };
      const request = pendingPayment.current;
      try {
        sessionStorage.setItem(pendingPaymentKey, JSON.stringify(request));
      } catch { /* In-memory retry remains available when storage is unavailable. */ }
      const ack = await persistSimulatedPayment(request);
      const recorded = await getConfirmedReceipt(ack.id);
      if (!matchesConfirmedTravelTaxReceipt(request.details.receiptSnapshot, recorded, ack.id)) {
        throw new Error('Travel Tax receipt does not match the saved Taxpayer payment');
      }
      stored = recorded;
      try { sessionStorage.removeItem(pendingPaymentKey); }
      catch { /* The saved key can safely replay the same payment. */ }
    }
    setRecoveringPayment(null);
    addPaymentReceipt(stored);
    setCreatedReceipt(stored);
    pendingPayment.current = null; setPaymentNonce(crypto.randomUUID());
    setBankSlipPending(false);
    stepTo(3);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (step !== 2 || !checkoutOpen || processing) return;
    const problem = pendingPayment.current ? null : validateTravelDetails() ?? validatePassengers() ?? validateReceiptContact();
    if (problem) { showError(problem); return; }
    if (!pendingPayment.current && (!paymentMethod || !paymentChannel || !acknowledged)) {
      setError(tr('Choose a payment method and confirm the details.', 'পেমেন্ট পদ্ধতি বেছে নিয়ে তথ্য নিশ্চিত করুন।'));
      return;
    }
    if (!pendingPayment.current && totalAmount <= 0) {
      setError(tr('No tax is payable for this passenger group.', 'এই যাত্রীদের জন্য কর প্রদেয় নেই।'));
      return;
    }
    setError(''); setProcessing(true);
    try {
      if (pendingPayment.current) {
        await persistPreview(pendingPayment.current.details.receiptSnapshot);
      } else if (paymentChannel === 'NOW' && simulateDecline) {
        setError(tr('Payment preview declined. Try again.', 'পেমেন্ট পরীক্ষাটি প্রত্যাখ্যাত হয়েছে। আবার চেষ্টা করুন।'));
      } else if (paymentChannel === 'OTC') {
        setCreatedReceipt(paymentReceipt(true));
        setBankSlipPending(true);
        stepTo(3);
      } else {
        await persistPreview(paymentReceipt(false));
      }
    } catch {
      setError(tr('Simulated payment could not be recorded. Retry with the same details.', 'নমুনা পেমেন্ট রেকর্ড করা যায়নি। একই তথ্য দিয়ে আবার চেষ্টা করুন।'));
    } finally { setProcessing(false); }
  };

  const settleBankSlip = async () => {
    if (!bankSlipPending || !createdReceipt || processing) return;
    setProcessing(true);
    try {
      await persistPreview({ ...createdReceipt, treasuryStatus: 'GATEWAY_SUCCESS', completedAt: new Date().toISOString() });
    } catch {
      setError(tr('Simulated bank settlement could not be recorded. Retry.', 'নমুনা ব্যাংক নিষ্পত্তি রেকর্ড হয়নি। আবার চেষ্টা করুন।'));
    } finally { setProcessing(false); }
  };


  const confirmCheckedPassenger = (item: TravelPassenger) => {
    const issue = passengerIdentityIssue(item.id);
    if (issue) { reportIdentityIssue(issue); return; }
    setConfirmedPassengerIds(ids => [...new Set([...ids, item.id])]);
    setEditingPassengerId(null); setEditBackup(null); setPassengerIssue(null); setPassportSuggestionsFor(null);
  };

  /** Each passenger uses a type tab; fields from the other type never appear. */
  const renderPassengerEditor = (item: TravelPassenger, index: number) => {
    const panelId = 'travel-passenger-panel-' + item.id;
    const assessment = assessTravelPassenger(item, unitRate, travelDate);
    const normalizedPassport = item.passport.trim().toUpperCase();
    const passengerFieldIssue = passengerIssue?.id === item.id ? passengerIssue : null;
    const passportAlreadyAdded = !!normalizedPassport && passengers.some(other =>
      other.id !== item.id && other.passport.trim().toUpperCase() === normalizedPassport);
    const availableSamples = SAMPLE_BD_PASSPORTS.filter(sample =>
      sample.passport.includes(normalizedPassport) && !passengers.some(other =>
        other.id !== item.id && other.passport.trim().toUpperCase() === sample.passport));
    const medicalAssessmentControl = (
        <div className="travel-passenger-workspace__medical" data-testid="travel-passenger-medical-control">
          <label className="travel-flow__check" htmlFor={'travel-medical-'+item.id}>
            <input id={'travel-medical-'+item.id} type="checkbox" checked={item.medicalPortReferral}
              onChange={event=>changePassenger(item.id,{medicalPortReferral:event.target.checked})}/>
            <span>{tr('Request manual medical assessment at departure port',
              'বন্দরে সরাসরি চিকিৎসাজনিত মূল্যায়নের অনুরোধ')}</span>
          </label>
        </div>
    );
    const medicalAssessmentNotice = item.medicalPortReferral && (
      <p role="status" data-testid="travel-manual-assessment-blocker" className="travel-flow__medical-note">
        {tr('Manual medical assessment is required at the departure port. Online Continue is unavailable. Bring supporting documents, or untick this option if you selected it by mistake.',
            'চিকিৎসাজনিত যাচাই বন্দরে সরাসরি করতে হবে। অনলাইনে এগোনো যাবে না। প্রয়োজনীয় কাগজপত্র আনুন অথবা ভুল করে নির্বাচন করলে টিক তুলে দিন।')}
      </p>
    );
    return <>
      <div className="travel-flow__passenger-tabs" role="tablist"
        aria-label={tr('Passenger type for passenger ', 'যাত্রীর ধরন, যাত্রী ') + (index + 1)}>
        {([
          ['BD', tr('Bangladeshi passenger','বাংলাদেশি যাত্রী'), Flag],
          ['FOREIGN', tr('Foreign passenger','বিদেশি যাত্রী'), Globe2]
        ] as const).map(([nationality, label, Icon]) =>
          <button key={nationality} type="button" role="tab"
            id={'travel-passenger-tab-' + item.id + '-' + nationality}
            aria-controls={panelId} aria-selected={item.nationality === nationality}
            tabIndex={item.nationality === nationality ? 0 : -1}
            className={'travel-flow__passenger-tab' + (item.nationality === nationality ? ' travel-flow__passenger-tab--active' : '')}
            onClick={() => item.nationality !== nationality && changePassengerType(item.id, nationality)}
            onKeyDown={event => {
              if (!['ArrowRight','ArrowLeft','Home','End'].includes(event.key)) return;
              event.preventDefault();
              const next: TravellerNationality = event.key === 'Home' ? 'BD' : event.key === 'End'
                ? 'FOREIGN' : item.nationality === 'BD' ? 'FOREIGN' : 'BD';
              if (next !== item.nationality) changePassengerType(item.id, next);
              requestAnimationFrame(() => document.getElementById(
                'travel-passenger-tab-' + item.id + '-' + next)?.focus());
            }}>
            <Icon size={17} aria-hidden="true" />{label}
          </button>)}
      </div>
      <div id={panelId} role="tabpanel"
        aria-labelledby={'travel-passenger-tab-' + item.id + '-' + item.nationality}
        className="travel-flow__passenger-panel">
        <div className="travel-flow__fields">
          {item.nationality === 'BD' ? <>
            <div className="travel-flow__passport-row">
              <div className="travel-flow__field travel-flow__passport-input">
                <label htmlFor={'travel-passport-' + item.id}>{tr('Passport number','পাসপোর্ট নম্বর')} *</label>
                <div className="travel-flow__passport-entry">
                <input id={'travel-passport-' + item.id} role="combobox" aria-autocomplete="list"
                  aria-controls={'travel-passport-suggestions-' + item.id}
                  aria-expanded={passportSuggestionsFor === item.id}
                  aria-invalid={passportAlreadyAdded || passengerFieldIssue?.field === 'passport'}
                  aria-describedby={[
                    passportAlreadyAdded ? 'travel-passport-duplicate-' + item.id : null,
                    passengerFieldIssue?.field === 'passport' ? 'travel-passenger-issue-' + item.id : null,
                  ].filter(Boolean).join(' ') || undefined}
                  value={item.passport} maxLength={20} autoComplete="off"
                  onFocus={() => {
                    errorFocusRevision.current += 1;
                    setPassportSuggestionsFor(passportAlreadyAdded ? null : item.id);
                  }}
                  onClick={() => {
                    if (!passportAlreadyAdded) setPassportSuggestionsFor(item.id);
                  }}
                  onKeyDown={event => {
                    if (event.key === 'Escape' && passportSuggestionsFor === item.id) {
                      event.preventDefault(); event.stopPropagation();
                      setPassportSuggestionsFor(null); return;
                    }
                    if (event.key === 'ArrowDown' && passportSuggestionsFor === item.id) {
                      event.preventDefault();
                      document.querySelector<HTMLElement>('#travel-passport-suggestions-' + item.id + ' [role="option"]')?.focus();
                    }
                  }}
                  onChange={event => {
                    const typedPassport = event.target.value.toUpperCase().replace(/\s+/g, '');
                    const alreadyAdded = passengers.some(other =>
                      other.id !== item.id && other.passport.trim().toUpperCase() === typedPassport);
                    changePassenger(item.id, {passport: typedPassport,
                      name: '', birthDate: '', identitySource: 'PENDING', medicalPortReferral: false});
                    // A complete passport must not leave the suggestion layer covering edit/remove actions.
                    setPassportSuggestionsFor(alreadyAdded || typedPassport.length >= 10 ? null : item.id);
                  }}
                  placeholder={tr('Select or enter a sample passport','একটি নমুনা পাসপোর্ট নির্বাচন বা লিখুন')}/>
                {item.passport && <button type="button" className="travel-flow__passport-clear"
                  aria-label={tr('Clear passport', 'পাসপোর্ট মুছুন')}
                  title={tr('Clear passport', 'পাসপোর্ট মুছুন')}
                  onClick={() => {
                    changePassenger(item.id, {passport: '', name: '', birthDate: '', identitySource: 'PENDING', medicalPortReferral: false});
                    setPassportSuggestionsFor(null);
                    requestAnimationFrame(() => document.getElementById('travel-passport-' + item.id)?.focus());
                  }}><X size={17} aria-hidden="true"/></button>}
                </div>
                {passportAlreadyAdded && <p className="travel-flow__inline-error" role="status"
                  id={'travel-passport-duplicate-' + item.id}>
                  {tr('Passport already added.', 'পাসপোর্ট ইতিমধ্যে যোগ করা হয়েছে।')}
                </p>}
              </div>
              <div className="travel-flow__field travel-flow__passport-action">
                <button id={'travel-lookup-' + item.id} type="button"
                  disabled={normalizedPassport.length < 6} onClick={() => {
                  setPassportSuggestionsFor(null);
                  if (passportAlreadyAdded) {
                    const message = tr('Passport already added.', 'পাসপোর্ট ইতিমধ্যে যোগ করা হয়েছে।');
                    // The duplicate is already announced beside the field.
                    // Keep the shared alert without adding a second row message.
                    setPassengerIssue(null);
                    showError(message);
                    requestAnimationFrame(() => requestAnimationFrame(() =>
                      document.getElementById('travel-passport-' + item.id)?.focus()));
                    return;
                  }
                  const sample = SAMPLE_BD_PASSPORTS.find(entry => entry.passport === normalizedPassport);
                  if (!sample) {
                    showError(tr('This passport is not in the ten sample records. Government verification is not connected.',
                      'এই পাসপোর্টটি ১০টি নমুনা রেকর্ডে নেই। সরকারি যাচাই সংযুক্ত নয়।'));
                    return;
                  }
                  changePassenger(item.id, {name: sample.name, birthDate: sample.birthDate,
                    country: 'Bangladesh', identitySource: 'PASSPORT_SAMPLE'});
                  // Identity lookup previews details. Always retain manual confirmation.
                  setEditingPassengerId(item.id);
                  // Checking only previews this passenger; the user must still
                  // confirm explicitly. Keep that confirmation above the fixed
                  // modal footer once the expanded identity review has rendered.
                  requestAnimationFrame(() => {
                    const card = document.querySelector<HTMLElement>('[data-passenger-id="' + item.id + '"]');
                    if (!card) return;
                    // The card expands for the identity review. Scroll only
                    // after that transition finishes, or the button can move
                    // back underneath the fixed modal footer.
                    const transitions = card.getAnimations({subtree: true})
                      .filter(animation => animation.playState === 'running');
                    void Promise.all(transitions.map(animation =>
                      animation.finished.catch(() => undefined))).then(() => {
                      const action = card.querySelector<HTMLElement>('.travel-flow__confirm-passenger');
                      const main = action?.closest<HTMLElement>('.travel-flow__main');
                      const body = action?.closest<HTMLElement>('.taxpay-modal__body');
                      const scroller = main && getComputedStyle(main).overflowY === 'auto' ? main : body;
                      if (!action || !scroller || !action.isConnected) return;
                      const footer = action.closest('.taxpay-modal')?.querySelector('.taxpay-modal__footer');
                      const visibleBottom = Math.min(scroller.getBoundingClientRect().bottom,
                        footer?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY);
                      const requiredScroll = action.getBoundingClientRect().bottom - visibleBottom + 16;
                      if (requiredScroll > 0) scroller.scrollBy({top: requiredScroll, behavior: 'smooth'});
                    });
                  });
                }}>{tr('Check Passport','পাসপোর্ট যাচাই করুন')}</button>
              </div>
              {passportSuggestionsFor === item.id && <div
                className="travel-flow__passport-suggestions" id={'travel-passport-suggestions-' + item.id}
                data-placement="below"
                style={{maxHeight: passportSuggestionMaxHeight}}
                role="listbox" aria-label={tr('Available sample passports','উপলব্ধ নমুনা পাসপোর্ট')}
                onKeyDown={event => {
                  if (event.key === 'Escape') {
                    event.preventDefault(); event.stopPropagation();
                    // Focus first; then dismiss so the input focus handler
                    // cannot reopen suggestions in the same event.
                    document.getElementById('travel-passport-' + item.id)?.focus();
                    setPassportSuggestionsFor(null);
                    return;
                  }
                  if (!['ArrowDown','ArrowUp','Home','End'].includes(event.key)) return;
                  const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'));
                  const current = options.indexOf(document.activeElement as HTMLButtonElement);
                  if (!options.length || current < 0) return;
                  event.preventDefault();
                  const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
                    : event.key === 'ArrowDown' ? (current + 1) % options.length
                    : (current + options.length - 1) % options.length;
                  options[next].focus();
                }}>
                <p className="travel-flow__passport-suggestions-heading" role="presentation">
                  {tr('Sample passport numbers','নমুনা পাসপোর্ট নম্বর')}
                </p>
                {availableSamples.map(sample => <button type="button" role="option"
                  aria-selected={item.passport === sample.passport}
                  key={sample.passport} onMouseDown={event => event.preventDefault()}
                  onClick={() => {
                    changePassenger(item.id, {passport: sample.passport, name: '', birthDate: '', identitySource: 'PENDING'});
                    setPassportSuggestionsFor(null);
                  }}>
                  <span>{sample.passport}</span><span>{tr('Sample','নমুনা')}</span>
                </button>)}
                {availableSamples.length === 0 && <p className="travel-flow__passport-no-results" role="presentation">
                  {passportAlreadyAdded
                    ? tr('Passport already added.','পাসপোর্ট ইতিমধ্যে যোগ করা হয়েছে।')
                    : tr('No available sample passports.','কোনো উপলব্ধ নমুনা পাসপোর্ট নেই।')}
                </p>}
              </div>}
            </div>
            {item.identitySource === 'PASSPORT_SAMPLE' && <section className="travel-flow__identity-card travel-flow__identity-card--compact"
              data-testid="travel-passport-search-result" aria-label={tr('Passenger details','যাত্রীর তথ্য')}>
              <dl>
                <div><dt>{tr('Passenger name','যাত্রীর নাম')}</dt><dd data-testid={'travel-passenger-name-' + item.id}>{item.name}</dd></div>
                <div><dt>{tr('Passport number','পাসপোর্ট নম্বর')}</dt><dd>{item.passport}</dd></div>
                <div><dt>{tr('Date of birth','জন্মতারিখ')}</dt><dd data-testid={'travel-passenger-birth-' + item.id}>{item.birthDate}</dd></div>
                <div><dt>{tr('Nationality','জাতীয়তা')}</dt><dd>{tr('Bangladeshi','বাংলাদেশি')}</dd></div>
              </dl>
              {medicalAssessmentControl}
              {medicalAssessmentNotice}
              {canShowAddPassenger && pendingConfirmationId === item.id &&
                <div className="travel-flow__confirm-row">
                  <button type="button" className="travel-flow__add-member travel-flow__confirm-passenger"
                    onClick={() => confirmCheckedPassenger(item)}>
                    <Plus size={17} aria-hidden="true"/>{tr('Add passenger','যাত্রী যোগ করুন')}
                  </button>
                </div>}
            </section>}
          </> : <>
            <div className="travel-flow__field">
              <label htmlFor={'travel-passport-' + item.id}>{tr('Passport number','পাসপোর্ট নম্বর')} *</label>
              <div className="travel-flow__passport-entry">
              <input id={'travel-passport-' + item.id} value={item.passport} maxLength={20} autoComplete="off"
                aria-invalid={passengerFieldIssue?.field === 'passport'}
                aria-describedby={passengerFieldIssue?.field === 'passport' ? 'travel-passenger-issue-' + item.id : undefined}
                onChange={event => changePassenger(item.id, {passport: event.target.value.toUpperCase().replace(/\s+/g, ''), medicalPortReferral: false})}
                placeholder={tr('Enter passport number','পাসপোর্ট নম্বর লিখুন')}/>
              {item.passport && <button type="button" className="travel-flow__passport-clear"
                aria-label={tr('Clear passport', 'পাসপোর্ট মুছুন')}
                title={tr('Clear passport', 'পাসপোর্ট মুছুন')}
                onClick={() => {
                  changePassenger(item.id, {passport: '', medicalPortReferral: false});
                  setPassportSuggestionsFor(null);
                  requestAnimationFrame(() => document.getElementById('travel-passport-' + item.id)?.focus());
                }}><X size={17} aria-hidden="true"/></button>}
              </div>
            </div>
          
            <div className="travel-flow__field">
              <label htmlFor={'travel-name-' + item.id}>{tr('Passenger name as on passport','পাসপোর্ট অনুযায়ী নাম')} *</label>
              <input id={'travel-name-' + item.id} maxLength={100} value={item.name}
                aria-invalid={passengerFieldIssue?.field === 'name'}
                aria-describedby={passengerFieldIssue?.field === 'name' ? 'travel-passenger-issue-' + item.id : undefined}
                onChange={event => changePassenger(item.id, {name: event.target.value.toUpperCase()})}
                placeholder={tr('Enter full name','পূর্ণ নাম লিখুন')}/>
            </div>
            <div className="travel-flow__field">
              <label htmlFor={'travel-birth-date-' + item.id}>{tr('Date of birth','জন্মতারিখ')} *</label>
              <input id={'travel-birth-date-' + item.id} type="date" value={item.birthDate}
                aria-invalid={passengerFieldIssue?.field === 'birth-date'}
                aria-describedby={passengerFieldIssue?.field === 'birth-date' ? 'travel-passenger-issue-' + item.id : undefined}
                max={travelDate || undefined} onChange={event => changePassenger(item.id, {birthDate: event.target.value})}/>
            </div>
            <div className="travel-flow__field">
              <label htmlFor={'travel-country-' + item.id}>{tr('Country of nationality','জাতীয়তার দেশ')} *</label>
              <input id={'travel-country-' + item.id} maxLength={80} value={item.country}
                aria-invalid={passengerFieldIssue?.field === 'country'}
                aria-describedby={passengerFieldIssue?.field === 'country' ? 'travel-passenger-issue-' + item.id : undefined}
                onChange={event => changePassenger(item.id, {country: event.target.value})}
                placeholder={tr('Enter country','দেশ লিখুন')}/>
            </div>
            {item.passport.trim().length >= 6 && medicalAssessmentControl}
            {medicalAssessmentNotice}
          </>}
        </div>
        {assessment && <p className="travel-flow__age-reason">{ageExplanation(assessment.age)}</p>}
      </div>
    </>;
  };

  if (recoveringPayment) {
    const recover = async () => {
      if (processing) return;
      setProcessing(true);
      setError('');
      try {
        pendingPayment.current = recoveringPayment;
        await persistPreview(recoveringPayment.details.receiptSnapshot);
      } catch {
        setError(tr('Payment confirmation is still unavailable. Retry again.',
          'পেমেন্ট নিশ্চিতকরণ পাওয়া যায়নি। আবার চেষ্টা করুন।'));
      } finally { setProcessing(false); }
    };
    const retryAction = <button type="button" className="travel-flow__primary"
      disabled={processing} onClick={recover}>
      {processing ? tr('Processing…', 'প্রক্রিয়াধীন…') : tr('Retry payment confirmation', 'পেমেন্ট নিশ্চিতকরণ আবার চেষ্টা করুন')}
    </button>;
    return <section className="travel-flow__panel" lang={language}>
      <h3>{tr('Payment confirmation pending', 'পেমেন্ট নিশ্চিতকরণের অপেক্ষায়')}</h3>
      <p>{recoveringPayment.details.receiptSnapshot.challanNo}</p>
      <p><TravelCurrency amount={recoveringPayment.amountMinor / 100} language={language}/></p>
      {error && <p role="alert">{error}</p>}
      {modalFooterTarget ? createPortal(retryAction, modalFooterTarget) : retryAction}
    </section>;
  }

  const pendingPassenger = passengers.find(p => p.id === editingPassengerId) ??
    passengers.find(p => !confirmedPassengerIds.includes(p.id)) ?? null;
  const beginNewPassenger = (nationality: TravellerNationality = 'BD', passport = '') => {
    if (pendingPassenger) { setEditingPassengerId(pendingPassenger.id); return; }
    const id = crypto.randomUUID();
    setPassengers(items => [...items, {...makeTravelPassenger(id,nationality), passport}]);
    setEditingPassengerId(id); setPassengerIssue(null); setError(''); setAcknowledged(false);
    // The empty search turns into the real passenger editor without dropping
    // the keyboard focus or the first typed passport character.
    requestAnimationFrame(() => document.getElementById('travel-passport-'+id)?.focus());
  };
  const primaryAction = zeroTaxReviewFinished ? (
    <button type="button" className="travel-flow__primary" onClick={reset}>
      {tr('Start another travel review', 'আরেকটি ভ্রমণ পর্যালোচনা শুরু করুন')}<ArrowRight size={17} aria-hidden="true"/>
    </button>
  ) : createdReceipt && bankSlipPending ? (
    <button type="button" className="travel-flow__primary" onClick={settleBankSlip} disabled={processing}>
      <Building2 size={17} aria-hidden="true" />
      {tr('Confirm sample bank settlement', 'নমুনা ব্যাংক নিষ্পত্তি নিশ্চিত করুন')}
    </button>
  ) : createdReceipt && receiptReviewOpen ? (
    <button type="button" className="travel-flow__primary" onClick={() => stepTo(3)}>
      {tr('View combined challan', 'সম্মিলিত চালান দেখুন')}<ArrowRight size={17} aria-hidden="true"/>
    </button>
  ) : createdReceipt ? null : step === 2 && !checkoutOpen ? (
    <button type="button" className="travel-flow__primary" disabled={!allCalculated}
      data-testid={allCalculated && totalAmount === 0 ? 'travel-zero-tax-finish' : undefined}
      onClick={() => {
        const zeroPayable = totalAmount === 0;
        const problem=validateTravelDetails() ?? validatePassengers() ?? (zeroPayable ? null : validateReceiptContact());
        if(problem){showError(problem);if(!zeroPayable && !receiptMobileComplete)
          requestAnimationFrame(()=>document.getElementById('travel-mobile')?.focus());return;}
        if (zeroPayable) { setZeroTaxReviewFinished(true); stepTo(3); return; }
        setCheckoutOpen(true);
      }}>
      {allCalculated && totalAmount === 0
        ? tr('Finish no-tax review', 'করবিহীন পর্যালোচনা শেষ করুন')
        : tr('Make Payment','পেমেন্ট করুন')}<ArrowRight size={17} aria-hidden="true"/>
    </button>
  ) : step === 2 ? (
    <button type="button" className="travel-flow__primary" disabled={!canSubmit} onClick={() => {
      const form = document.getElementById('travel-tax-form');
      if (form instanceof HTMLFormElement) form.requestSubmit();
    }}>
      <FileText size={17} aria-hidden="true"/>
      {processing ? tr('Processing…', 'প্রক্রিয়াধীন…') : tr('Confirm sample payment', 'নমুনা পেমেন্ট নিশ্চিত করুন')}
    </button>
  ) : (
    <button type="button" className="travel-flow__primary"
      aria-label={step === 0 ? tr('Continue to travel details','ভ্রমণের তথ্য দিতে এগিয়ে যান') : tr('Continue to review','পেমেন্ট পর্যালোচনায় যান')}
      disabled={step === 0 && !canContinueToTravel} onClick={continueStep}>
      <span className="travel-flow__action-long">{step === 0 ? tr('Continue to travel details','ভ্রমণের তথ্য দিতে এগিয়ে যান')
        : tr('Continue to review', 'পেমেন্ট পর্যালোচনায় যান')}</span>
      <span className="travel-flow__action-short" aria-hidden="true">{tr('Continue', 'এগিয়ে যান')}</span>
      <ArrowRight size={17} aria-hidden="true"/>
    </button>
  );

  const receiptOwner=authenticatedUser?.id ??
    (previewAccount&&activePreviewSession()?.profileId===previewAccount.id?previewAccount.id:null);
  let receiptReuse:PaymentReuse|null=null;
  if(receiptOwner&&createdReceipt?.paymentTransactionId&&!bankSlipPending){
    try{receiptReuse=reuseRecordedPayment([createdReceipt],receiptOwner,null,
      createdReceipt.batchId??createdReceipt.paymentTransactionId);}catch{/* Unsafe original cannot be repeated. */}
  }
  const ownedReceiptActions=Boolean(receiptOwner&&createdReceipt?.paymentTransactionId&&!bankSlipPending);
  const applyReceiptCorrection=createdReceipt&&ownedReceiptActions?()=>{
    navigate('corrections',{originalReference:createdReceipt.challanNo,applyForCorrection:Boolean(previewAccount)});
  }:undefined;
  // Preserve the shared receipt/modal action owner and full-width receipt.
  if (embedded && createdReceipt && !bankSlipPending && !receiptReviewOpen) {
    return <div className="payment-receipt-details payment-flow-embedded payment-flow-embedded--receipt" lang={language}>
      <button data-testid="travel-receipt-back" type="button" className="sr-only"
        onClick={() => stepTo(2)}>{tr('Return to review', 'পর্যালোচনায় ফিরুন')}</button>
      <ReceiptView receipt={createdReceipt} embedded compactWalkInLayout transactionActions={ownedReceiptActions}
        postReceiptInvitation={!authenticatedUser && !previewAccount && !skipPostPaymentLogin
          ? <aside className="walkin-postpayment-login no-print" data-testid="walkin-postpayment-login"
              aria-label={tr('Optional sign in', 'ঐচ্ছিক সাইন ইন')}>
              <div className="walkin-postpayment-login__copy">
                <strong>{tr('Want easier access to your payment history?', 'আপনার পেমেন্ট রেকর্ড পরে দেখতে চান?')}</strong>
                <p>{tr('Sign in to view payments and challans saved to your account. This walk-in receipt is not automatically linked to an account.',
                  'সাইন ইন করলে অ্যাকাউন্টের সংরক্ষিত পেমেন্ট ও চালান দেখতে পারবেন। এই ওয়াক-ইন রসিদ স্বয়ংক্রিয়ভাবে কোনো অ্যাকাউন্টে যুক্ত হবে না।')}</p>
              </div>
              <div className="walkin-postpayment-login__actions">
                <button type="button" className="walkin-postpayment-login__signin"
                  onClick={() => { setPaymentServiceChoiceOpen(false); navigate('taxpayer_login'); }}>
                  {tr('Sign in','সাইন ইন')} <ArrowRight size={16} aria-hidden="true"/>
                </button>
                <button type="button" className="walkin-postpayment-login__skip"
                  onClick={() => setSkipPostPaymentLogin(true)}>
                  {tr('Continue without signing in','সাইন ইন ছাড়াই চালিয়ে যান')}
                </button>
              </div>
            </aside>
          : undefined}
        onPayAgain={receiptReuse?()=>startPaymentReuse(receiptReuse!):undefined}
        onApplyForCorrection={applyReceiptCorrection}/>
    </div>;
  }

  return (
    <div className={'travel-flow' + (step === 2 ? ' payment-flow-embedded--unified' : '') + (step === 0 && !createdReceipt ? ' travel-flow--identity' : '') + (bn ? ' font-bengali' : '')} lang={language} data-step={step}
      data-receipt-review={receiptReviewOpen && !!createdReceipt ? 'true' : undefined}>
      <div className="travel-flow__main">
        {!embedded && <h1 className="travel-flow__standalone-title">{tr('Travel tax', 'ভ্রমণ কর')}</h1>}
        {!embedded && <nav className="travel-flow__steps" aria-label={tr('Travel tax steps', 'ভ্রমণ করের ধাপ')}>
          {[
            tr('Passenger Information','যাত্রীর তথ্য'), tr('Travel Details','ভ্রমণের তথ্য'),
            tr('Final Preview','চূড়ান্ত পর্যালোচনা'),
          ].map((name, idx) => (
            <button key={name} type="button" disabled={idx > step || !!createdReceipt}
              className={'travel-flow__step' + (idx === step ? ' travel-flow__step--current' : '')}
              aria-current={idx === step ? 'step' : undefined} onClick={() => stepTo(idx as 0 | 1 | 2 | 3)}>
              <span className="travel-flow__step-count">{idx + 1}</span><p>{name}</p>
            </button>
          ))}
        </nav>}
        <form id="travel-tax-form" onSubmit={submit} noValidate>
          {sourcePaymentId && !createdReceipt && !zeroTaxReviewFinished && <p role="status" data-testid="travel-pay-again-notice"
            className="rounded-lg border border-taxpay-border bg-taxpay-light px-3 py-2 text-sm text-taxpay-dark">
            {tr('Copied from previous travel payment (reference: ','আগের ভ্রমণ করের পেমেন্ট কপি করা হয়েছে (রেফারেন্স: ')}
            <strong className="break-all">{sourcePaymentId}</strong>.{' '}
            {tr('The original payment remains unchanged. Confirm each passenger again, enter passport and date of birth, and choose a new travel date before paying.',
              'মূল পেমেন্ট অপরিবর্তিত থাকবে। পরিশোধের আগে প্রতিটি যাত্রীর পাসপোর্ট ও জন্মতারিখ পুনরায় দিন, যাচাই করুন এবং নতুন ভ্রমণের তারিখ নির্বাচন করুন।')}
          </p>}
          {error && <p className="travel-flow__error" id="travel-tax-error" role="alert" tabIndex={-1}>{error}</p>}
          {(authenticatedUser || previewAccount || unsignedGuestDrafts) && !createdReceipt &&
            <AccountPaymentDraftControls service="TRAVEL_TAX" language={language}
              allowGuest={unsignedGuestDrafts}
              snapshot={snapshotTravelDraft} restore={restoreTravelDraft}
              selectedDraft={selectedAccountDraft} onSelectedDraft={setSelectedAccountDraft}
              guardOnly={step >= 2} actionTarget={embedded ? draftFooterTarget : undefined} />}

          {step === 0 && !createdReceipt && <div className="travel-passenger-workspace"
            aria-label={tr('Passenger information','যাত্রীর তথ্য')} data-testid="travel-passenger-list">
            <section className="travel-passenger-workspace__editor">
              <h2>{tr('Add passenger','যাত্রী যোগ করুন')}</h2>
              {pendingPassenger && passengers.length > 1 && !editBackup &&
                <button className="travel-flow__edit travel-passenger-workspace__cancel-editor"
                  type="button" onClick={()=>removeTravelPassenger(pendingPassenger)}>
                  {tr('Cancel adding','যোগ করা বাতিল করুন')}
                </button>}
              <p className="travel-passenger-workspace__help">{tr('Enter a passport number and search.','পাসপোর্ট নম্বর লিখে অনুসন্ধান করুন।')}</p>
              {pendingPassenger ? (() => {
                const item=pendingPassenger, index=passengers.findIndex(p=>p.id===item.id);
                return <div className="travel-passenger-workspace__entry" data-passenger-id={item.id} data-complete="false">
                  {renderPassengerEditor(item,index)}
                  {passengerIssue?.id===item.id && <p id={'travel-passenger-issue-'+item.id}
                    className="travel-flow__inline-error" role="alert">{passengerIssue.message}</p>}
                  {editBackup?.passenger.id===item.id && <button className="travel-flow__edit" type="button"
                    onClick={cancelPassengerEdit}>{tr('Cancel edit','সম্পাদনা বাতিল')}</button>}
                  {item.nationality === 'FOREIGN' && canShowAddPassenger && pendingConfirmationId === item.id &&
                    <div className="travel-flow__confirm-row">
                      <button type="button" className="travel-flow__add-member travel-flow__confirm-passenger"
                        onClick={() => confirmCheckedPassenger(item)}>
                        <Plus size={17} aria-hidden="true"/>{tr('Add passenger','যাত্রী যোগ করুন')}
                      </button>
                    </div>}
                </div>;
              })() : <div className="travel-passenger-workspace__blank">
                <div className="travel-flow__passenger-tabs" role="group">
                  <button type="button" className="travel-flow__passenger-tab travel-flow__passenger-tab--active"
                    onClick={()=>beginNewPassenger('BD')}>{tr('Bangladeshi','বাংলাদেশি')}</button>
                  <button type="button" className="travel-flow__passenger-tab"
                    onClick={()=>beginNewPassenger('FOREIGN')}>{tr('Foreign','বিদেশি')}</button>
                </div>
                <div className="travel-flow__passport-row">
                  <div className="travel-flow__field">
                    <label htmlFor="travel-new-passport">{tr('Passport number','পাসপোর্ট নম্বর')} *</label>
                    <input id="travel-new-passport" value="" placeholder={tr('Enter passport number','পাসপোর্ট নম্বর লিখুন')}
                      onFocus={()=>beginNewPassenger('BD')} onChange={event=>beginNewPassenger('BD',event.target.value)}/>
                  </div>
                  <button type="button" disabled className="travel-passenger-workspace__search">
                    <Search size={17}/>{tr('Search','অনুসন্ধান')}</button>
                </div>
                <div className="travel-passenger-workspace__empty-search"><Search size={23}/>
                  <span>{tr('Search another passport to add a passenger.',
                    'আরেকজন যাত্রী যোগ করতে পাসপোর্ট অনুসন্ধান করুন।')}</span></div>
              </div>}
              
            </section>
            <SelectedIdentityRail prefix="travel-passenger-workspace"
              label={tr('Passengers in this payment','এই পেমেন্টে যাত্রীরা')}
              count={confirmedPassengerIds.length} titleIconSize={18} emptyIconSize={19}
              emptyLabel={tr('No passengers added','কোনো যাত্রী যোগ করা হয়নি')}>
                {passengers.filter(item=>confirmedPassengerIds.includes(item.id)).map((item,i)=>
                  <div className="travel-passenger-workspace__person" key={item.id} data-passenger-id={item.id} data-complete="true">
                    <span className="travel-passenger-workspace__avatar">{i+1}</span>
                    <div className="travel-passenger-workspace__copy">
                      <button type="button" onClick={()=>beginPassengerEdit(item)}
                        aria-label={tr('Edit ','সম্পাদনা ')+item.name}>
                        <strong>{item.name} · {item.nationality==='BD'?tr('Bangladeshi','বাংলাদেশি'):tr('Foreign','বিদেশি')}</strong>
                      </button>
                      <small>{maskPassport(item.passport)}</small>
                    </div>
                    <button className="travel-passenger-workspace__remove" type="button"
                      aria-label={tr('Remove ','সরান ')+item.name}
                      onClick={()=>removeTravelPassenger(item)}>
                      <Trash2 size={17}/></button>
                  </div>)}
            </SelectedIdentityRail>
          </div>}

          {step === 1 && !createdReceipt && <section className="travel-flow__panel" aria-label={tr('Travel details', 'ভ্রমণের তথ্য')}>
            <PaymentFormSection number={2} title={tr('Travel details', 'ভ্রমণের তথ্য')} hideHeading={embedded}>
              <div className="travel-flow__field-group" id="travel-mode-section">
                <p className="travel-flow__field-title">{tr('Travel mode','যাতায়াতের মাধ্যম')} *</p>
                <fieldset id="travel-tax-route-results" className="travel-flow__routes">
                  <legend className="sr-only">{tr('Travel mode','যাতায়াতের মাধ্যম')}</legend>
                  {routeOptions.map(item => {
                    const index = item.value === 'LAND' ? 0 : 1;
                    return <label key={item.value} htmlFor={'travel-tax-route-' + index}
                      className={'travel-flow__route' + (mode === item.value ? ' travel-flow__route--selected' : '')}>
                      <span className="travel-flow__route-copy">
                        <strong>{bn ? item.bn : item.en}</strong>
                      </span>
                      <input id={'travel-tax-route-' + index} name="travel-tax-route" type="radio"
                        checked={mode === item.value} onChange={() => {
                          // Keep each mode's last valid port selection when toggling back.
                          // The incompatible mode's port is never used in the calculation or payload.
                          setMode(item.value); setError(''); setAcknowledged(false);
                        }}/>
                    </label>;
                  })}
                </fieldset>
              </div>
              <div className="travel-flow__fields travel-flow__field-group">
                {mode === 'LAND' ? <div key="land" className="travel-flow__field travel-flow__mode-field">
                  <label htmlFor="travel-port">{tr('Departure land port','স্থলবন্দর')} *</label>
                  <select id="travel-port" value={port} onChange={e => { setPort(e.target.value); setError(''); setAcknowledged(false); }}>
                    <option value="">{tr('Select departure port','বন্দর নির্বাচন করুন')}</option>
                    {LAND_PORT_NAMES.map(name => <option key={name} value={name}>{name}</option>)}
                  </select>
                  <p className="travel-flow__field-hint">{tr('Historical reference ports; current operation must be confirmed.',
                    'ঐতিহাসিক বন্দরের তালিকা; বর্তমান কার্যক্রম যাচাই প্রয়োজন।')}</p>
                </div> : <div key="water" className="travel-flow__field travel-flow__mode-field">
                  <label htmlFor="travel-water-port">{tr('Departure water port','নৌবন্দর')} *</label>
                  <input id="travel-water-port" value={waterPort} onChange={e => { setWaterPort(e.target.value); setError(''); setAcknowledged(false); }}
                    placeholder={tr('Enter water port','নৌবন্দর লিখুন')} list="travel-water-port-options"/>
                  <datalist id="travel-water-port-options"><option value="Chattogram"/><option value="Mongla"/><option value="Payra"/></datalist>
                  <p className="travel-flow__field-hint">{tr('Water-port catalogue pending approval.','নৌবন্দরের তালিকা অনুমোদনের অপেক্ষায়।')}</p>
                </div>}
                <div className="travel-flow__field">
                  <label htmlFor="travel-destination">{tr('Destination','গন্তব্য')} *</label>
                  <input id="travel-destination" list="travel-destinations" value={destination}
                    onChange={e => { setDestination(e.target.value); setError(''); setAcknowledged(false); }} placeholder={tr('Select or enter destination','গন্তব্য নির্বাচন বা লিখুন')}/>
                  <datalist id="travel-destinations"><option value="India"/><option value="Nepal"/><option value="Bhutan"/><option value="Myanmar"/></datalist>
                </div>
                <div className="travel-flow__field travel-flow__field--full">
                  <label htmlFor="travel-departure-date">{tr('Travel date','ভ্রমণের তারিখ')} *</label>
                  <input id="travel-departure-date" type="date" min={dhakaTravelDate()} value={travelDate} onChange={e => { setTravelDate(e.target.value); setError(''); setAcknowledged(false); }}/>
                </div>
              </div>
              <button type="button" className="travel-flow__edit-travel" onClick={() => stepTo(0)}>
                <Pencil size={15} aria-hidden="true"/>{tr('Edit passengers', 'যাত্রী সম্পাদনা')} ({passengers.length})
              </button>
            </PaymentFormSection>
          </section>}

          {step === 2 && !checkoutOpen && (!createdReceipt || receiptReviewOpen) && (
            <section className="payment-review payment-review--unified-v5 travel-flow__unified-preview"
              data-testid="travel-unified-final-preview" aria-label={tr('Final Preview','চূড়ান্ত পর্যালোচনা')}>
              <div className="payment-review__main">
                <section className="payment-review__panel unified-v3-review" aria-labelledby="travel-unified-review-title">
                  <div className="payment-review__section-title unified-v3-review__heading">
                    <div>
                      <h2 id="travel-unified-review-title">{tr('Payment details','পেমেন্টের বিবরণ')}</h2>
                      <p>{allCalculated && totalAmount === 0
                        ? tr('Check passenger and travel details. No tax is payable under the current preview calculation.',
                            'যাত্রী ও ভ্রমণের তথ্য যাচাই করুন। বর্তমান প্রিভিউ হিসাব অনুযায়ী কর প্রদেয় নেই।')
                        : tr('Check all passengers, travel details and the combined amount before checkout.',
                            'পেমেন্টের আগে সব যাত্রী, ভ্রমণের তথ্য ও মোট পরিমাণ যাচাই করুন।')}</p>
                    </div>
                    {!createdReceipt && <div className="unified-v3-review__actions">
                      <button type="button" onClick={() => stepTo(0)}><Pencil size={14} aria-hidden="true"/>
                        {tr('Edit passengers','যাত্রী সম্পাদনা')} ({passengers.length})</button>
                      <button type="button" onClick={() => stepTo(1)}><Pencil size={14} aria-hidden="true"/>
                        {tr('Edit travel details','ভ্রমণের তথ্য সম্পাদনা')}</button>
                    </div>}
                  </div>
                  <dl className="travel-flow__review travel-flow__review--unified">
                    <div><dt>{tr('Travel','ভ্রমণ')}</dt><dd>{mode === 'LAND' ? tr('By land','স্থলপথে') : tr('By water','নৌপথে')}</dd></div>
                    <div><dt>{tr('Departure port','যাত্রা বন্দর')}</dt><dd>{selectedPort}</dd></div>
                    <div><dt>{tr('Destination / date','গন্তব্য / তারিখ')}</dt><dd>{destination} / {travelDate}</dd></div>
                  </dl>
                  <div className="unified-v3-review__table-wrap travel-flow__table-wrap taxpay-table-viewport">
                    <TaxPayUnifiedTable className="unified-v3-review__table travel-flow__passenger-table taxpay-unified-table"
                      aria-label={tr('Passenger-wise travel tax amounts','যাত্রীভিত্তিক ভ্রমণ কর')}>
                      <thead><tr>
                        <th scope="col">{tr('Passenger','যাত্রী')}</th>
                        <th scope="col">{tr('Passport','পাসপোর্ট')}</th>
                        <th scope="col">{tr('Age','বয়স')}</th>
                        <th scope="col" className="text-right">{tr('Tax','কর')}</th>
                      </tr></thead>
                      <tbody>{passengers.map(item => <tr key={item.id}>
                        <td>{item.name}</td><td>{maskPassport(item.passport)}</td>
                        <td>{assessTravelPassenger(item, unitRate, travelDate)?.age ?? '—'}</td>
                        <td className="text-right tabular-nums"><TravelCurrency amount={assessTravelPassenger(item, unitRate, travelDate)?.amount ?? 0} language={language}/></td>
                      </tr>)}</tbody>
                      <tfoot><tr><th scope="row" colSpan={3}>{tr('Combined payable','মোট প্রদেয়')}</th>
                        <td className="text-right tabular-nums"><TravelCurrency amount={totalAmount} language={language}/></td></tr></tfoot>
                    </TaxPayUnifiedTable>
                  </div>
                </section>
                {totalAmount > 0 && <section className="payment-review__panel payment-review__payer travel-flow__unified-contact"
                    aria-label={tr('Receipt contact','রসিদের যোগাযোগ')} data-testid="travel-preview-receipt-contact">
                  <div className="payment-review__section-title">
                    <div><h2>{tr('Payer contact','পরিশোধকারীর যোগাযোগ')}</h2>
                      <p>{tr('Provide the mobile number for this saved payment record.',
                        'সংরক্ষিত পেমেন্ট রেকর্ডের জন্য মোবাইল নম্বর দিন।')}</p></div>
                  </div>
                  <div className="travel-flow__field">
                    <label htmlFor="travel-mobile">{tr('Mobile number for receipt','রসিদের জন্য মোবাইল নম্বর')} *</label>
                    {createdReceipt ? <p className="travel-flow__contact-readonly">{phone}</p> : <>
                      <input id="travel-mobile" type="tel" inputMode="numeric" maxLength={11}
                        autoComplete="tel-national" value={phone} placeholder="01XXXXXXXXX"
                        aria-invalid={phone.length > 0 && !receiptMobileComplete}
                        aria-describedby={phone.length > 0 && !receiptMobileComplete ? 'travel-mobile-error' : undefined}
                        onChange={event => { setPhone(event.target.value.replace(/\D/g, '').slice(0, 11)); setError(''); setAcknowledged(false); }}/>
                      {phone.length > 0 && !receiptMobileComplete && <p id="travel-mobile-error" className="travel-flow__inline-error" role="status">
                        {tr('Enter a valid 11-digit mobile number starting with 01.', '০১ দিয়ে শুরু হওয়া ১১ সংখ্যার বৈধ মোবাইল নম্বর দিন।')}
                      </p>}
                    </>}
                  </div>
                </section>}
              </div>
            </section>)}

          {step === 2 && checkoutOpen && !createdReceipt && (
            <section className="payment-review payment-review--unified-v5 unified-v5-payment-channel travel-flow__unified-checkout"
              data-testid="travel-payment-channel-screen" aria-label={tr('Payment channel','পেমেন্ট চ্যানেল')}>
              <div className="payment-review__main">
                <section className="payment-review__panel">
                  <div className="payment-review__section-title">
                    <div><h2>{tr('Choose payment channel','পেমেন্ট চ্যানেল বেছে নিন')}</h2>
                      <p>{tr('Choose online payment or a bank branch.','অনলাইন পেমেন্ট অথবা ব্যাংক শাখা বেছে নিন।')}</p></div>
                  </div>
                  <PaymentMethodSelector language={language} channel={paymentChannel} methodGroup={methodGroup} method={paymentMethod}
                    onChannelChange={(channel, method) => { setPaymentChannel(channel); setPaymentMethod(method); setMethodGroup(null); setAcknowledged(false); }}
                    onGroupChange={group => { setMethodGroup(group); setPaymentMethod(null); setAcknowledged(false); }}
                    onMethodChange={method => { setPaymentMethod(method); setAcknowledged(false); }}
                    simulateDecline={simulateDecline} onSimulateDeclineChange={setSimulateDecline}/>
                  <div className="unified-v5-review-total" data-testid="travel-checkout-total"
                    aria-label={tr('Combined travel tax','সম্মিলিত ভ্রমণ কর')}>
                    <div className="unified-v5-review-total__row">
                      <span>{tr('Calculated total','হিসাবকৃত মোট')} · {passengers.length} {tr('passenger(s)','যাত্রী')}</span>
                      <output aria-label={tr('Combined payable','মোট প্রদেয়')}><TravelCurrency amount={totalAmount} language={language}/></output>
                    </div>
                    {amountWords && <p data-testid="travel-checkout-total-in-words">{amountWords}</p>}
                    <p>{tr('Preview calculation — payment and settlement are not yet confirmed.',
                      'প্রিভিউ হিসাব — পরিশোধ ও নিষ্পত্তি এখনো নিশ্চিত নয়।')}</p>
                  </div>
                  {paymentChannel && paymentMethod && <label className="payment-review__ack">
                    <input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)}/>
                    <span>{tr('I confirm the travel information, all passengers and the combined amount.',
                      'ভ্রমণের তথ্য, সকল যাত্রী এবং মোট টাকার পরিমাণ নিশ্চিত করছি।')}</span>
                  </label>}
                  {!paymentMethod && <p className="travel-flow__field-hint" role="status">
                    {tr('Choose a payment channel and method to continue.','এগিয়ে যেতে পেমেন্ট চ্যানেল ও পদ্ধতি বেছে নিন।')}</p>}
                </section>
              </div>
            </section>)}

          {step === 3 && zeroTaxReviewFinished && !createdReceipt &&
            <section className="travel-flow__panel travel-flow__zero-tax-result"
              data-testid="travel-zero-tax-result" aria-label={tr('No tax payable in preview', 'প্রিভিউ অনুযায়ী কর প্রদেয় নেই')}>
              <h3>{tr('No tax payable in this review', 'এই পর্যালোচনায় কর প্রদেয় নেই')}</h3>
              <p role="status">{tr('The current preview calculation is zero. No payment was made, and no challan or receipt was issued.',
                'বর্তমান প্রিভিউতে হিসাব শূন্য। কোনো পেমেন্ট করা হয়নি এবং কোনো চালান বা রসিদ ইস্যু হয়নি।')}</p>
              <dl className="travel-flow__review">
                <div><dt>{tr('Passengers', 'যাত্রী')}</dt><dd>{passengers.length}</dd></div>
                <div><dt>{tr('Travel date', 'ভ্রমণের তারিখ')}</dt><dd>{travelDate}</dd></div>
                <div><dt>{tr('Calculated total', 'মোট হিসাব')}</dt><dd><TravelCurrency amount={0} language={language}/></dd></div>
              </dl>
              <button type="button" className="travel-flow__edit-travel" onClick={()=>stepTo(2)}>
                <Pencil size={15} aria-hidden="true"/>{tr('Review details again', 'তথ্য আবার পর্যালোচনা করুন')}
              </button>
            </section>}

          {step === 3 && bankSlipPending && createdReceipt && <section className="travel-flow__panel" aria-label={tr('Bank slip','ব্যাংক স্লিপ')}>
            <header className="travel-flow__section-header"><h3>{tr('Bank slip pending','ব্যাংক স্লিপ অপেক্ষমাণ')}</h3></header>
            <p role="status">{tr('No actual bank or Treasury settlement has occurred. You can finish the sample journey with the button below.',
              'বাস্তব ব্যাংক বা ট্রেজারি নিষ্পত্তি হয়নি। নিচের বোতামে শুধু নমুনা প্রবাহ শেষ হবে।')}</p>
            <dl className="travel-flow__review">
              <div><dt>{tr('Reference','রেফারেন্স')}</dt><dd>{createdReceipt.challanNo}</dd></div>
              <div><dt>{tr('Combined payable','মোট প্রদেয়')}</dt><dd><TravelCurrency amount={totalAmount} language={language}/></dd></div>
            </dl>
          </section>}

          {step === 3 && createdReceipt && !bankSlipPending && !embedded && <ReceiptView receipt={createdReceipt} embedded onBack={() => navigate('landing')}
            transactionActions={ownedReceiptActions}
            onPayAgain={receiptReuse?()=>startPaymentReuse(receiptReuse!):undefined}
            onApplyForCorrection={applyReceiptCorrection}/>}
          {!embedded && step === 2 && !createdReceipt && <div className="travel-flow__standalone-actions" data-testid="travel-standalone-stage-actions">{primaryAction}</div>}
          {!embedded && !createdReceipt && step > 0 && <button className="travel-flow__back" type="button"
            onClick={() => stepTo((step-1) as 0 | 1 | 2 | 3)}>
            <ArrowLeft size={16} aria-hidden="true"/>{tr('Back','ফিরুন')}
          </button>}
        </form>
      </div>

      <aside className="travel-flow__summary" aria-label={tr('Payment calculation','পেমেন্টের হিসাব')}>
        <div className="travel-flow__summary-title"><CreditCard size={18} aria-hidden="true"/>
          <h3>{tr('Payment calculation','পেমেন্টের হিসাব')}</h3>
        </div>
        <p className="travel-flow__summary-label">{tr('Calculated total','হিসাবকৃত মোট')}</p>
        <strong className="travel-flow__total travel-flow__total--with-words" data-testid="travel-payment-total">
          {allCalculated ? <TravelCurrency amount={totalAmount} language={language}/> : validAssessments.length > 0 && travelDate ? <TravelCurrency amount={provisionalAmount} language={language}/> : '—'}
        </strong>
        <p className="travel-flow__rate-caption">{tr('Preview rates', 'প্রিভিউ হার')}</p>
        <p className="travel-flow__amount-words" data-testid="travel-total-in-words">
          {allCalculated ? amountWords : validAssessments.length > 0 && travelDate
            ? tr('Provisional subtotal — not yet payable. Correct all passenger details.', 'অস্থায়ী উপমোট — এখনো পরিশোধযোগ্য নয়। সব যাত্রীর তথ্য সংশোধন করুন।')
            : tr('Complete passenger and travel details to calculate.', 'হিসাবের জন্য যাত্রী ও ভ্রমণের তথ্য পূরণ করুন।')}
        </p>
        <dl className="travel-flow__summary-list">
          <div><dt>{tr('Mode','মাধ্যম')}</dt><dd>{mode === 'LAND' ? tr('Land','স্থল') : tr('Water','নৌ')}</dd></div>
          <div><dt>{tr('Passengers','যাত্রী')}</dt><dd>{passengers.length}</dd></div>
          <div><dt>{tr('Status','অবস্থা')}</dt><dd>{createdReceipt ? tr('Sample record','নমুনা রেকর্ড') : allCalculated ? tr('Calculated for review','পর্যালোচনার জন্য হিসাব করা') : invalidPassengerIds.size > 0 ? tr('Passenger details need correction','যাত্রীর তথ্য সংশোধন প্রয়োজন') : tr('Awaiting travel details','ভ্রমণের তথ্যের অপেক্ষায়')}</dd></div>
        </dl>
        <div className="travel-flow__age-breakdown" role="status" aria-live="polite" tabIndex={embedded ? 0 : undefined}>
          {assessments.map(({passenger, assessment}, index) =>
            <div key={passenger.id} className="travel-flow__age-row">
              <p><strong>{passenger.name || tr('Passenger ', 'যাত্রী ') + (index + 1)}</strong>
                <strong>{assessment && !invalidPassengerIds.has(passenger.id) ? <TravelCurrency amount={assessment.amount} language={language}/> : '—'}</strong></p>
              <p>{assessment && !invalidPassengerIds.has(passenger.id) ? ageExplanation(assessment.age)
                : tr('Tax will calculate after passport and age information are available.',
                     'পাসপোর্ট ও বয়সের তথ্য পাওয়া গেলে কর হিসাব হবে।')}</p>
            </div>)}

        </div>
        {!embedded && step !== 2 && primaryAction}
      </aside>

      {embedded && modalFooterTarget && createPortal(
        <div className="travel-flow__footer-content">
          {step > 0 && !checkoutOpen && <details key={step} className="travel-flow__mobile-summary" data-testid="mobile-payment-calculation">
            <summary><p>{tr('Payment calculation','পেমেন্টের হিসাব')}</p>
              <strong>{allCalculated ? <TravelCurrency amount={totalAmount} language={language}/> : validAssessments.length > 0 && travelDate ? <TravelCurrency amount={provisionalAmount} language={language}/> : '—'}</strong></summary>
            <dl>
              <div><dt>{tr('Passengers','যাত্রী')}</dt><dd>{passengers.length}</dd></div>
              <div><dt>{tr('Mode','মাধ্যম')}</dt><dd>{mode === 'LAND' ? tr('Land','স্থল') : tr('Water','নৌ')}</dd></div>
              <div><dt>{tr('Status', 'অবস্থা')}</dt><dd>{allCalculated ? tr('Ready for review', 'পর্যালোচনার জন্য প্রস্তুত') : tr('Incomplete', 'অসম্পূর্ণ')}</dd></div>
              <div><dt>{tr('Age-based calculation','বয়সভিত্তিক হিসাব')}</dt><dd>{assessments.map(({passenger,assessment}) => (passenger.name || tr('Passenger','যাত্রী')) + ': ' + (assessment ? ageExplanation(assessment.age) : tr('Pending','অপেক্ষমাণ'))).join(' · ')}</dd></div>
              <div><dt>{tr('Total in words','কথায়')}</dt><dd data-testid="travel-mobile-total-in-words">{amountWords || '—'}</dd></div>
            </dl>
          </details>}
          <PaymentJourneyFooter className="travel-flow__footer-actions"
            leading={(authenticatedUser || previewAccount || unsignedGuestDrafts) && !createdReceipt && step < 2
              ? <div className="payment-flow-embedded__draft-actions" ref={setDraftFooterTarget} />
              : null}
            next={primaryAction}/>
        </div>, modalFooterTarget)}
    </div>
  );
};