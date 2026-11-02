import React from 'react';
import type {ChallanReceipt, Language, TreasuryStatus} from '../../types/tax';
import {formatCurrency} from '../../services/numberFormat';

const treasuryStages: TreasuryStatus[] = ['INITIATED','GATEWAY_PENDING','GATEWAY_SUCCESS','TREASURY_SCROLLED'];
const terminal = new Set<TreasuryStatus>(['FAILED','EXPIRED','REVERSED']);

/** Show recorded status and references without manufacturing missing event timestamps or official tax credits. */
export const PaymentLifecycleSummary: React.FC<{receipt:ChallanReceipt;language:Language}> = ({receipt,language}) => {
  const bn=language==='bn';
  const t=(en:string,bengali:string)=>bn?bengali:en;
  const stageIndex=treasuryStages.indexOf(receipt.treasuryStatus);
  const isTerminal=terminal.has(receipt.treasuryStatus);
  const creditConfirmed=receipt.taxCreditStatus==='CREDITED_TO_LEDGER' && !receipt.isSimulatedDemo;
  const date=(value?:string)=>value?new Date(value).toLocaleString(bn?'bn-BD':'en-GB'):t('Not recorded','নথিভুক্ত নেই');
  const detail=(name:string,value:React.ReactNode)=><div className="min-w-0"><p className="text-xs text-taxpay-muted">{name}</p><p className="mt-1 break-words text-sm font-semibold text-taxpay-text">{value||'—'}</p></div>;
  return <section className="mx-auto mb-4 max-w-5xl space-y-4" aria-label={t('Payment identity and lifecycle','পেমেন্ট পরিচিতি ও অবস্থা')}>
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-5">
        <h2 className="mb-4 text-base font-bold text-taxpay-text">{t('Payment identity','পেমেন্ট পরিচিতি')}</h2>
        <div className="grid grid-cols-2 gap-4">
          {detail(t('Tax event ID','কর ইভেন্ট আইডি'),receipt.taxEventId)}
          {detail(t('Payment transaction ID','পেমেন্ট লেনদেন আইডি'),receipt.paymentTransactionId||receipt.gatewayTransactionId)}
          {detail(t('Challan / receipt reference','চালান / রসিদ রেফারেন্স'),receipt.challanNo)}
          {detail(t('Payment reference','পেমেন্ট রেফারেন্স'),receipt.tokenNumber)}
          {detail(t('Amount','টাকার পরিমাণ'),formatCurrency(receipt.totalAmount,language))}
          {detail(t('Created at','তৈরির সময়'),date(receipt.createdAt))}
          {detail(t('Payment method','পেমেন্ট পদ্ধতি'),receipt.paymentMethod.replace(/_/g,' '))}
          {detail(t('Assessment year','করবর্ষ'),receipt.assessmentYear)}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-taxpay-border pt-4">
          {detail(t('Payer','পরিশোধকারী'),receipt.payerName)}
          {detail(t('Taxpayer TIN','করদাতার টিআইএন'),receipt.taxpayerTin||t('Not established','নির্ধারিত নয়'))}
          {detail(t('Tax zone','কর অঞ্চল'),receipt.taxZone)}
          {detail(t('Tax circle','কর সার্কেল'),receipt.taxCircle)}
        </div>
      </section>
      <section className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-5">
        <h2 className="mb-4 text-base font-bold text-taxpay-text">{t('Payment lifecycle','পেমেন্টের ধাপ')}</h2>
        <ol className="space-y-3">
          {treasuryStages.map((stage,i)=>{
            const reached=!isTerminal && i<=stageIndex;
            const current=!isTerminal && stage===receipt.treasuryStatus;
            const labels:Record<TreasuryStatus,string>={
              INITIATED:t('Payment initiated','পেমেন্ট শুরু'),GATEWAY_PENDING:t('Awaiting payment','পেমেন্ট অপেক্ষমাণ'),
              GATEWAY_SUCCESS:t('Gateway completed','গেটওয়ে সম্পন্ন'),TREASURY_SCROLLED:t('Treasury status recorded','ট্রেজারির অবস্থা নথিভুক্ত'),
              FAILED:t('Failed','ব্যর্থ'),EXPIRED:t('Expired','মেয়াদোত্তীর্ণ'),REVERSED:t('Reversed','প্রত্যাবর্তিত')
            };
            return <li key={stage} className="flex gap-3 text-sm">
              <span aria-hidden="true" className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${reached?'border-taxpay-primary bg-taxpay-light text-taxpay-dark':'border-taxpay-border text-taxpay-muted'}`}>{reached?'✓':i+1}</span>
              <div><p className={current?'font-bold text-taxpay-dark':'text-taxpay-text'}>{labels[stage]}</p>
                {current&&<p className="text-xs text-taxpay-muted">{t('Current recorded status','বর্তমানে নথিভুক্ত অবস্থা')}</p>}</div>
            </li>;
          })}
          {isTerminal&&<li role="status" className="rounded-lg border border-taxpay-border bg-slate-50 p-3 text-sm font-semibold text-taxpay-text">
            {t('Current recorded status','বর্তমান অবস্থা')}: {receipt.treasuryStatus.replace(/_/g,' ')}
          </li>}
          <li className="border-t border-taxpay-border pt-3 text-sm">
            <p className="font-semibold text-taxpay-text">{t('Tax-credit posting','কর ক্রেডিট পোস্টিং')}</p>
            <p className="mt-1 text-taxpay-muted">{creditConfirmed?t('Credited to ledger','লেজারে ক্রেডিট হয়েছে'):t('No verified tax-credit posting available','যাচাইকৃত কর ক্রেডিট পোস্টিং পাওয়া যায়নি')}</p>
          </li>
        </ol>
      </section>
    </div>
    <section className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-5">
      <h2 className="text-base font-bold text-taxpay-text">{t('Tax treatment and linked records','কর সমন্বয় ও সংযুক্ত রেকর্ড')}</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        {detail(t('Financial record status','আর্থিক রেকর্ডের অবস্থা'),receipt.treasuryStatus.replace(/_/g,' '))}
        {detail(t('Tax-credit status','কর ক্রেডিটের অবস্থা'),creditConfirmed?t('Credited','ক্রেডিট হয়েছে'):t('Not verified','যাচাই হয়নি'))}
        {detail(t('Treasury scroll reference','ট্রেজারি স্ক্রল রেফারেন্স'),receipt.treasuryScrollNo||t('Not recorded','নথিভুক্ত নেই'))}
      </div>
      <p className="mt-4 text-xs text-taxpay-muted">{t('Only source-recorded values are displayed. Missing lifecycle timestamps, adjustments and balance postings are not inferred.','শুধু উৎসে নথিভুক্ত তথ্য দেখানো হয়। অনুপস্থিত সময়, সমন্বয় ও ব্যালেন্স অনুমান করা হয় না।')}</p>
    </section>
  </section>;
};
