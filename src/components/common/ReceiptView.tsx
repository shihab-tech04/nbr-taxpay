import React, { useEffect } from 'react';
import {
  Printer,
  Download,
  CheckCircle,
  ShieldCheck,
  ArrowLeft,
  Building2,
  Copy,
  Info
} from 'lucide-react';
import { ChallanReceipt } from '../../types/tax';
import { formatCurrency } from '../../services/numberFormat';
import { useTaxState } from '../../services/taxState';
import { MASTER_PAYMENT_HEADS, CATEGORY_LABELS } from '../../data/paymentHeads';
import { downloadDisplayedCertificate } from '../../services/receiptDocumentExport';
import { TaxPayModal } from '../ui/TaxPayModal';

interface ReceiptViewProps {
  receipt: ChallanReceipt;
  onBack?: () => void;
  embedded?: boolean;
}

export const ReceiptView: React.FC<ReceiptViewProps> = ({ receipt, onBack, embedded = false }) => {
  const { language, navigate } = useTaxState();
  const bn = language === 'bn';
  useEffect(() => { if (!embedded) window.scrollTo(0, 0); }, [embedded]);
  const labels = bn ? {
    back: 'রেকর্ডে ফিরুন', print: 'রসিদ প্রিন্ট', export: 'ডাউনলোড',
    title: 'আমার কর — রসিদের বিবরণ',
    challan: 'চালান নম্বর', token: 'টোকেন নম্বর', timestamp: 'তারিখ ও সময়', copy: 'চালান নম্বর কপি করুন',
    payerDetails: 'করদাতা ও পরিশোধকারীর তথ্য', payer: 'পরিশোধকারীর নাম', tin: 'ই-টিআইএন', year: 'করবর্ষ', service: 'পেমেন্টের ধরন',
    zone: 'কর অঞ্চল', circle: 'কর সার্কেল', treasurySection: 'নিষ্পত্তির তথ্য',
    paymentMethod: 'পেমেন্ট পদ্ধতি', transaction: 'লেনদেন রেফারেন্স',
    scroll: 'ট্রেজারি স্ক্রল রেফারেন্স', pendingScroll: 'স্ক্রল রেফারেন্স নেই',
    withholdingTitle: 'উৎসে কর জমার নোটিশ', deductedFor: 'কর কর্তনগ্রহীতার টিআইএন-এর পক্ষে জমা:',
    noAgentCredit: 'এই রেকর্ডে কর কর্তনকারীর ব্যক্তিগত কর ক্রেডিট প্রতিষ্ঠিত হয় না।',
    breakdown: 'পেমেন্টের বিবরণ ও খাত', headCode: 'অর্থনৈতিক খাত কোড', description: 'খাতের বিবরণ',
    tax: 'কর (টাকা)', penalty: 'জরিমানা', surcharge: 'সারচার্জ', interest: 'সুদ', total: 'মোট (টাকা)', grandTotal: 'মোট অর্থ:',
    treasuryStatus: 'পেমেন্টের অবস্থা',
    credit: 'কর ক্রেডিট স্বীকৃতি', notApplicable: 'প্রযোজ্য নয়', pending: 'সমন্বয়ের অপেক্ষায়',
    credited: 'লেজার ক্রেডিট যাচাইয়ের অপেক্ষায়', claimed: 'রিটার্নের দাবি যাচাইয়ের অপেক্ষায়', disputed: 'বিরোধপূর্ণ',
    noAgentEntitlement: 'এজেন্টের স্বয়ংক্রিয় ক্রেডিট নয়; কর কর্তনগ্রহীতার অধিকার আলাদাভাবে যাচাই করতে হবে।'
  } : {
    back: 'Back to records', print: 'Print receipt', export: 'Download',
    title: 'Amar Kor — Receipt details',
    challan: 'Challan reference', token: 'Token number', timestamp: 'Date and time', copy: 'Copy reference',
    payerDetails: 'Payer and taxpayer details', payer: 'Payer name', tin: 'e-TIN', year: 'Assessment year', service: 'Payment service',
    zone: 'Taxes zone', circle: 'Taxes circle', treasurySection: 'Settlement details',
    paymentMethod: 'Payment method', transaction: 'Transaction reference',
    scroll: 'Treasury scroll reference', pendingScroll: 'No scroll reference',
    withholdingTitle: 'Withholding deposit notice', deductedFor: 'Deposit for deductee TIN:',
    noAgentCredit: 'Withholding-agent tax credit is not established by this record.',
    breakdown: 'Payment breakdown and head classification', headCode: 'Economic head code', description: 'Head description',
    tax: 'Tax (BDT)', penalty: 'Penalty', surcharge: 'Surcharge', interest: 'Interest', total: 'Total (BDT)', grandTotal: 'Total amount:',
    treasuryStatus: 'Payment status',
    credit: 'Tax credit recognition', notApplicable: 'NOT APPLICABLE', pending: 'PENDING RECONCILIATION',
    credited: 'LEDGER CREDIT UNVERIFIED', claimed: 'RETURN CLAIM UNVERIFIED', disputed: 'DISPUTED',
    noAgentEntitlement: 'No automatic agent credit; deductee entitlement requires separate verification.'
  };
  const creditStatusLabel = {
    NOT_APPLICABLE: labels.notApplicable,
    PENDING_RECONCILIATION: labels.pending,
    CREDITED_TO_LEDGER: labels.credited,
    CLAIMED_IN_RETURN: labels.claimed,
    DISPUTED: labels.disputed
  }[receipt.taxCreditStatus];
  const treasuryStatusLabels = {
    INITIATED: bn ? 'শুরু হয়েছে' : 'INITIATED',
    GATEWAY_PENDING: bn ? 'গেটওয়েতে অপেক্ষমাণ' : 'GATEWAY_PENDING',
    GATEWAY_SUCCESS: bn ? 'সিমুলেটেড পেমেন্ট সফল' : 'Simulated payment successful',
    TREASURY_SCROLLED: receipt.isSimulatedDemo
      ? (bn ? 'সিমুলেশন সংরক্ষিত' : 'Simulation recorded')
      : (bn ? 'ট্রেজারিতে নথিভুক্ত' : 'Treasury recorded'),
    FAILED: bn ? 'ব্যর্থ' : 'FAILED',
    EXPIRED: bn ? 'মেয়াদ শেষ' : 'EXPIRED',
    REVERSED: bn ? 'প্রত্যাবর্তিত' : 'REVERSED'
  }[receipt.treasuryStatus];
  const paymentMethodLabels = {
    BKASH: 'bKash', NAGAD: 'Nagad', ROCKET: 'Rocket', SONALI_E_SHEBA: 'Sonali e-Sheba',
    A_CHALLAN_CARD: 'A-Challan card', BEFTN_RTGS: 'BEFTN / RTGS',
    INTERNET_BANKING: 'Internet Banking', VISA: 'Visa', MASTERCARD: 'Mastercard', BANK_BRANCH: 'Bank branch', SIMULATED: 'Simulated payment'
  }[receipt.paymentMethod];

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
  };
  const itemName = (item: ChallanReceipt['items'][number]) => bn
    ? MASTER_PAYMENT_HEADS.find(head => head.id === item.headId && head.nameEn === item.headNameEn)?.nameBn || item.headNameEn
    : item.headNameEn;

  // A standalone receipt also uses the same modal as public lookup and account history.
  // This covers legacy direct guest-payment entry without editing parallel payment-form code.
  if (!embedded) return (
    <TaxPayModal title={labels.title} service="status" className="receipt-modal" footer={<></>}
      closeIconLabel={bn ? 'বন্ধ করুন' : 'Close modal'}
      onClose={onBack ?? (() => navigate('history'))}>
      <ReceiptView receipt={receipt} embedded />
    </TaxPayModal>
  );

  return (
    <div className={`receipt-view ${embedded ? 'receipt-view--embedded' : 'receipt-view--page'} space-y-4 max-w-4xl mx-auto${bn ? ' font-bengali' : ''}`} lang={language}>
      {/* Top Actions Bar */}
      <div className="receipt-view__actions no-print flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
        {!embedded && <button
          onClick={onBack || (() => navigate('history'))}
          aria-label={labels.back}
          className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-emerald-800 hover:text-emerald-950 px-3 py-1.5 rounded bg-emerald-50 hover:bg-emerald-100 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{labels.back}</span>
        </button>}

        <div className="receipt-view__action-group flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold bg-emerald-800 hover:bg-emerald-900 text-white px-3.5 py-1.5 rounded cursor-pointer shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{labels.print}</span>
          </button>
          <button
            onClick={() => downloadDisplayedCertificate(receipt)}
            className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded cursor-pointer border border-slate-300"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{embedded ? (bn ? 'ডাউনলোড' : 'Download') : labels.export}</span>
          </button>
        </div>
      </div>

      {/* Payment record generated from the app's local transaction state. */}
      <div className="receipt-view__paper print-card bg-white border border-slate-300 rounded-xl shadow-md p-4 sm:p-8 relative overflow-hidden text-slate-800 font-sans" lang={language}>
        {embedded ? (
          <header className="receipt-view__header">
            <div className="receipt-view__heading">
              <h3>{bn ? 'রসিদের বিবরণ' : 'Receipt details'}</h3>
            </div>
          </header>
        ) : (
          <div className="text-center pb-6 border-b-2 border-taxpay-primary space-y-1 relative">
            <div className="flex items-center justify-center gap-2 text-taxpay-dark">
              <Building2 className="w-8 h-8 text-emerald-800" />
              <h1 className="font-serif-fraunces text-xl sm:text-2xl font-bold tracking-tight text-taxpay-dark">
                {labels.title}
              </h1>
            </div>
          </div>
        )}

        {receipt.isSimulatedDemo === true && (
          <p role="note" className="my-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
            {bn
              ? 'শুধু ডেমো রসিদ — কোনো অর্থ স্থানান্তর, সরকারি চালান বা কর ক্রেডিট হয়নি।'
              : 'Demo receipt only — no money transferred, government challan or tax credit issued.'}
          </p>
        )}

        {/* Challan Identifiers Ribbon */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3 my-5 text-xs">
          <div>
            <span className="text-slate-700 block">{embedded ? (bn ? 'রেফারেন্স' : 'Reference') : labels.challan}:</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="font-mono-plex font-bold text-sm text-emerald-950">
                {receipt.challanNo}
              </span>
              <button
                onClick={() => handleCopy(receipt.challanNo)}
                type="button"
                aria-label={labels.copy}
                title={labels.copy}
                className="no-print grid min-h-11 min-w-11 place-items-center rounded text-slate-700 hover:text-slate-900"
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6 text-xs border-b border-slate-200 pb-6">
          <div className="space-y-2">
            <h3 className="font-bold text-xs uppercase tracking-wider text-emerald-900 border-b border-emerald-100 pb-1">
              {labels.payerDetails}
            </h3>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-slate-700">{labels.payer}:</span>
              <span className="col-span-2 font-semibold text-slate-900">{receipt.payerName}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-slate-700">{labels.tin}:</span>
              <span className="col-span-2 font-mono-plex font-bold text-emerald-900">{receipt.taxpayerTin || receipt.payerTin}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-slate-700">{labels.service}:</span>
              <span className="col-span-2 font-semibold text-slate-900">{bn ? (CATEGORY_LABELS[receipt.paymentCategory]?.bn ?? receipt.paymentCategory) : (CATEGORY_LABELS[receipt.paymentCategory]?.en ?? receipt.paymentCategory)}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-slate-700">{labels.year}:</span>
              <span className="col-span-2 font-bold text-slate-800">{receipt.assessmentYear}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-slate-700">{labels.zone}:</span>
              <span className="col-span-2 text-slate-800">{receipt.taxZone}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-slate-700">{labels.circle}:</span>
              <span className="col-span-2 text-slate-800">{receipt.taxCircle}</span>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-bold text-xs uppercase tracking-wider text-emerald-900 border-b border-emerald-100 pb-1">
              {labels.treasurySection}
            </h3>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-slate-700">{labels.paymentMethod}:</span>
              <span className="col-span-2 font-medium text-slate-900">{paymentMethodLabels}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-slate-700">{labels.transaction}:</span>
              <span className="col-span-2 font-mono-plex text-slate-700">{receipt.gatewayTransactionId}</span>
            </div>
            {receipt.taxEventId && <div className="grid grid-cols-3 gap-1">
              <span className="text-slate-700">{bn ? 'কর ইভেন্ট আইডি:' : 'Tax event ID:'}</span>
              <span className="col-span-2 font-mono-plex text-slate-700 break-all">{receipt.taxEventId}</span>
            </div>}
            {receipt.paymentTransactionId && <div className="grid grid-cols-3 gap-1">
              <span className="text-slate-700">{bn ? 'পেমেন্ট ট্রানজেকশন আইডি:' : 'Payment transaction ID:'}</span>
              <span className="col-span-2 font-mono-plex text-slate-700 break-all">{receipt.paymentTransactionId}</span>
            </div>}
            <div className="grid grid-cols-3 gap-1">
              <span className="text-slate-700">{labels.scroll}:</span>
              <span className="col-span-2 font-mono-plex font-semibold text-emerald-900">
                {receipt.treasuryScrollNo || labels.pendingScroll}
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

        {/* Financial Line Items Table */}
        <div className="my-6">
          <h3 className="font-bold text-xs uppercase tracking-wider text-emerald-900 mb-2">
            {labels.breakdown}
          </h3>
          <div className="overflow-hidden border border-slate-200 rounded-lg">
            <div className="receipt-view__cards divide-y divide-slate-200 bg-white sm:hidden" data-testid="receipt-breakdown-mobile">
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
            <div className="receipt-view__table hidden overflow-x-auto sm:block" data-testid="receipt-breakdown-table">
            <table className="min-w-[720px] divide-y divide-slate-200 text-xs">
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

        {/* Dual Financial Status Indicators */}
        <div className={`receipt-view__status grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs ${receipt.isSimulatedDemo ? 'receipt-view__status--simulation' : ''}`}>
          {/* Payment record status; the simulation is not a Treasury settlement. */}
          <div className="flex items-start gap-2.5">
            <div className="p-1.5 rounded-full bg-emerald-100 text-emerald-800 mt-0.5">
              <CheckCircle className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-slate-700 block">{receipt.isSimulatedDemo ? (bn ? 'রেকর্ডের অবস্থা' : 'Record status') : labels.treasuryStatus}:</span>
              <span className="inline-block px-2 py-0.5 mt-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                {treasuryStatusLabels}
              </span>
            </div>
          </div>

          {/* Tax Credit Entitlement Status */}
          <div className="flex items-start gap-2.5">
            <div className="p-1.5 rounded-full bg-blue-100 text-blue-800 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-slate-700 block">{labels.credit}:</span>
              <span className={`inline-block px-2 py-0.5 mt-0.5 rounded text-[11px] font-bold border ${
                receipt.taxCreditStatus === 'CREDITED_TO_LEDGER'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : receipt.taxCreditStatus === 'NOT_APPLICABLE'
                  ? 'bg-slate-200 text-slate-700 border-slate-300'
                  : 'bg-amber-100 text-amber-800 border-amber-300'
              }`}>
                {creditStatusLabel}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
