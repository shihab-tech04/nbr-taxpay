import type {ChallanReceipt} from '../../types/tax';
import {paymentTagGroupForTin, type PaymentTagGroup} from '../../services/beneficiaryPaymentTags';
import type {Beneficiary} from '../../services/beneficiaries';

export type DashboardChartSource='recorded'|'example';
export type DashboardChartService='income'|'tds'|'ait'|'other'|'travel';
export type DashboardChartTag=PaymentTagGroup|'own';

export type DashboardRecipientProfile=Pick<Beneficiary,'tin'|'tag'|'relationship'> & Partial<Pick<Beneficiary,'display_name'>>;
export type DashboardTopBeneficiary={
  tin:string;
  name:string|null;
  saved:boolean;
  tag:DashboardChartTag;
  amountMinor:bigint;
  paymentCount:number;
};

export type DashboardChartRecord={
  id:string;
  year:string;
  kind:string;
  amount:number;
  state:string;
  beneficiaryTin?:string;
  sql?:{receipts:ChallanReceipt[]};
};

export type DashboardChartSlice<Key extends string>={
  key:Key;
  amountMinor:bigint;
  paymentCount:number;
};
export type DashboardChartProjection={
  totalMinor:bigint;
  paymentCount:number;
  omittedRecords:number;
  byService:DashboardChartSlice<DashboardChartService>[];
  byTag:DashboardChartSlice<DashboardChartTag>[];
  byBeneficiary:DashboardTopBeneficiary[];
  unclassified:{
    recipientKnownMinor:bigint;
    recipientMissingMinor:bigint;
    untaggedRecipientCount:number;
    missingRecipientPaymentCount:number;
  };
};

export const DASHBOARD_SERVICE_KEYS:readonly DashboardChartService[]=['income','ait','tds','other','travel'];
export const DASHBOARD_TAG_KEYS:readonly DashboardChartTag[]=['family','friends','clients','others','own','unassigned'];

const assessmentYear=(raw:string):string=>{
  const value=String(raw||'').trim();
  const short=/^(20\d{2})-(\d{2})$/.exec(value);
  return short?short[1]+'-20'+short[2]:value;
};
export const serviceForCategory=(category:ChallanReceipt['paymentCategory']):DashboardChartService=>{
  switch(category){
    case 'TAX_WITH_RETURN':return 'income';
    case 'SOURCE_TAX_DEPOSIT':return 'tds';
    case 'ADVANCE_TAX':return 'ait';
    case 'TRAVEL_TAX':return 'travel';
    default:return 'other';
  }
};
const serviceForExample=(kind:string):DashboardChartService=>
  kind==='tds'?'tds':kind==='ait'?'ait':kind==='travel'?'travel':'income';

type ChartAllocation={
  rowId:string;
  service:DashboardChartService;
  tin:string|undefined;
  name?:string;
  amountMinor:bigint;
};

/**
 * Dashboard-only, read-only view. Every SQL receipt is reduced to its original,
 * positive, year-qualified allocation items. Never attribute the full combined
 * batch amount to each year or beneficiary. Missing allocations stay omitted.
 * Example fixtures are a separate explicitly selected source, never mixed into
 * account-owned SQL payments or described as official Treasury credits.
 */
export function projectDashboardChartRecords(
  rows:readonly DashboardChartRecord[],
  year:string,
  source:DashboardChartSource,
  people:readonly DashboardRecipientProfile[],
  ownerTin:string,
  serviceFilter:DashboardChartService|'all'='all',
  recipientFilter?:string
):DashboardChartProjection{
  const targetYear=assessmentYear(year);
  const allocations:ChartAllocation[]=[];
  let omittedRecords=0;
  const seen=new Map<string,string>();
  for(const row of rows){
    if(row.state!=='POSTED')continue;
    if(source==='example'&&row.sql)continue;
    if(source==='recorded'&&!row.sql)continue;
    if(row.sql){
      let omitted=false;
      for(const receipt of row.sql.receipts){
        const identity=String(receipt.paymentTransactionId||receipt.id||'').trim();
        if(!identity){omitted=true;continue;}
        const fingerprint=JSON.stringify({
          batchId:receipt.batchId??null,
          batchIndex:receipt.batchItemIndex??null,
          category:receipt.paymentCategory,
          year:receipt.assessmentYear,
          allocations:receipt.allocationItems??null
        });
        if(seen.has(identity)){
          if(seen.get(identity)!==fingerprint)omitted=true;
          continue;
        }
        seen.set(identity,fingerprint);
        if(!receipt.allocationItems?.length){omitted=true;continue;}
        for(const item of receipt.allocationItems){
          if(assessmentYear(item.assessmentYear)!==targetYear)continue;
          if(!Number.isSafeInteger(item.amountMinor)||item.amountMinor<=0){omitted=true;continue;}
          allocations.push({
            rowId:row.id,
            service:serviceForCategory(receipt.paymentCategory),
            tin:typeof item.taxpayerTin==='string'?item.taxpayerTin.trim():undefined,
            name:typeof item.taxpayerName==='string'?item.taxpayerName.trim():undefined,
            amountMinor:BigInt(item.amountMinor)
          });
        }
      }
      if(omitted)omittedRecords++;
      continue;
    }
    // Example withholding lines were recorded by employers/deductors, not
    // initiated by this payer. They are not the payer's spending by recipient.
    if(row.kind==='tds')continue;
    if(assessmentYear(row.year)!==targetYear)continue;
    const amountMinor=Math.round(row.amount*100);
    if(!Number.isSafeInteger(amountMinor)||amountMinor<=0){omittedRecords++;continue;}
    allocations.push({
      rowId:row.id,service:serviceForExample(row.kind),
      tin:row.beneficiaryTin,amountMinor:BigInt(amountMinor)
    });
  }
  const included=allocations.filter(row=>
    (serviceFilter==='all'||row.service===serviceFilter)&&
    (!recipientFilter||row.tin===recipientFilter));
  const aggregate=<Key extends string>(
    keys:readonly Key[],getKey:(row:ChartAllocation)=>Key
  ):DashboardChartSlice<Key>[]=>keys.map(key=>{
    const matching=included.filter(row=>getKey(row)===key);
    return {
      key,
      amountMinor:matching.reduce((sum,row)=>sum+row.amountMinor,0n),
      paymentCount:new Set(matching.map(row=>row.rowId)).size
    };
  });
  const byService=aggregate(DASHBOARD_SERVICE_KEYS,row=>row.service);
  const byTag=aggregate(DASHBOARD_TAG_KEYS,row=>{
    if(row.tin===ownerTin)return 'own';
    if(!row.tin)return 'unassigned';
    return paymentTagGroupForTin(row.tin,people);
  });
  // Group by actual recipient TIN. Never assume two people with the same name
  // are the same taxpayer or count receipt lines as separate payments.
  const groups=new Map<string,ChartAllocation[]>();
  for(const allocation of included){
    const tin=allocation.tin?.trim();
    if(!tin)continue;
    const existing=groups.get(tin)||[];
    existing.push(allocation);
    groups.set(tin,existing);
  }
  const byBeneficiary:DashboardTopBeneficiary[]=[...groups.entries()].map(([tin,rows])=>{
    const matching=people.filter(p=>p.tin===tin);
    const savedNames=[...new Set(matching.map(p=>p.display_name?.trim()).filter((x):x is string=>Boolean(x)))];
    const receiptNames=[...new Set(rows.map(p=>p.name?.trim()).filter((x):x is string=>Boolean(x)))];
    const name=savedNames.length===1?savedNames[0]
      :savedNames.length>1?null:receiptNames.length===1?receiptNames[0]:null;
    const tag:DashboardChartTag=tin===ownerTin?'own':paymentTagGroupForTin(tin,people);
    return {
      tin,name,saved:matching.length>0,
      tag,
      amountMinor:rows.reduce((sum,row)=>sum+row.amountMinor,0n),
      paymentCount:new Set(rows.map(row=>row.rowId)).size
    };
  }).sort((a,b)=>a.amountMinor>b.amountMinor?-1:a.amountMinor<b.amountMinor?1:a.tin.localeCompare(b.tin));
  // Retain the full unclassified financial amount, but distinguish payments
  // with an exact recipient identifier from payments with no recipient at all.
  // A known TIN is not evidence of a family/client relationship.
  const untagged=included.filter(row=>row.tin && row.tin!==ownerTin &&
    paymentTagGroupForTin(row.tin,people)==='unassigned');
  const missingRecipient=included.filter(row=>!row.tin);
  const unclassified={
    recipientKnownMinor:untagged.reduce((sum,row)=>sum+row.amountMinor,0n),
    recipientMissingMinor:missingRecipient.reduce((sum,row)=>sum+row.amountMinor,0n),
    untaggedRecipientCount:new Set(untagged.map(row=>row.tin)).size,
    missingRecipientPaymentCount:new Set(missingRecipient.map(row=>row.rowId)).size
  };
  return {
    totalMinor:included.reduce((sum,row)=>sum+row.amountMinor,0n),
    paymentCount:new Set(included.map(row=>row.rowId)).size,
    omittedRecords,
    byService,
    byTag,
    byBeneficiary,
    unclassified
  };
}

export function formatDashboardChartMoney(amountMinor:bigint,language:'en'|'bn'){
  const locale=language==='bn'?'bn-BD':'en-BD';
  const whole=new Intl.NumberFormat(locale).format(amountMinor/100n);
  const remainder=Number(amountMinor%100n);
  return '৳ '+whole+(remainder?'.'+new Intl.NumberFormat(locale,{
    minimumIntegerDigits:2,useGrouping:false
  }).format(remainder):'');
}
export function dashboardChartPercentage(amountMinor:bigint,totalMinor:bigint){
  return totalMinor>0n?Number(amountMinor*10000n/totalMinor)/100:0;
}


/** The entire overview and its chart use one assessment-year-scoped source.
 * Never silently merge fictional records with persisted payment allocations. */
export function chooseDashboardChartSource(
  rows:readonly DashboardChartRecord[],year:string,
  people:readonly DashboardRecipientProfile[],ownerTin:string
):DashboardChartSource{
  const saved=projectDashboardChartRecords(rows,year,'recorded',people,ownerTin);
  const examples=projectDashboardChartRecords(rows,year,'example',people,ownerTin);
  return saved.totalMinor>0n||saved.omittedRecords>0 ? 'recorded'
    : examples.totalMinor>0n ? 'example' : 'recorded';
}


/** Apply the exact same allocation guards as the visible dashboard chart
 * before opening filtered history. A multi-year combined payment must not
 * appear merely because a different head or recipient matched that batch. */
export function matchesDashboardChartDrilldown(
  row:DashboardChartRecord,
  year:string,
  source:DashboardChartSource,
  people:readonly DashboardRecipientProfile[],
  ownerTin:string,
  service:DashboardChartService|'all'='all',
  recipientTin?:string,
  relationship?:DashboardChartTag
):boolean{
  const projection=projectDashboardChartRecords([row],year,source,people,ownerTin,service,recipientTin);
  if(projection.totalMinor<=0n)return false;
  return !relationship||projection.byTag.some(item=>item.key===relationship&&item.amountMinor>0n);
}
