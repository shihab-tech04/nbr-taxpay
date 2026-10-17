import React from 'react';
import { ServiceCategoryTag } from '../ui/ServiceCategoryTag';
import type { DemoUserId } from '../../data/demoUsers';
import type { Language } from '../../types/tax';
import {
  useDemoSqlProfileAndServiceRecords,
  type DemoServiceCode,
  type DemoServiceRecordState,
  type DemoSqlServiceRecord,
} from '../../services/demoSqlProfiles';

type Bilingual = { en: string; bn: string };
const serviceLabels: Record<DemoServiceCode, Bilingual> = {
  TAX_WITH_RETURN: { en: 'Tax with return', bn: 'রিটার্নের সঙ্গে কর' },
  ADVANCE_TAX: { en: 'Advance income tax', bn: 'অগ্রিম আয়কর' },
  ASSESSED_DEMAND: { en: 'Assessed tax demand', bn: 'নির্ধারিত কর দাবি' },
  PENALTY: { en: 'Penalty payment', bn: 'জরিমানা পরিশোধ' },
  SOURCE_TAX_DEPOSIT: { en: 'Source tax deposit (TDS/TCS)', bn: 'উৎসে কর জমা (টিডিএস/টিসিএস)' },
  APPELLATE_TRIBUNAL: { en: 'Appellate Tribunal payment', bn: 'আপিল ট্রাইব্যুনাল পেমেন্ট' },
  OTHER_TAX_PAYMENT: { en: 'Other tax payments', bn: 'অন্যান্য কর পরিশোধ' },
  TRAVEL_TAX: { en: 'Travel tax', bn: 'ভ্রমণ কর' },
};
const stateLabels: Record<DemoServiceRecordState, Bilingual> = {
  SIMULATED: { en: 'Recorded', bn: 'নথিভুক্ত' },
  PENDING: { en: 'Pending', bn: 'অপেক্ষমাণ' },
  FAILED: { en: 'Failed', bn: 'ব্যর্থ' },
  REVERSED: { en: 'Reversed', bn: 'প্রত্যাবর্তিত' },
  REVIEW_REQUIRED: { en: 'Review required', bn: 'পর্যালোচনা প্রয়োজন' },
};
const stateStyles: Record<DemoServiceRecordState, string> = {
  SIMULATED: 'border-blue-200 bg-blue-50 text-blue-800',
  PENDING: 'border-amber-200 bg-amber-50 text-amber-900',
  FAILED: 'border-rose-200 bg-rose-50 text-rose-900',
  REVERSED: 'border-slate-200 bg-slate-100 text-slate-700',
  REVIEW_REQUIRED: 'border-violet-200 bg-violet-50 text-violet-900',
};
const reviewStates: ReadonlySet<DemoServiceRecordState> = new Set([
  'PENDING', 'FAILED', 'REVERSED', 'REVIEW_REQUIRED',
]);

const amount = (minor: number | bigint, locale: string): string => {
  // Format whole taka and paisa separately so no floating-point rounding is introduced.
  const minorAsInteger = BigInt(minor);
  const fullTaka = minorAsInteger / 100n;
  const paisa = Number(minorAsInteger % 100n);
  const whole = new Intl.NumberFormat(locale).format(fullTaka);
  const fractional = new Intl.NumberFormat(locale, {
    minimumIntegerDigits: 2, useGrouping: false,
  }).format(paisa);
  return `৳ ${whole}.${fractional}`;
};

const simulationSummary = (records: readonly DemoSqlServiceRecord[]) => {
  const simulated = records.filter(record => record.state === 'SIMULATED');
  return {
    distinctServices: new Set(records.map(record => record.serviceCode)).size,
    incomeSimulated: simulated.filter(record => record.serviceCode !== 'TRAVEL_TAX'),
    travelSimulated: simulated.filter(record => record.serviceCode === 'TRAVEL_TAX'),
    attention: records.filter(record => reviewStates.has(record.state)),
  };
};

export interface DemoServiceRecordsPanelProps {
  userId: DemoUserId;
  language: Language;
}

/** SQL-backed records for the selected public fictional user; no local data fallback. */
export const DemoServiceRecordsPanel: React.FC<DemoServiceRecordsPanelProps> = ({ userId, language }) => {
  const { status, profile, records, error } = useDemoSqlProfileAndServiceRecords(userId);
  const bn = language === 'bn';
  const locale = bn ? 'bn-BD' : 'en-BD';
  const tr = (en: string, bangla: string) => bn ? bangla : en;
  const label = (value: Bilingual) => value[language];
  const summary = simulationSummary(records);
  const sumMinor = (rows: readonly DemoSqlServiceRecord[]) =>
    rows.reduce((total, record) => total + BigInt(record.amountMinor), 0n);
  const renderDate = (value: string) => new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  }).format(new Date(value));
  const summaryCards = [
    {
      key: 'records',
      title: tr('Service records', 'সেবার রেকর্ড'),
      value: new Intl.NumberFormat(locale).format(records.length),
      detail: tr(`${summary.distinctServices} of 8 service types`, `৮টি সেবার মধ্যে ${new Intl.NumberFormat(locale).format(summary.distinctServices)}টি`),
    },
    {
      key: 'income',
      title: tr('Income-tax records', 'আয়কর রেকর্ড'),
      value: summary.incomeSimulated.length ? amount(sumMinor(summary.incomeSimulated), locale) : '—',
      detail: tr('Seven income-tax service types', 'সাত ধরনের আয়কর সেবা'),
    },
    {
      key: 'travel',
      title: tr('Travel-tax records', 'ভ্রমণ কর রেকর্ড'),
      value: summary.travelSimulated.length ? amount(sumMinor(summary.travelSimulated), locale) : '—',
      detail: tr('Separate from income-tax amounts', 'আয়করের হিসাব থেকে পৃথক'),
    },
    {
      key: 'attention',
      title: tr('Other statuses', 'অন্যান্য অবস্থা'),
      value: new Intl.NumberFormat(locale).format(summary.attention.length),
      detail: tr('Pending, review, failed or reversed', 'অপেক্ষমাণ, পর্যালোচনা, ব্যর্থ বা প্রত্যাবর্তিত'),
    },
  ];
  const renderState = (record: DemoSqlServiceRecord) => (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${stateStyles[record.state]}`}>
      {label(stateLabels[record.state])}
    </span>
  );
  const participant = (record: DemoSqlServiceRecord) => record.participantRole === 'PAYER'
    ? tr('Payer', 'পরিশোধকারী') : tr('Beneficiary', 'সুবিধাভোগী');

  return (
    <section
      aria-labelledby={`taxpay-sql-services-title-${userId}`}
      aria-busy={status === 'loading'}
      className="space-y-4 rounded-2xl border border-taxpay-border bg-white p-4 shadow-sm sm:p-5"
      data-testid="demo-sql-service-panel"
      data-scenario-user={userId}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`taxpay-sql-services-title-${userId}`} className="text-lg font-semibold text-taxpay-text sm:text-xl">
            {tr('Tax service activity', 'কর সেবার কার্যক্রম')}
          </h2>
          {status === 'ready' && profile && (
            <>
              {(bn ? profile.nameBn : profile.nameEn) && <p className="mt-1 text-sm font-semibold text-taxpay-dark">{bn ? profile.nameBn : profile.nameEn}</p>}
              {(bn ? profile.focusBn : profile.focusEn) && <p className="mt-1 text-sm text-taxpay-muted">{bn ? profile.focusBn : profile.focusEn}</p>}
              {(profile.tinStub || profile.jurisdictionLabel) && (
                <p className="mt-1 text-xs text-taxpay-muted">
                  {[profile.tinStub, profile.jurisdictionLabel].filter(Boolean).join(' · ')}
                </p>
              )}
            </>
          )}
        </div>
        <span className="rounded-full border border-taxpay-border bg-taxpay-light px-3 py-1 text-xs font-medium text-taxpay-primary">
          {userId}
        </span>
      </header>

      {status === 'loading' && (
        <p className="rounded-xl bg-slate-50 px-4 py-6 text-sm text-taxpay-muted" role="status">
          {tr('Loading stored service records…', 'সংরক্ষিত সেবার রেকর্ড লোড হচ্ছে…')}
        </p>
      )}
      {status === 'error' && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-5" role="alert">
          <h3 className="text-sm font-semibold text-rose-900">{tr('Service records unavailable', 'সেবার রেকর্ড পাওয়া যাচ্ছে না')}</h3>
          <p className="mt-1 text-sm text-rose-900">{error}</p>
        </div>
      )}
      {status === 'ready' && !profile && (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-taxpay-muted" role="status">
          {tr('No profile found for this account.', 'এই অ্যাকাউন্টের প্রোফাইল পাওয়া যায়নি।')}
        </p>
      )}
      {status === 'ready' && profile && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4" aria-label={tr('Service activity summary', 'সেবা কার্যক্রমের সারসংক্ষেপ')}>
            {summaryCards.map(card => (
              <article className="min-w-0 rounded-xl border border-taxpay-border bg-slate-50 p-3 sm:p-4" key={card.key}>
                <h3 className="text-xs font-medium text-taxpay-muted">{card.title}</h3>
                <p className="mt-2 break-words text-lg font-semibold tabular-nums text-taxpay-text sm:text-xl">{card.value}</p>
                <p className="mt-1 text-xs leading-5 text-taxpay-muted">{card.detail}</p>
              </article>
            ))}
          </div>
          {records.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-taxpay-muted" role="status">
              {tr('No stored service activity is available for this account.', 'এই অ্যাকাউন্টে কোনো সংরক্ষিত সেবার কার্যক্রম নেই।')}
            </p>
          ) : (
            <>
              <h3 className="text-base font-semibold text-taxpay-text">{tr('Service record details', 'সেবার রেকর্ডের বিস্তারিত')}</h3>
              <div className="hidden overflow-x-auto rounded-xl border border-taxpay-border md:block">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold text-taxpay-muted">
                    <tr>
                      <th scope="col" className="px-3 py-3">{tr('Service', 'সেবা')}</th>
                      <th scope="col" className="px-3 py-3">{tr('Year / participant', 'করবর্ষ / অংশগ্রহণ')}</th>
                      <th scope="col" className="px-3 py-3 text-right">{tr('Amount', 'পরিমাণ')}</th>
                      <th scope="col" className="px-3 py-3">{tr('State', 'অবস্থা')}</th>
                      <th scope="col" className="px-3 py-3 text-center">{tr('Date', 'তারিখ')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-taxpay-border">
                    {records.map(record => (
                      <tr key={record.recordId} className="align-top">
                        <td className="px-3 py-3">
                          <ServiceCategoryTag code={record.serviceCode}>{label(serviceLabels[record.serviceCode])}</ServiceCategoryTag>
                          <p className="mt-1 break-all text-xs text-taxpay-muted">{record.recordId}</p>
                        </td>
                        <td className="px-3 py-3 text-taxpay-text">
                          <p>{record.assessmentYear ?? tr('Not applicable', 'প্রযোজ্য নয়')}</p>
                          <p className="mt-1 text-xs text-taxpay-muted">{participant(record)}{record.relatedUserId ? ` · ${record.relatedUserId}` : ''}</p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-taxpay-text">{amount(record.amountMinor, locale)}</td>
                        <td className="px-3 py-3">{renderState(record)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-center text-taxpay-muted"><time dateTime={record.recordedAt}>{renderDate(record.recordedAt)}</time></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="space-y-3 md:hidden" aria-label={tr('Service records', 'সেবার রেকর্ড')}>
                {records.map(record => (
                  <li key={record.recordId} className="rounded-xl border border-taxpay-border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h4 className="min-w-0 text-sm"><ServiceCategoryTag code={record.serviceCode}>{label(serviceLabels[record.serviceCode])}</ServiceCategoryTag></h4>
                      {renderState(record)}
                    </div>
                    <p className="mt-1 break-all text-xs text-taxpay-muted">{record.recordId}</p>
                    <p className="mt-3 text-lg font-semibold tabular-nums text-taxpay-text">{amount(record.amountMinor, locale)}</p>
                    <div className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-taxpay-muted">
                      <p>{record.assessmentYear ?? tr('No assessment year', 'করবর্ষ প্রযোজ্য নয়')}</p>
                      <p>{participant(record)}{record.relatedUserId ? ` · ${record.relatedUserId}` : ''}</p>
                      <p><time dateTime={record.recordedAt}>{renderDate(record.recordedAt)}</time></p>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
};
