import { supabase } from './supabaseClient';

export interface BeneficiaryList { id: string; owner_uid: string; name: string; created_at: string; }
export interface Beneficiary { id: string; owner_uid: string; list_id: string; tin: string; display_name: string; created_at: string; updated_at: string; }
export type BeneficiaryInput = Pick<Beneficiary,'tin' | 'display_name'>;

/** A contact is never a taxpayer authorization or verified TIN/name binding. */
function client() {
  if (!supabase) throw new Error('Saved beneficiaries are unavailable. Please try again later.');
  return supabase;
}
export async function loadBeneficiaries(ownerUid: string): Promise<{lists:BeneficiaryList[]; people:Beneficiary[]}> {
  const db=client();
  const [listResult,peopleResult]=await Promise.all([
    db.from('taxpay_beneficiary_lists').select('id,owner_uid,name,created_at').eq('owner_uid',ownerUid).order('name'),
    db.from('taxpay_beneficiaries').select('id,owner_uid,list_id,tin,display_name,created_at,updated_at').eq('owner_uid',ownerUid).order('created_at',{ascending:false}).limit(1000),
  ]);
  if(listResult.error) throw listResult.error;
  if(peopleResult.error) throw peopleResult.error;
  return {lists:(listResult.data??[]) as BeneficiaryList[],people:(peopleResult.data??[]) as Beneficiary[]};
}
export async function createBeneficiaryList(ownerUid:string,name:string):Promise<BeneficiaryList> {
  const trimmed=name.trim();
  if(!trimmed || trimmed.length>80)throw new Error('Enter a list name of up to 80 characters.');
  const {data,error}=await client().from('taxpay_beneficiary_lists').insert({owner_uid:ownerUid,name:trimmed}).select('id,owner_uid,name,created_at').single();
  if(error)throw error;
  return data as BeneficiaryList;
}
export async function addBeneficiaries(ownerUid:string,listId:string,rows:BeneficiaryInput[]):Promise<number> {
  if(!rows.length)return 0;
  if(rows.length>1000)throw new Error('Import a maximum of 1,000 beneficiaries at a time.');
  const valid=rows.every(row=>/^\d{12}$/.test(row.tin)&&row.display_name.trim().length>0&&row.display_name.trim().length<=160);
  if(!valid)throw new Error('Check the beneficiary TIN and name before saving.');
  // Database unique constraint + ignoreDuplicates makes retry idempotent and leaves existing names unchanged.
  const {data,error}=await client().from('taxpay_beneficiaries')
    .upsert(rows.map(row=>({owner_uid:ownerUid,list_id:listId,tin:row.tin,display_name:row.display_name.trim()})),
      {onConflict:'list_id,tin',ignoreDuplicates:true})
    .select('id');
  if(error)throw error;
  return data?.length??0;
}
export async function updateBeneficiary(ownerUid:string,id:string,name:string):Promise<void>{
  const trimmed=name.trim();
  if(!trimmed||trimmed.length>160)throw new Error('Enter a beneficiary name of up to 160 characters.');
  const {error}=await client().from('taxpay_beneficiaries').update({display_name:trimmed,updated_at:new Date().toISOString()}).eq('id',id).eq('owner_uid',ownerUid);
  if(error)throw error;
}
export async function removeBeneficiary(ownerUid:string,id:string):Promise<void>{
  const {error}=await client().from('taxpay_beneficiaries').delete().eq('id',id).eq('owner_uid',ownerUid);
  if(error)throw error;
}
