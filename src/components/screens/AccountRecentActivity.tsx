import React,{useEffect,useState} from 'react';
import {loadAccountActivities,type AccountActivityItem,type AccountActivityType} from '../../services/accountActivity';

const labels:Record<AccountActivityType,{en:string;bn:string}>={
  PAGE_OPENED:{en:'Opened page',bn:'পৃষ্ঠা খুলেছেন'},
  LANGUAGE_CHANGED:{en:'Changed language',bn:'ভাষা পরিবর্তন করেছেন'},
  BENEFICIARY_LIST_SELECTED:{en:'Selected beneficiary list',bn:'উপকারভোগীর তালিকা নির্বাচন করেছেন'},
  PAYMENT_STARTED:{en:'Started payment form',bn:'পেমেন্ট ফর্ম শুরু করেছেন'},
  PROFILE_SAVED:{en:'Saved profile settings',bn:'প্রোফাইল সেটিংস সংরক্ষণ করেছেন'}
};

const routeLabels:Record<string,{en:string;bn:string}>={
  en:{en:'English',bn:'ইংরেজি'},bn:{en:'Bangla',bn:'বাংলা'},
  user_guide:{en:'User guide',bn:'ব্যবহার নির্দেশিকা'},
  secure_workspace:{en:'Sign-in',bn:'সাইন-ইন'},
  head_catalogue:{en:'Tax heads',bn:'কর খাত'},
  guest:{en:'Payment services',bn:'পেমেন্ট সেবা'},guestwh:{en:'Withholding tax',bn:'উৎসে কর'},
  travel:{en:'Travel tax',bn:'ভ্রমণ কর'},verify:{en:'Verify payment',bn:'পেমেন্ট যাচাই'},
  incident:{en:'Issue report',bn:'সমস্যার প্রতিবেদন'},architecture:{en:'System overview',bn:'সিস্টেম পরিচিতি'},
  taxpayer_home:{en:'Taxpayer home',bn:'করদাতা হোম'},dashboard:{en:'Dashboard',bn:'ড্যাশবোর্ড'},
  wizard:{en:'Payment form',bn:'পেমেন্ট ফর্ম'},history:{en:'Payment history',bn:'পেমেন্ট ইতিহাস'},
  payment_details:{en:'Payment details',bn:'পেমেন্টের বিবরণ'},ledger:{en:'Tax ledger',bn:'কর হিসাব'},
  journey:{en:'Tax Journey',bn:'কর যাত্রা'},certificates:{en:'Certificates',bn:'সনদপত্র'},
  corrections:{en:'Corrections',bn:'সংশোধন'},notifications:{en:'Notifications',bn:'বিজ্ঞপ্তি'},
  payment_notifications:{en:'Payment notifications',bn:'পেমেন্ট বিজ্ঞপ্তি'},
  account_notifications:{en:'Account notifications',bn:'অ্যাকাউন্টের বিজ্ঞপ্তি'},
  account_profile:{en:'Profile',bn:'প্রোফাইল'},account_settings:{en:'Profile settings',bn:'প্রোফাইল সেটিংস'},
  manage_authorization:{en:'Manage authorization',bn:'অনুমোদন পরিচালনা'},
  beneficiaries:{en:'Beneficiaries',bn:'উপকারভোগী'},services:{en:'Services',bn:'সেবা'},
  taxpayer_login:{en:'Taxpayer sign-in',bn:'করদাতার সাইন-ইন'},office_login:{en:'Office sign-in',bn:'অফিস সাইন-ইন'},
  ontology:{en:'Tax terms',bn:'কর বিষয়ক শব্দ'},glossary:{en:'Glossary',bn:'শব্দকোষ'},
  guidance:{en:'Tax guidance',bn:'কর নির্দেশনা'}
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
  const retry=bn?'আবার চেষ্টা':'Retry';
  const routeName=(route:string)=>routeLabels[route]?.[language]??route.replaceAll('_',' ');
  return <section className="taxpayer-account-panel" aria-labelledby="account-recent-activity">
    <h2 id="account-recent-activity">{bn?'আমার সাম্প্রতিক কার্যক্রম':'My recent activity'}</h2>
    <p>{bn
      ?'এই অ্যাকাউন্টের সংরক্ষিত পৃষ্ঠা দেখা ও সেটিংস পরিবর্তন। এটি পেমেন্ট নিশ্চিতকরণ নয়।'
      :'Saved page visits and account setting changes for this account. These entries do not confirm a payment.'}</p>
    {current.loading
      ?<p role="status">{bn?'কার্যক্রম লোড হচ্ছে…':'Loading activity…'}</p>
      :current.error
        ?<div role="alert">
            <p>{bn?'কার্যক্রম লোড করা যায়নি।':'Could not load saved activity.'}</p>
            <button type="button" onClick={()=>setRevision(value=>value+1)}>{retry}</button>
          </div>
        :current.rows.length===0
          ?<p role="status">{bn?'এখনো কোনো সংরক্ষিত কার্যক্রম নেই।':'No saved activity yet.'}</p>
          :<ul className="space-y-2" aria-label={bn?'সাম্প্রতিক কার্যক্রম':'Recent account activity'}>
              {current.rows.map(row=><li key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2 text-sm">
                <span>{labels[row.event_type][language]}{row.route?' · '+routeName(row.route):''}</span>
                <time dateTime={row.occurred_at}>{new Intl.DateTimeFormat(bn?'bn-BD':'en-GB',
                  {dateStyle:'medium',timeStyle:'short'}).format(new Date(row.occurred_at))}</time>
              </li>)}
            </ul>}
  </section>;
}
