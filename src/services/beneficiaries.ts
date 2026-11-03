import { supabase } from './supabaseClient';
import { beneficiaryNameForStorage } from './beneficiaryNames';
import {normalizeOtherLabel,validBeneficiaryClassification,type BeneficiaryTag,type BeneficiaryRelation} from './beneficiaryTags';
import {
  addGuestBeneficiaries, createGuestBeneficiaryList, loadGuestBeneficiaries, hasStoredGuestBeneficiaries,
  removeGuestBeneficiary, updateGuestBeneficiary, editGuestBeneficiaryClassification, moveGuestBeneficiary, renameGuestBeneficiaryList, deleteGuestBeneficiaryList,
} from './guestBeneficiaries';

export interface BeneficiaryList { id: string; owner_uid?: string; name: string; created_at: string; }
export interface Beneficiary { id: string; owner_uid?: string; list_id: string; tin: string; display_name: string; tag:BeneficiaryTag|null; relationship:BeneficiaryRelation|null; other_label:string|null; created_at: string; updated_at: string; }
/** Optional only for pre-tag legacy imports and existing saved records; the entry UI requires both choices. */
export type BeneficiaryInput = Pick<Beneficiary,'tin' | 'display_name'> & Partial<Pick<Beneficiary,'tag'|'relationship'|'other_label'>>;

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
type BeneficiarySnapshot = {lists:BeneficiaryList[]; people:Beneficiary[]};
// One in-flight fetch per identity, shared by the management page and payment
// picker. Entries disappear after completion: writes and tab changes never
// reuse a stale success, and failures are never cached.
const beneficiaryReads = new Map<string, Promise<BeneficiarySnapshot>>();
export function loadBeneficiaries(ownerUid: string | null = null): Promise<BeneficiarySnapshot> {
  const key = ownerUid ?? 'guest';
  const existing = beneficiaryReads.get(key);
  if (existing) return existing;
  const request = fetchBeneficiaries(ownerUid).finally(() => {
    if (beneficiaryReads.get(key) === request) beneficiaryReads.delete(key);
  });
  beneficiaryReads.set(key, request);
  return request;
}
async function fetchBeneficiaries(ownerUid: string | null): Promise<BeneficiarySnapshot> {
  if (!ownerUid) return loadGuestBeneficiaries();
  const db=client();
  // PostgREST truncates unpaged SELECT results at the project row limit.
  // Read both collections in stable pages; an omitted saved list must never
  // look like an account with no beneficiaries.
  const [lists,people]=await Promise.all([
    collectBeneficiaryPages<BeneficiaryList>(async(from,to)=>{
      const result=await db.from('taxpay_beneficiary_lists').select('id,owner_uid,name,created_at')
        .eq('owner_uid',ownerUid).order('name').order('id').range(from,to);
      if(result.error)throw result.error;
      return (result.data??[]) as BeneficiaryList[];
    }),
    collectBeneficiaryPages<Beneficiary>(async(from,to)=>{
      const result=await db.from('taxpay_beneficiaries').select('id,owner_uid,list_id,tin,display_name,tag,relationship,other_label,created_at,updated_at')
        .eq('owner_uid',ownerUid).order('created_at',{ascending:false}).order('id',{ascending:false}).range(from,to);
      if(result.error)throw result.error;
      return (result.data??[]) as Beneficiary[];
    }),
  ]);
  return {lists,people};
}
/** Explicit, idempotent recovery from this browser's guest capability into the signed-in profile.
 * Keep guest records intact so a partially completed import can be safely retried.
 * Never attempt to recover another browser's guest session or guess its capability.
 */
export async function recoverGuestBeneficiariesToProfile(ownerUid:string):Promise<{lists:number;people:number}> {
  if(!ownerUid)throw new Error('Sign in before restoring beneficiaries.');
  const db=client();
  const ensureOwner=async()=>{
    const {data,error}=await db.auth.getUser();
    if(error||data.user?.id!==ownerUid){
      throw new Error('Your signed-in account has changed. Sign in again before restoring beneficiaries.');
    }
  };
  // A supplied owner UID is never enough to authorize a private account write.
  await ensureOwner();
  if(!hasStoredGuestBeneficiaries())return {lists:0,people:0};
  const source=await loadGuestBeneficiaries();
  if(!source.lists.length)return {lists:0,people:0};
  await ensureOwner();
  const existing=await loadBeneficiaries(ownerUid);
  const known=[...existing.lists];
  const destinations=new Map<string,string>();
  let listCount=0,personCount=0;
  for(const guestList of source.lists){
    await ensureOwner();
    const normalizedName=guestList.name.trim().toLocaleLowerCase();
    let destination=known.find(list=>list.name.trim().toLocaleLowerCase()===normalizedName);
    if(!destination){
      let created=false;
      try { destination=await createBeneficiaryList(ownerUid,guestList.name);created=true; }
      catch(error){
        // A concurrent same-account request may have created the list. Never
        // substitute a different owner's list or discard a failed source row.
        const refreshed=await loadBeneficiaries(ownerUid);
        destination=refreshed.lists.find(list=>list.name.trim().toLocaleLowerCase()===normalizedName);
        if(!destination)throw error;
      }
      known.push(destination);
      if(created)listCount++;
    }
    destinations.set(guestList.id,destination.id);
    const rows=source.people.filter(person=>person.list_id===guestList.id)
      .map(person=>({tin:person.tin,display_name:person.display_name,tag:person.tag??null,relationship:person.relationship??null,other_label:person.other_label??null}));
    for(let offset=0;offset<rows.length;offset+=500){
      await ensureOwner();
      personCount+=await addBeneficiaries(ownerUid,destination.id,rows.slice(offset,offset+500));
    }
  }
  // A successful HTTP write is insufficient: verify each original TIN is
  // readable from the same verified owner's SQL account before announcing success.
  await ensureOwner();
  const saved=await loadBeneficiaries(ownerUid);
  for(const guestList of source.lists){
    const destinationId=destinations.get(guestList.id);
    if(!destinationId||!saved.lists.some(list=>list.id===destinationId)){
      throw new Error('A beneficiary list could not be verified. Retry to finish restoring it.');
    }
    const savedTins=new Set(saved.people.filter(person=>person.list_id===destinationId).map(person=>person.tin));
    if(source.people.some(person=>person.list_id===guestList.id&&!savedTins.has(person.tin))){
      throw new Error('Some beneficiaries could not be verified. Retry safely; existing records will not be duplicated.');
    }
  }
  return {lists:listCount,people:personCount};
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
  const normalized=rows.map(row=>({...row,display_name:beneficiaryNameForStorage(row.display_name),
    other_label:row.tag==='others'?normalizeOtherLabel(row.other_label):null}));
  const valid=normalized.every(row=>/^\d{12}$/.test(row.tin)&&row.display_name.length<=160 &&
    ((row.tag==null && row.relationship==null) || validBeneficiaryClassification(row.tag,row.relationship,row.other_label)));
  // Legacy null tags remain readable; all new single/bulk entry forms enforce a choice.
  if(!valid)throw new Error('Check the beneficiary TIN and name length before saving.');
  if (!ownerUid) return addGuestBeneficiaries(listId,normalized);
  // Database unique constraint + ignoreDuplicates makes retry idempotent and leaves existing names unchanged.
  const {data,error}=await client().from('taxpay_beneficiaries')
    .upsert(normalized.map(row=>({owner_uid:ownerUid,list_id:listId,tin:row.tin,display_name:row.display_name,tag:row.tag??null,relationship:row.relationship??null,other_label:row.other_label??null})),
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
/** Atomically edit a saved contact's self-declared classification and optional list.
 * No payment data or taxpayer authorization is changed.
 * Legacy untagged rows must be explicitly classified when edited.
 */
export async function editBeneficiaryClassification(
  ownerUid:string|null,
  person:Pick<Beneficiary,'id'|'list_id'>,
  targetListId:string,
  classification:Pick<Beneficiary,'tag'|'relationship'|'other_label'>
):Promise<void>{
  const tag=classification.tag;
  const relationship=tag==='friends_family'?classification.relationship:null;
  const other_label=tag==='others'?normalizeOtherLabel(classification.other_label):null;
  if(!validBeneficiaryClassification(tag,relationship,other_label)){
    throw new Error('Choose a tag, and enter its required relationship or Others description (up to 80 characters).');
  }
  if(!targetListId)throw new Error('Choose a saved list.');
  if(!ownerUid){
    await editGuestBeneficiaryClassification(person.id,person.list_id,targetListId,{
      tag:tag!,relationship,other_label,
    });
    return;
  }
  const db=client();
  const {data:destination,error:destinationError}=await db.from('taxpay_beneficiary_lists')
    .select('id').eq('id',targetListId).eq('owner_uid',ownerUid).maybeSingle();
  if(destinationError)throw destinationError;
  if(!destination)throw new Error('The destination list is unavailable. Refresh and try again.');
  const {data,error}=await db.from('taxpay_beneficiaries')
    .update({list_id:targetListId,tag,relationship,other_label,updated_at:new Date().toISOString()})
    .eq('id',person.id).eq('owner_uid',ownerUid).eq('list_id',person.list_id)
    .select('id,list_id,tag,relationship,other_label').maybeSingle();
  if(error?.code==='23505')throw new Error('This beneficiary is already saved in the destination list.');
  if(error)throw error;
  if(!data || data.list_id!==targetListId || data.tag!==tag ||
      data.relationship!==relationship || data.other_label!==other_label){
    throw new Error('The beneficiary changed or was not saved. Refresh and try again.');
  }
}

/** Move a saved contact without changing its TIN, name, identity or payment history. */
export async function moveBeneficiary(ownerUid:string|null,id:string,sourceListId:string,targetListId:string):Promise<void>{
  if(!targetListId||!sourceListId||sourceListId===targetListId)throw new Error('Choose another saved list.');
  if(!ownerUid)return moveGuestBeneficiary(id,sourceListId,targetListId);
  const db=client();
  // The destination must belong to this account. Existing RLS and the composite
  // (list_id,owner_uid) foreign key also enforce ownership at write time.
  const {data:destination,error:destinationError}=await db.from('taxpay_beneficiary_lists')
    .select('id').eq('id',targetListId).eq('owner_uid',ownerUid).maybeSingle();
  if(destinationError)throw destinationError;
  if(!destination)throw new Error('The destination list is unavailable. Refresh and choose another list.');
  const {data,error}=await db.from('taxpay_beneficiaries')
    .update({list_id:targetListId,updated_at:new Date().toISOString()})
    .eq('id',id).eq('owner_uid',ownerUid).eq('list_id',sourceListId)
    .select('id').maybeSingle();
  if(error?.code==='23505')throw new Error('This beneficiary is already saved in the destination list.');
  if(error)throw error;
  if(!data)throw new Error('The beneficiary has changed or is no longer available. Refresh and try again.');
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
