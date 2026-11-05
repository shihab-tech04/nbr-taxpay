import {supabase} from './supabaseClient';
import type {Language} from '../types/tax';

/** Visual preferences only. Never use user-editable metadata for taxpayer ownership or permissions. */
export type AccountViewPreferenceKey = 'taxpay_language' | 'taxpay_last_beneficiary_list_id';

export function validSavedLanguage(value:unknown):Language|null {
  return value==='bn'||value==='en'?value:null;
}

export function rememberedBeneficiaryListId(
  lists:ReadonlyArray<{id:string}>, saved:unknown
):string {
  return typeof saved==='string'&&lists.some(list=>list.id===saved)
    ?saved:lists[0]?.id??'';
}

function previewLanguageStorageKey(previewId:string|null):string {
  return previewId?'taxpay:preview-language:'+previewId:'taxpay:guest-language';
}

/** Preview users have no verified Supabase identity: this is device-only UX,
 * never cross-device storage or an account record. */
export function readBrowserLanguage(previewId:string|null):Language|null {
  try {return validSavedLanguage(window.localStorage.getItem(previewLanguageStorageKey(previewId)));}
  catch {return null;}
}

export function saveBrowserLanguage(previewId:string|null,language:Language):void {
  try {window.localStorage.setItem(previewLanguageStorageKey(previewId),language);}
  catch { /* Browser storage may be disabled; never imply it was saved remotely. */ }
}

/** Verify current Auth owner before writing an account-owned visual preference.
 * The Auth server merges user_metadata; no beneficiary/payment rows are altered.
 */
export async function saveAccountViewPreference(
  ownerUid:string,key:AccountViewPreferenceKey,value:string
):Promise<void> {
  const db=supabase;
  if(!db)throw new Error('Sign in to save account preferences.');
  const {data:identity,error:identityError}=await db.auth.getUser();
  if(identityError||identity.user?.id!==ownerUid)throw new Error('Account changed. Sign in again.');
  const {data:updated,error:saveError}=await db.auth.updateUser({data:{[key]:value}});
  if(saveError)throw saveError;
  if(updated.user?.id!==ownerUid||updated.user.user_metadata?.[key]!==value)
    throw new Error('Account preference could not be confirmed.');
}
