import React, { useState } from 'react';
import { FileText, Printer } from 'lucide-react';
import {TaxpayerActivityTabs, TaxpayerPageHeading} from '../layout/TaxpayerPageStructure';
import { useTaxState } from '../../services/taxState';
import { formatCurrency } from '../../services/numberFormat';
import { useAccountIdentity } from '../../services/accountIdentity';
import { taxpayerPreviewReceipts } from '../../services/taxpayerEvidence';

type CertificatePreview = 'ANNUAL_PAYMENT' | 'WITHHOLDING_PROOF' | 'TRAVEL_CLEARANCE';

const previewOptions: { id: CertificatePreview; en: string; bn: string }[] = [
  { id: 'ANNUAL_PAYMENT', en: 'Annual payment summary', bn: 'বার্ষিক পেমেন্টের সারসংক্ষেপ' },
  { id: 'WITHHOLDING_PROOF', en: 'Withholding deposit summary', bn: 'উৎসে কর জমার সারসংক্ষেপ' },
  { id: 'TRAVEL_CLEARANCE', en: 'Travel tax payment summary', bn: 'ভ্রমণ কর পেমেন্টের সারসংক্ষেপ' }
];

export const CertificatesView: React.FC<{activityTabs?:boolean}> = ({activityTabs=false}) => {
  const { taxpayerProfile, receipts, language, userRole, demoUser } = useTaxState();
  const {user:authenticatedUser}=useAccountIdentity();
  const [selectedPreview, setSelectedPreview] = useState<CertificatePreview>('ANNUAL_PAYMENT');
  const bn = language === 'bn';
  const label = (en: string, bengali: string) => bn ? bengali : en;

  // These payer-linked records are synthetic UI fixtures. They do not prove settlement,
  // identify a tax-credit owner, or support a government-issued certificate.
  const sampleReceipts = taxpayerPreviewReceipts(receipts, taxpayerProfile.tin, userRole, demoUser, Boolean(authenticatedUser));
  const sampleTotal = sampleReceipts.reduce((total, receipt) => total + receipt.totalAmount, 0);
  const sampleAvailable = sampleReceipts.length > 0;

  const details = selectedPreview === 'ANNUAL_PAYMENT'
    ? [
      { label: label('Payment total', 'পেমেন্টের মোট'), value: sampleAvailable ? formatCurrency(sampleTotal, language) : label('Not available', 'পাওয়া যাচ্ছে না') },
      { label: label('Records', 'রেকর্ড'), value: sampleAvailable ? new Intl.NumberFormat(bn ? 'bn-BD' : 'en-US').format(sampleReceipts.length) : label('Not available', 'পাওয়া যাচ্ছে না') },
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
        { label: label('Government receipt', 'সরকারি রসিদ'), value: label('Unavailable', 'উপলব্ধ নয়') },
        { label: label('Travel clearance', 'ভ্রমণ ছাড়পত্র'), value: label('Unavailable', 'উপলব্ধ নয়') }
      ];

  const selectedOption = previewOptions.find(option => option.id === selectedPreview)!;

  return (
    <div className={`mx-auto max-w-4xl space-y-4 pb-12 ${bn ? 'font-bengali' : ''}`}>
      <TaxpayerPageHeading id="certificate-preview-title" title={label('Certificate summaries', 'সনদের সারসংক্ষেপ')} actions={
        <button
            type="button"
            onClick={() => window.print()}
            className="no-print inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-lg bg-taxpay-primary px-4 text-sm font-semibold text-white hover:bg-taxpay-dark"
          >
            <Printer size={17} aria-hidden="true" />
            {label('Print summary', 'সারসংক্ষেপ প্রিন্ট')}
          </button>} />
      {activityTabs && <TaxpayerActivityTabs />}
      <section className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-6" aria-labelledby="certificate-preview-title">
        <div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label={label('Choose a summary', 'সারসংক্ষেপ বাছুন')}>
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
                <p className="text-xs font-bold text-taxpay-dark">{label('SUMMARY', 'সারসংক্ষেপ')}</p>
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

          </section>
        </div>
      </section>
    </div>
  );
};
