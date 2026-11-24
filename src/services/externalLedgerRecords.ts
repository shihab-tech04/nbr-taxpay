import {supabase} from './supabaseClient';
import type {Language} from '../types/tax';
import type {TaxAccountEvent} from '../components/screens/EventBasedTaxLedger';

/** Authoritative source codes, not claims that an external provider is connected. */
export const EXTERNAL_LEDGER_SOURCES = {
  BRTA:'BRTA',
  E_TDS:'e-TDS',
  IBAS_PLUS_PLUS:'iBAS++',
  NSD:'NSD',
  SUB_REGISTRAR_OFFICE:'Sub-Registrar Office',
  BANK:'Bank',
  SA_CODER:'SA Coder'
} as const;
export type ExternalLedgerSource = keyof typeof EXTERNAL_LEDGER_SOURCES;

export type ExternalPaymentRecord = {
  id:string; owner_uid:string; source_system:string; source_transaction_id:string;
  source_allocation_id:string; taxpayer_tin:string; payer_tin:string|null;
  identity_binding_evidence_ref:string;
  source_reference:string|null; challan_no:string|null; dhara:string|null;
  assessment_year:string; tax_head:string; amount_minor:number|string;
  source_status:string; occurred_at:string; source_evidence_ref:string;
};
export type ExternalCreditPosting = {
  id:string; payment_record_id:string; owner_uid:string; official_credit_reference:string;
  official_credit_source:string; credited_amount_minor:number|string;
  credited_at:string; verification_evidence_ref:string;
};


/** Prefix potentially executable spreadsheet formulas without modifying numeric amounts. */
export function escapeLedgerCsvCell(value:string|number|null|undefined):string {
  const raw=String(value??'');
  const first=raw.trimStart().charAt(0);
  const unsafe=typeof value==='string' && (['=','+','-','@'].includes(first)||[9,10,13].includes(raw.charCodeAt(0)));
  const safe=unsafe?"'"+raw:raw;
  return '"'+safe.replaceAll('"','""')+'"';
}

function minor(value:number|string):number {
  if ((typeof value!=='number' && (typeof value!=='string'||! /^[1-9][0-9]*$/.test(value))) ||
      (typeof value==='number' && (!Number.isInteger(value)||value<=0))) {
    throw new Error('Invalid external ledger amount');
  }
  const parsed=Number(value);
  if(!Number.isSafeInteger(parsed)||parsed<=0)throw new Error('Invalid external ledger amount');
  return parsed;
}
function present(value:unknown):value is string {
  return typeof value==='string'&&value.trim().length>0;
}
function optional(value:unknown):value is string|null {
  return value===null || (typeof value==='string' && value.trim().length>0);
}
function timestamp(value:unknown):value is string {
  return present(value)&&Number.isFinite(Date.parse(value));
}
function sourceLabel(value:string):string {
  if(!Object.prototype.hasOwnProperty.call(EXTERNAL_LEDGER_SOURCES,value)){
    throw new Error('Unknown external ledger source');
  }
  return EXTERNAL_LEDGER_SOURCES[value as ExternalLedgerSource];
}

/** No payment can affect the credit column without an independent official posting. */
export function projectExternalLedgerEvents(
  ownerUid:string,
  payments:readonly ExternalPaymentRecord[],
  credits:readonly ExternalCreditPosting[],
  language:Language
):TaxAccountEvent[]{
  if(!present(ownerUid))throw new Error('External ledger owner unavailable');
  const byId=new Map<string,{payment:ExternalPaymentRecord;amount:number;source:string}>();
  const seenSourceAllocations=new Set<string>();
  const events:TaxAccountEvent[]=[];
  for(const payment of payments){
    if(!present(payment.id)||payment.owner_uid!==ownerUid||byId.has(payment.id)||
      !present(payment.source_transaction_id)||!present(payment.source_allocation_id)||
      !/^[0-9]{12,13}$/.test(payment.taxpayer_tin)||
      (payment.payer_tin!==null&&!/^[0-9]{12,13}$/.test(payment.payer_tin))||
      !present(payment.identity_binding_evidence_ref)||!present(payment.tax_head)||
      !present(payment.assessment_year)||!present(payment.source_status)||
      !present(payment.source_evidence_ref)||!optional(payment.source_reference)||
      !optional(payment.challan_no)||!optional(payment.dhara)||!timestamp(payment.occurred_at)){
      throw new Error('Unreconciled external payment source record');
    }
    const source=sourceLabel(payment.source_system);
    const sourceAllocationKey=JSON.stringify([payment.source_system,payment.source_transaction_id,payment.source_allocation_id]);
    if(seenSourceAllocations.has(sourceAllocationKey))throw new Error('Duplicate external source allocation');
    seenSourceAllocations.add(sourceAllocationKey);
    const amount=minor(payment.amount_minor);
    byId.set(payment.id,{payment,amount,source});
    events.push({
      id:'external:payment:'+payment.id,occurredAt:payment.occurred_at,
      code:'EXTERNAL_PAYMENT_RECORDED',
      title:language==='bn'?'বহিরাগত পেমেন্ট নথিভুক্ত':'External payment recorded',
      assessmentYear:payment.assessment_year,component:payment.tax_head,
      amountMinor:amount,effectMinor:null,balanceAfterMinor:null,
      actor:language==='bn'?'উৎস সিস্টেম':'Source system',source,
      sourceCode:payment.source_system,dhara:payment.dhara??undefined,
      paymentId:undefined,challanNo:payment.challan_no??undefined,
      reference:payment.source_reference||payment.source_transaction_id,
      status:payment.source_status,creditEvidenceStatus:'RECORDED_ONLY',
      reason:language==='bn'
        ?'এই পেমেন্টের নথি কর ক্রেডিট প্রমাণ করে না।'
        :'A recorded source payment does not establish tax credit.',
      linkedReferences:[payment.source_transaction_id,payment.source_allocation_id,payment.source_evidence_ref,
        payment.source_reference,payment.challan_no].filter(present)
    });
  }
  const creditIds=new Set<string>();
  const seenCreditReferences=new Set<string>();
  const creditTotals=new Map<string,number>();
  for(const credit of credits){
    if(!present(credit.id)||creditIds.has(credit.id)||credit.owner_uid!==ownerUid||
       !present(credit.official_credit_reference)||!present(credit.official_credit_source)||
       !present(credit.verification_evidence_ref)||!timestamp(credit.credited_at)) {
      throw new Error('Unreconciled official credit posting');
    }
    creditIds.add(credit.id);
    const officialKey=JSON.stringify([credit.payment_record_id,credit.official_credit_source,credit.official_credit_reference]);
    if(seenCreditReferences.has(officialKey))throw new Error('Duplicate official credit posting');
    seenCreditReferences.add(officialKey);
    const matched=byId.get(credit.payment_record_id);
    if(!matched)throw new Error('Unmatched official credit posting');
    const credited=minor(credit.credited_amount_minor);
    const sum=(creditTotals.get(credit.payment_record_id)||0)+credited;
    if(!Number.isSafeInteger(sum)||sum>matched.amount)throw new Error('Official credit exceeds source payment');
    creditTotals.set(credit.payment_record_id,sum);
    const {payment,source}=matched;
    events.push({
      id:'external:credit:'+credit.id,occurredAt:credit.credited_at,
      code:'EXTERNAL_OFFICIAL_TAX_CREDIT',
      title:language==='bn'?'যাচাইকৃত কর ক্রেডিট':'Official tax credit posted',
      assessmentYear:payment.assessment_year,component:payment.tax_head,
      amountMinor:credited,effectMinor:-credited,balanceAfterMinor:null,
      actor:credit.official_credit_source,source,sourceCode:payment.source_system,
      dhara:payment.dhara??undefined,
      challanNo:payment.challan_no??undefined,
      reference:credit.official_credit_reference,
      status:'OFFICIAL_CREDIT_POSTED',creditEvidenceStatus:'OFFICIAL_POSTING',
      reason:language==='bn'
        ?'স্বতন্ত্র সরকারি ক্রেডিট পোস্টিংয়ের প্রমাণ নথিভুক্ত।'
        :'Separate official credit posting evidence is recorded.',
      linkedReferences:[payment.source_transaction_id,credit.official_credit_reference,
        credit.verification_evidence_ref,payment.source_evidence_ref]
    });
  }
  return events.sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)||b.id.localeCompare(a.id));
}

async function allRows<T>(table:string,columns:string,ownerUid:string):Promise<T[]> {
  if(!supabase)throw new Error('External ledger source is not configured');
  const rows:T[]=[];
  for(let offset=0;offset<20000;offset+=200){
    const {data,error}=await supabase.from(table).select(columns)
      .eq('owner_uid',ownerUid).order('id',{ascending:true}).range(offset,offset+199);
    if(error)throw error;
    const page=(data??[]) as T[];
    rows.push(...page);
    if(page.length<200)return rows;
  }
  throw new Error('External ledger exceeds supported page limit; no partial result displayed');
}

/** A signed-in account sees only owner-scoped, server-imported evidence. */
export async function loadExternalLedgerEvents(ownerUid:string,language:Language):Promise<TaxAccountEvent[]> {
  if(!supabase)throw new Error('External ledger source is not configured');
  const {data,error}=await supabase.auth.getUser();
  if(error||!data.user||data.user.id!==ownerUid)throw new Error('External ledger owner not verified');
  const payments=await allRows<ExternalPaymentRecord>(
    'taxpay_external_payment_records',
    'id,owner_uid,source_system,source_transaction_id,source_allocation_id,taxpayer_tin,payer_tin,identity_binding_evidence_ref,source_reference,challan_no,dhara,assessment_year,tax_head,amount_minor,source_status,occurred_at,source_evidence_ref',
    ownerUid
  );
  const credits=await allRows<ExternalCreditPosting>(
    'taxpay_external_credit_postings',
    'id,payment_record_id,owner_uid,official_credit_reference,official_credit_source,credited_amount_minor,credited_at,verification_evidence_ref',
    ownerUid
  );
  const {data:confirmed,error:recheck}=await supabase.auth.getUser();
  if(recheck||confirmed.user?.id!==ownerUid)throw new Error('External ledger owner changed during read');
  return projectExternalLedgerEvents(ownerUid,payments,credits,language);
}
