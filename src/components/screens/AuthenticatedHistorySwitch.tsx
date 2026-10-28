import React, {useEffect,useState} from 'react';
import {getBoundSimulationUser} from '../../services/simulatedPaymentsApi';
import {historyModeForBoundId} from '../../services/accountHistoryMode';
import {AccountReviewHistory} from './AccountReviewHistory';
import {DemoPaymentActivity} from './DemoPaymentActivity';
import {TaxpayerPageHeading} from '../layout/TaxpayerPageStructure';

/** Keep existing authorized private simulator when an actual binding exists.
 * Unbound accounts may still inspect their own nonfinancial requests without TIN.
 * A stale previous user's simulation mode must never be reused across Auth users.
 */
export const AuthenticatedHistorySwitch:React.FC<{ownerUid:string;language:'en'|'bn';activityTabs?:boolean}>=
({ownerUid,language,activityTabs=false})=>{
  const [resolved,setResolved]=useState<{uid:string|null;mode:'loading'|'simulation'|'reviews'}>(
    {uid:null,mode:'loading'});
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    let active=true;
    setResolved({uid:ownerUid,mode:'loading'});
    getBoundSimulationUser().then(result=>{
      if(active)setResolved({uid:ownerUid,mode:historyModeForBoundId(result)});
    }).catch(()=>{
      // No simulator entitlement is granted on RPC errors. An authenticated
      // user can still read their own existing RLS-limited review records.
      if(active)setResolved({uid:ownerUid,mode:'reviews'});
    });
    return()=>{active=false;};
  },[ownerUid,revision]);
  const mode=resolved.uid===ownerUid?resolved.mode:'loading';
  if(mode==='simulation')return <DemoPaymentActivity activityTabs={activityTabs}/>;
  if(mode==='reviews')return <AccountReviewHistory ownerUid={ownerUid} language={language} activityTabs={activityTabs}/>;
  return <section className="mx-auto max-w-5xl space-y-4 pb-12">
    <TaxpayerPageHeading title={language==='bn'?'অ্যাকাউন্টের কার্যক্রম':'Account activity'}
      description={language==='bn'?'সংরক্ষিত কার্যক্রম যাচাই হচ্ছে…':'Checking access to saved records…'}/>
    <p role="status" className="rounded-xl border border-taxpay-border bg-white p-4 text-sm text-taxpay-muted">
      {language==='bn'?'অ্যাকাউন্টের তথ্য যাচাই হচ্ছে…':'Checking account access…'}
    </p>
    <button type="button" onClick={()=>setRevision(v=>v+1)}
      className="min-h-11 rounded-lg border border-taxpay-border bg-white px-3 text-sm text-taxpay-primary">
      {language==='bn'?'আবার চেষ্টা করুন':'Retry'}
    </button>
  </section>;
};
