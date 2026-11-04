import React, { useEffect, useState } from 'react';
import { getStoryNotices, getStorySessionPayments } from '../../services/simulatedPaymentStory';
import { reconcileStoryPaymentNotices, type VerifiedStoryPaymentNotice } from '../../services/storyNotificationReconciliation';
import { formatSimulatedAmount } from '../../services/simulatedPaymentsApi';
import {TaxPayDataGrid} from '../ui/TaxPayDataTable';

/** The browser-session payment inbox is separate from authenticated tax identity.
 * It reads the existing SQL notification and matching SQL payment every time;
 * neither a receipt preview nor an in-memory UI event is payment settlement.
 */
export const SessionPaymentNotifications: React.FC<{ language: 'en' | 'bn' }> = ({ language }) => {
  const [notices, setNotices] = useState<VerifiedStoryPaymentNotice[]>([]);
  const [error, setError] = useState('');
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

  if (!knownSession && notices.length === 0) return null;
  return <section className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-6" aria-live="polite" aria-label={label('This browser’s payment notifications', 'এই ব্রাউজারের পেমেন্ট বিজ্ঞপ্তি')}>
    <h2 className="font-semibold text-taxpay-text">{label('This browser’s payment notifications', 'এই ব্রাউজারের পেমেন্ট বিজ্ঞপ্তি')}</h2>
    <p className="mt-1 text-sm text-taxpay-muted">{label('Records from this browser session. Settlement and tax credit are not confirmed.', 'এই ব্রাউজার সেশনের রেকর্ড। নিষ্পত্তি ও কর ক্রেডিট নিশ্চিত হয়নি।')}</p>
    {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> :
      notices.length === 0 ? <p className="mt-2 text-sm text-taxpay-muted">{label('No payment notifications in this session.', 'এই সেশনে কোনো পেমেন্ট বিজ্ঞপ্তি নেই।')}</p> :
      <TaxPayDataGrid variant="tabular" rows={notices} getRowKey={notice=>notice.id}
        ariaLabel={label('Session payment notices','সেশন পেমেন্ট বিজ্ঞপ্তি')}
        testId="session-payment-notification-register" mobileTestId="session-payment-notification-cards"
        columns={[
          {key:'update',header:label('Update','হালনাগাদ'),renderCell:()=><p className="font-semibold text-taxpay-text">{label('Payment record saved','পেমেন্ট রেকর্ড সংরক্ষিত')}</p>},
          {key:'reference',header:label('Reference','রেফারেন্স'),renderCell:notice=><p className="break-all font-mono-plex text-sm">{notice.paymentId}</p>},
          {key:'amount',header:label('Amount','পরিমাণ'),headerClassName:'text-right',cellClassName:'text-right tabular-nums',
            renderCell:notice=><p className="font-semibold">{formatSimulatedAmount(notice.amountMinor)}</p>},
          {key:'date',header:label('Recorded','সংরক্ষণের সময়'),renderCell:notice=><time dateTime={notice.createdAt}>
            {new Date(notice.createdAt).toLocaleString(bn?'bn-BD':'en-GB')}</time>}
        ]}/>
  </section>;
};
