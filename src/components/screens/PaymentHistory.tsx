import React, { useState } from 'react';
import { ArrowRight, Download, Search } from 'lucide-react';
import { DemoPaymentActivity } from './DemoPaymentActivity';
import { AuthenticatedHistorySwitch } from './AuthenticatedHistorySwitch';
import {useAccountIdentity} from '../../services/accountIdentity';
import { useTaxState } from '../../services/taxState';
import { ASSESSMENT_YEARS } from '../../data/mockData';
import { CATEGORY_LABELS } from '../../data/paymentHeads';
import { ServiceCategoryTag } from '../ui/ServiceCategoryTag';
import { formatCurrency } from '../../services/numberFormat';
import { taxpayerPreviewReceipts } from '../../services/taxpayerEvidence';
import type { ChallanReceipt, PaymentCategory } from '../../types/tax';
import {TaxpayerActivityTabs, TaxpayerPageHeading} from '../layout/TaxpayerPageStructure';
import {PaymentLifecycleDetails,type PaymentLifecycleRecord} from './EventBasedTaxLedger';
import {TaxPayModal} from '../ui/TaxPayModal';

const statusText: Record<string, {en:string; bn:string}> = {
  INITIATED:{en:'Initiated',bn:'শুরু হয়েছে'},
  GATEWAY_PENDING:{en:'Payment pending',bn:'পেমেন্ট অপেক্ষমাণ'},
  GATEWAY_SUCCESS:{en:'Gateway completed',bn:'গেটওয়ে সম্পন্ন'},
  TREASURY_SCROLLED:{en:'Treasury recorded',bn:'ট্রেজারিতে নথিভুক্ত'},
  FAILED:{en:'Failed',bn:'ব্যর্থ'},
  EXPIRED:{en:'Expired',bn:'মেয়াদ শেষ'},
  REVERSED:{en:'Reversed',bn:'প্রত্যাবর্তিত'},
  NOT_APPLICABLE:{en:'Not applicable',bn:'প্রযোজ্য নয়'},
  PENDING_RECONCILIATION:{en:'Reconciliation pending',bn:'সমন্বয় অপেক্ষমাণ'},
  CREDITED_TO_LEDGER:{en:'Credit not verified',bn:'ক্রেডিট যাচাই হয়নি'},
  CLAIMED_IN_RETURN:{en:'Claim not verified',bn:'দাবি যাচাই হয়নি'},
  DISPUTED:{en:'Disputed',bn:'বিরোধপূর্ণ'}
};

/** Read-only detail projection: a session receipt alone proves no Treasury settlement or tax credit. */
function historyLifecycleRecord(receipt:ChallanReceipt):PaymentLifecycleRecord {
  return {
    reference:receipt.challanNo,
    taxEventId:receipt.taxEventId,
    transactionId:receipt.paymentTransactionId||receipt.gatewayTransactionId,
    challanNo:receipt.challanNo,
    payerName:receipt.payerName,payerTin:receipt.payerTin,
    taxpayerTin:receipt.taxpayerTin,
    assessmentYear:receipt.assessmentYear,
    paymentType:receipt.paymentCategory.replaceAll('_',' '),
    taxZone:receipt.taxZone,taxCircle:receipt.taxCircle,
    channel:receipt.paymentMethod.replaceAll('_',' '),
    amountMinor:Math.round(receipt.totalAmount*100),
    createdAt:receipt.createdAt,status:receipt.treasuryStatus.replaceAll('_',' '),
    financialReceiptStatus:'Not verified',taxCreditStatus:'Not verified',
    source:'TaxPay payment record',
    events:[
      {id:receipt.id+':created',title:'Payment record created',occurredAt:receipt.createdAt,source:'TaxPay payment record'},
      ...(receipt.completedAt?[{id:receipt.id+':status',title:receipt.treasuryStatus.replaceAll('_',' '),
        occurredAt:receipt.completedAt,source:'TaxPay payment record'}]:[])
    ],
    allocations:receipt.allocationItems?.map((a,index)=>({
      id:String(index),title:a.taxpayerName+' · '+a.paymentServiceEn,
      assessmentYear:a.assessmentYear,amountMinor:a.amountMinor
    }))||receipt.items.map((a,index)=>({id:String(index),title:a.headNameEn,
      assessmentYear:receipt.assessmentYear,amountMinor:Math.round(a.totalAmount*100)}))
  };
}

const escapeCsv = (value: unknown) => {
  let raw = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(raw)) raw = "'" + raw;
  return '"' + raw.replace(/"/g, '""') + '"';
};

export const PaymentHistory: React.FC<{activityTabs?:boolean}> = ({activityTabs=false}) => {
  const { receipts, selectReceipt, language, taxpayerProfile, userRole, demoUser, routeParams } = useTaxState();
  const trackingActivity=Boolean(routeParams.trackPayment);
  const {user:authenticatedUser}=useAccountIdentity();
  const [query, setQuery] = useState('');
  const [year, setYear] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [lifecycleReceipt,setLifecycleReceipt]=useState<ChallanReceipt|null>(null);
  const bn = language === 'bn';
  const label = (en:string,bengali:string)=> bn ? bengali : en;
  // payerTin is not authoritative taxpayer/credit ownership. Only initiated demo receipts
  // are visible until a separate beneficiary and entitlement contract has been certified.
  const filtered = taxpayerPreviewReceipts(receipts, taxpayerProfile.tin, userRole, demoUser, Boolean(authenticatedUser))
    .filter(r => (r.challanNo + ' ' + r.tokenNumber + ' ' + r.payerName).toLowerCase().includes(query.trim().toLowerCase()))
    .filter(r => year === 'ALL' || r.assessmentYear === year)
    .filter(r => category === 'ALL' || r.paymentCategory === category);
  const categoryText = (value: PaymentCategory) =>
    bn ? (CATEGORY_LABELS[value]?.bn || value) : (CATEGORY_LABELS[value]?.en || value);
  const statusLabel = (value:string) => statusText[value] ? (bn ? statusText[value].bn : statusText[value].en) : value;
  const treasuryLabel = (receipt:ChallanReceipt) => receipt.isSimulatedDemo && receipt.treasuryStatus === 'TREASURY_SCROLLED'
    ? label('Treasury status not verified','ট্রেজারির অবস্থা যাচাই হয়নি')
    : receipt.isSimulatedDemo && receipt.treasuryStatus === 'GATEWAY_SUCCESS'
      ? label('Payment record saved','পেমেন্ট রেকর্ড সংরক্ষিত') : statusLabel(receipt.treasuryStatus);
  const exportDemo = () => {
    const headings=['Reference','Token','Payment category','Assessment year','Payer TIN','Amount ৳','Treasury status','Credit status'];
    const lines = filtered.map((r:ChallanReceipt)=>[
      r.challanNo,r.tokenNumber,r.paymentCategory,r.assessmentYear,r.payerTin,r.totalAmount,treasuryLabel(r),statusLabel(r.taxCreditStatus)
    ].map(escapeCsv).join(','));
    const csv=[headings.map(escapeCsv).join(','),...lines].join('\r\n');
    const url=URL.createObjectURL(new Blob(['\uFEFF',csv],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='Korbritto_payment_activity.csv';
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  };

  if (authenticatedUser) return <AuthenticatedHistorySwitch ownerUid={authenticatedUser.id}
    language={language} activityTabs={activityTabs} />;
  if (demoUser) return <DemoPaymentActivity activityTabs={activityTabs} />;

  return (
    <div className={`mx-auto max-w-5xl space-y-4 pb-12 ${bn?'font-bengali':''}`}>
      <TaxpayerPageHeading title={trackingActivity?label('Track payment','পেমেন্ট অনুসন্ধান'):label('Payments & activity','পেমেন্ট ও লেনদেন')}
        description={trackingActivity?label('Find a payment by its reference.','রেফারেন্স দিয়ে পেমেন্ট খুঁজুন।'):label('Activity overview','লেনদেনের সারসংক্ষেপ')} />
      {activityTabs && <TaxpayerActivityTabs />}
      <section className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-5" aria-label={label('Search and filters','খোঁজ ও ফিল্টার')}>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="activity-search" className="mb-1 block text-sm font-semibold text-taxpay-text">{label('Search payments','পেমেন্ট খুঁজুন')}</label>
            <div className="relative">
              <Search aria-hidden="true" size={17} className="absolute left-3 top-3.5 text-taxpay-muted"/>
              <input id="activity-search" type="search" value={query} onChange={e=>setQuery(e.target.value)}
                placeholder={trackingActivity?label('Enter challan or transaction reference','চালান বা লেনদেন রেফারেন্স লিখুন'):label('Reference or payer','রেফারেন্স বা পরিশোধকারী')}
                className="min-h-11 w-full min-w-0 rounded-lg border border-taxpay-border bg-white pl-10 pr-3 text-sm text-taxpay-text focus-visible:outline-taxpay-primary"/>
            </div>
          </div>
          <div>
            <label htmlFor="activity-year" className="mb-1 block text-sm font-semibold text-taxpay-text">{label('Assessment year','করবর্ষ')}</label>
            <select id="activity-year" value={year} onChange={e=>setYear(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-taxpay-border bg-white px-3 text-sm text-taxpay-text">
              <option value="ALL">{label('All years','সব করবর্ষ')}</option>
              {ASSESSMENT_YEARS.map(y=><option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="activity-category" className="mb-1 block text-sm font-semibold text-taxpay-text">{label('Payment type','পেমেন্টের ধরন')}</label>
            <select id="activity-category" value={category} onChange={e=>setCategory(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-taxpay-border bg-white px-3 text-sm text-taxpay-text">
              <option value="ALL">{label('All types','সব ধরন')}</option>
              {Object.entries(CATEGORY_LABELS).map(([key,value])=><option key={key} value={key}>{bn?value.bn:value.en}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <p aria-live="polite" className="text-sm text-taxpay-muted">{label('Records','রেকর্ড')}: {filtered.length}</p>
          <button type="button" onClick={exportDemo} disabled={!filtered.length}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-taxpay-border px-3 text-sm font-semibold text-taxpay-dark hover:bg-taxpay-light disabled:opacity-50">
            <Download aria-hidden="true" size={16}/>{label('Export records','রেকর্ড নিন')}
          </button>
        </div>
      </section>
      <section aria-label={label('Payment records','পেমেন্টের তথ্য')} className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-5">
        {filtered.length===0 ? (
          <div className="rounded-lg bg-taxpay-background p-5">
            <h2 className="text-base font-semibold text-taxpay-text">{label('No matching records','মিল পাওয়া যায়নি')}</h2>
            <p className="mt-1 text-sm text-taxpay-muted">{label('Try another reference, year, or payment type.','অন্য রেফারেন্স, করবর্ষ বা পেমেন্টের ধরন নির্বাচন করুন।')}</p>
          </div>
        ) : <>
          <div className="grid gap-3 md:hidden">
            {filtered.map(r=>(
              <article key={r.id} className="min-w-0 rounded-lg border border-taxpay-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="min-w-0 break-all font-mono-plex text-sm font-semibold text-taxpay-text">{r.challanNo}</h2>
                  <p className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(r.totalAmount,language)}</p>
                </div>
                <p className="mt-1 text-xs text-taxpay-muted"><ServiceCategoryTag code={r.paymentCategory}>{categoryText(r.paymentCategory)}</ServiceCategoryTag> · {label('AY','করবর্ষ')} {r.assessmentYear}</p>
                <p className="mt-2 text-xs text-taxpay-muted">{label('Treasury status','ট্রেজারির অবস্থা')}: {treasuryLabel(r)}</p>
                <p className="text-xs text-taxpay-muted">{label('Credit status','ক্রেডিটের অবস্থা')}: {statusLabel(r.taxCreditStatus)}</p>
                <button type="button" onClick={()=>setLifecycleReceipt(r)}
                  className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-taxpay-border bg-white text-sm font-semibold text-taxpay-dark">
                  {label('Payment lifecycle','পেমেন্টের ধাপসমূহ')} <ArrowRight aria-hidden="true" size={16}/>
                </button>
                <button type="button" onClick={()=>selectReceipt(r.id)}
                  className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-taxpay-light text-sm font-semibold text-taxpay-dark">
                  {label('View details','বিস্তারিত দেখুন')} <ArrowRight aria-hidden="true" size={16}/>
                </button>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-taxpay-background text-xs text-taxpay-muted">
                <tr>
                  <th scope="col" className="px-3 py-3">{label('Reference','রেফারেন্স')}</th>
                  <th scope="col" className="px-3 py-3">{label('Payment type','পেমেন্টের ধরন')}</th>
                  <th scope="col" className="px-3 py-3">{label('Year','বর্ষ')}</th>
                  <th scope="col" className="px-3 py-3 text-right">{label('Amount','টাকার পরিমাণ')}</th>
                  <th scope="col" className="px-3 py-3">{label('Status','অবস্থা')}</th>
                  <th scope="col" className="px-3 py-3">{label('Details','বিস্তারিত')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-taxpay-border">
                {filtered.map(r=><tr key={r.id}>
                  <td className="break-all px-3 py-3 font-mono-plex text-xs">{r.challanNo}</td>
                  <td className="px-3 py-3"><ServiceCategoryTag code={r.paymentCategory}>{categoryText(r.paymentCategory)}</ServiceCategoryTag></td>
                  <td className="whitespace-nowrap px-3 py-3">{r.assessmentYear}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{formatCurrency(r.totalAmount,language)}</td>
                  <td className="px-3 py-3">{treasuryLabel(r)}</td>
                  <td className="px-3 py-3"><div className="flex flex-wrap gap-1">
                    <button type="button" onClick={()=>setLifecycleReceipt(r)} className="min-h-11 rounded-md px-2 font-semibold text-taxpay-dark hover:bg-taxpay-light">{label('Lifecycle','পেমেন্ট ধাপ')}</button>
                    <button type="button" onClick={()=>selectReceipt(r.id)} className="min-h-11 rounded-md px-2 font-semibold text-taxpay-dark hover:bg-taxpay-light">{label('Receipt','রসিদ')}</button>
                  </div></td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </>}
      </section>
      {lifecycleReceipt&&<TaxPayModal title={label('Payment details','পেমেন্টের বিবরণ')}
        onClose={()=>setLifecycleReceipt(null)} hideFooter className="taxpayer-transaction-detail">
        <PaymentLifecycleDetails language={language} record={historyLifecycleRecord(lifecycleReceipt)}/>
      </TaxPayModal>}
    </div>
  );
};
