import {BENEFICIARY_RELATIONS,type BeneficiaryTag,type BeneficiaryRelation} from './beneficiaryTags';

/** Presentation-only encoding. The SQL schema keeps tag and relationship in separate fields. */
export function beneficiaryChoiceValue(tag:BeneficiaryTag|'',relationship:BeneficiaryRelation|''):string{
  if(tag==='friends_family')return relationship?`friends_family:${relationship}`:'';
  return tag;
}
export function beneficiaryChoiceParts(value:string):{tag:BeneficiaryTag|'',relationship:BeneficiaryRelation|''}{
  if(value==='clients'||value==='others')return {tag:value,relationship:''};
  if(value.startsWith('friends_family:')){
    const relation=value.slice('friends_family:'.length);
    if(BENEFICIARY_RELATIONS.some(allowed=>allowed===relation))
      return {tag:'friends_family',relationship:relation as BeneficiaryRelation};
  }
  return {tag:'',relationship:''};
}
