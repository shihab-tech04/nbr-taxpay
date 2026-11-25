import type {ChallanReceipt} from '../types/tax';

export type ActivityPayer={name:string;tin:string|null};
const knownName=(value:unknown):value is string=>
  typeof value==='string'&&value.trim().length>0&&value.trim()!=='—';
const knownTin=(value:unknown):value is string=>
  typeof value==='string'&&/^\d{12,13}$/.test(value);

/** Read-only projection: the account and beneficiary are never assumed to be the payer. */
export function activityPaymentPayer(
  row:{kind?:string;sql?:{receipts:readonly ChallanReceipt[]}},
  exampleIncomePayer:{name:string;tin?:string}|null=null
):ActivityPayer|null{
  if(row.sql){
    const receipts=row.sql.receipts;
    if(!receipts.length)return null;
    const names=receipts.map(receipt=>knownName(receipt.payerName)?receipt.payerName.trim():null);
    if(names.some(name=>name===null)||new Set(names).size!==1)return null;
    const tins=receipts.map(receipt=>knownTin(receipt.payerTin)?receipt.payerTin:null);
    const distinct=new Set(tins.filter((tin):tin is string=>tin!==null));
    if(distinct.size>1)return null;
    return {name:names[0]!,tin:tins.every(tin=>tin!==null&&tin===tins[0])?tins[0]:null};
  }
  // Only the existing fictional income-tax scenario identifies the payer.
  if(row.kind!=='income'||!exampleIncomePayer||!knownName(exampleIncomePayer.name))return null;
  return {name:exampleIncomePayer.name.trim(),tin:knownTin(exampleIncomePayer.tin)?exampleIncomePayer.tin:null};
}
