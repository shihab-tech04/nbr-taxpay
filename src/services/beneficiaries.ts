import { supabase } from './supabaseClient';
import { beneficiaryNameForStorage } from './beneficiaryNames';
import {
  addGuestBeneficiaries, createGuestBeneficiaryList, loadGuestBeneficiaries,
  removeGuestBeneficiary, updateGuestBeneficiary, renameGuestBeneficiaryList, deleteGuestBeneficiaryList,
} from './guestBeneficiaries';

export interface BeneficiaryList { id: string; owner_uid?: string; name: string; created_at: string; }
export interface Beneficiary { id: string; owner_uid?: string; list_id: string; tin: string; display_name: string; created_at: string; updated_at: string; }
export type BeneficiaryInput = Pick<Beneficiary,'tin' | 'display_name'>;

/** A contact is never a taxpayer authorization or verified TIN/name binding. */
function client() {
  if (!supabase) throw new Error('Saved beneficiaries are unavailable. Please try again later.');
  return supabase;
}
/** Read every page instead of silently truncating beneficiaries across named lists. */
export async function collectBeneficiaryPages<T>(
  fetchPage:(from:number,to:number)=>Promise<T[]>, pageSize=500
):Promise<T[]> {
  if(!Number.isInteger(pageSize)||pageSize<1||pageSize>1000)throw new Error('Invalid beneficiary page size.');
  const all:T[]=[];
  for(let from=0;;from+=pageSize){
    const page=await fetchPage(from,from+pageSize-1);
    all.push(...page);
    if(page.length<pageSize)return all;
  }
}
export async function loadBeneficiaries(ownerUid: string | null = null): Promise<{lists:BeneficiaryList[]; people:Beneficiary[]}> {
  if (!ownerUid) return loadGuestBeneficiaries();
  const db=client();
  const [listResult,people]=await Promise.all([
    db.from('taxpay_beneficiary_lists').select('id,owner_uid,name,created_at').eq('owner_uid',ownerUid).order('name'),
    collectBeneficiaryPages<Beneficiary>(async(from,to)=>{
      const result=await db.from('taxpay_beneficiaries').select('id,owner_uid,list_id,tin,display_name,created_at,updated_at')
        .eq('owner_uid',ownerUid).order('created_at',{ascending:false}).order('id',{ascending:false}).range(from,to);
      if(result.error)throw result.error;
      return (result.data??[]) as Beneficiary[];
    }),
  ]);
  if(listResult.error)throw listResult.error;
  return {lists:(listResult.data??[]) as BeneficiaryList[],people};
}
export async function createBeneficiaryList(ownerUid:string | null,name:string):Promise<BeneficiaryList> {
  const trimmed=name.trim();
  if(!trimmed || trimmed.length>80)throw new Error('Enter a list name of up to 80 characters.');
  if (!ownerUid) return createGuestBeneficiaryList(trimmed);
  const {data,error}=await client().from('taxpay_beneficiary_lists').insert({owner_uid:ownerUid,name:trimmed}).select('id,owner_uid,name,created_at').single();
  if(error)throw error;
  return data as BeneficiaryList;
}
export async function addBeneficiaries(ownerUid:string | null,listId:string,rows:BeneficiaryInput[]):Promise<number> {
  if(!rows.length)return 0;
  if(rows.length>1000)throw new Error('Import a maximum of 1,000 beneficiaries at a time.');
  const normalized=rows.map(row=>({...row,display_name:beneficiaryNameForStorage(row.display_name)}));
  const valid=normalized.every(row=>/^\d{12}$/.test(row.tin)&&row.display_name.length<=160);
  if(!valid)throw new Error('Check the beneficiary TIN and name length before saving.');
  if (!ownerUid) return addGuestBeneficiaries(listId,normalized);
  // Database unique constraint + ignoreDuplicates makes retry idempotent and leaves existing names unchanged.
  const {data,error}=await client().from('taxpay_beneficiaries')
    .upsert(normalized.map(row=>({owner_uid:ownerUid,list_id:listId,tin:row.tin,display_name:row.display_name})),
      {onConflict:'list_id,tin',ignoreDuplicates:true})
    .select('id');
  if(error)throw error;
  return data?.length??0;
}
export async function updateBeneficiary(ownerUid:string | null,id:string,name:string):Promise<void>{
  const normalized=beneficiaryNameForStorage(name);
  if(normalized.length>160)throw new Error('Enter a beneficiary name of 160 characters or fewer.');
  if (!ownerUid) return updateGuestBeneficiary(id,normalized);
  const {error}=await client().from('taxpay_beneficiaries').update({display_name:normalized,updated_at:new Date().toISOString()}).eq('id',id).eq('owner_uid',ownerUid);
  if(error)throw error;
}
export async function removeBeneficiary(ownerUid:string | null,id:string):Promise<void>{
  if (!ownerUid) return removeGuestBeneficiary(id);
  const {error}=await client().from('taxpay_beneficiaries').delete().eq('id',id).eq('owner_uid',ownerUid);
  if(error)throw error;
}

/** Rename only an owner-owned saved list; never mutate member TINs or payment records. */
export async function renameBeneficiaryList(ownerUid:string|null,id:string,name:string):Promise<void>{
  const normalized=name.trim();
  if(!normalized || normalized.length>80)throw new Error('Enter a list name of up to 80 characters.');
  if(!ownerUid)return renameGuestBeneficiaryList(id,normalized);
  const {data,error}=await client().from('taxpay_beneficiary_lists')
    .update({name:normalized}).eq('id',id).eq('owner_uid',ownerUid).select('id').maybeSingle();
  if(error){
    if(error.code==='23505')throw new Error('A list with this name already exists.');
    throw error;
  }
  if(!data)throw new Error('This beneficiary list no longer exists. Refresh and try again.');
}
/** Deleting a list cascades to its saved contacts only. Database RLS scopes the owner. */
export async function deleteBeneficiaryList(ownerUid:string|null,id:string):Promise<void>{
  if(!ownerUid)return deleteGuestBeneficiaryList(id);
  const {data,error}=await client().from('taxpay_beneficiary_lists')
    .delete().eq('id',id).eq('owner_uid',ownerUid).select('id').maybeSingle();
  if(error)throw error;
  if(!data)throw new Error('This beneficiary list no longer exists. Refresh and try again.');
}
