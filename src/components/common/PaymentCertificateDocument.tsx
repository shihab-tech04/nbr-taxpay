import React from 'react';
import { Copy } from 'lucide-react';
import type { ChallanReceipt, Language } from '../../types/tax';
import { formatCurrency } from '../../services/numberFormat';
import { buildPaymentCertificateModel } from '../../services/paymentCertificateModel';

interface Props {
  receipt: ChallanReceipt;
  language: Language;
}

export const PaymentCertificateDocument: React.FC<Props> = ({ receipt, language }) => {
  const model = buildPaymentCertificateModel(receipt);
  const bn = language === 'bn';
  if (!model) return (
    <div className="payment-certificate-document" data-testid="payment-certificate-unavailable" role="alert">
      {bn
        ? 'সংরক্ষিত পেমেন্টের পরিচয়, বরাদ্দ বা মোট অর্থ মেলেনি। এই পেমেন্ট সনদ দেখানো যাচ্ছে না।'
        : 'The saved payment identity, allocations or total could not be reconciled. This payment certificate is unavailable.'}
    </div>
  );

  const paymentDate = new Intl.DateTimeFormat(bn ? 'bn-BD' : 'en-GB', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka',
  }).format(new Date(model.paymentDate));
  const labels = bn ? {
    title: 'পেমেন্ট সনদ',
    certificateRef: 'সনদ রেফারেন্স',
    paymentRef: 'পেমেন্ট রেফারেন্স',
    paymentDate: 'পেমেন্টের তারিখ',
    service: 'পেমেন্টের ধরন',
    assessmentYear: 'করবর্ষ',
    payer: 'পরিশোধকারী',
    payerTin: 'পরিশোধকারীর ই-টিআইএন',
    allocations: 'প্রাপক ও পেমেন্ট বরাদ্দ',
    recipient: 'করদাতা / যাত্রী',
    taxHead: 'খাত / বিবরণ',
    year: 'করবর্ষ / যাত্রার তারিখ',
    amount: 'বরাদ্দের পরিমাণ',
    total: 'মোট অর্থ',
    travel: 'ভ্রমণের তথ্য',
    mode: 'মাধ্যম',
    port: 'যাত্রা বন্দর',
    destination: 'গন্তব্য',
    travelDate: 'যাত্রার তারিখ',
    passport: 'পাসপোর্ট',
    nationality: 'জাতীয়তা',
    country: 'দেশ',
    age: 'বয়স',
    bangladeshi: 'বাংলাদেশি',
    foreign: 'বিদেশি',
    land: 'স্থলপথে',
    water: 'নৌপথে',
    note: 'এই সহজকর পেমেন্ট সনদটি সংরক্ষিত পেমেন্টের তথ্য নথিভুক্ত করে। এটি সরকারি কর-ক্রেডিট সনদ বা ব্যাংক/ট্রেজারি নিষ্পত্তির প্রমাণ নয়।',
    copy: 'সনদ রেফারেন্স কপি করুন',
  } : {
    title: 'Payment Certificate',
    certificateRef: 'Certificate reference',
    paymentRef: 'Payment reference',
    paymentDate: 'Payment date',
    service: 'Payment service',
    assessmentYear: 'Assessment year',
    payer: 'Paid by',
    payerTin: 'Payer e-TIN',
    allocations: 'Recipients and payment allocations',
    recipient: 'Taxpayer / passenger',
    taxHead: 'Tax head / description',
    year: 'Assessment year / travel date',
    amount: 'Allocated amount',
    total: 'Total amount',
    travel: 'Travel details',
    mode: 'Travel mode',
    port: 'Departure port',
    destination: 'Destination',
    travelDate: 'Travel date',
    passport: 'Passport',
    nationality: 'Nationality',
    country: 'Country',
    age: 'Age',
    bangladeshi: 'Bangladeshi',
    foreign: 'Foreign',
    land: 'Land',
    water: 'Water',
    note: 'This Sohojkor Payment Certificate records the linked payment. It is not a government tax-credit certificate or proof of bank or Treasury settlement.',
    copy: 'Copy certificate reference',
  };
  const numberLabel = (value: number) => value === undefined ? '—'
    : value.toLocaleString(bn ? 'bn-BD' : 'en-BD');

  return (
    <article className="payment-certificate-document space-y-4" data-testid="payment-certificate-document"
      aria-label={labels.title}>
      <header className="receipt-view__summary">
        <div className="receipt-view__summary-copy">
          <p className="receipt-view__eyebrow">Sohojkor</p>
          <h3>{labels.title}</h3>
          <p className="receipt-view__summary-subtitle">{bn ? model.serviceBn : model.serviceEn}</p>
        </div>
        <div className="receipt-view__amount">
          <span>{labels.total}</span>
          <strong data-testid="payment-certificate-total">{formatCurrency(model.totalMinor / 100, language)}</strong>
        </div>
      </header>

      <section className="receipt-view__reference-strip" aria-label={labels.title}>
        <div data-testid="payment-certificate-reference">
          <span className="text-slate-700 block">{labels.certificateRef}</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <strong className="receipt-view__reference-number font-mono-plex break-all">{model.certificateReference}</strong>
            <button type="button" className="receipt-view__copy no-print" aria-label={labels.copy}
              title={labels.copy} onClick={() => navigator.clipboard?.writeText(model.certificateReference)}>
              <Copy className="w-3.5 h-3.5" aria-hidden="true"/>
            </button>
          </div>
        </div>
        <div>
          <span className="text-slate-700 block">{labels.paymentRef}</span>
          <strong className="font-mono-plex break-all">{model.paymentReference}</strong>
        </div>
        <div>
          <span className="text-slate-700 block">{labels.paymentDate}</span>
          <strong>{paymentDate}</strong>
        </div>
      </section>

      <section className="receipt-view__parties" aria-label={labels.payer}>
        <div className="space-y-2">
          <h3 className="receipt-view__section-title">{labels.payer}</h3>
          <div className="receipt-view__detail">
            <span className="text-slate-700">{labels.payer}:</span>
            <strong className="col-span-2 text-slate-900">{model.payerName}</strong>
          </div>
          {model.payerTin && <div className="receipt-view__detail">
            <span className="text-slate-700">{labels.payerTin}:</span>
            <strong className="col-span-2 font-mono-plex text-slate-900">{model.payerTin}</strong>
          </div>}
          <div className="receipt-view__detail">
            <span className="text-slate-700">{labels.service}:</span>
            <strong className="col-span-2 text-slate-900">{bn ? model.serviceBn : model.serviceEn}</strong>
          </div>
          {model.assessmentYears.length > 0 && <div className="receipt-view__detail">
            <span className="text-slate-700">{labels.assessmentYear}:</span>
            <strong className="col-span-2 text-slate-900">{model.assessmentYears.join(', ')}</strong>
          </div>}
        </div>
        {model.travel && <div className="space-y-2" data-testid="payment-certificate-travel-details">
          <h3 className="receipt-view__section-title">{labels.travel}</h3>
          <div className="receipt-view__detail">
            <span className="text-slate-700">{labels.mode}:</span>
            <strong className="col-span-2">{model.travel.mode === 'LAND' ? labels.land : labels.water}</strong>
          </div>
          <div className="receipt-view__detail">
            <span className="text-slate-700">{labels.port}:</span>
            <strong className="col-span-2">{model.travel.departurePort}</strong>
          </div>
          <div className="receipt-view__detail">
            <span className="text-slate-700">{labels.destination}:</span>
            <strong className="col-span-2">{model.travel.destination}</strong>
          </div>
          <div className="receipt-view__detail">
            <span className="text-slate-700">{labels.travelDate}:</span>
            <strong className="col-span-2">{model.travel.travelDate}</strong>
          </div>
        </div>}
      </section>

      <section className="receipt-view__breakdown">
        <h3 className="receipt-view__section-title">{labels.allocations}</h3>
        <div className="receipt-view__table">
          <table className="receipt-view__financial-table" aria-label={labels.allocations}>
            <thead>
              <tr>
                <th scope="col">{labels.recipient}</th>
                <th scope="col">{labels.taxHead}</th>
                <th scope="col">{labels.year}</th>
                <th scope="col" className="text-right">{labels.amount}</th>
              </tr>
            </thead>
            <tbody>
              {model.lines.map((line, index) => (
                <tr key={model.paymentTransactionId + ':' + index} data-testid="payment-certificate-line">
                  <td>
                    <strong>{line.recipientName}</strong>
                    {line.recipientTin && <span className="block break-all font-mono-plex text-xs">{line.recipientTin}</span>}
                    {line.passportMasked && <span className="block text-xs">{labels.passport}: {line.passportMasked}</span>}
                    {line.nationality && <span className="block text-xs">
                      {labels.nationality}: {line.nationality === 'Bangladeshi' ? labels.bangladeshi : labels.foreign}
                      {line.country ? ' · ' + labels.country + ': ' + line.country : ''}
                    </span>}
                    {line.age !== undefined && <span className="block text-xs">{labels.age}: {numberLabel(line.age)}</span>}
                  </td>
                  <td>
                    <span>{bn ? line.descriptionBn : line.descriptionEn}</span>
                    {line.economicCode && <span className="block font-mono-plex text-xs">{line.economicCode}</span>}
                  </td>
                  <td>{line.assessmentYear ?? model.travel?.travelDate ?? '—'}</td>
                  <td className="text-right font-mono-plex font-semibold">{formatCurrency(line.amountMinor / 100, language)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={3} className="text-right">{labels.total}</th>
                <td className="text-right font-mono-plex font-bold" data-testid="payment-certificate-total-row">
                  {formatCurrency(model.totalMinor / 100, language)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <footer className="border-t border-slate-200 pt-3 text-xs leading-relaxed text-slate-700">
        {labels.note}
      </footer>
    </article>
  );
};
