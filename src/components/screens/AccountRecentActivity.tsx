import React,{useEffect,useState} from 'react';
import {loadAccountActivities,type AccountActivityItem,type AccountActivityType} from '../../services/accountActivity';

const names:Record<AccountActivityType,{en:string;bn:string}>={
  PAGE_OPENED:{en:'Opened page',bn:'পৃষ্ঠা খুলেছেন'},
  LANGUAGE_CHANGED:{en:'Changed language',bn:'ভাষা পরিবর্তন করেছেন'},
  BENEFICIARY_LIST_SELECTED:{en:'Selected beneficiary list',bn:'উপকারভোগীর তালিকা নির্বাচন করেছেন'},
  PAYMENT_STARTED:{en:'Started payment form',bn:'পেমেন্ট ফর্ম শুরু করেছেন'},
  PROFILE_SAVED:{en:'Saved profile settings',bn:'প্রোফাইল সেটিংস সংরক্ষণ করেছেন'}
};
export function AccountRecentActivity({ownerUid,language}:{ownerUid:string;language:'en'|'bn'}){
  const [state,setState]=useState<{owner:string|null;loading:boolean;rows:AccountActivityItem[];error:boolean}>(
    {owner:null,loading:true,rows:[],error:false});
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    let active=true;
    setState({owner:ownerUid,loading:true,rows:[],error:false});
    loadAccountActivities(ownerUid).then(rows=>{
      if(active)setState({owner:ownerUid,loading:false,rows,error:false});
    }).catch(()=>{
      if(active)setState({owner:ownerUid,loading:false,rows:[],error:true});
    });
    return()=>{active=false;};
  },[ownerUid,revision]);
  const bn=language==='bn';
  const current=state.owner===ownerUid?state:{owner:null,loading:true,rows:[],error:false};
  return <section className="taxpayer-account-panel" aria-labelledby="account-recent-activity">
    <h2 id="account-recent-activity">{bn?'আমার সাম্প্রতিক কার্যক্রম':'My recent activity'}</h2>
    <p>{bn?'এই অ্যাকাউন্টে সংরক্ষিত নেভিগেশন ও সেটিংস পরিবর্তন। এটি পেমেন্টের প্রমাণ নয়।':'Saved page visits and settings changes for this account. These are not payment confirmations.'}</p>
    {current.loading?<p role="status">{bn?'কার্যক্রম লোড হচ্ছে…':'Loading activity…'}</p>:
      current.error?<div role="alert">
        <p>{bn?'কার্যক্রম লোড করা যায়নি।':'Could not load saved activity.'}</p>
        <button type="button" onClick={()=>setRevision(v=>v+1)}>{bn?'আবার চেষ্টা':'Retry'}</button>
      </div>:
      current.rows.length===0?<p role="status">{bn?'এখনো কোনো সংরক্ষিত কার্যক্রম নেই।':'No saved activity yet.'}</p>:
      <ul className="space-y-2">
        {current.rows.map(row=><li key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2 text-sm">
          <span>{names[row.event_type][language]}{row.route?' · '+row.route.replaceAll('_',' '):''}</span>
          <time dateTime={row.occurred_at}>{new Intl.DateTimeFormat(bn?'bn-BD':'en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(row.occurred_at))}</time>
        </li>)}
      </ul>}
  </section>;
}
