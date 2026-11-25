import {supabase} from './supabaseClient';
import {isWellFormedTinProfile,type TaxpayerTinProfile} from '../contracts/taxpayerTinProfile';
import {TAXPAYER_PROFILE_FIELD_ORDER} from '../contracts/taxpayerProfileFieldLayout';

/**
 * Application Auth alone never proves a TIN. The existing server-side
 * sim_my_taxpayer_profile() RPC is the only approved owner binding here.
 * This reader does not create bindings or authorize payments.
 */
export type VerifiedRegistrationReader={
  currentAuthUid:()=>Promise<string|null>;
  boundAccountId:()=>Promise<unknown>;
  readProfile:(accountId:string)=>Promise<unknown>;
};

/**
 * The existing sim_my_taxpayer_profile() SQL raises P0001 specifically when
 * the signed-in account has not been approved for any profile. That means
 * "not linked", not a broken network connection or an authorization grant.
 * Every other RPC error must remain a visible failure.
 */
export function isUnboundRegistrationRpcError(
  error:{code?:string;message?:string}|null,
):boolean {
  return error?.code==='P0001'&&
    error.message==='No approved synthetic profile binding';
}

export function parseOwnerRegistrationRow(raw:unknown,accountId:string):TaxpayerTinProfile{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid registration profile row');
  const row=raw as Record<string,unknown>;
  if(row.account_id!==accountId||typeof row.tin!=='string'||!/^[0-9]{12}$/.test(row.tin)||
     !isWellFormedTinProfile(row.profile as TaxpayerTinProfile)||
     (row.profile as TaxpayerTinProfile).tin!==row.tin||
     !Number.isSafeInteger(row.revision)||(row.revision as number)<1||
     typeof row.updated_at!=='string'||!Number.isFinite(Date.parse(row.updated_at)))
    throw Error('Registration profile owner/source mismatch');
  // Exactly the 24 approved registration fields plus two source metadata keys.
  // Never silently accept a missing field or introduce extra rendered identity data.
  const fields=row.profile as Record<string,unknown>;
  const approved=['source','sourceUpdatedAt',...TAXPAYER_PROFILE_FIELD_ORDER.map(([field])=>field)];
  if(approved.length!==26||new Set(approved).size!==26||
     Object.keys(fields).length!==approved.length ||
     !approved.every(field=>Object.hasOwn(fields,field)) ||
     TAXPAYER_PROFILE_FIELD_ORDER.some(([field])=>{
       const value=fields[field];return value!==null&&typeof value!=='string';
     }))throw Error('Registration profile field contract mismatch');
  return row.profile as TaxpayerTinProfile;
}

/** Fail closed on a switched/expired Auth owner before and after every source read. */
export async function resolveAuthenticatedRegistrationProfile(
  expectedUid:string,reader:VerifiedRegistrationReader,
):Promise<TaxpayerTinProfile|null>{
  if(!expectedUid||await reader.currentAuthUid()!==expectedUid)
    throw Error('Account session changed');
  const accountId=await reader.boundAccountId();
  if(await reader.currentAuthUid()!==expectedUid)
    throw Error('Account session changed');
  // An unbound Auth account is not the owner of any taxpayer profile.
  if(accountId===null)return null;
  if(typeof accountId!=='string'||!/^user(?:[1-9]|[1-4][0-9]|5[0-5])$/.test(accountId))
    throw Error('Registration profile owner binding invalid');
  const raw=await reader.readProfile(accountId);
  if(await reader.currentAuthUid()!==expectedUid)
    throw Error('Account session changed');
  return raw===null?null:parseOwnerRegistrationRow(raw,accountId);
}

export async function loadAuthenticatedRegistrationProfile(expectedUid:string):Promise<TaxpayerTinProfile|null>{
  if(!supabase)throw Error('Registration profile SQL unavailable');
  const client=supabase;
  return resolveAuthenticatedRegistrationProfile(expectedUid,{
    currentAuthUid:async()=>{
      const {data,error}=await client.auth.getUser();
      if(error)throw Error('Unable to verify account identity');
      return data.user?.id??null;
    },
    boundAccountId:async()=>{
      const {data,error}=await client.rpc('sim_my_taxpayer_profile');
      if(isUnboundRegistrationRpcError(error))return null;
      if(error)throw Error('Unable to verify taxpayer ownership');
      return data;
    },
    readProfile:async(accountId)=>{
      const {data,error}=await client.from('taxpay_taxpayer_registration_profiles')
        .select('account_id,tin,profile,revision,updated_at')
        .eq('account_id',accountId).maybeSingle();
      if(error)throw Error('Registration profile SQL read failed');
      return data;
    },
  });
}
