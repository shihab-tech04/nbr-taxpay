import {TAXPAY_PUBLIC_ENDPOINT} from '../config/publicBackend';
import {activePreviewSession} from './previewAccountSession';
import {supabase} from './supabaseClient';
import {isWellFormedTinProfile,type TaxpayerTinProfile} from '../contracts/taxpayerTinProfile';

export type RegistrationProfileSnapshot={
  accountId:string;tin:string;profile:TaxpayerTinProfile;revision:number;updatedAt:string;
};
function checked(data:unknown,accountId:string):RegistrationProfileSnapshot {
  if(!data || typeof data!=='object' || Array.isArray(data)) throw Error('Invalid registration profile');
  const record=data as Record<string,unknown>;
  if(record.accountId!==accountId || typeof record.tin!=='string' ||
      !/^\d{12}$/.test(record.tin) || !isWellFormedTinProfile(record.profile as TaxpayerTinProfile) ||
      (record.profile as TaxpayerTinProfile).tin!==record.tin ||
      !Number.isSafeInteger(record.revision) || Number(record.revision)<1 ||
      typeof record.updatedAt!=='string' || !Number.isFinite(Date.parse(record.updatedAt)))
    throw Error('Registration profile does not match this account');
  return record as RegistrationProfileSnapshot;
}
/** One SQL-owned record, never inferred from a typed TIN or payment reference. */
export async function loadTaxpayerRegistrationProfile(accountId:string):Promise<RegistrationProfileSnapshot|null> {
  const preview=activePreviewSession();
  if(preview){
    if(preview.profileId!==accountId) throw Error('Preview account changed');
    const {url,publishableKey}=TAXPAY_PUBLIC_ENDPOINT;
    if(!url||!publishableKey)throw Error('Registration profile source unavailable');
    const result=await fetch(url.replace(/\/$/,'')+'/functions/v1/taxpay-guest-beneficiaries',{
      method:'POST',cache:'no-store',
      headers:{apikey:publishableKey,'content-type':'application/json','x-taxpay-guest-capability':preview.capability},
      body:JSON.stringify({action:'demo-registration',profileId:accountId}),
    });
    const body=await result.json().catch(()=>null) as {success?:boolean;data?:unknown}|null;
    if(!result.ok || body?.success!==true)throw Error('Registration profile read failed');
    if(activePreviewSession()?.profileId!==accountId)throw Error('Preview account changed');
    return body.data===null?null:checked(body.data,accountId);
  }
  if(!supabase)throw Error('Registration profile SQL unavailable');
  const {data:user,error:authError}=await supabase.auth.getUser();
  if(authError||!user.user)throw Error('Sign in to view your registration profile');
  const bound=await supabase.rpc('sim_my_taxpayer_profile');
  if(bound.error || bound.data!==accountId)throw Error('Registration profile account mismatch');
  const result=await supabase.from('taxpay_taxpayer_registration_profiles')
    .select('account_id,tin,profile,revision,updated_at').eq('account_id',accountId).maybeSingle();
  if(result.error)throw Error('Registration profile SQL read failed');
  if(!result.data)return null;
  const {data:stillCurrent,error:changed}=await supabase.auth.getUser();
  if(changed||stillCurrent.user?.id!==user.user.id)throw Error('Registration profile account changed');
  return checked({accountId:result.data.account_id,tin:result.data.tin,profile:result.data.profile,
    revision:result.data.revision,updatedAt:result.data.updated_at},accountId);
}
