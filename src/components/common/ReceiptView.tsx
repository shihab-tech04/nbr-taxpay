import React, { useContext, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Printer,
  Download,
  Copy,
  Info
} from 'lucide-react';
import { ChallanReceipt } from '../../types/tax';
import { formatCurrency } from '../../services/numberFormat';
import { useTaxState } from '../../services/taxState';
import { MASTER_PAYMENT_HEADS, CATEGORY_LABELS } from '../../data/paymentHeads';
import { downloadDisplayedCertificate } from '../../services/receiptDocumentExport';
import { TaxPayModal, TaxPayModalFooterTarget } from '../ui/TaxPayModal';

interface ReceiptViewProps {
  receipt: ChallanReceipt;
  onBack?: () => void;
  embedded?: boolean;
  backLabel?: string;
  /** Optional receipt-only restart, aligned opposite download and print. */
  onNewPayment?: () => void;
}

export const ReceiptView: React.FC<ReceiptViewProps> = ({ receipt, onBack, embedded = false, onNewPayment }) => {
  const { language, navigate } = useTaxState();
  const footerTarget = useContext(TaxPayModalFooterTarget);
  const bn = language === 'bn';
  useEffect(() => { if (!embedded) window.scrollTo(0, 0); }, [embedded]);
  const labels = bn ? {
    back: 'রেকর্ডে ফিরুন', print: 'রসিদ প্রিন্ট', export: 'ডাউনলোড',
    title: 'করবৃত্ত — রসিদের বিবরণ',
    challan: 'পেমেন্ট রেফারেন্স', token: 'টোকেন নম্বর', timestamp: 'তারিখ ও সময়', copy: 'রেফারেন্স কপি করুন',
    payerDetails: 'করদাতা ও পরিশোধকারীর তথ্য', payer: 'পরিশোধকারীর নাম', tin: 'ই-টিআইএন', year: 'করবর্ষ', service: 'পেমেন্টের ধরন',
    zone: 'কর অঞ্চল', circle: 'কর সার্কেল', treasurySection: 'নিষ্পত্তির তথ্য',
    paymentMethod: 'পেমেন্ট পদ্ধতি', transaction: 'লেনদেন রেফারেন্স',
    scroll: 'ট্রেজারি স্ক্রল রেফারেন্স', pendingScroll: 'স্ক্রল রেফারেন্স নেই',
    withholdingTitle: 'উৎসে কর জমার নোটিশ', deductedFor: 'কর কর্তনগ্রহীতার টিআইএন-এর পক্ষে জমা:',
    noAgentCredit: 'এই রেকর্ডে কর কর্তনকারীর ব্যক্তিগত কর ক্রেডিট প্রতিষ্ঠিত হয় না।',
    allocations: 'করদাতাভিত্তিক পেমেন্ট বরাদ্দ', allocationTaxpayer: 'করদাতা / ই-টিআইএন', allocationAmount: 'বরাদ্দের পরিমাণ',
    breakdown: 'পেমেন্টের বিবরণ ও খাত', headCode: 'অর্থনৈতিক খাত কোড', description: 'খাতের বিবরণ',
    tax: 'কর (টাকা)', penalty: 'জরিমানা', surcharge: 'সারচার্জ', interest: 'সুদ', total: 'মোট (টাকা)', grandTotal: 'মোট অর্থ:',
    noAgentEntitlement: 'এজেন্টের স্বয়ংক্রিয় ক্রেডিট নয়; কর কর্তনগ্রহীতার অধিকার আলাদাভাবে যাচাই করতে হবে।'
  } : {
    back: 'Back to records', print: 'Print receipt', export: 'Download',
    title: 'Korbritto — Receipt details',
    challan: 'Payment reference', token: 'Token number', timestamp: 'Date and time', copy: 'Copy reference',
    payerDetails: 'Payer and taxpayer details', payer: 'Payer name', tin: 'e-TIN', year: 'Assessment year', service: 'Payment service',
    zone: 'Taxes zone', circle: 'Taxes circle', treasurySection: 'Settlement details',
    paymentMethod: 'Payment method', transaction: 'Transaction reference',
    scroll: 'Treasury scroll reference', pendingScroll: 'No scroll reference',
    withholdingTitle: 'Withholding deposit notice', deductedFor: 'Deposit for deductee TIN:',
    noAgentCredit: 'Withholding-agent tax credit is not established by this record.',
    allocations: 'Taxpayer payment allocations', allocationTaxpayer: 'Taxpayer / e-TIN', allocationAmount: 'Allocated amount (BDT)',
    breakdown: 'Payment breakdown and head classification', headCode: 'Economic head code', description: 'Head description',
    tax: 'Tax (BDT)', penalty: 'Penalty', surcharge: 'Surcharge', interest: 'Interest', total: 'Total (BDT)', grandTotal: 'Total amount:',
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
  const defaultService = bn
    ? (CATEGORY_LABELS[receipt.paymentCategory]?.bn ?? receipt.paymentCategory)
    : (CATEGORY_LABELS[receipt.paymentCategory]?.en ?? receipt.paymentCategory);
  const serviceNames = Array.from(new Set(allocationItems
    .map(item => bn ? item.paymentServiceBn : item.paymentServiceEn)
    .filter(name => name.trim().length > 0)));
  const serviceSummary = serviceNames.length ? serviceNames.join(', ') : defaultService;
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
          {allocationItems.map((item, idx) => (
            <article key={`${item.taxpayerTin || item.taxpayerName}-${item.assessmentYear}-${item.paymentServiceEn}-${idx}`} className="p-3 space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{labels.allocationTaxpayer}</p>
                <p className="mt-1 break-words text-sm font-semibold text-slate-900">{item.taxpayerName}</p>
                {item.taxpayerTin && <p className="mt-1 break-all font-mono-plex text-xs text-slate-700">{item.taxpayerTin}</p>}
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-slate-200 pt-3 text-xs">
                <div><dt className="text-slate-700">{labels.service}</dt><dd className="mt-1 break-words font-medium text-slate-900">{bn ? item.paymentServiceBn : item.paymentServiceEn}</dd></div>
                <div><dt className="text-slate-700">{labels.year}</dt><dd className="mt-1 font-medium text-slate-900">{item.assessmentYear}</dd></div>
              </dl>
              <div className="flex items-center justify-between gap-3 border-t border-taxpay-border pt-2 font-semibold text-taxpay-dark">
                <span>{labels.allocationAmount}</span>
                <span className="shrink-0 font-mono-plex">{formatCurrency(item.amountMinor / 100, language)}</span>
              </div>
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
              {allocationItems.map((item, idx) => (
                <tr key={`${item.taxpayerTin || item.taxpayerName}-${item.assessmentYear}-${item.paymentServiceEn}-${idx}`} className="hover:bg-slate-50/50">
                  <td>
                    <div className="font-medium text-slate-900">{item.taxpayerName}</div>
                    {item.taxpayerTin && <div className="mt-1 break-all font-mono-plex text-xs text-slate-700">{item.taxpayerTin}</div>}
                  </td>
                  <td className="text-slate-800">{bn ? item.paymentServiceBn : item.paymentServiceEn}</td>
                  <td>{item.assessmentYear}</td>
                  <td className="font-mono-plex font-bold text-slate-900">{formatCurrency(item.amountMinor / 100, language)}</td>
                </tr>
              ))}
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
    <div className="receipt-view__actions no-print">
      {onNewPayment && <button type="button"
        className="receipt-view__action receipt-view__action--secondary receipt-view__restart"
        onClick={onNewPayment}>{bn ? 'নতুন পেমেন্ট' : 'New payment'}</button>}
      <div className="receipt-view__action-group">
        <button type="button" className="receipt-view__action receipt-view__action--secondary"
          onClick={() => downloadDisplayedCertificate(receipt)}>
          <Download size={18} aria-hidden="true" /><span>{labels.export}</span>
        </button>
        <button type="button" className="receipt-view__action receipt-view__action--primary"
          onClick={() => window.print()}>
          <Printer size={18} aria-hidden="true" /><span>{labels.print}</span>
        </button>
      </div>
    </div>
  );

  if (!embedded) return (
    <TaxPayModal title={labels.title} service="status" className="receipt-modal" footer={<></>}
      closeIconLabel={bn ? 'বন্ধ করুন' : 'Close modal'}
      onClose={onBack ?? (() => navigate('history'))}>
      <ReceiptView receipt={receipt} embedded />
    </TaxPayModal>
  );

  return (
    <div className={`receipt-view receipt-view--embedded${bn ? ' font-bengali' : ''}`} lang={language}>
      {footerTarget ? createPortal(receiptActions, footerTarget) : receiptActions}

      {/* Payment record generated from the app's local transaction state. */}
      <div className="receipt-view__paper print-card" lang={language}>
        <header className="receipt-view__summary">
          <div className="receipt-view__summary-copy">
            <p className="receipt-view__eyebrow">{bn ? 'পেমেন্ট রেকর্ড' : 'Payment record'}</p>
            <h3>{bn ? 'রসিদের বিবরণ' : 'Receipt details'}</h3>
            <p className="receipt-view__summary-subtitle">
              {serviceSummary}
            </p>
          </div>
          <div className="receipt-view__amount">
            <span>{bn ? 'সর্বমোট অর্থ' : 'Total amount'}</span>
            <strong>{formatCurrency(receipt.totalAmount, language)}</strong>
          </div>
        </header>

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

          <div>
            <span className="text-slate-700 block">{embedded ? (bn ? 'টোকেন' : 'Token') : labels.token}:</span>
            <span className="font-mono-plex font-bold text-sm text-slate-900 mt-0.5 block">
              {receipt.tokenNumber}
            </span>
          </div>

          <div>
            <span className="text-slate-700 block">{embedded ? (bn ? 'তারিখ ও সময়' : 'Date & time') : labels.timestamp}:</span>
            <span className="font-mono-plex font-medium text-slate-800 mt-0.5 block">
              {receipt.completedAt || receipt.createdAt}
            </span>
          </div>
        </div>

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
            <div className="receipt-view__detail">
              <span className="text-slate-700">{labels.tin}:</span>
              <span className="col-span-2 font-mono-plex font-bold text-emerald-900">{taxpayerTinSummary}</span>
            </div>
            <div className="receipt-view__detail">
              <span className="text-slate-700">{labels.service}:</span>
              <span className="col-span-2 font-semibold text-slate-900">{serviceSummary}</span>
            </div>
            <div className="receipt-view__detail">
              <span className="text-slate-700">{labels.year}:</span>
              <span className="col-span-2 font-bold text-slate-800">{assessmentYearSummary}</span>
            </div>
            <div className="receipt-view__detail">
              <span className="text-slate-700">{labels.zone}:</span>
              <span className="col-span-2 text-slate-800">{receipt.taxZone}</span>
            </div>
            <div className="receipt-view__detail">
              <span className="text-slate-700">{labels.circle}:</span>
              <span className="col-span-2 text-slate-800">{receipt.taxCircle}</span>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="receipt-view__section-title">
              {labels.treasurySection}
            </h3>
            <div className="receipt-view__detail">
              <span className="text-slate-700">{labels.paymentMethod}:</span>
              <span className="col-span-2 font-medium text-slate-900">{paymentMethodLabels}</span>
            </div>
            <div className="receipt-view__detail">
              <span className="text-slate-700">{labels.transaction}:</span>
              <span className="col-span-2 font-mono-plex text-slate-700">{receipt.gatewayTransactionId}</span>
            </div>
            {receipt.taxEventId && <div className="receipt-view__detail">
              <span className="text-slate-700">{bn ? 'কর ইভেন্ট আইডি:' : 'Tax event ID:'}</span>
              <span className="col-span-2 font-mono-plex text-slate-700 break-all">{receipt.taxEventId}</span>
            </div>}
            {receipt.paymentTransactionId && <div className="receipt-view__detail">
              <span className="text-slate-700">{bn ? 'পেমেন্ট ট্রানজেকশন আইডি:' : 'Payment transaction ID:'}</span>
              <span className="col-span-2 font-mono-plex text-slate-700 break-all">{receipt.paymentTransactionId}</span>
            </div>}
            <div className="receipt-view__detail">
              <span className="text-slate-700">{labels.scroll}:</span>
              <span className="col-span-2 font-mono-plex font-semibold text-emerald-900">
                {receipt.isSimulatedDemo ? (bn ? 'ট্রেজারি স্ক্রল ইস্যু হয়নি' : 'No Treasury scroll issued') : receipt.treasuryScrollNo || labels.pendingScroll}
              </span>
            </div>

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

        {/* Keep one financial document view for both standard heads and reconciled allocations. */}
        {allocationBreakdown || (
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
        )}

      </div>
    </div>
  );
};
