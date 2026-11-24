import {maskTinForDisplay} from '../../services/tinDisplay';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Printer,
  Download,
  Copy,
  Info,
  RotateCcw,
  FilePenLine
} from 'lucide-react';
import { ChallanReceipt } from '../../types/tax';
import { formatCurrency } from '../../services/numberFormat';
import { useTaxState } from '../../services/taxState';
import {beneficiaryFinalTagLabel,type BeneficiaryRelation} from '../../services/beneficiaryTags';
import { MASTER_PAYMENT_HEADS, CATEGORY_LABELS } from '../../data/paymentHeads';
import { downloadDisplayedCertificate } from '../../services/receiptDocumentExport';
import { groupReceiptAllocations } from '../../services/receiptAllocationGroups';
import { TaxPayModal, TaxPayModalFooterTarget } from '../ui/TaxPayModal';
import { PaymentCertificateDocument } from './PaymentCertificateDocument';
import { canViewPaymentCertificate } from '../../services/paymentCertificateModel';

interface ReceiptViewProps {
  receipt: ChallanReceipt;
  certificate?: boolean;
  /** Display-only details for a clearly labelled synthetic Gift Tax preview. */
  giftSimulationDetails?: {doneeName:string;doneeTin:string;relationship:string;giftAmount:number;giftDate:string;description:string;remarks:string};
  simulationServiceName?: string;
  onBack?: () => void;
  embedded?: boolean;
  backLabel?: string;
  /** Optional receipt-only restart, aligned opposite download and print. */
  onNewPayment?: () => void;
  /** Transaction actions are offered only by the account-owned receipt reader. */
  transactionActions?: boolean;
  onPayAgain?: () => void;
  onApplyForCorrection?: () => void;
  payAgainUnavailableReason?: string;
  payAgainTestId?: string;
  /** Secondary receipts in a batch must not create extra modal footer controls. */
  suppressFooterActions?: boolean;
  /** Compact walk-in document reader; other account/history readers remain unchanged. */
  compactWalkInLayout?: boolean;
  /** Authenticated Activity detail chrome only. Printed receipt and payment contracts are unchanged. */
  accountRecordView?: boolean;
  activeDocument?: 'receipt' | 'certificate';
  onDocumentChange?: (next: 'receipt' | 'certificate') => void;
  /** Optional post-payment invitation. Excluded from printed or downloaded receipt. */
  postReceiptInvitation?: React.ReactNode;
}

export const ReceiptView: React.FC<ReceiptViewProps> = ({ receipt, onBack, embedded = false, onNewPayment, certificate = false,
  giftSimulationDetails:giftSimulationDetailsProp, simulationServiceName,
  transactionActions = false, onPayAgain, onApplyForCorrection, payAgainUnavailableReason,
  payAgainTestId = 'receipt-pay-again', suppressFooterActions = false,
  compactWalkInLayout = false, accountRecordView = false, activeDocument, onDocumentChange, postReceiptInvitation }) => {
  const { language, navigate } = useTaxState();
  const gift=receipt.giftDetails;
  const giftSimulationDetails=giftSimulationDetailsProp??(gift&&receipt.paymentCategory==='GIFT_TAX'?{
    doneeName:gift.donee.name,doneeTin:gift.donee.tin,relationship:beneficiaryFinalTagLabel(gift.donee.tag,gift.donee.relationship as BeneficiaryRelation|null,language,gift.donee.otherLabel)??'—',
    giftAmount:gift.giftAmountMinor/100,giftDate:gift.giftDate,description:gift.description,remarks:gift.remarks,
  }:undefined);
  const [showCertificate, setShowCertificate] = useState(false);
  const canViewCertificate = canViewPaymentCertificate(receipt);
  const isCertificate = certificate || (canViewCertificate && (activeDocument ? activeDocument === 'certificate' : showCertificate));
  const changeDocument = (next: 'receipt' | 'certificate') => {
    setDownloadError(false);
    if (onDocumentChange) onDocumentChange(next);
    else setShowCertificate(next === 'certificate');
  };
  const showReceiptTransactionActions = transactionActions && !isCertificate;
  const paperRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  async function downloadCertificate() {
    if (!paperRef.current) return;
    if (isCertificate && !canViewCertificate) {
      setDownloadError(true);
      return;
    }
    setDownloading(true);
    setDownloadError(false);
    try {
      await downloadDisplayedCertificate(receipt, paperRef.current, isCertificate);
    } catch {
      setDownloadError(true);
    } finally {
      setDownloading(false);
    }
  }
  const certificateReference = isCertificate ? 'SK-PC-' + receipt.paymentTransactionId : null;
  const footerTarget = useContext(TaxPayModalFooterTarget);
  const travelPreview = receipt.paymentCategory === 'TRAVEL_TAX' && !!receipt.isSimulatedDemo;
  const recordedAt = new Date(receipt.completedAt || receipt.createdAt);
  const readableDate = Number.isNaN(recordedAt.getTime()) ? (receipt.completedAt || receipt.createdAt)
    : new Intl.DateTimeFormat(language === 'bn' ? 'bn-BD' : 'en-GB', {
      dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka',
    }).format(recordedAt);
  const bn = language === 'bn';
  useEffect(() => { if (!embedded) window.scrollTo(0, 0); }, [embedded]);
  const labels = bn ? {
    back: 'রেকর্ডে ফিরুন', print: 'রসিদ প্রিন্ট', export: 'ডাউনলোড', payAgain: 'আবার পরিশোধ', applyCorrection: 'সংশোধনের আবেদন',
    title: 'সহজকর — রসিদের বিবরণ',
    challan: 'পেমেন্ট রেফারেন্স', token: 'টোকেন নম্বর', timestamp: 'তারিখ ও সময়', copy: 'রেফারেন্স কপি করুন',
    payerDetails: 'করদাতা ও পরিশোধকারীর তথ্য', payer: 'পরিশোধকারীর নাম', tin: 'ই-টিআইএন', year: 'করবর্ষ', service: 'পেমেন্টের ধরন',
    zone: 'কর অঞ্চল', circle: 'কর সার্কেল', treasurySection: 'নিষ্পত্তির তথ্য',
    paymentMethod: 'পেমেন্ট পদ্ধতি', transaction: 'লেনদেন রেফারেন্স',
    scroll: 'ট্রেজারি স্ক্রল রেফারেন্স', pendingScroll: 'স্ক্রল রেফারেন্স নেই',
    withholdingTitle: 'উৎসে কর জমার নোটিশ', deductedFor: 'কর কর্তনগ্রহীতার টিআইএন-এর পক্ষে জমা:',
    noAgentCredit: 'এই রেকর্ডে কর কর্তনকারীর ব্যক্তিগত কর ক্রেডিট প্রতিষ্ঠিত হয় না।',
    allocations: 'করদাতাভিত্তিক পেমেন্ট বরাদ্দ', allocationTaxpayer: 'করদাতা / ই-টিআইএন', allocationAmount: 'বরাদ্দের পরিমাণ', taxpayerSubtotal: 'করদাতার মোট',
    breakdown: 'পেমেন্টের বিবরণ ও খাত', headCode: 'অর্থনৈতিক খাত কোড', description: 'খাতের বিবরণ',
    tax: 'কর (টাকা)', penalty: 'জরিমানা', surcharge: 'সারচার্জ', interest: 'সুদ', total: 'মোট (টাকা)', grandTotal: 'মোট অর্থ:',
    noAgentEntitlement: 'এজেন্টের স্বয়ংক্রিয় ক্রেডিট নয়; কর কর্তনগ্রহীতার অধিকার আলাদাভাবে যাচাই করতে হবে।'
  } : {
    back: 'Back to records', print: 'Print receipt', export: 'Download', payAgain: 'Pay Again', applyCorrection: 'Apply for Correction',
    title: 'Sohojkor — Receipt details',
    challan: 'Payment reference', token: 'Token number', timestamp: 'Date and time', copy: 'Copy reference',
    payerDetails: 'Payer and taxpayer details', payer: 'Payer name', tin: 'e-TIN', year: 'Assessment year', service: 'Payment service',
    zone: 'Taxes zone', circle: 'Taxes circle', treasurySection: 'Settlement details',
    paymentMethod: 'Payment method', transaction: 'Transaction reference',
    scroll: 'Treasury scroll reference', pendingScroll: 'No scroll reference',
    withholdingTitle: 'Withholding deposit notice', deductedFor: 'Deposit for deductee TIN:',
    noAgentCredit: 'Withholding-agent tax credit is not established by this record.',
    allocations: 'Taxpayer payment allocations', allocationTaxpayer: 'Taxpayer / e-TIN', allocationAmount: 'Allocated amount (৳)', taxpayerSubtotal: 'Taxpayer subtotal',
    breakdown: 'Payment breakdown and head classification', headCode: 'Economic head code', description: 'Head description',
    tax: 'Tax (৳)', penalty: 'Penalty', surcharge: 'Surcharge', interest: 'Interest', total: 'Total (৳)', grandTotal: 'Total amount:',
    noAgentEntitlement: 'No automatic agent credit; deductee entitlement requires separate verification.'
  };
  const paymentMethodLabels = {
    BKASH: 'bKash', NAGAD: 'Nagad', ROCKET: 'Rocket', SONALI_E_SHEBA: 'Sonali e-Sheba',
    A_CHALLAN_CARD: 'A-Challan card', BEFTN_RTGS: 'BEFTN / RTGS',
    INTERNET_BANKING: 'Internet Banking', VISA: 'Visa', MASTERCARD: 'Mastercard', BANK_BRANCH: 'Bank branch', SIMULATED: 'Payment'
  }[receipt.paymentMethod];

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
  };
  const itemName = (item: ChallanReceipt['items'][number]) => bn
    ? MASTER_PAYMENT_HEADS.find(head => head.id === item.headId && head.nameEn === item.headNameEn)?.nameBn || item.headNameEn
    : item.headNameEn;

  const allocationItems = receipt.allocationItems ?? [];
  const taxpayerGroups = groupReceiptAllocations(allocationItems);
  const batchLabel=receipt.batchId&&receipt.batchItemIndex&&receipt.batchItemCount
    ? (bn ? `ব্যাচ ${receipt.batchItemIndex} / ${receipt.batchItemCount}` : `Batch item ${receipt.batchItemIndex} of ${receipt.batchItemCount}`)
    : null;
  const defaultService = bn
    ? (CATEGORY_LABELS[receipt.paymentCategory]?.bn ?? receipt.paymentCategory)
    : (CATEGORY_LABELS[receipt.paymentCategory]?.en ?? receipt.paymentCategory);
  const serviceNames = Array.from(new Set(allocationItems
    .map(item => bn ? item.paymentServiceBn : item.paymentServiceEn)
    .filter(name => name.trim().length > 0)));
  const serviceSummary = simulationServiceName && receipt.isSimulatedDemo ? simulationServiceName : serviceNames.length ? serviceNames.join(', ') : defaultService;
  const assessmentYears = Array.from(new Set(allocationItems
    .map(item => item.assessmentYear)
    .filter(year => year.trim().length > 0)));
  const assessmentYearSummary = assessmentYears.length ? assessmentYears.join(', ') : receipt.assessmentYear;
  const taxpayerTins = Array.from(new Set(allocationItems.map(item => item.taxpayerTin || '—')));
  const taxpayerTinSummary = allocationItems.length
    ? taxpayerTins.join(', ')
    : (receipt.taxpayerTin || receipt.payerTin);

  const allocationBreakdown = allocationItems.length > 0 ? (
    <div className="receipt-view__breakdown">
      <h3 className="receipt-view__section-title">{labels.allocations}</h3>
      <div className="receipt-view__breakdown-content">
        <div className="receipt-view__cards" data-testid="receipt-allocation-mobile">
          {taxpayerGroups.map(group => (
            <article key={group.key} data-testid="receipt-taxpayer-group" className="p-3 space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{labels.allocationTaxpayer}</p>
                <p className="mt-1 break-words text-sm font-semibold text-slate-900">{group.taxpayerName}</p>
                {group.taxpayerTin && <p className="mt-1 break-all font-mono-plex text-xs text-slate-700">{group.taxpayerTin}</p>}
              </div>
              {group.items.map((item, index) => (
                <div key={group.key + ':' + index} data-testid="receipt-taxpayer-head-row" className="border-t border-slate-200 pt-3">
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <div><dt className="text-slate-700">{labels.service}</dt><dd className="mt-1 break-words font-medium text-slate-900">{bn ? item.paymentServiceBn : item.paymentServiceEn}</dd></div>
                    <div><dt className="text-slate-700">{labels.year}</dt><dd className="mt-1 font-medium text-slate-900">{item.assessmentYear}</dd></div>
                  </dl>
                  <div className="flex items-center justify-between gap-3 pt-2 font-semibold text-taxpay-dark">
                    <span>{labels.allocationAmount}</span>
                    <span className="shrink-0 font-mono-plex">{formatCurrency(item.amountMinor / 100, language)}</span>
                  </div>
                </div>
              ))}
              {group.items.length > 1 && <div className="flex items-center justify-between gap-3 border-t border-taxpay-border bg-taxpay-light px-2 py-2 text-sm font-semibold text-taxpay-dark">
                <span>{labels.taxpayerSubtotal}</span><span className="font-mono-plex">{formatCurrency(group.totalMinor / 100, language)}</span>
              </div>}
            </article>
          ))}
          <div className="flex items-center justify-between gap-3 bg-taxpay-light px-3 py-3 text-sm font-bold text-taxpay-dark">
            <span>{labels.grandTotal}</span><span className="shrink-0 font-mono-plex">{formatCurrency(receipt.totalAmount, language)}</span>
          </div>
        </div>
        <div className="receipt-view__table" data-testid="receipt-allocation-table">
          <table className="receipt-view__financial-table receipt-view__allocation-table" aria-label={labels.allocations}>
            <thead className="bg-slate-50 text-slate-600 font-semibold text-left">
              <tr>
                <th scope="col">{labels.allocationTaxpayer}</th>
                <th scope="col">{labels.service}</th>
                <th scope="col">{labels.year}</th>
                <th scope="col" className="text-right">{labels.allocationAmount}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {taxpayerGroups.flatMap(group => group.items.map((item, index) => (
                <tr key={`${group.key}:${index}`} data-testid="receipt-taxpayer-head-row" className="hover:bg-slate-50/50">
                  {index === 0 && <td rowSpan={group.items.length} className="align-top" data-testid="receipt-taxpayer-cell">
                    <div className="font-medium text-slate-900">{group.taxpayerName}</div>
                    {group.taxpayerTin && <div className="mt-1 break-all font-mono-plex text-xs text-slate-700">{group.taxpayerTin}</div>}
                    {group.items.length > 1 && <div className="mt-2 text-xs font-semibold text-taxpay-dark">{labels.taxpayerSubtotal}: {formatCurrency(group.totalMinor / 100, language)}</div>}
                  </td>}
                  <td className="receipt-view__allocation-service text-slate-800">{bn ? item.paymentServiceBn : item.paymentServiceEn}</td>
                  <td className="receipt-view__allocation-year">{item.assessmentYear}</td>
                  <td className="receipt-view__allocation-amount font-mono-plex font-bold text-slate-900">{formatCurrency(item.amountMinor / 100, language)}</td>
                </tr>
              )))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="text-right uppercase">{labels.grandTotal}</td>
                <td className="font-mono-plex text-right">{formatCurrency(receipt.totalAmount, language)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  ) : null;

  // The existing shared modal owns the action footer. The receipt supplies its controls.
  const receiptActions = (
    <div className={'receipt-view__actions no-print'+(showReceiptTransactionActions?' receipt-view__actions--transaction':'')}>
      {!compactWalkInLayout && !showReceiptTransactionActions && onBack && <button type="button" className="receipt-view__action receipt-view__action--secondary receipt-view__restart"
        onClick={onBack}>{bn ? 'পেমেন্ট নিশ্চিতকরণে ফিরুন' : 'Back to confirmation'}</button>}
      {!showReceiptTransactionActions && onNewPayment && <button type="button"
        className="receipt-view__action receipt-view__action--secondary receipt-view__restart"
        onClick={onNewPayment}>{bn ? 'নতুন পেমেন্ট' : 'New payment'}</button>}
      <div className="receipt-view__action-group">
        <button type="button" className="receipt-view__action receipt-view__action--secondary"
          disabled={downloading} onClick={downloadCertificate}>
          <Download size={18} aria-hidden="true" /><span>{labels.export}</span>
        </button>
        {showReceiptTransactionActions ? <>
          <button type="button" data-testid={payAgainTestId} data-receipt-action="pay-again"
            className="receipt-view__action receipt-view__action--secondary"
            disabled={!onPayAgain} title={!onPayAgain ? (payAgainUnavailableReason ??
              (bn?'মূল পেমেন্টের সম্পূর্ণ তথ্য পাওয়া যায়নি':'The complete original payment is unavailable')):undefined}
            onClick={onPayAgain}>
            <RotateCcw size={18} aria-hidden="true"/><span>{labels.payAgain}</span>
          </button>
          <button type="button" data-testid="receipt-apply-correction"
            className="receipt-view__action receipt-view__action--primary"
            disabled={!onApplyForCorrection}
            title={!onApplyForCorrection?(bn?'এই রেকর্ডের মালিকানা যাচাই করা যায়নি':'This receipt is not linked to a verified account'):undefined}
            onClick={onApplyForCorrection}>
            <FilePenLine size={18} aria-hidden="true"/><span>{labels.applyCorrection}</span>
          </button>
        </> : <button type="button" className="receipt-view__action receipt-view__action--primary"
          onClick={() => window.print()}>
          <Printer size={18} aria-hidden="true" /><span>{isCertificate ? (bn ? 'সনদ প্রিন্ট' : 'Print certificate') : labels.print}</span>
        </button>}
      </div>
    </div>
  );

  // The modal header owns Back. This small document switcher is content navigation,
  // not another back/close toolbar, and is excluded from document exports.
  const walkinDocuments = compactWalkInLayout && canViewCertificate && !certificate ? (
    <div className="receipt-view__documents no-print" role="tablist"
      aria-label={bn ? 'পেমেন্টের নথি' : 'Payment documents'}>
      <button type="button" role="tab" aria-selected={!isCertificate}
        className={isCertificate ? 'receipt-view__document-tab' : 'receipt-view__document-tab receipt-view__document-tab--active'}
        onClick={() => changeDocument('receipt')}>{bn ? 'চালানের বিবরণ' : 'Challan details'}</button>
      <button type="button" role="tab" aria-selected={isCertificate}
        className={isCertificate ? 'receipt-view__document-tab receipt-view__document-tab--active' : 'receipt-view__document-tab'}
        onClick={() => changeDocument('certificate')}>{bn ? 'পেমেন্ট রেকর্ড সনদ' : 'Payment record certificate'}</button>
    </div>
  ) : null;

  if (!embedded) return (
    <TaxPayModal title={certificate ? (bn ? 'সহজকর পেমেন্ট সনদ' : 'Sohojkor Payment Certificate') : labels.title} service="status" className="receipt-modal" footer={<></>}
      closeIconLabel={bn ? 'বন্ধ করুন' : 'Close modal'}
      onClose={onBack ?? (() => navigate('history'))}>
      <ReceiptView receipt={receipt} embedded certificate={certificate} onBack={onBack} onNewPayment={onNewPayment}
        giftSimulationDetails={giftSimulationDetails} simulationServiceName={simulationServiceName}
        transactionActions={transactionActions} onPayAgain={onPayAgain}
        onApplyForCorrection={onApplyForCorrection} payAgainUnavailableReason={payAgainUnavailableReason}
        suppressFooterActions={suppressFooterActions} payAgainTestId={payAgainTestId} accountRecordView={accountRecordView}/>
    </TaxPayModal>
  );

  return (
    <div className={`receipt-view receipt-view--embedded${compactWalkInLayout ? ' receipt-view--walkin' : ''}${accountRecordView ? ' receipt-view--account-history' : ''}${bn ? ' font-bengali' : ''}`} lang={language}>
      {!suppressFooterActions && (!isCertificate || canViewCertificate) && (footerTarget ? createPortal(receiptActions, footerTarget) : receiptActions)}

      {compactWalkInLayout ? walkinDocuments : <>
      {/* Keep required flow navigation outside the recorded receipt's three-action footer. */}
      {showReceiptTransactionActions && onBack && <div className="no-print flex flex-wrap items-center gap-2">
        <button type="button"
          className="receipt-view__action receipt-view__action--secondary receipt-view__restart"
          onClick={onBack}>{bn ? 'পেমেন্ট নিশ্চিতকরণে ফিরুন' : 'Back to confirmation'}</button>
      </div>}
      {showReceiptTransactionActions && !onBack && <div className="no-print flex flex-wrap items-center gap-2">
        <button type="button" className="receipt-view__action receipt-view__action--secondary"
          onClick={() => window.print()}>
          <Printer size={18} aria-hidden="true" /><span>{labels.print}</span>
        </button>
      </div>}
      {canViewCertificate && !certificate && <button type="button"
        className="receipt-view__action receipt-view__action--secondary no-print"
        onClick={() => changeDocument(isCertificate ? 'receipt' : 'certificate')}>
        {showCertificate ? (bn ? 'রসিদ দেখুন' : 'View receipt')
          : (bn ? 'পেমেন্ট সনদ দেখুন' : 'View payment certificate')}
      </button>}
      </>}
      {compactWalkInLayout && isCertificate && <p className="receipt-view__record-only-note no-print" role="note">
        {bn ? 'এই সনদটি সংরক্ষিত পেমেন্টের রেকর্ড, ব্যাংক বা ট্রেজারি নিষ্পত্তির প্রমাণ নয়।'
          : 'Saved payment record certificate only — not proof of bank or Treasury settlement.'}
      </p>}
      {downloadError && <p role="alert" className="no-print">
        {bn ? 'সনদ ডাউনলোড করা যায়নি। আবার চেষ্টা করুন।' : 'Unable to download the certificate. Try again.'}
      </p>}
      <div ref={paperRef} className="receipt-view__paper print-card" lang={language}>
        {isCertificate ? <PaymentCertificateDocument receipt={receipt} language={language}/> : <>
        {batchLabel&&<div className="receipt-view__batch-meta" data-testid="receipt-batch-identity">
          <strong>{batchLabel}</strong><span className="break-all">{receipt.batchId}</span>
        </div>}
        <header className="receipt-view__summary">
          <div className="receipt-view__summary-copy">
            <p className="receipt-view__eyebrow">{isCertificate ? (bn ? 'সহজকর' : 'Sohojkor') : travelPreview ? (bn ? 'সংরক্ষিত পেমেন্ট রেকর্ড' : 'Saved payment record') : (bn ? 'পেমেন্ট রেকর্ড' : 'Payment record')}</p>
            <h3>{isCertificate ? (bn ? 'পেমেন্ট সনদ' : 'Payment Certificate') : travelPreview ? (bn ? 'সম্মিলিত ভ্রমণ করের বিবরণ' : 'Combined Travel Tax details') : (bn ? 'রসিদের বিবরণ' : 'Receipt details')}</h3>
            <p className="receipt-view__summary-subtitle">
              {serviceSummary}
            </p>
          </div>
          <div className="receipt-view__amount">
            <span>{bn ? 'সর্বমোট অর্থ' : 'Total amount'}</span>
            <strong>{formatCurrency(receipt.totalAmount, language)}</strong>
          </div>
        </header>

        {certificateReference && <div className="receipt-view__batch-meta" data-testid="payment-certificate-reference">
          <strong>{bn ? 'সনদ রেফারেন্স' : 'Certificate reference'}</strong>
          <span className="break-all">{certificateReference}</span>
        </div>}
        {/* Challan Identifiers Ribbon */}
        <div className="receipt-view__reference-strip">
          <div>
            <span className="text-slate-700 block">{embedded ? (bn ? 'রেফারেন্স' : 'Reference') : labels.challan}:</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="receipt-view__reference-number font-mono-plex">
                {receipt.challanNo}
              </span>
              <button
                onClick={() => handleCopy(receipt.challanNo)}
                type="button"
                aria-label={labels.copy}
                title={labels.copy}
                className="receipt-view__copy no-print"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {!isCertificate && !travelPreview && <div>
            <span className="text-slate-700 block">{embedded ? (bn ? 'টোকেন' : 'Token') : labels.token}:</span>
            <span className="font-mono-plex font-bold text-sm text-slate-900 mt-0.5 block">
              {receipt.tokenNumber}
            </span>
          </div>}

          <div>
            <span className="text-slate-700 block">{embedded ? (bn ? 'তারিখ ও সময়' : 'Date & time') : labels.timestamp}:</span>
            <span className="font-mono-plex font-medium text-slate-800 mt-0.5 block">
              {readableDate}
            </span>
          </div>
        </div>

        {receipt.isSimulatedDemo && giftSimulationDetails && <section className="gift-tax-sample-receipt" data-testid="gift-tax-sample-receipt">
          <p className="gift-tax-sample-receipt__warning">{bn ? 'শুধু সিমুলেশন — সরকারি চালান, অর্থ পরিশোধ বা কর ক্রেডিটের প্রমাণ নয়' : 'SIMULATION ONLY — not a government challan, payment or tax-credit confirmation'}</p>
          <h3 className="receipt-view__section-title">{bn ? 'দানকরের বিবরণ' : 'Gift Tax details'}</h3>
          <dl className="gift-tax-sample-receipt__fields">
            <div><dt>{bn ? 'মাধ্যম (কলাম ২)' : 'Through (Column 2)'}</dt><dd>{giftSimulationDetails.doneeName} · {maskTinForDisplay(giftSimulationDetails.doneeTin)}</dd></div>
            <div><dt>{bn ? 'যার পক্ষে (কলাম ৩)' : 'On Behalf Of (Column 3)'}</dt><dd>{receipt.payerName} · {maskTinForDisplay(receipt.payerTin)}</dd></div>
            <div><dt>{bn ? 'সম্পর্ক' : 'Relationship'}</dt><dd>{giftSimulationDetails.relationship}</dd></div>
            <div><dt>{bn ? 'দানের পরিমাণ' : 'Gift amount'}</dt><dd>{formatCurrency(giftSimulationDetails.giftAmount,language)}</dd></div>
            <div><dt>{bn ? 'দানের তারিখ' : 'Gift date'}</dt><dd>{giftSimulationDetails.giftDate}</dd></div>
            <div><dt>{bn ? 'দানের বিবরণ' : 'Description'}</dt><dd>{giftSimulationDetails.description||'—'}</dd></div>
            {giftSimulationDetails.remarks && <div><dt>{bn ? 'মন্তব্য' : 'Remarks'}</dt><dd>{giftSimulationDetails.remarks}</dd></div>}
          </dl>
        </section>}
        {/* Two-Column Parties & Jurisdictions */}
        <div className="receipt-view__parties">
          <div className="space-y-2">
            <h3 className="receipt-view__section-title">
              {labels.payerDetails}
            </h3>
            <div className="receipt-view__detail">
              <span className="text-slate-700">{labels.payer}:</span>
              <span className="col-span-2 font-semibold text-slate-900">{receipt.payerName}</span>
            </div>
            {receipt.receiptEmail && <div className="receipt-view__detail">
              <span className="text-slate-700">{bn ? 'রসিদের ইমেইল' : 'Receipt email'}:</span>
              <span className="col-span-2 break-all text-slate-800">{receipt.receiptEmail}</span>
            </div>}
            {receipt.paymentCategory !== 'TRAVEL_TAX' && <div className="receipt-view__detail">
              <span className="text-slate-700">{labels.tin}:</span>
              <span className="col-span-2 font-mono-plex font-bold text-emerald-900">{taxpayerTinSummary}</span>
            </div>}
            <div className="receipt-view__detail">
              <span className="text-slate-700">{labels.service}:</span>
              <span className="col-span-2 font-semibold text-slate-900">{serviceSummary}</span>
            </div>
            <div className="receipt-view__detail">
              <span className="text-slate-700">{labels.year}:</span>
              <span className="col-span-2 font-bold text-slate-800">{assessmentYearSummary}</span>
            </div>
            {receipt.paymentCategory !== 'TRAVEL_TAX' && <>
              <div className="receipt-view__detail">
                <span className="text-slate-700">{labels.zone}:</span>
                <span className="col-span-2 text-slate-800">{receipt.taxZone}</span>
              </div>
              <div className="receipt-view__detail">
                <span className="text-slate-700">{labels.circle}:</span>
                <span className="col-span-2 text-slate-800">{receipt.taxCircle}</span>
              </div>
            </>}
          </div>

          <div className="space-y-2">
            <h3 className="receipt-view__section-title">
              {isCertificate ? (bn ? 'পেমেন্টের তথ্য' : 'Payment details') :
                receipt.isSimulatedDemo ? (bn ? 'পেমেন্ট রেকর্ডের অবস্থা' : 'Payment record status') : labels.treasurySection}
            </h3>
            <div className="receipt-view__detail">
              <span className="text-slate-700">{labels.paymentMethod}:</span>
              <span className="col-span-2 font-medium text-slate-900">{paymentMethodLabels}</span>
            </div>
            {!isCertificate && !travelPreview && <div className="receipt-view__detail">
              <span className="text-slate-700">{labels.transaction}:</span>
              <span className="col-span-2 font-mono-plex text-slate-700">{receipt.gatewayTransactionId}</span>
            </div>}
            {!isCertificate && !travelPreview && receipt.taxEventId && <div className="receipt-view__detail">
              <span className="text-slate-700">{bn ? 'কর ইভেন্ট আইডি:' : 'Tax event ID:'}</span>
              <span className="col-span-2 font-mono-plex text-slate-700 break-all">{receipt.taxEventId}</span>
            </div>}
            {(isCertificate || !travelPreview) && receipt.paymentTransactionId && <div className="receipt-view__detail">
              <span className="text-slate-700">{bn ? 'পেমেন্ট ট্রানজেকশন আইডি:' : 'Payment transaction ID:'}</span>
              <span className="col-span-2 font-mono-plex text-slate-700 break-all">{receipt.paymentTransactionId}</span>
            </div>}
            {!isCertificate && !travelPreview && <div className="receipt-view__detail">
              <span className="text-slate-700">{labels.scroll}:</span>
              <span className="col-span-2 font-mono-plex font-semibold text-emerald-900">
                {receipt.isSimulatedDemo ? (bn ? 'ট্রেজারি স্ক্রল ইস্যু হয়নি' : 'No Treasury scroll issued') : receipt.treasuryScrollNo || labels.pendingScroll}
              </span>
            </div>}

            {travelPreview && <p className="receipt-view__summary-subtitle" role="status">{bn ? 'এটি সরকারি A-Challan বা ট্রেজারি নিষ্পত্তি নয়। ট্রেজারি স্ক্রল ইস্যু হয়নি।' : 'Not a government A-Challan or Treasury settlement. No Treasury scroll issued.'}</p>}
            {/* WITHHOLDING SPECIFIC SEPARATION */}
            {receipt.isWithholding && (
              <div className="mt-3 p-2 rounded bg-amber-50 border border-amber-200 text-[11px] space-y-1">
                <span className="font-bold text-amber-900 block flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-amber-700" />
                  {labels.withholdingTitle}
                </span>
                <p className="text-amber-800 leading-tight">
                  {labels.deductedFor} <strong className="font-mono">{receipt.deducteeTin || (bn ? 'উল্লেখ নেই' : 'Unspecified')}</strong>. {labels.noAgentCredit}
                </p>
              </div>
            )}
          </div>
        </div>
        {!isCertificate && postReceiptInvitation}

        {receipt.travelDetails && <section className="receipt-view__breakdown" data-testid="travel-family-challan">
          <h3 className="receipt-view__section-title">{bn ? 'যাত্রীভিত্তিক ভ্রমণ কর' : 'Passenger-wise Travel Tax'}</h3>
          <div className="receipt-view__table">
            <table className="receipt-view__financial-table" aria-label={bn ? 'এক চালানে সব যাত্রীর কর' : 'All passengers in one challan'}>
              <thead><tr>
                <th scope="col">{bn ? 'যাত্রী' : 'Passenger'}</th>
                <th scope="col">{bn ? 'পাসপোর্ট' : 'Passport'}</th>
                <th scope="col">{bn ? 'বয়স' : 'Age'}</th>
                <th scope="col">{bn ? 'কর' : 'Tax'}</th>
              </tr></thead>
              <tbody>{receipt.travelDetails.passengers.map((item,index) => <tr key={index}>
                <td>{item.name}</td>
                <td>{item.passportMasked}</td>
                <td>{item.age ?? item.ageBand}{typeof item.age === 'number' && item.age <= 5 && <p className="receipt-view__summary-subtitle">{bn ? 'বয়সভিত্তিক করছাড়; যাচাই সাপেক্ষে' : 'Age-based exemption; subject to verification'}</p>}</td>
                <td>{formatCurrency(item.amount, language)}</td>
              </tr>)}</tbody>
              <tfoot><tr><th scope="row" colSpan={3}>{bn ? 'সর্বমোট ভ্রমণ কর' : 'Combined Travel Tax'}</th>
                <td>{formatCurrency(receipt.totalAmount, language)}</td></tr></tfoot>
            </table>
          </div>
          <dl className="receipt-view__detail receipt-view__travel-meta">
            <div><dt>{bn ? 'যাত্রার মাধ্যম' : 'Travel mode'}</dt><dd>{receipt.travelDetails.mode === 'LAND' ? (bn ? 'স্থলপথে' : 'Land') : (bn ? 'নৌপথে' : 'Water')}</dd></div>
            <div><dt>{bn ? 'যাত্রা বন্দর' : 'Departure port'}</dt><dd>{receipt.travelDetails.departurePort}</dd></div>
            <div><dt>{bn ? 'গন্তব্য ও তারিখ' : 'Destination and date'}</dt><dd>{receipt.travelDetails.destination} · {receipt.travelDetails.travelDate}</dd></div>
            <div><dt>{bn ? 'অর্থনৈতিক কোড' : 'Economic code'}</dt><dd>{receipt.travelDetails.economicCode}</dd></div>
          </dl>
          <p className="receipt-view__summary-subtitle">{bn
            ? 'এই সংরক্ষিত রেকর্ড সরকারি A-Challan ইস্যু বা ট্রেজারি নিষ্পত্তির প্রমাণ নয়।'
            : 'This saved record is not proof of government A-Challan issuance or Treasury settlement.'}</p>
        </section>}
        {/* Keep one financial document view for both standard heads and reconciled allocations. */}
        {allocationBreakdown || (!receipt.travelDetails && (
        <div className="receipt-view__breakdown">
          <h3 className="receipt-view__section-title">
            {labels.breakdown}
          </h3>
          <div className="receipt-view__breakdown-content">
            <div className="receipt-view__cards" data-testid="receipt-breakdown-mobile">
              {receipt.items.map((item, idx) => (
                <article key={idx} className="p-3 space-y-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-700">{labels.headCode}</p>
                    <p className="break-all font-mono-plex text-xs font-semibold text-emerald-900">{item.economicCode}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold leading-snug text-slate-900">{itemName(item)}</h4>
                    {item.note && <p className="mt-1 break-words text-[11px] leading-snug text-slate-600">{item.note}</p>}
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-slate-200 pt-3 text-xs">
                    <div><dt className="text-slate-700">{labels.tax}</dt><dd className="font-mono-plex font-medium text-slate-900">{formatCurrency(item.taxAmount, language)}</dd></div>
                    <div><dt className="text-slate-700">{labels.penalty}</dt><dd className="font-mono-plex font-medium text-slate-900">{formatCurrency(item.penaltyAmount, language)}</dd></div>
                    <div><dt className="text-slate-700">{labels.surcharge}</dt><dd className="font-mono-plex font-medium text-slate-900">{formatCurrency(item.surchargeAmount, language)}</dd></div>
                    <div><dt className="text-slate-700">{labels.interest}</dt><dd className="font-mono-plex font-medium text-slate-900">{formatCurrency(item.interestAmount, language)}</dd></div>
                  </dl>
                  <div className="flex items-center justify-between gap-3 border-t border-emerald-200 pt-2 font-semibold text-emerald-950">
                    <span>{labels.total}</span><span className="shrink-0 font-mono-plex">{formatCurrency(item.totalAmount, language)}</span>
                  </div>
                </article>
              ))}
              <div className="flex items-center justify-between gap-3 bg-emerald-50 px-3 py-3 text-sm font-bold text-emerald-950">
                <span>{labels.grandTotal}</span><span className="shrink-0 font-mono-plex">{formatCurrency(receipt.totalAmount, language)}</span>
              </div>
            </div>
            <div className="receipt-view__table" data-testid="receipt-breakdown-table">
            <table className="receipt-view__financial-table">
              <thead className="bg-slate-50 text-slate-600 font-semibold text-left">
                <tr>
                  <th scope="col" className="px-3 py-2.5">{labels.headCode}</th>
                  <th scope="col" className="px-3 py-2.5">{labels.description}</th>
                  <th scope="col" className="px-3 py-2.5 text-right">{labels.tax}</th>
                  <th scope="col" className="px-3 py-2.5 text-right">{labels.penalty}</th>
                  <th scope="col" className="px-3 py-2.5 text-right">{labels.surcharge}</th>
                  <th scope="col" className="px-3 py-2.5 text-right">{labels.interest}</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-bold">{labels.total}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {receipt.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2 font-mono-plex text-emerald-900 font-medium whitespace-nowrap">
                      {item.economicCode}
                    </td>
                    <td className="px-3 py-2 text-slate-800">
                      <div className="font-medium">
                        {itemName(item)}
                      </div>
                      {item.note && <div className="text-[11px] text-slate-700 italic">{item.note}</div>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono-plex">{formatCurrency(item.taxAmount, language)}</td>
                    <td className="px-3 py-2 text-right font-mono-plex">{formatCurrency(item.penaltyAmount, language)}</td>
                    <td className="px-3 py-2 text-right font-mono-plex">{formatCurrency(item.surchargeAmount, language)}</td>
                    <td className="px-3 py-2 text-right font-mono-plex">{formatCurrency(item.interestAmount, language)}</td>
                    <td className="px-3 py-2 text-right font-mono-plex font-bold text-slate-900">
                      {formatCurrency(item.totalAmount, language)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-emerald-50/60 font-bold border-t-2 border-slate-300">
                <tr>
                  <td colSpan={6} className="px-3 py-2.5 text-right text-emerald-950 uppercase">
                    {labels.grandTotal}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono-plex text-sm text-emerald-950">
                    {formatCurrency(receipt.totalAmount, language)}
                  </td>
                </tr>
              </tfoot>
            </table>
            </div>
          </div>
        </div>
        ))}
        </>}
        {!isCertificate && receipt.paymentRemarks !== undefined && receipt.paymentRemarks !== '' && (
          <section className="receipt-view__breakdown" data-testid="receipt-payment-remarks">
            <h3 className="receipt-view__section-title">
              {bn ? 'চালানের মন্তব্য' : 'Challan remarks'}
            </h3>
            <p className="whitespace-pre-wrap break-words text-sm text-slate-700">
              {receipt.paymentRemarks}
            </p>
          </section>
        )}
      </div>
    </div>
  );
};
