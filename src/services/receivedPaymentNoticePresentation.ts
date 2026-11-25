import type {ReceivedPaymentNotice} from './demoReceivedPaymentNotices';
import {recordedActivityCategoryLabel} from './activityRecordedCategory';
import {formatCurrency} from './numberFormat';

export function receivedPaymentNoticePresentation(notice:ReceivedPaymentNotice,language:'en'|'bn',verified=false){
  const bn=language==='bn';
  const completed=notice.paymentStatus==='SIMULATED_SUCCESS';
  return {
    title:completed?(bn?'আপনার পক্ষ থেকে একটি পেমেন্ট করা হয়েছে':'A payment has been made on your behalf'):
      verified?(bn?'প্রাপ্ত পেমেন্টের বিজ্ঞপ্তি':'Received payment notice'):(bn?'প্রাপ্ত কর পরিশোধের বিজ্ঞপ্তি':'Received tax payment notice'),
    payer:notice.payerName?.trim()||(bn?'পেমেন্টকারীর নাম পাওয়া যায়নি':'Payer name unavailable'),
    category:recordedActivityCategoryLabel(notice.serviceCode,language),
    year:notice.assessmentYear,
    amount:formatCurrency(notice.amountMinor/100,language),
    reference:notice.receiptReference??notice.paymentId,
    dateTime:new Date(notice.createdAt).toLocaleString(bn?'bn-BD':'en-GB',{timeZone:'Asia/Dhaka'}),
    status:completed?(bn?'সম্পন্ন (সিমুলেটেড)':'Completed (simulated)'):(bn?'নথিভুক্ত — নিষ্পত্তি নিশ্চিত নয়':'Recorded — settlement not confirmed'),
  };
}
