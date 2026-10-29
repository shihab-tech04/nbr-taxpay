import React, { useEffect, useState } from 'react';
import { Download, FileText, Printer } from 'lucide-react';
import { TaxpayerActivityTabs, TaxpayerPageHeading } from '../layout/TaxpayerPageStructure';
import { TaxPayModal } from '../ui/TaxPayModal';
import { useTaxState } from '../../services/taxState';
import { formatCurrency } from '../../services/numberFormat';
import { downloadDisplayedCertificateSummary } from '../../services/receiptDocumentExport';
import { getStorySessionPayments, type StorySessionPayment } from '../../services/simulatedPaymentStory';

type CertificatePreview = 'ANNUAL_PAYMENT' | 'WITHHOLDING_PROOF' | 'TRAVEL_CLEARANCE';

const previewOptions: { id: CertificatePreview; en: string; bn: string }[] = [
  { id: 'ANNUAL_PAYMENT', en: 'Annual payment summary', bn: 'বার্ষিক পেমেন্টের সারসংক্ষেপ' },
  { id: 'WITHHOLDING_PROOF', en: 'Withholding deposit summary', bn: 'উৎসে কর জমার সারসংক্ষেপ' },
  { id: 'TRAVEL_CLEARANCE', en: 'Travel tax payment summary', bn: 'ভ্রমণ কর পেমেন্টের সারসংক্ষেপ' }
];

export const CertificatesView: React.FC<{ activityTabs?: boolean }> = ({ activityTabs = false }) => {
  const { language } = useTaxState();
  const [selectedPreview, setSelectedPreview] = useState<CertificatePreview>('ANNUAL_PAYMENT');
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [sqlPayments, setSqlPayments] = useState<StorySessionPayment[]>([]);
  const [sqlError, setSqlError] = useState(false);
  const bn = language === 'bn';
  const label = (en: string, bengali: string) => bn ? bengali : en;

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const rows = await getStorySessionPayments();
        if (active) {
          setSqlPayments(rows.filter(row => row.status === 'SIMULATED_SUCCESS'));
          setSqlError(false);
        }
      } catch {
        if (active) setSqlError(true);
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const scopedPayments = sqlPayments.filter(row => selectedPreview === 'ANNUAL_PAYMENT' ||
    (selectedPreview === 'WITHHOLDING_PROOF' && row.service === 'SOURCE_TAX_DEPOSIT') ||
    (selectedPreview === 'TRAVEL_CLEARANCE' && row.service === 'TRAVEL_TAX'));
  const recordedTotal = scopedPayments.reduce((total, row) => total + row.amountMinor / 100, 0);
  const totalValue = sqlError ? label('Unavailable', 'পাওয়া যাচ্ছে না') :
    formatCurrency(recordedTotal, language);
  const countValue = sqlError ? label('Unavailable', 'পাওয়া যাচ্ছে না') :
    new Intl.NumberFormat(bn ? 'bn-BD' : 'en-US').format(scopedPayments.length);
  const details = selectedPreview === 'ANNUAL_PAYMENT'
    ? [
      { label: label('Payment total', 'পেমেন্টের মোট'), value: totalValue },
      { label: label('Records', 'রেকর্ড'), value: countValue },
      { label: label('Treasury settlement', 'ট্রেজারি জমা'), value: label('Not verified', 'যাচাই হয়নি') },
      { label: label('Tax credit', 'কর ক্রেডিট'), value: label('Not verified', 'যাচাই হয়নি') }
    ]
    : selectedPreview === 'WITHHOLDING_PROOF'
      ? [
        { label: label('Deposit total', 'জমার মোট'), value: totalValue },
        { label: label('Records', 'রেকর্ড'), value: countValue },
        { label: label('Deductee ownership', 'করদাতার মালিকানা'), value: label('Not verified', 'যাচাই হয়নি') },
        { label: label('Tax credit', 'কর ক্রেডিট'), value: label('Not verified', 'যাচাই হয়নি') }
      ]
      : [
        { label: label('Travel payment total', 'ভ্রমণ পেমেন্টের মোট'), value: totalValue },
        { label: label('Records', 'রেকর্ড'), value: countValue },
        { label: label('Government receipt', 'সরকারি রসিদ'), value: label('Unavailable', 'উপলব্ধ নয়') },
        { label: label('Travel clearance', 'ভ্রমণ ছাড়পত্র'), value: label('Unavailable', 'উপলব্ধ নয়') }
      ];
  const selectedOption = previewOptions.find(option => option.id === selectedPreview)!;
  const selectedTitle = bn ? selectedOption.bn : selectedOption.en;

  return (
    <div className={bn ? 'mx-auto max-w-4xl space-y-4 pb-12 font-bengali' : 'mx-auto max-w-4xl space-y-4 pb-12'}>
      <TaxpayerPageHeading id="certificate-preview-title"
        title={label('Certificate summaries', 'সনদের সারসংক্ষেপ')}
        actions={
          <button type="button" onClick={() => setSummaryOpen(true)}
            className="no-print inline-flex min-h-11 items-center gap-2 rounded-lg bg-taxpay-primary px-4 text-sm font-semibold text-white hover:bg-taxpay-dark">
            <FileText size={17} aria-hidden="true" />
            {label('View summary', 'সারসংক্ষেপ দেখুন')}
          </button>
        } />
      {activityTabs && <TaxpayerActivityTabs />}
      <section className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-6" aria-labelledby="certificate-preview-title">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label={label('Choose a summary', 'সারসংক্ষেপ বাছুন')}>
          {previewOptions.map(option => (
            <button key={option.id} type="button"
              aria-pressed={selectedPreview === option.id}
              onClick={() => { setSelectedPreview(option.id); setSummaryOpen(true); }}
              className={selectedPreview === option.id
                ? 'min-h-11 rounded-lg border border-taxpay-primary bg-taxpay-primary-light px-3 py-2 text-left text-sm font-semibold text-taxpay-dark'
                : 'min-h-11 rounded-lg border border-taxpay-border bg-white px-3 py-2 text-left text-sm font-semibold text-taxpay-text hover:bg-taxpay-background'}>
              {bn ? option.bn : option.en}
            </button>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-taxpay-border bg-taxpay-background p-4">
          <p className="text-sm font-semibold text-taxpay-dark">{label('Selected document', 'নির্বাচিত নথি')}</p>
          <h2 className="mt-1 text-lg font-bold text-taxpay-text">{selectedTitle}</h2>
          <p className="mt-2 text-sm text-taxpay-muted">
            {label('Open the summary to view recorded transactions, download or print.',
              'রেকর্ডকৃত লেনদেন দেখতে, ডাউনলোড করতে বা প্রিন্ট করতে সারসংক্ষেপ খুলুন।')}
          </p>
        </div>
      </section>

      {summaryOpen && (
        <TaxPayModal title={label('Certificate summary', 'সনদের সারসংক্ষেপ')}
          className="receipt-modal certificate-summary-modal" service="status"
          onClose={() => setSummaryOpen(false)}
          closeIconLabel={label('Close modal', 'বন্ধ করুন')}
          footer={
            <div className="receipt-view__actions no-print">
              <div className="receipt-view__action-group">
                <button type="button" className="receipt-view__action receipt-view__action--secondary"
                  onClick={() => downloadDisplayedCertificateSummary(selectedPreview)}>
                  <Download size={18} aria-hidden="true" />
                  {label('Download', 'ডাউনলোড')}
                </button>
                <button type="button" className="receipt-view__action receipt-view__action--primary"
                  onClick={() => window.print()}>
                  <Printer size={18} aria-hidden="true" />
                  {label('Print summary', 'সারসংক্ষেপ প্রিন্ট')}
                </button>
              </div>
            </div>
          }>
          <div className={bn ? 'receipt-view receipt-view--embedded font-bengali' : 'receipt-view receipt-view--embedded'} lang={language}>
            <article className="receipt-view__paper print-card" lang={language} data-testid="certificate-summary-document">
              <header className="receipt-view__summary">
                <div className="receipt-view__summary-copy">
                  <p className="receipt-view__eyebrow">{label('Certificate summary', 'সনদের সারসংক্ষেপ')}</p>
                  <h3>{selectedTitle}</h3>
                  <p className="receipt-view__summary-subtitle">
                    {label('Recorded payment overview', 'রেকর্ডকৃত পেমেন্টের সারসংক্ষেপ')}
                  </p>
                </div>
                <div className="receipt-view__amount">
                  <span>{label('Total amount', 'সর্বমোট অর্থ')}</span>
                  <strong>{totalValue}</strong>
                  <small>{label('Recorded transactions', 'রেকর্ডকৃত লেনদেন')}</small>
                </div>
              </header>
              <div className="receipt-view__reference-strip">
                <div>
                  <span>{label('Document type', 'নথির ধরন')}</span>
                  <strong className="block break-words text-sm">{selectedTitle}</strong>
                </div>
                <div>
                  <span>{label('Number of records', 'রেকর্ডের সংখ্যা')}</span>
                  <strong className="block text-sm">{countValue}</strong>
                </div>
              </div>
              <div className="receipt-view__parties">
                <section>
                  <h3 className="receipt-view__section-title">{label('Payment overview', 'পেমেন্টের সারসংক্ষেপ')}</h3>
                  {details.slice(0, 2).map(item => (
                    <div key={item.label} className="receipt-view__detail">
                      <span>{item.label}:</span><span>{item.value}</span>
                    </div>
                  ))}
                </section>
                <section>
                  <h3 className="receipt-view__section-title">{label('Record information', 'রেকর্ডের তথ্য')}</h3>
                  {details.slice(2).map(item => (
                    <div key={item.label} className="receipt-view__detail">
                      <span>{item.label}:</span><span>{item.value}</span>
                    </div>
                  ))}
                </section>
              </div>
              <section className="receipt-view__breakdown">
                <h3 className="receipt-view__section-title">{label('Payment records', 'পেমেন্ট রেকর্ড')}</h3>
                {sqlError ? (
                  <p role="status" className="text-sm text-taxpay-muted">{label('Records are temporarily unavailable.', 'রেকর্ড সাময়িকভাবে পাওয়া যাচ্ছে না।')}</p>
                ) : scopedPayments.length === 0 ? (
                  <p role="status" className="text-sm text-taxpay-muted">{label('No matching records.', 'কোনো মিল পাওয়া যায়নি।')}</p>
                ) : (
                  <div className="receipt-view__breakdown-content">
                    <div className="receipt-view__cards" data-testid="certificate-summary-mobile">
                      {scopedPayments.map(row => (
                        <article key={row.id} className="p-3">
                          <p className="break-all font-mono-plex text-sm font-semibold">{row.id}</p>
                          <p className="mt-1 text-sm">{row.service.replace(/_/g, ' ')}</p>
                          <p className="mt-1 text-sm">{new Date(row.createdAt).toLocaleDateString(bn ? 'bn-BD' : 'en-GB')}</p>
                          <p className="mt-2 text-sm font-bold">{formatCurrency(row.amountMinor / 100, language)}</p>
                        </article>
                      ))}
                    </div>
                    <div className="receipt-view__table" data-testid="certificate-summary-table">
                      <table className="receipt-view__financial-table">
                        <thead>
                          <tr>
                            <th scope="col">{label('Transaction ID', 'লেনদেন আইডি')}</th>
                            <th scope="col">{label('Service', 'সেবা')}</th>
                            <th scope="col">{label('Date', 'তারিখ')}</th>
                            <th scope="col">{label('Amount (BDT)', 'টাকা (বিডিটি)')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scopedPayments.map(row => (
                            <tr key={row.id}>
                              <td className="break-all font-mono-plex">{row.id}</td>
                              <td>{row.service.replace(/_/g, ' ')}</td>
                              <td>{new Date(row.createdAt).toLocaleDateString(bn ? 'bn-BD' : 'en-GB')}</td>
                              <td>{formatCurrency(row.amountMinor / 100, language)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            </article>
          </div>
        </TaxPayModal>
      )}
    </div>
  );
};
