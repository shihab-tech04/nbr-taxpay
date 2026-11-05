import {supabase} from './supabaseClient';
import {TAXPAY_PUBLIC_ENDPOINT} from '../config/publicBackend';
import {getDemoUser,type DemoUserId} from '../data/demoUsers';

export function syntheticTaxpayerId(value:string):DemoUserId|null {
  return getDemoUser(value.trim().toLowerCase())?.id??null;
}
export function syntheticAccountEmail(id:DemoUserId):string {
  return `taxpay-sample-${id}@example.com`;
}
/** Publicly known fictional sample credentials. The resulting Auth UID is
 * owner-scoped in SQL; it does NOT prove legal taxpayer identity or tax credit.
 */
export async function signInSyntheticTaxpayer(userId:string,password:string):Promise<DemoUserId>{
  const id=syntheticTaxpayerId(userId);
  if(!id||password!==id)throw new Error('INVALID_CREDENTIALS');
  const db=supabase;
  const {url,publishableKey}=TAXPAY_PUBLIC_ENDPOINT;
  if(!db||!url||!publishableKey)throw new Error('ACCOUNT_UNAVAILABLE');
  let response:Response;
  try {
    response=await fetch(`${url.replace(/\/$/,'')}/functions/v1/taxpay-synthetic-account`,{
      method:'POST',cache:'no-store',
      headers:{'content-type':'application/json','apikey':publishableKey},
      body:JSON.stringify({userId:id,password}),
    });
  }catch{throw new Error('ACCOUNT_UNAVAILABLE');}
  if(response.status===401)throw new Error('INVALID_CREDENTIALS');
  if(!response.ok)throw new Error('ACCOUNT_UNAVAILABLE');
  const result=await response.json().catch(()=>null) as {ok?:boolean}|null;
  if(result?.ok!==true)throw new Error('ACCOUNT_UNAVAILABLE');
  const {data,error}=await db.auth.signInWithPassword({
    email:syntheticAccountEmail(id),password:`korbritto-public-demo-${id}`,
  });
  if(error||!data.user||!data.session)throw new Error('INVALID_CREDENTIALS');
  if(data.user.app_metadata?.taxpay_synthetic_id!==id||
     data.user.app_metadata?.taxpay_account_class!=='public_synthetic'){
    await db.auth.signOut({scope:'local'});
    throw new Error('ACCOUNT_UNAVAILABLE');
  }
  return id;
}
