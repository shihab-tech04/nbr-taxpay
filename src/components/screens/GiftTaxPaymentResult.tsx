import React,{useState} from 'react';
import {AlertCircle, Building2, CheckCircle2, Clock3, FileText, ArrowRight, Download, Printer} from 'lucide-react';
import {ReceiptView} from '../common/ReceiptView';
import type {ChallanReceipt} from '../../types/tax';
import {maskTinForDisplay} from '../../services/tinDisplay';
import type {GiftTaxPaymentInput, GiftTaxPaymentOutcome} from '../../services/giftTaxPaymentGateway';
import {validatedGiftTaxSettlement} from '../../services/giftTaxPaymentGateway';
import {BENEFICIARY_RELATIONS, beneficiaryFinalTagLabel, type BeneficiaryRelation} from '../../services/beneficiaryTags';

interface Props {
  language: 'en'|'bn';
  input: GiftTaxPaymentInput;
  outcome: GiftTaxPaymentOutcome;
  onBack: () => void;
  onRetry: () => void;
  onRefresh?: () => void;
}
export function GiftTaxPaymentResult({language,input,outcome,onBack,onRetry,onRefresh}:Props){
  const bn=language==='bn';
  const tr=(en:string,bd:string)=>bn?bd:en;
  const [showReceipt,setShowReceipt]=useState(false);
  // Keep the original relationship slug in the payment contract; localize display only.
  const selectedRelation = input.donee.relationship && BENEFICIARY_RELATIONS.some(value=>value===input.donee.relationship)
    ? input.donee.relationship as BeneficiaryRelation : null;
  const relationshipLabel = beneficiaryFinalTagLabel(input.donee.tag,selectedRelation,language,input.donee.otherLabel)
    ?? input.donee.otherLabel ?? input.donee.relationship ?? '—';
  const proof=validatedGiftTaxSettlement(outcome,input);
  const simulatedSuccess=outcome.kind==='SIMULATED_SUCCESS';
  const simulatedPending=outcome.kind==='SIMULATED_PENDING';
  const simulatedFailed=outcome.kind==='SIMULATED_FAILED';
  const noTax=outcome.kind==='SIMULATED_NO_TAX';
  const pending=outcome.kind==='PENDING'||simulatedPending;
  const failed=outcome.kind==='FAILED'||simulatedFailed;
  const completed=Boolean(proof)||simulatedSuccess||noTax;
  const Icon=simulatedPending?Building2:pending?Clock3:completed?CheckCircle2:AlertCircle;
  const reference='reference' in outcome ? outcome.reference : proof?.paymentReference;
  const title=simulatedSuccess?tr('Simulation completed','সিমুলেশন সম্পন্ন')
    :noTax?tr('No Gift Tax payable','কোনো দানকর পরিশোধযোগ্য নয়')
    :simulatedPending?tr('Sample bank payment slip ready','নমুনা ব্যাংক পেমেন্ট স্লিপ প্রস্তুত')
    :pending?tr('Payment pending','পেমেন্ট অপেক্ষমাণ')
    :failed?tr('Payment request declined','পরিশোধের অনুরোধ প্রত্যাখ্যাত')
    :proof?tr('Payment confirmed','পেমেন্ট নিশ্চিত')
    :tr('Payment not started','পেমেন্ট শুরু হয়নি');
  const description=simulatedSuccess
    ?tr('A sample payment record was generated in this browser. No bank transaction, Office posting, official challan or donor credit occurred.','এই ব্রাউজারে নমুনা পেমেন্ট রেকর্ড তৈরি হয়েছে। ব্যাংক লেনদেন, অফিস পোস্টিং, সরকারি চালান বা দাতার কর ক্রেডিট হয়নি।')
    :noTax?tr('The estimated Gift Tax is zero. No payment, challan or credit was generated.','আনুমানিক দানকর শূন্য। কোনো পেমেন্ট, চালান বা ক্রেডিট তৈরি হয়নি।')
    :simulatedPending?tr('This is a sample bank-branch state. No payment or credit has been confirmed. Select an online method to continue the simulation.','এটি ব্যাংক শাখার নমুনা অবস্থা। পেমেন্ট বা ক্রেডিট নিশ্চিত হয়নি। সিমুলেশন চালাতে অনলাইন মাধ্যম বেছে নিন।')
    :pending?tr('Awaiting verified settlement. No receipt or donor credit has been created.','যাচাইকৃত নিষ্পত্তির অপেক্ষা চলছে। রসিদ বা ক্রেডিট তৈরি হয়নি।')
    :failed?tr('The attempt failed. Keep your details and choose another method or retry.','চেষ্টা ব্যর্থ হয়েছে। তথ্য রেখে অন্য মাধ্যম বেছে নিন বা আবার চেষ্টা করুন।')
    :proof?tr('Official settlement and donor credit reference verified.','সরকারি নিষ্পত্তি ও দাতার কর ক্রেডিট রেফারেন্স যাচাই হয়েছে।')
    :tr('An official Gift Tax gateway is not connected. No charge, official challan or donor credit was created.','সরকারি দানকর গেটওয়ে সংযুক্ত নয়। কোনো অর্থ, সরকারি চালান বা দাতার কর ক্রেডিট তৈরি হয়নি।');
  const receipt:ChallanReceipt|null=outcome.kind==='SIMULATED_SUCCESS'?{
    id:outcome.reference,challanNo:outcome.reference,tokenNumber:'SIMULATION',
    paymentCategory:'OTHER_TAX_PAYMENT',assessmentYear:'—',
    payerName:input.donor.name,payerTin:input.donor.tin,
    taxpayerName:input.donor.name,taxpayerTin:input.donor.tin,
    paymentRemarks:input.remarks,isRepresentativePayment:false,
    taxZone:tr('Not verified','যাচাই হয়নি'),taxCircle:tr('Not verified','যাচাই হয়নি'),
    isWithholding:false,items:[{headId:0,economicCode:'SIM-GIFT',
      headNameEn:'Gift Tax — simulated only',taxAmount:input.estimatedTaxMinor/100,
      penaltyAmount:0,surchargeAmount:0,interestAmount:0,totalAmount:input.estimatedTaxMinor/100}],
    totalAmount:input.estimatedTaxMinor/100,paymentMethod:outcome.method,
    gatewayTransactionId:outcome.reference,treasuryStatus:'INITIATED',
    taxCreditStatus:'NOT_APPLICABLE',createdAt:outcome.createdAt,
    isSimulatedDemo:true,
  }:null;
  if(showReceipt && receipt) return <div data-testid="gift-tax-simulation-receipt" className="gift-tax-simulation-receipt">
    <div className="gift-tax-sample-warning" role="note">{tr('SIMULATION ONLY — this is not an official challan or tax-credit certificate.','শুধু সিমুলেশন — এটি সরকারি চালান বা কর ক্রেডিট সনদ নয়।')}</div>
    <ReceiptView receipt={receipt} embedded compactWalkInLayout
      simulationServiceName={tr('Gift Tax (simulation)','দানকর (সিমুলেশন)')}
      giftSimulationDetails={{doneeName:input.donee.name,doneeTin:input.donee.tin,
        relationship:relationshipLabel,
        giftAmount:input.giftAmountMinor/100,giftDate:input.giftDate,
        description:input.description,remarks:input.remarks}}
      onBack={()=>setShowReceipt(false)}/>
    <button type="button" className="payment-lifecycle__secondary" onClick={()=>setShowReceipt(false)}>{tr('Back to payment result','পেমেন্টের ফলে ফিরুন')}</button>
  </div>;
  return <section data-testid="gift-tax-payment-result" className="payment-lifecycle gift-tax-result"
    aria-label={tr('Gift Tax payment result','দানকর পেমেন্টের ফলাফল')} aria-live="polite">
    <div className={'payment-lifecycle__heading payment-lifecycle__heading--'+
      (pending?'pending':failed?'failed':completed?'complete':'running')}>
      <span className="payment-lifecycle__symbol" aria-hidden="true"><Icon size={22}/></span>
      <div><h2>{title}</h2><p>{description}</p></div>
    </div>
    <div className="payment-lifecycle__overview">
      <div><span>{tr('Gift Tax amount','দানকরের পরিমাণ')}</span>
        <strong>{new Intl.NumberFormat(bn?'bn-BD':'en-IN',{style:'currency',currency:'BDT',maximumFractionDigits:2}).format(input.estimatedTaxMinor/100).replace('BDT','৳')}</strong></div>
      {reference&&<div><span>{tr('Simulation reference','সিমুলেশন রেফারেন্স')}</span><strong className="payment-lifecycle__reference-value">{reference}</strong></div>}
    </div>
    <div className="payment-lifecycle__details">
      <dl className="payment-lifecycle__references">
        <div><dt>{tr('Donor (tax-liable)','দাতা (করদায়ী)')}</dt><dd>{input.donor.name} · {maskTinForDisplay(input.donor.tin)}</dd></div>
        <div><dt>{tr('Through / Donee','মাধ্যম / গ্রহীতা')}</dt><dd>{input.donee.name} · {maskTinForDisplay(input.donee.tin)}</dd></div>
      </dl>
      <ol className="payment-lifecycle__timeline" aria-label={tr('Payment lifecycle','পেমেন্টের অবস্থা')} data-testid="payment-lifecycle">
        <li><span className="payment-lifecycle__event-dot" aria-hidden="true">✓</span>{tr('Gift Tax review completed','দানকরের তথ্য পর্যালোচনা সম্পন্ন')}</li>
        <li className={failed?'payment-lifecycle__event--failed':''}>
          <span className="payment-lifecycle__event-dot" aria-hidden="true">{failed?'!':pending?'·':'✓'}</span>
          {completed?tr('Simulation result prepared','সিমুলেশনের ফল প্রস্তুত')
            :pending?tr('Awaiting payment confirmation','পেমেন্ট নিশ্চিতকরণের অপেক্ষায়')
            :failed?tr('Simulated attempt declined','সিমুলেটেড চেষ্টা প্রত্যাখ্যাত')
            :tr('Official payment unavailable','সরকারি পেমেন্ট উপলব্ধ নয়')}
        </li>
      </ol>
    </div>
    {simulatedSuccess&&<div className="payment-lifecycle__result payment-lifecycle__result--complete"><FileText size={18}/><p>{tr('Sample record only. Download/print will carry simulation markings; it cannot be used as proof of payment.','শুধু নমুনা রেকর্ড। ডাউনলোড/প্রিন্টে সিমুলেশনের চিহ্ন থাকবে; এটি পরিশোধের প্রমাণ নয়।')}</p></div>}
    {pending&&<div className="payment-lifecycle__result payment-lifecycle__result--pending"><Clock3 size={18}/><p>{tr('No successful receipt or credit has been issued.','সফল রসিদ বা ক্রেডিট ইস্যু হয়নি।')}</p></div>}
    {failed&&<div className="payment-lifecycle__result payment-lifecycle__result--failed"><AlertCircle size={18}/><p>{outcome.kind==='SIMULATED_FAILED'||outcome.kind==='FAILED'?outcome.reason:description}</p></div>}
    <div className="payment-lifecycle__actions no-print">
      {simulatedSuccess&&<button type="button" className="payment-lifecycle__primary" onClick={()=>setShowReceipt(true)}>
        <FileText size={17}/>{tr('View sample receipt','নমুনা রসিদ দেখুন')}<ArrowRight size={17}/>
      </button>}
      {(failed||pending||outcome.kind==='UNAVAILABLE'||noTax||simulatedSuccess)&&<button type="button" className="payment-lifecycle__secondary" onClick={onBack}>
        {tr('Back to Final Preview','চূড়ান্ত পর্যালোচনায় ফিরুন')}
      </button>}
      {failed&&('retryable'in outcome)&&outcome.retryable&&<button type="button" className="payment-lifecycle__primary" onClick={onRetry}>
        {tr('Retry payment simulation','পেমেন্ট সিমুলেশন আবার চেষ্টা করুন')}
      </button>}
      {outcome.kind==='PENDING'&&onRefresh&&<button type="button" className="payment-lifecycle__secondary" onClick={onRefresh}>{tr('Check status','অবস্থা দেখুন')}</button>}
      {proof&&<><a href={proof.receiptDocumentUrl} target="_blank" rel="noopener noreferrer" className="payment-lifecycle__secondary"><Download size={17}/>{tr('Download receipt','রসিদ ডাউনলোড')}</a>
        <a href={proof.challanDocumentUrl} target="_blank" rel="noopener noreferrer" className="payment-lifecycle__secondary"><Printer size={17}/>{tr('Open challan','চালান খুলুন')}</a></>}
    </div>
  </section>;
}
