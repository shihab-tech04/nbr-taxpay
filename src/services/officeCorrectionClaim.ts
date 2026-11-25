import type {supabase} from './supabaseClient';

/** Claim only cases linked by the server to the current signed-in account. */
export async function claimPendingOfficeCorrections(client:NonNullable<typeof supabase>):Promise<void>{
 const {error}=await client.rpc('taxpay_claim_office_initiated_corrections',{p_limit:20});
 if(error && !(error.code==='PGRST202' && /taxpay_claim_office_initiated_corrections/i.test(error.message??'')))throw error;
}
