import React, { useState } from 'react';
import { ArrowRight, Download, Search } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { ASSESSMENT_YEARS } from '../../data/mockData';
import { CATEGORY_LABELS } from '../../data/paymentHeads';
import { formatCurrency } from '../../services/numberFormat';
import type { ChallanReceipt, PaymentCategory } from '../../types/tax';

const statusText: Record<string, {en:string; bn:string}> = {
  INITIATED:{en:'Initiated',bn:'শুরু হয়েছে'},
  GATEWAY_PENDING:{en:'Payment pending',bn:'পেমেন্ট অপেক্ষমাণ'},
  GATEWAY_SUCCESS:{en:'Gateway completed (sample)',bn:'গেটওয়ে সম্পন্ন (নমুনা)'},
  TREASURY_SCROLLED:{en:'Treasury recorded (sample)',bn:'ট্রেজারিতে নথিভুক্ত (নমুনা)'},
  FAILED:{en:'Failed',bn:'ব্যর্থ'},
  EXPIRED:{en:'Expired',bn:'মেয়াদ শেষ'},
  REVERSED:{en:'Reversed',bn:'প্রত্যাবর্তিত'},
  NOT_APPLICABLE:{en:'Not applicable',bn:'প্রযোজ্য নয়'},
  PENDING_RECONCILIATION:{en:'Reconciliation pending',bn:'সমন্বয় অপেক্ষমাণ'},
  CREDITED_TO_LEDGER:{en:'Credited (sample only)',bn:'ক্রেডিট (শুধু নমুনা)'},
  CLAIMED_IN_RETURN:{en:'Claimed (sample only)',bn:'দাবিকৃত (শুধু নমুনা)'},
  DISPUTED:{en:'Disputed',bn:'বিরোধপূর্ণ'}
};

const escapeCsv = (value: unknown) => {
  let raw = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(raw)) raw = "'" + raw;
  return '"' + raw.replace(/"/g, '""') + '"';
};

export const PaymentHistory: React.FC = () => {
  const { receipts, selectReceipt, language, taxpayerProfile } = useTaxState();
  const [query, setQuery] = useState('');
  const [year, setYear] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const bn = language === 'bn';
  const label = (en:string,bengali:string)=> bn ? bengali : en;
  // payerTin is not authoritative taxpayer/credit ownership. Only initiated demo receipts
  // are visible until a separate beneficiary and entitlement contract has been certified.
  const filtered = receipts.filter(r => r.payerTin === taxpayerProfile.tin)
    .filter(r => (r.challanNo + ' ' + r.tokenNumber + ' ' + r.payerName).toLowerCase().includes(query.trim().toLowerCase()))
    .filter(r => year === 'ALL' || r.assessmentYear === year)
    .filter(r => category === 'ALL' || r.paymentCategory === category);
  const categoryText = (value: PaymentCategory) =>
    bn ? (CATEGORY_LABELS[value]?.bn || value) : (CATEGORY_LABELS[value]?.en || value);
  const statusLabel = (value:string) => statusText[value] ? (bn ? statusText[value].bn : statusText[value].en) : value;
  const exportDemo = () => {
    const headings=['DEMONSTRATION ONLY','Reference','Token','Payment category','Assessment year','Payer TIN (not credit owner)','Amount BDT','Treasury sample status','Credit sample status'];
    const lines = filtered.map((r:ChallanReceipt)=>[
      'Not government payment evidence',r.challanNo,r.tokenNumber,r.paymentCategory,r.assessmentYear,r.payerTin,r.totalAmount,r.treasuryStatus,r.taxCreditStatus
    ].map(escapeCsv).join(','));
    const csv=[headings.map(escapeCsv).join(','),...lines].join('\r\n');
    const url=URL.createObjectURL(new Blob(['\uFEFF',csv],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='TaxPay_sample_payment_activity.csv';
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  };

  return (
    <div className={`mx-auto max-w-5xl space-y-4 pb-12 ${bn?'font-bengali':''}`}>
      <header className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-6">
        <p className="text-xs font-semibold text-taxpay-dark">{label('Activity overview','লেনদেনের সারসংক্ষেপ')}</p>
        <h1 className="mt-1 text-2xl font-bold text-taxpay-text">{label('Payments & activity','পেমেন্ট ও লেনদেন')}</h1>
      </header>
      <section className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-5" aria-label={label('Search and filters','খোঁজ ও ফিল্টার')}>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="activity-search" className="mb-1 block text-sm font-semibold text-taxpay-text">{label('Search payments','পেমেন্ট খুঁজুন')}</label>
            <div className="relative">
              <Search aria-hidden="true" size={17} className="absolute left-3 top-3.5 text-taxpay-muted"/>
              <input id="activity-search" type="search" value={query} onChange={e=>setQuery(e.target.value)}
                placeholder={label('Reference or payer','রেফারেন্স বা পরিশোধকারী')}
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
                <p className="mt-1 text-xs text-taxpay-muted">{categoryText(r.paymentCategory)} · {label('AY','করবর্ষ')} {r.assessmentYear}</p>
                <p className="mt-2 text-xs text-taxpay-muted">{label('Treasury status','ট্রেজারির অবস্থা')}: {statusLabel(r.treasuryStatus)}</p>
                <p className="text-xs text-taxpay-muted">{label('Credit status','ক্রেডিটের অবস্থা')}: {statusLabel(r.taxCreditStatus)}</p>
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
                  <th scope="col" className="px-3 py-3">{label('Demo status','নমুনা অবস্থা')}</th>
                  <th scope="col" className="px-3 py-3">{label('Details','বিস্তারিত')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-taxpay-border">
                {filtered.map(r=><tr key={r.id}>
                  <td className="break-all px-3 py-3 font-mono-plex text-xs">{r.challanNo}</td>
                  <td className="px-3 py-3">{categoryText(r.paymentCategory)}</td>
                  <td className="whitespace-nowrap px-3 py-3">{r.assessmentYear}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{formatCurrency(r.totalAmount,language)}</td>
                  <td className="px-3 py-3">{statusLabel(r.treasuryStatus)}</td>
                  <td className="px-3 py-3"><button type="button" onClick={()=>selectReceipt(r.id)} className="min-h-11 rounded-md px-2 font-semibold text-taxpay-dark hover:bg-taxpay-light">{label('View','দেখুন')}</button></td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </>}
      </section>
    </div>
  );
};
