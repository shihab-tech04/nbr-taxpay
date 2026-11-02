import React, {useEffect,useMemo,useState} from 'react';
import {ArrowRight, BookOpen, CircleUserRound, FileCheck2, FilePenLine, Receipt, WalletCards} from 'lucide-react';
import {useTaxState} from '../../services/taxState';
import {useAccountIdentity} from '../../services/accountIdentity';
import {loadAccountTaxJourney,type AccountJourneyItem} from '../../services/accountTaxJourney';
import {TaxpayerPageHeading} from '../layout/TaxpayerPageStructure';

const destinations=[
  {route:'account_profile',title:{en:'Profile',bn:'প্রোফাইল'},Icon:CircleUserRound},
  {route:'history',title:{en:'Payment activity',bn:'পেমেন্টের তথ্য'},Icon:Receipt},
  {route:'secure_workspace',title:{en:'Saved payment drafts',bn:'সংরক্ষিত পেমেন্ট খসড়া'},Icon:WalletCards},
  {route:'ledger',title:{en:'Tax ledger',bn:'কর লেজার'},Icon:BookOpen},
  {route:'certificates',title:{en:'Certificates',bn:'সনদপত্র'},Icon:FileCheck2},
  {route:'corrections',title:{en:'Corrections',bn:'সংশোধন'},Icon:FilePenLine},
] as const;
type LoadState={uid:string|null;phase:'loading'|'ready'|'error';events:AccountJourneyItem[]};

/** Real accounts show only recorded owner-owned review events. A request never
 * implies a Treasury receipt, tax credit or officially posted liability. */
export const TaxJourney:React.FC=()=>{
  const {navigate,language}=useTaxState();
  const {user,loading:checkingIdentity}=useAccountIdentity();
  const bn=language==='bn';
  const tr=(en:string,bengali:string)=>bn?bengali:en;
  const ownerUid=user?.id??null;
  const [revision,setRevision]=useState(0);
  const [snapshot,setSnapshot]=useState<LoadState>({uid:null,phase:'loading',events:[]});
  const [year,setYear]=useState('all');

  useEffect(()=>{
    if(checkingIdentity||!ownerUid)return;
    let active=true;
    setSnapshot({uid:ownerUid,phase:'loading',events:[]});
    loadAccountTaxJourney(ownerUid).then(events=>{
      if(active)setSnapshot({uid:ownerUid,phase:'ready',events});
    }).catch(()=>{
      if(active)setSnapshot({uid:ownerUid,phase:'error',events:[]});
    });
    return()=>{active=false;};
  },[checkingIdentity,ownerUid,revision]);
  const state=ownerUid&&snapshot.uid===ownerUid?snapshot:{uid:ownerUid,phase:'loading' as const,events:[]};
  const years=useMemo(()=>[...new Set(state.events.map(item=>item.assessmentYear))].sort((a,b)=>b.localeCompare(a)),[state.events]);
  const selectedYear=year==='all'||years.includes(year)?year:'all';
  const visible=state.events.filter(item=>selectedYear==='all'||item.assessmentYear===selectedYear);
  const date=(at:string)=>new Intl.DateTimeFormat(bn?'bn-BD':'en-BD',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Dhaka'}).format(new Date(at));
  const status=(code:string)=>{
    const labels:Record<string,[string,string]>={
      SUBMITTED_FOR_REVIEW:['Submitted for review','পর্যালোচনার জন্য জমা'],
      OFFICER_ACKNOWLEDGED:['Officer acknowledged','কর্মকর্তা গ্রহণ করেছেন'],
      INFO_REQUESTED:['Information requested','তথ্য চাওয়া হয়েছে'],
      CLOSED:['Review closed','পর্যালোচনা বন্ধ'],
      UNVERIFIED:['Status unavailable','অবস্থা পাওয়া যায়নি'],
    };
    return tr(...(labels[code]??labels.UNVERIFIED));
  };
  return <div className="mx-auto max-w-4xl space-y-5 pb-12">
    <TaxpayerPageHeading id="taxpay-journey-title" title={tr('My tax journey','আমার কর কার্যক্রম')}
      description={tr('Recorded account activity and links to the related tax services.','অ্যাকাউন্টের নথিভুক্ত কার্যক্রম এবং সংশ্লিষ্ট করসেবার লিংক।')}/>
    {ownerUid&&<section className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-6" aria-labelledby="account-journey-events-title"
      data-testid="account-tax-journey">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 id="account-journey-events-title" className="text-lg font-semibold text-taxpay-text">{tr('Account timeline','অ্যাকাউন্টের ঘটনাক্রম')}</h2>
          <p className="mt-1 text-sm text-taxpay-muted">{tr('Submitted review requests and recorded status events, oldest first.','জমা দেওয়া পর্যালোচনা অনুরোধ ও নথিভুক্ত অবস্থার পরিবর্তন, পুরোনো থেকে নতুন।')}</p></div>
        {state.phase==='ready'&&years.length>0&&<label className="flex flex-col gap-1 text-sm font-medium text-taxpay-text">
          {tr('Assessment year','করবর্ষ')}
          <select aria-label={tr('Journey assessment year','যাত্রার করবর্ষ')}
            className="min-h-11 min-w-32 rounded-lg border border-taxpay-border bg-white px-3"
            value={selectedYear} onChange={event=>setYear(event.target.value)}>
            <option value="all">{tr('All years','সব করবর্ষ')}</option>
            {years.map(value=><option key={value} value={value}>{value}</option>)}
          </select>
        </label>}
      </div>
      <p className="mt-3 text-sm text-taxpay-muted" role="note">
        {tr('These are application review events, not government payment confirmations. Treasury settlement, ledger posting and tax credit are not inferred.',
          'এগুলো অ্যাপের পর্যালোচনার ঘটনা, সরকারি পেমেন্ট নিশ্চিতকরণ নয়। ট্রেজারি নিষ্পত্তি, লেজার পোস্টিং বা কর ক্রেডিট অনুমান করা হয় না।')}
      </p>
      {state.phase==='loading'&&<p role="status" className="mt-5 text-sm text-taxpay-muted">{tr('Loading account events…','অ্যাকাউন্টের ঘটনা লোড হচ্ছে…')}</p>}
      {state.phase==='error'&&<div role="alert" className="mt-5 space-y-2">
        <p className="text-sm text-taxpay-error">{tr('Your account timeline could not be verified.','আপনার অ্যাকাউন্টের ঘটনাক্রম যাচাই করা যায়নি।')}</p>
        <button type="button" className="min-h-11 rounded-lg border border-taxpay-border px-3 text-taxpay-primary"
          onClick={()=>setRevision(x=>x+1)}>{tr('Try again','আবার চেষ্টা করুন')}</button>
      </div>}
      {state.phase==='ready'&&visible.length===0&&<p role="status" className="mt-5 rounded-lg border border-dashed border-taxpay-border bg-slate-50 p-5 text-sm text-taxpay-muted">
        {tr('No recorded review activity for this selection.','এই নির্বাচনের জন্য কোনো নথিভুক্ত পর্যালোচনা কার্যক্রম নেই।')}
      </p>}
      {state.phase==='ready'&&visible.length>0&&<ol className="mt-5 space-y-0" aria-label={tr('Chronological account review events','অ্যাকাউন্টের পর্যালোচনা ঘটনাক্রম')}>
        {visible.map(item=><li key={item.key} className="relative border-l-2 border-taxpay-border pb-5 pl-5 last:pb-0">
          <span className="absolute -left-[6px] top-1 h-2.5 w-2.5 rounded-full border-2 border-taxpay-primary bg-white" aria-hidden="true"/>
          <article className="min-w-0 rounded-lg border border-taxpay-border bg-slate-50 p-3 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0"><p className="text-xs text-taxpay-muted"><time dateTime={item.at}>{date(item.at)}</time> · {item.assessmentYear}</p>
                <h3 className="mt-1 break-words text-sm font-semibold text-taxpay-text">{item.source==='request'
                  ?tr('Review request submitted','পর্যালোচনা অনুরোধ জমা দেওয়া হয়েছে')
                  :tr('Review status event','পর্যালোচনা অবস্থার ঘটনা')}</h3>
              </div>
              <span className="rounded-lg border border-taxpay-border bg-white px-2 py-1 text-xs font-medium text-taxpay-primary">{status(item.status)}</span>
            </div>
            <p className="mt-2 break-all text-xs text-taxpay-muted">{tr('Request reference','অনুরোধের রেফারেন্স')}: {item.reference}</p>
            <details className="mt-3 text-sm">
              <summary className="min-h-10 cursor-pointer font-semibold text-taxpay-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-taxpay-primary">
                {tr('View event details','ঘটনার বিবরণ দেখুন')}
              </summary>
              <dl className="mt-2 grid gap-2 text-taxpay-text sm:grid-cols-2">
                <div><dt className="text-taxpay-muted">{tr('Type','ধরন')}</dt><dd className="break-words">{item.category.replaceAll('_',' ')}</dd></div>
                <div><dt className="text-taxpay-muted">{tr('Recorded event','নথিভুক্ত ঘটনা')}</dt><dd className="break-words">{item.label.replaceAll('_',' ')}</dd></div>
              </dl>
            </details>
          </article>
        </li>)}
      </ol>}
    </section>}
    <section className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-6" aria-labelledby="taxpay-journey-links-title">
      <h2 id="taxpay-journey-links-title" className="text-lg font-semibold text-taxpay-text">{tr('Related services','সংশ্লিষ্ট সেবা')}</h2>
      <nav aria-label={tr('Tax services','করসেবা')} className="mt-3 grid gap-3 sm:grid-cols-2">
        {destinations.map(({route,title,Icon})=><button key={route} type="button" onClick={()=>navigate(route)}
          className="flex min-h-14 items-center gap-3 rounded-xl border border-taxpay-border bg-white p-4 text-left text-sm font-semibold text-taxpay-dark hover:bg-taxpay-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taxpay-primary">
          <Icon size={19} aria-hidden={true}/><span className="min-w-0 flex-1">{bn?title.bn:title.en}</span>
          <ArrowRight size={17} aria-hidden={true}/>
        </button>)}
      </nav>
    </section>
  </div>;
};
