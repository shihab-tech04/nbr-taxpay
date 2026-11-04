import React, { useEffect, useState } from 'react';
import { getStoryNotices, getStorySessionPayments } from '../../services/simulatedPaymentStory';
import { reconcileStoryPaymentNotices, type VerifiedStoryPaymentNotice } from '../../services/storyNotificationReconciliation';
import { formatSimulatedAmount } from '../../services/simulatedPaymentsApi';
import {TaxPayDataGrid,TaxPayTableControls,TaxPayTableCounter,TaxPayTableState} from '../ui/TaxPayDataTable';

/** The browser-session payment inbox is separate from authenticated tax identity.
 * It reads the existing SQL notification and matching SQL payment every time;
 * neither a receipt preview nor an in-memory UI event is payment settlement.
 */
export const SessionPaymentNotifications: React.FC<{ language: 'en' | 'bn' }> = ({ language }) => {
  const [notices, setNotices] = useState<VerifiedStoryPaymentNotice[]>([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [knownSession, setKnownSession] = useState(() => {
    try { return sessionStorage.getItem('taxpay-guest-story-payment') === 'true'; }
    catch { return false; }
  });
  const bn = language === 'bn';
  const label = (en: string, bangla: string) => bn ? bangla : en;

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const [events, payments] = await Promise.all([getStoryNotices(), getStorySessionPayments()]);
        const verified = reconcileStoryPaymentNotices(events, payments);
        if (active) {
          setNotices(verified);
          setKnownSession(previous => previous || verified.length > 0);
          setError('');
        }
      } catch {
        if (active) {
          setNotices([]);
          setError(bn ? 'পেমেন্ট বিজ্ঞপ্তি যাচাই করা যায়নি।' : 'Could not verify this browser session’s payment notifications.');
        }
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 7000);
    return () => { active = false; window.clearInterval(interval); };
  }, [language]);

  const query=search.trim().toLocaleLowerCase();
  const filtered=notices.filter(notice=>!query || [notice.paymentId,String(notice.amountMinor),notice.createdAt].some(value=>value.toLocaleLowerCase().includes(query)));
  if (!knownSession && notices.length === 0) return null;
  return <section className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-6" aria-live="polite" aria-label={label('This browser’s payment notifications', 'এই ব্রাউজারের পেমেন্ট বিজ্ঞপ্তি')}>
    <h2 className="font-semibold text-taxpay-text">{label('This browser’s payment notifications', 'এই ব্রাউজারের পেমেন্ট বিজ্ঞপ্তি')}</h2>
    <p className="mt-1 text-sm text-taxpay-muted">{label('Records from this browser session. Settlement and tax credit are not confirmed.', 'এই ব্রাউজার সেশনের রেকর্ড। নিষ্পত্তি ও কর ক্রেডিট নিশ্চিত হয়নি।')}</p>
    {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> :
      notices.length === 0 ? <TaxPayTableState>{label('No payment notifications in this session.', 'এই সেশনে কোনো পেমেন্ট বিজ্ঞপ্তি নেই।')}</TaxPayTableState> :
      <div className="mt-4 space-y-3" data-testid="session-payment-register">
        <TaxPayTableControls className="taxpay-record-page-filters">
          <label className="taxpayer-transaction-filter">
            <span>{label('Find a payment update','পেমেন্টের হালনাগাদ খুঁজুন')}</span>
            <input className="min-h-11 w-full rounded-lg border border-taxpay-border bg-white px-3 text-base"
              type="search" aria-label={label('Find a payment update','পেমেন্টের হালনাগাদ খুঁজুন')}
              placeholder={label('Search payment reference or date','পেমেন্ট রেফারেন্স বা তারিখ')}
              value={search} onChange={event=>setSearch(event.target.value)}/>
          </label>
          {search&&<button type="button" className="min-h-11 rounded-lg border border-taxpay-border px-3 font-semibold text-taxpay-primary"
            onClick={()=>setSearch('')}>{label('Clear search','অনুসন্ধান মুছুন')}</button>}
        </TaxPayTableControls>
        <TaxPayTableCounter label={label('Records','রেকর্ড')} shown={filtered.length} total={notices.length}/>
        {filtered.length===0?<TaxPayTableState>{label('No payment updates match your search.','অনুসন্ধানে কোনো পেমেন্ট হালনাগাদ পাওয়া যায়নি।')}</TaxPayTableState>:
          <TaxPayDataGrid variant="tabular" rows={filtered} getRowKey={notice=>String(notice.id)}
            ariaLabel={label('Browser session payment register','ব্রাউজার সেশনের পেমেন্ট রেকর্ড')}
            testId="session-payment-table" mobileTestId="session-payment-cards"
            columns={[
              {key:'record',header:label('Update','হালনাগাদ'),renderCell:()=> <p className="font-semibold text-taxpay-text">{label('Payment record saved','পেমেন্ট রেকর্ড সংরক্ষিত')}</p>},
              {key:'reference',header:label('Payment reference','পেমেন্ট রেফারেন্স'),renderCell:notice=><p className="break-all font-mono-plex text-sm text-taxpay-muted">{notice.paymentId}</p>},
              {key:'amount',header:label('Amount','পরিমাণ'),headerClassName:'text-right',cellClassName:'text-right tabular-nums',renderCell:notice=><p className="font-semibold tabular-nums">{formatSimulatedAmount(notice.amountMinor)}</p>},
              {key:'recorded',header:label('Recorded','সংরক্ষণের সময়'),renderCell:notice=><time dateTime={notice.createdAt} className="text-sm text-taxpay-muted">{new Date(notice.createdAt).toLocaleString(bn?'bn-BD':'en-GB')}</time>}
            ]}
            renderMobileCard={notice=><div className="space-y-2">
              <div className="taxpay-mobile-table-card__header">
                <p className="taxpay-mobile-table-card__title">{label('Payment record saved','পেমেন্ট রেকর্ড সংরক্ষিত')}</p>
                <p className="shrink-0 font-semibold tabular-nums">{formatSimulatedAmount(notice.amountMinor)}</p>
              </div>
              <p className="taxpay-mobile-table-card__meta break-all">{label('Reference','রেফারেন্স')}: {notice.paymentId}</p>
              <p className="taxpay-mobile-table-card__meta"><time dateTime={notice.createdAt}>{new Date(notice.createdAt).toLocaleString(bn?'bn-BD':'en-GB')}</time></p>
            </div>}/>}
      </div>}

  </section>;
};
