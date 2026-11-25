import type {ReceivedPaymentNotice} from '../../services/demoReceivedPaymentNotices';
import {receivedPaymentNoticePresentation} from '../../services/receivedPaymentNoticePresentation';

export function ReceivedPaymentNoticeDetails({notice,language}:{notice:Omit<ReceivedPaymentNotice,'isRead'>;language:'en'|'bn'}){
  const bn=language==='bn';
  const details=receivedPaymentNoticePresentation(notice,language);
  return <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
    <div><dt>{bn?'পেমেন্টকারীর নাম':"Payer's name"}</dt><dd>{details.payer}</dd></div>
    <div><dt>{bn?'করের ধরন':'Tax type'}</dt><dd>{details.category}</dd></div>
    <div><dt>{bn?'করবর্ষ':'Assessment year'}</dt><dd>{details.year}</dd></div>
    <div><dt>{bn?'পেমেন্টের পরিমাণ':'Payment amount'}</dt><dd className="font-semibold">{details.amount}</dd></div>
    <div><dt>{bn?'পেমেন্ট রেফারেন্স নম্বর':'Payment reference number'}</dt><dd className="break-all">{details.reference}</dd></div>
    <div><dt>{bn?'তারিখ ও সময়':'Date and time'}</dt><dd><time dateTime={notice.createdAt}>{details.dateTime}</time></dd></div>
    <div><dt>{bn?'পেমেন্টের অবস্থা':'Payment status'}</dt><dd>{details.status}</dd></div>
  </dl>;
}
