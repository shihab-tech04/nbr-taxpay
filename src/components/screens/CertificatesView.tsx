import React, { useState } from 'react';
import { FileText, Printer, ShieldAlert } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { formatCurrency } from '../../services/numberFormat';

type CertificatePreview = 'ANNUAL_PAYMENT' | 'WITHHOLDING_PROOF' | 'TRAVEL_CLEARANCE';

const previewOptions: { id: CertificatePreview; en: string; bn: string }[] = [
  { id: 'ANNUAL_PAYMENT', en: 'Annual payment summary', bn: 'বার্ষিক পেমেন্টের সারসংক্ষেপ' },
  { id: 'WITHHOLDING_PROOF', en: 'Withholding deposit summary', bn: 'উৎসে কর জমার সারসংক্ষেপ' },
  { id: 'TRAVEL_CLEARANCE', en: 'Travel tax payment summary', bn: 'ভ্রমণ কর পেমেন্টের সারসংক্ষেপ' }
];

export const CertificatesView: React.FC = () => {
  const { taxpayerProfile, receipts, language } = useTaxState();
  const [selectedPreview, setSelectedPreview] = useState<CertificatePreview>('ANNUAL_PAYMENT');
  const bn = language === 'bn';
  const label = (en: string, bengali: string) => bn ? bengali : en;

  // These payer-linked records are synthetic UI fixtures. They do not prove settlement,
  // identify a tax-credit owner, or support a government-issued certificate.
  const sampleReceipts = receipts.filter(receipt => receipt.payerTin === taxpayerProfile.tin);
  const sampleTotal = sampleReceipts.reduce((total, receipt) => total + receipt.totalAmount, 0);

  const details = selectedPreview === 'ANNUAL_PAYMENT'
    ? [
      { label: label('Example payment total', 'নমুনা পেমেন্টের মোট'), value: formatCurrency(sampleTotal, language) },
      { label: label('Example records', 'নমুনা রেকর্ড'), value: new Intl.NumberFormat(bn ? 'bn-BD' : 'en-US').format(sampleReceipts.length) },
      { label: label('Treasury settlement', 'ট্রেজারি জমা'), value: label('Not verified', 'যাচাই হয়নি') },
      { label: label('Tax credit', 'কর ক্রেডিট'), value: label('Not verified', 'যাচাই হয়নি') }
    ]
    : selectedPreview === 'WITHHOLDING_PROOF'
      ? [
        { label: label('eTDS connection', 'ই-টিডিএস সংযোগ'), value: label('Not connected', 'সংযুক্ত নয়') },
        { label: label('Deductee ownership', 'করদাতার মালিকানা'), value: label('Not verified', 'যাচাই হয়নি') },
        { label: label('Tax credit', 'কর ক্রেডিট'), value: label('Not verified', 'যাচাই হয়নি') }
      ]
      : [
        { label: label('Travel tax service', 'ভ্রমণ কর সেবা'), value: label('Not connected', 'সংযুক্ত নয়') },
        { label: label('Government receipt', 'সরকারি রসিদ'), value: label('Not issued', 'ইস্যু হয়নি') },
        { label: label('Travel clearance', 'ভ্রমণ ছাড়পত্র'), value: label('Not issued', 'ইস্যু হয়নি') }
      ];

  const selectedOption = previewOptions.find(option => option.id === selectedPreview)!;

  return (
    <div className={`mx-auto max-w-4xl space-y-4 pb-12 ${bn ? 'font-bengali' : ''}`}>
      <section className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-6" aria-labelledby="certificate-preview-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-taxpay-light text-taxpay-dark">
              <FileText size={20} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-taxpay-dark">{label('DEMONSTRATION PREVIEW', 'নমুনা প্রদর্শনী')}</p>
              <h1 id="certificate-preview-title" className="mt-1 text-xl font-bold leading-snug text-taxpay-text sm:text-2xl">
                {label('Certificate previews', 'সনদের নমুনা')}
              </h1>
              <p className="mt-1 text-sm leading-relaxed text-taxpay-muted">
                {label('No official certificate is issued from this demonstration.', 'এই প্রদর্শনী থেকে কোনো সরকারি সনদ ইস্যু করা হয় না।')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="no-print inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-lg bg-taxpay-primary px-4 text-sm font-semibold text-white hover:bg-taxpay-dark"
          >
            <Printer size={17} aria-hidden="true" />
            {label('Print sample preview', 'নমুনা প্রিভিউ প্রিন্ট')}
          </button>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-lg border border-taxpay-border bg-taxpay-background p-3 text-sm leading-relaxed text-taxpay-text" role="note">
          <ShieldAlert className="mt-0.5 shrink-0 text-taxpay-dark" size={18} aria-hidden="true" />
          <p>{label(
            'Illustrative interface data only. This preview does not verify a payment, Treasury settlement, tax-credit owner or eligibility.',
            'শুধু নমুনা প্রদর্শনের তথ্য। এই প্রিভিউ কোনো পেমেন্ট, ট্রেজারি জমা, কর ক্রেডিটের মালিকানা বা যোগ্যতা যাচাই করে না।'
          )}</p>
        </div>

        <div className="mt-5 border-t border-taxpay-border pt-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label={label('Choose a sample preview', 'নমুনা প্রিভিউ বাছুন')}>
            {previewOptions.map(option => (
              <button
                key={option.id}
                type="button"
                aria-pressed={selectedPreview === option.id}
                onClick={() => setSelectedPreview(option.id)}
                className={`min-h-11 min-w-0 rounded-lg border px-3 py-2 text-left text-sm font-semibold leading-snug transition-colors ${
                  selectedPreview === option.id
                    ? 'border-taxpay-primary bg-taxpay-primary-light text-taxpay-dark'
                    : 'border-taxpay-border bg-white text-taxpay-text hover:bg-taxpay-background'
                }`}
              >
                {bn ? option.bn : option.en}
              </button>
            ))}
          </div>

          <section className="mt-4 rounded-xl border border-dashed border-taxpay-border bg-taxpay-background p-4 sm:p-6" aria-labelledby="certificate-summary-title" aria-live="polite">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-taxpay-dark">
                <FileText size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-taxpay-dark">{label('SAMPLE SUMMARY', 'নমুনা সারসংক্ষেপ')}</p>
                <h2 id="certificate-summary-title" className="mt-1 text-lg font-bold leading-snug text-taxpay-text">
                  {bn ? selectedOption.bn : selectedOption.en}
                </h2>
              </div>
            </div>

            <dl className="mt-4 grid gap-2 sm:grid-cols-2">
              {details.map(item => (
                <div key={item.label} className="min-w-0 rounded-lg border border-taxpay-border bg-white p-3">
                  <dt className="text-xs font-medium text-taxpay-muted">{item.label}</dt>
                  <dd className="mt-1 break-words text-sm font-semibold text-taxpay-text">{item.value}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-4 border-t border-taxpay-border pt-3 text-sm font-semibold leading-relaxed text-taxpay-dark">
              {label('Not an issued certificate, payment receipt, tax-credit record or travel clearance.', 'এটি ইস্যুকৃত সনদ, পেমেন্ট রসিদ, কর ক্রেডিটের রেকর্ড বা ভ্রমণ ছাড়পত্র নয়।')}
            </p>
          </section>
        </div>
      </section>
    </div>
  );
};
