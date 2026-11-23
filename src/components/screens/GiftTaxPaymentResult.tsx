import {AlertCircle, CheckCircle2, Clock3, Download, ExternalLink, Printer} from 'lucide-react';
import type {GiftTaxPaymentInput, GiftTaxPaymentOutcome} from '../../services/giftTaxPaymentGateway';
import {validatedGiftTaxSettlement} from '../../services/giftTaxPaymentGateway';

interface Props {
  language: 'en' | 'bn';
  input: GiftTaxPaymentInput;
  outcome: GiftTaxPaymentOutcome;
  onBack: () => void;
  onRetry: () => void;
  onRefresh?: () => void;
}
export function GiftTaxPaymentResult({language, input, outcome, onBack, onRetry, onRefresh}: Props) {
  const bn = language === 'bn';
  const t = (en: string, bd: string) => bn ? bd : en;
  const proof = validatedGiftTaxSettlement(outcome, input);
  // A malformed/unverified success callback must never unlock documents.
  const unsafeSuccess = outcome.kind === 'SETTLED' && !proof;
  const unavailable = outcome.kind === 'UNAVAILABLE' || unsafeSuccess;
  const pending = outcome.kind === 'PENDING';
  const failed = outcome.kind === 'FAILED';
  const success = Boolean(proof);
  const label = success ? t('Payment confirmed', 'পেমেন্ট নিশ্চিত')
    : pending ? t('Payment pending', 'পেমেন্ট অপেক্ষমাণ')
    : failed ? t('Payment failed', 'পেমেন্ট ব্যর্থ')
    : t('Payment not started', 'পেমেন্ট শুরু হয়নি');
  const Icon = success ? CheckCircle2 : pending ? Clock3 : AlertCircle;
  return <section data-testid="gift-tax-payment-result" aria-label={t('Gift Tax payment result', 'দানকর পেমেন্ট ফলাফল')}
    className="payment-form-layout__sections" aria-live="polite">
    <div role="status" className="payment-lifecycle gift-tax-result-status">
      <div className="flex items-start gap-3">
        <Icon size={23} aria-hidden="true" className="shrink-0 text-taxpay-primary"/>
        <div className="min-w-0">
          <h2 className="unified-taxpayer-workspace__heading">{label}</h2>
          <p className="text-sm leading-6 text-taxpay-muted">
            {success
              ? t('The gateway settlement, official challan and donor tax-credit posting have been verified by the server.', 'সার্ভারে গেটওয়ে নিষ্পত্তি, সরকারি চালান ও দাতার কর ক্রেডিট পোস্টিং যাচাই হয়েছে।')
              : pending
              ? t('Awaiting independent payment confirmation. No successful receipt or donor credit has been created.', 'স্বতন্ত্র পেমেন্ট নিশ্চয়তার অপেক্ষা চলছে। সফল রসিদ বা দাতার কর ক্রেডিট তৈরি হয়নি।')
              : failed
              ? t('The payment could not be confirmed. Your entered information is preserved.', 'পেমেন্ট নিশ্চিত করা যায়নি। আপনার দেওয়া তথ্য সংরক্ষিত আছে।')
              : t('Official Gift Tax payment is not connected. No payment was initiated, no money was charged, and no official challan, receipt or donor credit was generated.', 'সরকারি দানকর পেমেন্ট সংযুক্ত নয়। পেমেন্ট শুরু হয়নি, কোনো টাকা কাটা হয়নি, এবং সরকারি চালান, রসিদ বা দাতার কর ক্রেডিট তৈরি হয়নি।')}
          </p>
          {failed && <p role="alert" className="mt-2 text-sm text-taxpay-text">{outcome.reason}</p>}
          {pending && <p className="mt-2 text-sm text-taxpay-muted">{t('Reference', 'রেফারেন্স')}: {outcome.reference}</p>}
        </div>
      </div>
    </div>
    {proof && <div data-testid="gift-tax-settled-documents" className="payment-form-section payment-form-section--static">
      <div className="payment-form-section__body">
        <dl className="gift-tax-review-lines">
          <div><dt>{t('Challan number', 'চালান নম্বর')}</dt><dd>{proof.governmentChallanNo}</dd></div>
          <div><dt>{t('Donor TIN', 'দাতার টিআইএন')}</dt><dd>{proof.donorTin}</dd></div>
          <div><dt>{t('Tax zone / circle', 'কর অঞ্চল / সার্কেল')}</dt><dd>{proof.donorZone} / {proof.donorCircle}</dd></div>
          <div><dt>{t('Donor credit reference', 'দাতার ক্রেডিট রেফারেন্স')}</dt><dd>{proof.donorCreditPostingReference}</dd></div>
        </dl>
        <div className="flex flex-wrap gap-2">
          <a href={proof.receiptDocumentUrl} target="_blank" rel="noopener noreferrer" download
            className="gift-tax-action gift-tax-action--secondary">
            <Download size={17} aria-hidden="true"/>{t('Download receipt', 'রসিদ ডাউনলোড')}
          </a>
          <a href={proof.challanDocumentUrl} target="_blank" rel="noopener noreferrer" download
            className="gift-tax-action gift-tax-action--secondary">
            <Download size={17} aria-hidden="true"/>{t('Download challan', 'চালান ডাউনলোড')}
          </a>
          <a href={proof.receiptDocumentUrl} target="_blank" rel="noopener noreferrer"
            className="gift-tax-action gift-tax-action--secondary">
            <Printer size={17} aria-hidden="true"/>{t('Open receipt to print', 'প্রিন্টের জন্য রসিদ খুলুন')}<ExternalLink size={14} aria-hidden="true"/>
          </a>
        </div>
      </div>
    </div>}
    <div className="flex flex-wrap gap-2">
      {(unavailable || failed) && <button type="button" onClick={onBack}
        className="gift-tax-action gift-tax-action--secondary">
        {t('Back to Final Preview', 'চূড়ান্ত পর্যালোচনায় ফিরুন')}
      </button>}
      {failed && outcome.retryable && <button type="button" onClick={onRetry}
        className="tax-service-choice__continue">
        {t('Retry payment', 'আবার পরিশোধের চেষ্টা করুন')}
      </button>}
      {pending && onRefresh && <button type="button" onClick={onRefresh}
        className="gift-tax-action gift-tax-action--secondary">
        {t('Check payment status', 'পেমেন্টের অবস্থা দেখুন')}
      </button>}
    </div>
    {!proof && <p className="gift-tax-lookup-notice">
      {t('Only a verified gateway settlement and independently posted donor credit can unlock official documents.', 'শুধু যাচাইকৃত গেটওয়ে নিষ্পত্তি ও স্বতন্ত্রভাবে পোস্ট করা দাতার ক্রেডিট থাকলেই সরকারি নথি পাওয়া যাবে।')}
    </p>}
  </section>;
}
