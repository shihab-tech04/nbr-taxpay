import type {Beneficiary} from './beneficiaries';
export const PAYMENT_TAG_GROUPS=['family','friends','clients','others','unassigned'] as const;
export type PaymentTagGroup=typeof PAYMENT_TAG_GROUPS[number];
type TaggedPerson=Pick<Beneficiary,'tin'|'tag'|'relationship'>;
/**
 * One taxpayer TIN may appear in several saved lists. Never double-count.
 * Conflicting classifications are intentionally unassigned until resolved.
 */
export function paymentTagGroupForTin(tin:string|undefined,people:readonly TaggedPerson[]):PaymentTagGroup {
  if(!tin)return 'unassigned';
  const groups=new Set<PaymentTagGroup>();
  for(const person of people){
    if(person.tin!==tin)continue;
    if(person.tag==='friends_family')groups.add(person.relationship==='friends'?'friends':'family');
    else if(person.tag==='clients')groups.add('clients');
    else if(person.tag==='others')groups.add('others');
  }
  return groups.size===1 ? [...groups][0] : 'unassigned';
}
export const paymentTagGroupLabels:Record<PaymentTagGroup,{en:string;bn:string}>={
  family:{en:'Family',bn:'পরিবার'},
  friends:{en:'Friends',bn:'বন্ধু'},
  clients:{en:'Clients',bn:'ক্লায়েন্ট'},
  others:{en:'Others',bn:'অন্যান্য'},
  unassigned:{en:'Own / unassigned',bn:'নিজের / শ্রেণিবিহীন'}
};
