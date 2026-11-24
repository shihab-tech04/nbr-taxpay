import React, {useState} from 'react';
import {AlertCircle, ArrowRight, Building2, CheckCircle2, Clock3, FileText} from 'lucide-react';
import {ReceiptView} from '../common/ReceiptView';
import type {ChallanReceipt} from '../../types/tax';
import {maskTinForDisplay} from '../../services/tinDisplay';
import type {GiftTaxPaymentInput, GiftTaxPaymentOutcome} from '../../services/giftTaxPaymentGateway';
import {validatedGiftTaxSettlement} from '../../services/giftTaxPaymentGateway';
import {BENEFICIARY_RELATIONS, beneficiaryFinalTagLabel, type BeneficiaryRelation} from '../../services/beneficiaryTags';

interface Props {
  language: 'en' | 'bn';
  input: GiftTaxPaymentInput;
  outcome: GiftTaxPaymentOutcome;
  onBack: () => void;
  onRetry: () => void;
  onContinueBank: () => void;
  onLogin: () => void;
  onRefresh?: () => void;
  signedIn?: boolean;
  busy?:boolean;
}

/**
 * The approved walk-in Payment result surface also used by GuestPayment:
 * payment-flow-embedded__confirmation-layout > payment-lifecycle,
 * then a separate challan/receipt action and account-benefits card.
 *
 * Gift Tax uses the SAME approved presentation classes and interaction order.
 * Its proof is sample-only: never claim official settlement, SQL persistence or
 * donor credit for a browser-local simulation. The only produced receipt
 * deliberately carries isSimulatedDemo and a SIM-GIFT reference.
 */
export function GiftTaxPaymentResult({
  language, input, outcome, onBack, onRetry, onContinueBank, onLogin, onRefresh, signedIn = false, busy=false,
}: Props) {
  const bn=language==='bn';
  const t=(en:string,bd:string)=>bn?bd:en;
  const [showReceipt,setShowReceipt]=useState(false);
  const [skipAccount,setSkipAccount]=useState(false);
  const relation=input.donee.relationship&&BENEFICIARY_RELATIONS.some(value=>value===input.donee.relationship)
    ?input.donee.relationship as BeneficiaryRelation:null;
  const relationship=beneficiaryFinalTagLabel(input.donee.tag,relation,language,input.donee.otherLabel)
    ??input.donee.otherLabel??input.donee.relationship??'—';
  const officialProof=validatedGiftTaxSettlement(outcome,input);
  const simulatedSuccess=outcome.kind==='SIMULATED_SUCCESS';
  const noTax=outcome.kind==='SIMULATED_NO_TAX';
  const simulatedPending=outcome.kind==='SIMULATED_PENDING';
  const failed=outcome.kind==='FAILED'||outcome.kind==='SIMULATED_FAILED';
  const syncPending=outcome.kind==='SIMULATED_SYNC_PENDING';
  const pending=outcome.kind==='PENDING'||simulatedPending||syncPending;
  const completed=Boolean(officialProof)||simulatedSuccess||noTax;
  const reference='reference' in outcome ? outcome.reference : officialProof?.paymentReference;
  const format=(value:number)=>new Intl.NumberFormat(bn?'bn-BD':'en-IN',{maximumFractionDigits:2}).format(value);
  const amount='৳ '+format(input.estimatedTaxMinor/100);
  const Icon=pending?(simulatedPending?Building2:Clock3):failed?AlertCircle:CheckCircle2;
  const heading=simulatedSuccess?(signedIn ? t('Payment record saved','পেমেন্ট রেকর্ড সংরক্ষিত') : t('Payment record saved','পেমেন্ট রেকর্ড সংরক্ষিত'))
    :noTax?t('No Gift Tax payable','কোনো দানকর পরিশোধযোগ্য নয়')
    :syncPending?t('Payment synchronization pending','পেমেন্ট সিঙ্ক অপেক্ষমাণ')
    :simulatedPending?t('Bank payment slip ready','ব্যাংকের জন্য পরিশোধ-স্লিপ প্রস্তুত')
    :pending?t('Payment pending','পেমেন্ট অপেক্ষমাণ')
    :failed?t('Payment request declined','পরিশোধের অনুরোধ প্রত্যাখ্যাত')
    :officialProof?t('Payment confirmed','পেমেন্ট নিশ্চিত')
    :t('Payment not started','পেমেন্ট শুরু হয়নি');
  const resultText=simulatedSuccess
    ?(signedIn ? t('Simulated payment recorded in Taxpayer SQL and mirrored to Office. No money, official challan or donor tax credit was created.', 'করদাতার SQL-এ নমুনা পেমেন্ট সংরক্ষিত এবং অফিসে সিঙ্ক হয়েছে। কোনো টাকা, সরকারি চালান বা দাতার কর ক্রেডিট তৈরি হয়নি।') : t('Sample payment record saved in this browser; settlement is not verified. No money, official challan or donor tax credit was created.',
      'এই ব্রাউজারে নমুনা পেমেন্ট রেকর্ড সংরক্ষিত; নিষ্পত্তি যাচাই হয়নি। কোনো টাকা, সরকারি চালান বা দাতার কর ক্রেডিট তৈরি হয়নি।'))
    :noTax?t('This review calculates zero Gift Tax. No payment was initiated and no money was charged.',
      'এই হিসাবে দানকর শূন্য। কোনো পেমেন্ট শুরু হয়নি এবং অর্থ কাটা হয়নি।')
    :syncPending?t('The original transaction is not yet fully verified. Retry synchronization with the same reference; do not submit another payment.','মূল লেনদেনের সিঙ্ক যাচাই হয়নি। একই রেফারেন্সে আবার চেষ্টা করুন; নতুন পেমেন্ট করবেন না।')
    :simulatedPending?t('This is not tax paid yet. Only a sample bank payment slip was created; bank settlement and donor credit remain unverified.',
      'এখনও কর পরিশোধ হয়নি। শুধু নমুনা ব্যাংক-স্লিপ তৈরি হয়েছে; ব্যাংক নিষ্পত্তি ও দাতার কর ক্রেডিট যাচাই হয়নি।')
    :failed?t('The simulated payment was declined. Your Gift Tax details are still available; retry with another sample payment method.',
      'নমুনা পেমেন্ট প্রত্যাখ্যাত হয়েছে। দানকরের তথ্য সংরক্ষিত আছে; অন্য নমুনা পদ্ধতিতে চেষ্টা করুন।')
    :officialProof?t('Payment confirmed with independently verified settlement and donor credit.',
      'স্বতন্ত্রভাবে যাচাইকৃত নিষ্পত্তি ও দাতার কর ক্রেডিটসহ পেমেন্ট নিশ্চিত হয়েছে।')
    :t('No Gift Tax settlement has been initiated. No money or official document was created.',
      'দানকরের কোনো নিষ্পত্তি শুরু হয়নি। অর্থ বা সরকারি নথি তৈরি হয়নি।');
  const receipt:ChallanReceipt|null=simulatedSuccess&&outcome.kind==='SIMULATED_SUCCESS'?(outcome.receipt??{
    id:outcome.reference,challanNo:outcome.reference,tokenNumber:'SIMULATION',
    paymentCategory:'OTHER_TAX_PAYMENT',assessmentYear:'—',
    payerName:input.payer?.name||input.donor.name,payerTin:input.payer?.tin||input.donor.tin,
    taxpayerName:input.donor.name,taxpayerTin:input.donor.tin,
    receiptMobile:input.payer?.phone,receiptEmail:input.payer?.email,
    noticeReference:input.payer?.noticeReference,
    paymentRemarks:input.remarks,isRepresentativePayment:false,
    taxZone:t('Not verified','যাচাই হয়নি'),taxCircle:t('Not verified','যাচাই হয়নি'),
    isWithholding:false,items:[{headId:0,economicCode:'SIM-GIFT',
      headNameEn:'Gift Tax — simulated only',taxAmount:input.estimatedTaxMinor/100,
      penaltyAmount:0,surchargeAmount:0,interestAmount:0,totalAmount:input.estimatedTaxMinor/100}],
    totalAmount:input.estimatedTaxMinor/100,paymentMethod:outcome.method,
    gatewayTransactionId:outcome.reference,treasuryStatus:'INITIATED',
    taxCreditStatus:'NOT_APPLICABLE',createdAt:outcome.createdAt,isSimulatedDemo:true,
  }):null;

  if(showReceipt&&receipt) return <div className="gift-tax-simulation-receipt" data-testid="gift-tax-simulation-receipt">
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
    <button type="button" className="payment-lifecycle__secondary" onClick={()=>setShowReceipt(false)}>
      {t('Back to payment result','পেমেন্টের ফলে ফিরুন')}
    </button>
  </div>;

  const stages=simulatedSuccess?[
    t('Sample payment request started','নমুনা পেমেন্ট অনুরোধ শুরু হয়েছে'),
    t('Sample request details prepared','নমুনা অনুরোধের তথ্য প্রস্তুত'),
    t('Sample reference generated','নমুনা রেফারেন্স তৈরি'),
    t('Sample payment record prepared','নমুনা পেমেন্ট রেকর্ড প্রস্তুত'),
    t('Treasury settlement not verified','ট্রেজারি নিষ্পত্তি যাচাই হয়নি'),
    t('Donor credit not posted','দাতার কর ক্রেডিট পোস্ট হয়নি'),
  ]:noTax?[t('Gift Tax reviewed — no payment due','দানকর পর্যালোচিত — পরিশোধ প্রযোজ্য নয়')]
    :syncPending?[t('Simulation submission prepared','নমুনা পেমেন্ট প্রস্তুত'),t('Waiting for Taxpayer SQL and Office readback','করদাতা SQL এবং অফিস যাচাইয়ের অপেক্ষায়')]
    :pending?[t('Sample bank payment slip prepared','নমুনা ব্যাংক পরিশোধ স্লিপ প্রস্তুত'),
      t('Waiting for sample bank confirmation','নমুনা ব্যাংক নিশ্চিতকরণের অপেক্ষায়')]
    :failed?[t('Sample payment request started','নমুনা পেমেন্ট অনুরোধ শুরু হয়েছে'),
      t('Payment request declined','পেমেন্টের অনুরোধ প্রত্যাখ্যাত')]
    :[t('Gift Tax review prepared','দানকরের তথ্য পর্যালোচনার জন্য প্রস্তুত')];

  return <div className="payment-flow-embedded payment-flow-embedded--receipt gift-tax-approved-result"
    data-testid="gift-tax-result-shell">
    <div className="payment-flow-embedded__confirmation-layout gift-tax-result-cards">
      <section className="payment-lifecycle" data-testid="gift-tax-payment-result"
        aria-label={t('Gift Tax payment result','দানকর পেমেন্টের ফলাফল')} aria-live="polite">
        <div className={'payment-lifecycle__heading payment-lifecycle__heading--'+
          (pending?'pending':failed?'failed':completed?'complete':'running')}>
          <span className="payment-lifecycle__symbol" aria-hidden="true"><Icon size={22}/></span>
          <h2 id="gift-tax-payment-result-title">{heading}</h2>
        </div>
        <div className="payment-lifecycle__overview">
          <div><span>{t('Amount','মোট পরিশোধ')}</span><strong>{amount}</strong></div>
          <div><span>{t('Payment reference','পেমেন্ট রেফারেন্স')}</span>
            <strong className="payment-lifecycle__reference-value">{reference??'—'}</strong></div>
        </div>
        <details className="payment-lifecycle__progress-detail" open={!completed&&!pending&&!failed}
          data-testid="gift-tax-result-progress">
          <summary>{t('Payment progress and references','পেমেন্টের অগ্রগতি ও রেফারেন্স')}</summary>
          <div className="payment-lifecycle__details">
            <dl className="payment-lifecycle__references">
              <div><dt>{t('Tax event ID','কর ইভেন্ট আইডি')}</dt>
                <dd>{t('Not issued — sample only','ইস্যু হয়নি — শুধু নমুনা')}</dd></div>
              <div><dt>{t('Payment transaction ID','পেমেন্ট ট্রানজেকশন আইডি')}</dt>
                <dd>{receipt?.paymentTransactionId??t('Not issued — sample only','ইস্যু হয়নি — শুধু নমুনা')}</dd></div>
              <div><dt>{t('Payment reference','পেমেন্ট রেফারেন্স')}</dt><dd>{reference??'—'}</dd></div>
              <div><dt>{t('Amount','মোট অর্থ')}</dt><dd>{amount}</dd></div>
              <div><dt>{t('Donor (tax-liable)','দাতা (করদায়ী)')}</dt>
                <dd>{input.donor.name} · {maskTinForDisplay(input.donor.tin)}</dd></div>
              <div><dt>{t('Through / Donee','মাধ্যম / গ্রহীতা')}</dt>
                <dd>{input.donee.name} · {maskTinForDisplay(input.donee.tin)}</dd></div>
            </dl>
            <ol className="payment-lifecycle__timeline" data-testid="payment-lifecycle"
              aria-label={t('Payment lifecycle','পেমেন্টের অবস্থা')}>
              {stages.map((stage,index)=><li key={index}
                className={failed&&index===stages.length-1?'payment-lifecycle__event--failed':''}>
                <span className="payment-lifecycle__event-dot" aria-hidden="true">
                  {failed&&index===stages.length-1?'!':pending&&index===stages.length-1?'·':'✓'}
                </span>
                <span>{stage}</span>
              </li>)}
            </ol>
          </div>
        </details>
        <div className={'payment-lifecycle__result payment-lifecycle__result--'+
          (pending?'pending':failed?'failed':'complete')}>
          <FileText size={18} aria-hidden="true"/>
          <p>{resultText}</p>
        </div>
        {(failed||pending||noTax||outcome.kind==='UNAVAILABLE')&&
          <div className="payment-lifecycle__actions no-print">
            {simulatedPending&&<button type="button" className="payment-lifecycle__primary"
              onClick={onContinueBank} disabled={busy}>
              {t('Continue sample bank payment','নমুনা ব্যাংক পেমেন্ট এগিয়ে নিন')}<ArrowRight size={16}/>
            </button>}
            {failed&&'retryable' in outcome&&outcome.retryable&&<button type="button"
              className="payment-lifecycle__primary" onClick={onRetry}>
              {t('Try another payment method','অন্য পেমেন্ট পদ্ধতিতে চেষ্টা করুন')}<ArrowRight size={16}/>
            </button>}
            {(outcome.kind==='PENDING'||syncPending)&&onRefresh&&<button type="button"
              className="payment-lifecycle__secondary" onClick={onRefresh} disabled={busy}>
              {t('Check status','অবস্থা দেখুন')}
            </button>}
            {!syncPending&&<button type="button" className="payment-lifecycle__secondary" onClick={onBack}>
              {t('Back to Final Preview','চূড়ান্ত পর্যালোচনায় ফিরুন')}
            </button>}
          </div>}
      </section>
      {receipt&&<div className="walkin-result-challan no-print" data-testid="walkin-challan-action">
        <button type="button" className="payment-lifecycle__primary" onClick={()=>setShowReceipt(true)}>
          <FileText size={17} aria-hidden="true"/>
          {t('Sample Challan Details','নমুনা চালানের বিবরণ')}
          <ArrowRight size={17} aria-hidden="true"/>
        </button>
      </div>}
      {simulatedSuccess&&!signedIn&&!skipAccount&&<aside className="walkin-result-benefits no-print"
        data-testid="walkin-result-benefits" aria-labelledby="gift-walkin-benefits-title">
        <h3 id="gift-walkin-benefits-title">
          {t('Get More with a Sohojkor Account','সহজকর অ্যাকাউন্টে আরও সুবিধা')}
        </h3>
        <ul>
          <li>{t('Access available payment certificates','উপলব্ধ পেমেন্ট সনদ দেখুন')}</li>
          <li>{t('View previous payment records and challans','আগের পেমেন্ট রেকর্ড ও চালান দেখুন')}</li>
          <li>{t('Track payment history','পেমেন্টের ইতিহাস অনুসরণ করুন')}</li>
        </ul>
        <div className="walkin-result-benefits__actions">
          <button type="button" className="walkin-postpayment-login__signin" onClick={onLogin}>
            {t('Log In','সাইন ইন')}<ArrowRight size={16} aria-hidden="true"/>
          </button>
          <button type="button" className="walkin-postpayment-login__skip"
            onClick={()=>setSkipAccount(true)}>
            {t('Continue without Login','সাইন ইন ছাড়াই চালিয়ে যান')}
          </button>
        </div>
        <p>{t('This is a browser-local Gift Tax simulation and is not automatically linked to an account.',
          'এটি ব্রাউজারে সংরক্ষিত দানকরের নমুনা; কোনো অ্যাকাউন্টের সঙ্গে স্বয়ংক্রিয়ভাবে যুক্ত নয়।')}</p>
      </aside>}
      {simulatedSuccess&&<div className="gift-tax-result-edit no-print">
        <button type="button" className="payment-lifecycle__secondary" onClick={onBack}>
          {t('Back to Final Preview','চূড়ান্ত পর্যালোচনায় ফিরুন')}
        </button>
      </div>}
    </div>
  </div>;
}
