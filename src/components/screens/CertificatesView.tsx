import React, { useEffect, useState } from 'react';
import { Download, FileText, Printer } from 'lucide-react';
import { TaxpayerActivityTabs, TaxpayerPageHeading } from '../layout/TaxpayerPageStructure';
import { TaxPayModal } from '../ui/TaxPayModal';
import { useTaxState } from '../../services/taxState';
import { formatCurrency } from '../../services/numberFormat';
import { downloadDisplayedCertificateSummary } from '../../services/receiptDocumentExport';
import { getAccountStoryPayments, getDetailedStorySessionPayments, beneficiaryPaymentEntries, type BeneficiaryPaymentEntry } from '../../services/story1AccountPaymentHistory';
import { useAccountIdentity } from '../../services/accountIdentity';
import { ReceiptView } from '../common/ReceiptView';
import type { ChallanReceipt } from '../../types/tax';
import {TaxPayDataGrid,TaxPayTableControls,TaxPayTableCounter,TaxPayTableState} from '../ui/TaxPayDataTable';

type CertificatePreview = 'ANNUAL_PAYMENT' | 'WITHHOLDING_PROOF' | 'TRAVEL_CLEARANCE';

const previewOptions: { id: CertificatePreview; en: string; bn: string }[] = [
  { id: 'ANNUAL_PAYMENT', en: 'Annual payment summary', bn: 'বার্ষিক পেমেন্টের সারসংক্ষেপ' },
  { id: 'WITHHOLDING_PROOF', en: 'Withholding deposit summary', bn: 'উৎসে কর জমার সারসংক্ষেপ' },
  { id: 'TRAVEL_CLEARANCE', en: 'Travel tax payment summary', bn: 'ভ্রমণ কর পেমেন্টের সারসংক্ষেপ' }
];

export const CertificatesView: React.FC<{ activityTabs?: boolean }> = ({ activityTabs = false }) => {
  const { language } = useTaxState();
  const { user: authenticatedUser } = useAccountIdentity();
  const [selectedPreview, setSelectedPreview] = useState<CertificatePreview>('ANNUAL_PAYMENT');
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [sqlPayments, setSqlPayments] = useState<BeneficiaryPaymentEntry[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<ChallanReceipt | null>(null);
  const [sqlError, setSqlError] = useState(false);
  const [sqlLoading,setSqlLoading]=useState(true);
  const [recordSearch,setRecordSearch]=useState('');
  const [receiptReturnToSummary,setReceiptReturnToSummary]=useState(false);
  const bn = language === 'bn';
  const label = (en: string, bengali: string) => bn ? bengali : en;

  useEffect(() => {
    let active = true;
    setSqlLoading(true);
    setSqlPayments([]);
    setSelectedReceipt(null);
    setSummaryOpen(false);
    const refresh = async () => {
      try {
        const payments=authenticatedUser
          ?await getAccountStoryPayments(authenticatedUser.id)
          :await getDetailedStorySessionPayments();
        if (active) {
          setSqlPayments(beneficiaryPaymentEntries(payments));
          setSqlError(false);
          setSqlLoading(false);
        }
      } catch {
        if (active) {setSqlError(true);setSqlLoading(false);setSqlPayments([]);}
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [authenticatedUser?.id]);

  const scopedPayments = sqlPayments.filter(row => selectedPreview === 'ANNUAL_PAYMENT' ||
    (selectedPreview === 'WITHHOLDING_PROOF' && row.receipt.paymentCategory === 'SOURCE_TAX_DEPOSIT') ||
    (selectedPreview === 'TRAVEL_CLEARANCE' && row.receipt.paymentCategory === 'TRAVEL_TAX'));
  const recordNeedle=recordSearch.trim().toLocaleLowerCase();
  const matchingPayments=scopedPayments.filter(row=>!recordNeedle || [
    row.beneficiaryName,row.taxpayerTin,row.paymentHead,row.assessmentYear,row.paymentId,row.economicCode
  ].some(value=>String(value??'').toLocaleLowerCase().includes(recordNeedle)));
  // Use integer minor units so the total equals the sum of beneficiary lines.
  const recordedMinor = scopedPayments.reduce((total,row) => total + row.amountMinor,0);
  const recordedTotal = recordedMinor / 100;
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
    <div className={bn ? 'mx-auto max-w-6xl space-y-4 pb-12 font-bengali' : 'mx-auto max-w-6xl space-y-4 pb-12'}>
      <TaxpayerPageHeading id="certificate-preview-title"
        title={label('Receipts & payment records','রসিদ ও পেমেন্ট রেকর্ড')}
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

      <section className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-6 space-y-3"
        aria-label={label('Recorded payments','সংরক্ষিত পেমেন্ট')} data-testid="account-certificate-record-register">
        <div className="taxpay-table-toolbar">
          <div>
            <h2 className="text-base font-semibold text-taxpay-text">{label('Payment records','পেমেন্ট রেকর্ড')}</h2>
            <p className="mt-1 text-sm text-taxpay-muted">{label('Saved payment records are not government-issued certificates or verified tax credits.',
              'সংরক্ষিত পেমেন্ট রেকর্ড সরকারি সনদ বা যাচাইকৃত কর ক্রেডিট নয়।')}</p>
          </div>
          <TaxPayTableCounter label={label('Records','রেকর্ড')} shown={matchingPayments.length} total={scopedPayments.length}/>
        </div>
        <TaxPayTableControls className="taxpay-record-page-filters">
          <label className="taxpayer-transaction-filter">
            <span>{label('Find a payment record','পেমেন্ট রেকর্ড খুঁজুন')}</span>
            <input type="search" className="min-h-11 w-full rounded-lg border border-taxpay-border bg-white px-3 text-base"
              aria-label={label('Find a payment record','পেমেন্ট রেকর্ড খুঁজুন')}
              placeholder={label('Search reference, name, TIN or tax head','রেফারেন্স, নাম, টিআইএন বা কর খাত')}
              value={recordSearch} onChange={event=>setRecordSearch(event.target.value)}/>
          </label>
          {recordSearch&&<button type="button" className="min-h-11 rounded-lg border border-taxpay-border px-3 font-semibold text-taxpay-primary"
            onClick={()=>setRecordSearch('')}>{label('Clear search','অনুসন্ধান মুছুন')}</button>}
        </TaxPayTableControls>
        {sqlLoading?<TaxPayTableState>{label('Loading payment records…','পেমেন্ট রেকর্ড লোড হচ্ছে…')}</TaxPayTableState>:
         sqlError?<div role="alert" className="taxpay-table-state">{label('Payment records are temporarily unavailable.','পেমেন্ট রেকর্ড সাময়িকভাবে পাওয়া যাচ্ছে না।')}</div>:
         matchingPayments.length===0?<TaxPayTableState>{scopedPayments.length
           ?label('No payment records match the search.','এই অনুসন্ধানে কোনো পেমেন্ট রেকর্ড নেই।')
           :label('No payment records in this summary.','এই সারসংক্ষেপে কোনো পেমেন্ট রেকর্ড নেই।')}</TaxPayTableState>:
         <TaxPayDataGrid variant="tabular" rows={matchingPayments} getRowKey={row=>row.key}
           ariaLabel={label('Recorded payment register','সংরক্ষিত পেমেন্ট তালিকা')}
           testId="account-certificate-payment-table" mobileTestId="account-certificate-payment-cards"
           columns={[
             {key:'beneficiary',header:label('Beneficiary / TIN','উপকারভোগী / টিআইএন'),renderCell:row=><div>
               <p className="font-semibold">{row.beneficiaryName}</p>
               <p className="break-all font-mono-plex text-sm text-taxpay-muted">{row.taxpayerTin||'—'}</p>
             </div>},
             {key:'head',header:label('Tax head / year','কর খাত / করবর্ষ'),renderCell:row=><div>
               <p>{row.paymentHead}</p><p className="text-sm text-taxpay-muted">{row.assessmentYear}</p>
             </div>},
             {key:'reference',header:label('Reference','রেফারেন্স'),renderCell:row=><p className="break-all font-mono-plex text-sm">{row.paymentId}</p>},
             {key:'amount',header:label('Amount','পরিমাণ'),headerClassName:'text-right',cellClassName:'text-right tabular-nums',
               renderCell:row=><p className="font-semibold">{formatCurrency(row.amountMinor/100,language)}</p>},
             {key:'receipt',header:label('Receipt','রসিদ'),renderCell:row=><button type="button"
               className="min-h-11 rounded-lg border border-taxpay-border px-3 font-semibold text-taxpay-primary"
               onClick={()=>{setReceiptReturnToSummary(false);setSelectedReceipt(row.receipt);}}>{label('View receipt','রসিদ দেখুন')}</button>}
           ]}
           renderMobileCard={row=><>
             <div className="taxpay-mobile-table-card__header">
               <p className="taxpay-mobile-table-card__title">{row.beneficiaryName}</p>
               <p className="shrink-0 font-semibold tabular-nums">{formatCurrency(row.amountMinor/100,language)}</p>
             </div>
             <p className="taxpay-mobile-table-card__meta">{label('TIN','টিআইএন')}: {row.taxpayerTin||'—'}</p>
             <p className="taxpay-mobile-table-card__meta">{row.paymentHead} · {row.assessmentYear}</p>
             <p className="taxpay-mobile-table-card__meta break-all">{label('Reference','রেফারেন্স')}: {row.paymentId}</p>
             <div className="taxpay-mobile-table-card__actions">
               <button type="button" className="min-h-11 rounded-lg border border-taxpay-border px-3 font-semibold text-taxpay-primary"
                 onClick={()=>{setReceiptReturnToSummary(false);setSelectedReceipt(row.receipt);}}>{label('View receipt','রসিদ দেখুন')}</button>
             </div>
           </>}/>}
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
                        <article key={row.key} className="p-3">
                          <p className="font-semibold">{row.beneficiaryName}</p>
                          <p className="break-all font-mono-plex text-xs">{row.taxpayerTin || '—'}</p>
                          <p className="mt-1 text-sm">{row.paymentHead} · {row.assessmentYear}</p>
                          <p className="mt-1 break-all font-mono-plex text-xs">{row.paymentId}</p>
                          <p className="mt-2 text-sm font-bold">{formatCurrency(row.amountMinor / 100, language)}</p>
                          <button type="button" className="mt-2 min-h-11 rounded-lg border border-taxpay-border px-3 font-semibold text-taxpay-primary"
                            onClick={()=>{setSummaryOpen(false);setReceiptReturnToSummary(true);setSelectedReceipt(row.receipt);}}>{label('View receipt','রসিদ দেখুন')}</button>
                        </article>
                      ))}
                    </div>
                    <div className="receipt-view__table" data-testid="certificate-summary-table">
                      <table className="receipt-view__financial-table">
                        <thead>
                          <tr>
                            <th scope="col">{label('Transaction ID', 'লেনদেন আইডি')}</th>
                            <th scope="col">{label('Beneficiary / TIN','উপকারভোগী / টিআইএন')}</th>
                            <th scope="col">{label('Payment head','পেমেন্ট খাত')}</th>
                            <th scope="col">{label('Assessment year','করবর্ষ')}</th>
                            <th scope="col" className="text-right">{label('Amount (৳)', 'পরিমাণ (৳)')}</th>
                            <th scope="col">{label('Receipt','রসিদ')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scopedPayments.map(row => (
                            <tr key={row.key}>
                              <td className="break-all font-mono-plex">{row.paymentId}</td>
                              <td><strong>{row.beneficiaryName}</strong><small className="block break-all">{row.taxpayerTin||'—'}</small></td>
                              <td>{row.paymentHead}{row.economicCode&&<small className="block">{row.economicCode}</small>}</td>
                              <td>{row.assessmentYear}</td>
                              <td className="text-right font-mono-plex">{formatCurrency(row.amountMinor / 100, language)}</td>
                              <td><button type="button" className="min-h-11 font-semibold text-taxpay-primary"
                                onClick={()=>{setSummaryOpen(false);setReceiptReturnToSummary(true);setSelectedReceipt(row.receipt);}}>{label('View','দেখুন')}</button></td>
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
      {selectedReceipt&&<TaxPayModal title={label('Payment receipt','পেমেন্ট রসিদ')} service="status"
        className="receipt-modal" footer={<></>}
        onClose={()=>{setSelectedReceipt(null);if(receiptReturnToSummary)setSummaryOpen(true);}}>
        <ReceiptView receipt={selectedReceipt} embedded/>
      </TaxPayModal>}
    </div>
  );
};
