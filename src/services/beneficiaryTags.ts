/** Fixed, user-declared beneficiary tags. They never grant payment authorization or confirm kinship. */
export const BENEFICIARY_TAGS = ['clients','friends_family','others'] as const;
export const BENEFICIARY_RELATIONS = ['father','mother','siblings','son','daughter','spouse','friends'] as const;
export type BeneficiaryTag = typeof BENEFICIARY_TAGS[number];
export type BeneficiaryRelation = typeof BENEFICIARY_RELATIONS[number];
export interface BeneficiaryClassification {
  tag: BeneficiaryTag | null;
  relationship: BeneficiaryRelation | null;
  other_label: string | null;
}
/** User-provided description, never used to infer or authorize identity. */
export const BENEFICIARY_OTHER_LABEL_MAX = 80;
export function normalizeOtherLabel(label:unknown):string|null {
  if(typeof label!=='string')return null;
  const value=label.trim();
  return value.length>0&&value.length<=BENEFICIARY_OTHER_LABEL_MAX?value:null;
}
export function validBeneficiaryClassification(tag:unknown,relationship:unknown,otherLabel:unknown=null):boolean {
  if (!BENEFICIARY_TAGS.some(value=>value===tag)) return false;
  if(tag==='others')return (relationship===null||relationship===undefined||relationship==='')&&
    normalizeOtherLabel(otherLabel)!==null;
  if(otherLabel!==null&&otherLabel!==undefined&&otherLabel!=='')return false;
  if(tag==='friends_family')return BENEFICIARY_RELATIONS.some(value=>value===relationship);
  return relationship===null || relationship===undefined || relationship==='';
}
const tagLabels:{[K in BeneficiaryTag]:[string,string]}={
  clients:['Clients','ক্লায়েন্ট'],
  friends_family:['Friends & family members','বন্ধু ও পরিবারের সদস্য'],
  others:['Others','অন্যান্য'],
};
const relationLabels:{[K in BeneficiaryRelation]:[string,string]}={
  father:['Father','বাবা'],mother:['Mother','মা'],siblings:['Siblings','ভাইবোন'],
  son:['Son','ছেলে'],daughter:['Daughter','মেয়ে'],spouse:['Spouse','স্বামী/স্ত্রী'],friends:['Friends','বন্ধু'],
};
export function beneficiaryTagLabel(
  tag:BeneficiaryTag|null|undefined,relation:BeneficiaryRelation|null|undefined,language:'en'|'bn',otherLabel?:string|null
):string {
  if(!tag)return language==='bn'?'পূর্বের তথ্য · ট্যাগ নেই':'Previously saved · No tag';
  const label=tagLabels[tag]?.[language==='bn'?1:0];
  if(!label)return language==='bn'?'ট্যাগ নেই':'No tag';
  if(tag==='others')return otherLabel?.trim()?`${label} · ${otherLabel.trim()}`:label;
  if(tag!=='friends_family')return label;
  const sub=relation?relationLabels[relation]?.[language==='bn'?1:0]:null;
  return sub?`${label} · ${sub}`:label;
}
