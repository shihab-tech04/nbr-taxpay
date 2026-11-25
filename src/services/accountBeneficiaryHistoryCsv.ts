import type {BeneficiaryPaymentEntry} from './story1AccountPaymentHistory';

type Language='en'|'bn';

const escapeCsv=(value:unknown)=>{
  const raw=String(value??'');
  const safe=/^[=+\-@\t\r]/.test(raw)?"'"+raw:raw;
  return '"'+safe.replaceAll('"','""')+'"';
};

function exactTaka(amountMinor:number):string{
  if(!Number.isSafeInteger(amountMinor)||amountMinor<=0)
    throw Error('Payment allocation amount is invalid');
  const paise=BigInt(amountMinor);
  return `${paise/100n}.${String(paise%100n).padStart(2,'0')}`;
}

/** Export only the verified payer-history rows the caller has already filtered. */
export function buildAccountBeneficiaryHistoryCsv(rows:readonly BeneficiaryPaymentEntry[],language:Language):string{
  const headers=language==='bn'
    ?['পেমেন্টের তারিখ','উপকারভোগী','টিআইএন','পেমেন্ট খাত','করবর্ষ','পেমেন্ট রেফারেন্স','সমন্বিত রেফারেন্স','পরিমাণ ৳']
    :['Payment date','Beneficiary','TIN','Payment head','Assessment year','Payment reference','Combined reference','Amount ৳'];
  const lines=rows.map(row=>{
    if(!/^\d{12}$/.test(row.taxpayerTin)||!row.paymentId.trim()||!Number.isFinite(Date.parse(row.receipt.createdAt)))
      throw Error('Payment allocation identity is invalid');
    return [row.receipt.createdAt,row.beneficiaryName,row.taxpayerTin,row.paymentHead,row.assessmentYear,
      row.paymentId,row.batchId??'',exactTaka(row.amountMinor)].map(escapeCsv).join(',');
  });
  return '\uFEFF'+[headers.map(escapeCsv).join(','),...lines].join('\r\n');
}
