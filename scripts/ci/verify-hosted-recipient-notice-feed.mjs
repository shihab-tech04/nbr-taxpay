/** Read-only hosted verification for the existing fictional recipient capability.
 * No payment submission, acknowledgement, report write or credential logging. */
const root='https://gmuhitmaynfhipcvbvkh.supabase.co/functions/v1/taxpay-guest-beneficiaries';
const key=process.env.SOHOJKOR_V2_PUBLISHABLE_KEY;
if(!key?.startsWith('sb_publishable_'))throw Error('Expected V2 publishable key');
async function request(body,cap){
 const response=await fetch(root,{method:'POST',headers:{apikey:key,origin:'https://shihab-tech04.github.io','content-type':'application/json',...(cap?{'x-taxpay-guest-capability':cap}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 const json=await response.json().catch(()=>null);
 if(!response.ok||json?.success!==true)throw Error('Recipient feed request failed: '+body.action+' HTTP '+response.status);
 return json.data;
}
let rows=0;const owners=new Set();
let reportRouteVerified=false;
for(const profile of ['user1','user2','user3','user4','user30']){
 const session=await request({action:'demo-login',userId:profile,password:profile});
 if(session?.profileId!==profile||!/^([A-Za-z0-9_-]){43}$/.test(session.capability))throw Error('Unexpected fictional session');
 if(!reportRouteVerified){
   const url=root.replace('/taxpay-guest-beneficiaries','/demo-story1-taxpay/corrections');
   const headers={apikey:key,origin:'https://shihab-tech04.github.io','content-type':'application/json','x-taxpay-guest-capability':session.capability};
   const list=await fetch(url+'?limit=1&offset=0',{headers,signal:AbortSignal.timeout(15000)});
   const history=await list.json().catch(()=>null);
   if(!list.ok||history?.success!==true||history.simulationOnly!==true||!Array.isArray(history.data))throw Error('Report history route unavailable');
   const denied=await fetch(url,{method:'POST',headers,body:JSON.stringify({caseKind:'UNSOLICITED_PAYMENT_REPORT',eventId:crypto.randomUUID()+':allocation:999999999',requestKey:crypto.randomUUID(),reason:'Release readiness probe for nonexistent simulated allocation; must not write.'}),signal:AbortSignal.timeout(15000)});
   const body=await denied.json().catch(()=>null);
   if(denied.status!==403||body?.error!=='CORRECTION_PAYMENT_UNAVAILABLE')throw Error('Expected deployed report allocation validation, HTTP '+denied.status);
   reportRouteVerified=true;
 }
 for(const action of ['received-notices-list','received-notices-unread']){
   const data=await request({action,offset:0,limit:100},session.capability);
   if(!Array.isArray(data?.items)||!Number.isSafeInteger(data.total)||data.offset!==0||data.limit!==100||typeof data.hasMore!=='boolean')throw Error('Invalid notice page for '+profile);
   for(const notice of data.items){
     if(typeof notice.eventId!=='string'||typeof notice.paymentId!=='string'||!Number.isSafeInteger(notice.amountMinor)||notice.amountMinor<=0||!Number.isFinite(Date.parse(notice.createdAt))||!['SIMULATED_SUCCESS','SIMULATED_INITIATED'].includes(notice.paymentStatus)||typeof notice.isRead!=='boolean')throw Error('Invalid hosted allocation record for '+profile);
     if(action==='received-notices-unread'&&notice.isRead)throw Error('Unread queue returned read record');
   }
   if(action==='received-notices-list'&&data.items.length){rows+=data.items.length;owners.add(profile);}
 }
}
if(rows===0)throw Error('No actual recipient rows; delivery not established');
console.log('PASS existing V2 fictional recipient list/unread readback: '+rows+' records across '+owners.size+' accounts; no payment or acknowledgement writes.');

if(!reportRouteVerified)throw Error('Report route not verified');
console.log('PASS deployed recipient report route rejects nonexistent allocation without write');
