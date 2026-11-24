import React,{useState} from 'react';
import {AlertCircle, Building2, CheckCircle2, Clock3, FileText, ArrowRight} from 'lucide-react';
import {ReceiptView} from '../common/ReceiptView';
import type {ChallanReceipt} from '../../types/tax';
import {maskTinForDisplay} from '../../services/tinDisplay';
import type {GiftTaxPaymentInput,GiftTaxPaymentOutcome} from '../../services/giftTaxPaymentGateway';
import {validatedGiftTaxSettlement} from '../../services/giftTaxPaymentGateway';
import {BENEFICIARY_RELATIONS,beneficiaryFinalTagLabel,type BeneficiaryRelation} from '../../services/beneficiaryTags';

interface Props {
  language:'en'|'bn';
  input:GiftTaxPaymentInput;
  outcome:GiftTaxPaymentOutcome;
  onBack:()=>void;
  onRetry:()=>void;
  onRefresh?:()=>void;
}

/** Approved walk-in result shell: one full-width lifecycle card, details disclosure,
 * sample receipt action. Nonfinancial Gift Tax never manufactures Treasury or SQL proof. */
export function GiftTaxPaymentResult({language,input,outcome,onBack,onRetry,onRefresh}:Props) {
  const bn=language==='bn';
  const t=(en:string,bd:string)=>bn?bd:en;
  const [showReceipt,setShowReceipt]=useState(false);
  const relation=input.donee.relationship&&BENEFICIARY_RELATIONS.some(x=>x===input.donee.relationship)
    ?input.donee.relationship as BeneficiaryRelation:null;
  const relationship=beneficiaryFinalTagLabel(input.donee.tag,relation,language,input.donee.otherLabel)
    ??input.donee.otherLabel??input.donee.relationship??'—';
  const proof=validatedGiftTaxSettlement(outcome,input);
  const simulatedSuccess=outcome.kind==='SIMULATED_SUCCESS';
  const simulatedPending=outcome.kind==='SIMULATED_PENDING';
  const noTax=outcome.kind==='SIMULATED_NO_TAX';
  const failed=outcome.kind==='FAILED'||outcome.kind==='SIMULATED_FAILED';
  const pending=outcome.kind==='PENDING'||simulatedPending;
  const completed=Boolean(proof)||simulatedSuccess||noTax;
  const reference='reference'in outcome?outcome.reference:proof?.paymentReference;
  const amount=new Intl.NumberFormat(bn?'bn-BD':'en-IN',{maximumFractionDigits:2}).format(input.estimatedTaxMinor/100);
  const Icon=pending?(simulatedPending?Building2:Clock3):failed?AlertCircle:CheckCircle2;
  const title=simulatedSuccess?t('Sample payment record ready','নমুনা পেমেন্ট রেকর্ড প্রস্তুত')
    :noTax?t('No Gift Tax payable','কোনো দানকর পরিশোধযোগ্য নয়')
    :simulatedPending?t('Sample bank payment slip ready','নমুনা ব্যাংক পেমেন্ট স্লিপ প্রস্তুত')
    :pending?t('Payment pending','পেমেন্ট অপেক্ষমাণ')
    :failed?t('Payment request declined','পরিশোধের অনুরোধ প্রত্যাখ্যাত')
    :proof?t('Payment confirmed','পেমেন্ট নিশ্চিত')
    :t('Payment not started','পেমেন্ট শুরু হয়নি');
  const description=simulatedSuccess
    ?t('The sample record is ready in this browser. It is not a bank transaction, official challan or donor tax credit.',
      'নমুনা রেকর্ড এই ব্রাউজারে প্রস্তুত। এটি ব্যাংক লেনদেন, সরকারি চালান বা দাতার কর ক্রেডিট নয়।')
    :noTax?t('The estimate is zero. No money was charged or payment record created.','হিসাবে কর শূন্য। কোনো অর্থ কাটা হয়নি বা পেমেন্ট রেকর্ড তৈরি হয়নি।')
    :simulatedPending?t('Only a sample bank-branch slip exists. No funds or credit have been confirmed.',
      'শুধু নমুনা ব্যাংক-স্লিপ প্রস্তুত। অর্থ বা কর ক্রেডিট নিশ্চিত হয়নি।')
    :failed?t('Your payment details were retained. Choose another sample method or retry.','পেমেন্টের তথ্য রাখা হয়েছে। অন্য নমুনা মাধ্যম বেছে আবার চেষ্টা করুন।')
    :proof?t('Official settlement and donor-credit references were verified.','সরকারি নিষ্পত্তি ও দাতার কর ক্রেডিটের রেফারেন্স যাচাই হয়েছে।')
    :t('Official Gift Tax settlement is not connected. No money, challan or credit was generated.',
      'সরকারি দানকর নিষ্পত্তি সংযুক্ত নয়। অর্থ, চালান বা কর ক্রেডিট তৈরি হয়নি।');
  const receipt:ChallanReceipt|null=simulatedSuccess&&outcome.kind==='SIMULATED_SUCCESS'?{
    id:outcome.reference,challanNo:outcome.reference,tokenNumber:'SIMULATION',
    paymentCategory:'OTHER_TAX_PAYMENT',assessmentYear:'—',
    payerName:input.payer?.name||input.donor.name,payerTin:input.payer?.tin||input.donor.tin,
    taxpayerName:input.donor.name,taxpayerTin:input.donor.tin,
    receiptMobile:input.payer?.phone,receiptEmail:input.payer?.email,
    paymentRemarks:input.remarks,isRepresentativePayment:false,
    taxZone:t('Not verified','যাচাই হয়নি'),taxCircle:t('Not verified','যাচাই হয়নি'),
    isWithholding:false,items:[{headId:0,economicCode:'SIM-GIFT',
      headNameEn:'Gift Tax — simulated only',taxAmount:input.estimatedTaxMinor/100,
      penaltyAmount:0,surchargeAmount:0,interestAmount:0,totalAmount:input.estimatedTaxMinor/100}],
    totalAmount:input.estimatedTaxMinor/100,paymentMethod:outcome.method,
    gatewayTransactionId:outcome.reference,treasuryStatus:'INITIATED',
    taxCreditStatus:'NOT_APPLICABLE',createdAt:outcome.createdAt,isSimulatedDemo:true,
  }:null;
  if(showReceipt&&receipt) return <div className="gift-tax-simulation-receipt"
    data-testid="gift-tax-simulation-receipt">
    <p role="note" className="gift-tax-sample-warning">
      {t('SIMULATION ONLY — not an official challan or tax-credit certificate.',
        'শুধু সিমুলেশন — এটি সরকারি চালান বা কর ক্রেডিট সনদ নয়।')}
    </p>
    <ReceiptView receipt={receipt} embedded compactWalkInLayout
      simulationServiceName={t('Gift Tax (simulation)','দানকর (সিমুলেশন)')}
      giftSimulationDetails={{doneeName:input.donee.name,doneeTin:input.donee.tin,
        relationship,giftAmount:input.giftAmountMinor/100,
        giftDate:input.giftDate,description:input.description,remarks:input.remarks}}
      onBack={()=>setShowReceipt(false)}/>
    <button type="button" className="payment-lifecycle__secondary"
      onClick={()=>setShowReceipt(false)}>{t('Back to payment result','পেমেন্টের ফলে ফিরুন')}</button>
  </div>;
  return <div className="gift-tax-approved-result">
    <section className="payment-lifecycle gift-tax-result" data-testid="gift-tax-payment-result"
      aria-label={t('Gift Tax payment result','দানকর পেমেন্টের ফলাফল')} aria-live="polite">
      <div className={'payment-lifecycle__heading payment-lifecycle__heading--'+
        (pending?'pending':failed?'failed':completed?'complete':'running')}>
        <span className="payment-lifecycle__symbol" aria-hidden="true"><Icon size={22}/></span>
        <div><h2>{title}</h2></div>
      </div>
      <div className="payment-lifecycle__overview">
        <div><span>{t('Amount','পরিমাণ')}</span><strong>{'৳ '+amount}</strong></div>
        <div><span>{t('Payment reference','পেমেন্ট রেফারেন্স')}</span>
          <strong className="payment-lifecycle__reference-value">{reference??'—'}</strong></div>
      </div>
      <details className="payment-lifecycle__progress-detail" open={!completed}>
        <summary>{t('Payment progress and references','পেমেন্টের অগ্রগতি ও রেফারেন্স')}</summary>
        <div className="payment-lifecycle__details">
          <dl className="payment-lifecycle__references">
            <div><dt>{t('Donor (tax-liable)','দাতা (করদায়ী)')}</dt>
              <dd>{input.donor.name} · {maskTinForDisplay(input.donor.tin)}</dd></div>
            <div><dt>{t('Through / Donee','মাধ্যম / গ্রহীতা')}</dt>
              <dd>{input.donee.name} · {maskTinForDisplay(input.donee.tin)}</dd></div>
            <div><dt>{t('Tax event ID','কর ইভেন্ট আইডি')}</dt>
              <dd>{t('Not issued — sample only','ইস্যু হয়নি — শুধু নমুনা')}</dd></div>
            <div><dt>{t('Payment transaction ID','পেমেন্ট ট্রানজেকশন আইডি')}</dt>
              <dd>{t('Not issued — sample only','ইস্যু হয়নি — শুধু নমুনা')}</dd></div>
            <div><dt>{t('Payment reference','পেমেন্ট রেফারেন্স')}</dt>
              <dd>{reference??'—'}</dd></div>
            <div><dt>{t('Amount','পরিমাণ')}</dt><dd>{'৳ '+amount}</dd></div>
          </dl>
          <ol className="payment-lifecycle__timeline" data-testid="payment-lifecycle"
            aria-label={t('Payment lifecycle','পেমেন্টের অবস্থা')}>
            <li><span className="payment-lifecycle__event-dot">✓</span>
              {t('Gift Tax review completed','দানকরের তথ্য পর্যালোচনা সম্পন্ন')}</li>
            <li className={failed?'payment-lifecycle__event--failed':''}>
              <span className="payment-lifecycle__event-dot">{failed?'!':pending?'·':'✓'}</span>
              {failed?t('Simulation attempt declined','সিমুলেশন প্রত্যাখ্যাত')
                :pending?t('Sample confirmation pending','নমুনা নিশ্চিতকরণ অপেক্ষমাণ')
                :t('Sample review result prepared','নমুনা পর্যালোচনার ফল প্রস্তুত')}</li>
          </ol>
        </div>
      </details>
      <div className={'payment-lifecycle__result payment-lifecycle__result--'+(failed?'failed':pending?'pending':'complete')}>
        <FileText size={18} aria-hidden="true"/><p>{description}</p>
      </div>
      <div className="payment-lifecycle__actions no-print">
        {receipt&&<button type="button" className="payment-lifecycle__primary"
          onClick={()=>setShowReceipt(true)}>
          <FileText size={17}/>{t('Sample receipt details','নমুনা রসিদের বিবরণ')}<ArrowRight size={17}/>
        </button>}
        <button type="button" className="payment-lifecycle__secondary" onClick={onBack}>
          {t('Back to Final Preview','চূড়ান্ত পর্যালোচনায় ফিরুন')}
        </button>
        {failed&&'retryable'in outcome&&outcome.retryable&&
          <button type="button" className="payment-lifecycle__primary" onClick={onRetry}>
            {t('Try another sample payment method','অন্য নমুনা পেমেন্ট মাধ্যম বেছে নিন')}
          </button>}
        {outcome.kind==='PENDING'&&onRefresh&&<button type="button" className="payment-lifecycle__secondary"
          onClick={onRefresh}>{t('Check status','অবস্থা দেখুন')}</button>}
      </div>
      <aside className="walkin-result-benefits" role="note">
        <h3>{t('About your Sohojkor account','আপনার সহজকর অ্যাকাউন্ট সম্পর্কে')}</h3>
        <p>{t('An official payment, when available, can be tracked through its verified reference. This sample is not linked to your account or SQL.',
          'সরকারি পরিশোধ চালু হলে যাচাইকৃত রেফারেন্স দিয়ে অনুসরণ করা যাবে। এই নমুনা আপনার অ্যাকাউন্ট বা SQL-এর সঙ্গে যুক্ত নয়।')}</p>
      </aside>
    </section>
  </div>;
}
