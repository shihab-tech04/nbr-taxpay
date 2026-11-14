import React,{useEffect,useState} from 'react';
import '../../styles/taxpay-dashboard-interactive.css';
import {ArrowRight} from 'lucide-react';
import {
  DASHBOARD_SERVICE_KEYS,DASHBOARD_TAG_KEYS,
  projectDashboardChartRecords,chooseDashboardChartSource,formatDashboardChartMoney,dashboardChartPercentage,
  type DashboardChartRecord,type DashboardChartService,type DashboardChartTag,
  type DashboardChartSource,type DashboardRecipientProfile
} from './dashboardBentoAnalytics';

const SERVICE_LABELS:Record<DashboardChartService,{en:string;bn:string}>={
  income:{en:'Tax with Return',bn:'রিটার্নের সঙ্গে কর'},
  ait:{en:'Advance Tax',bn:'অগ্রিম কর'},
  tds:{en:'Source Tax',bn:'উৎসে কর'},
  other:{en:'Other Tax',bn:'অন্যান্য কর'},
  travel:{en:'Travel Tax',bn:'ভ্রমণ কর'}
};
const TAG_LABELS:Record<DashboardChartTag,{en:string;bn:string}>={
  family:{en:'Family',bn:'পরিবার'},
  friends:{en:'Friends',bn:'বন্ধু'},
  clients:{en:'Clients',bn:'ক্লায়েন্ট'},
  others:{en:'Others',bn:'অন্যান্য'},
  own:{en:'My tax',bn:'নিজের কর'},
  unassigned:{en:'Unclassified',bn:'শ্রেণিবিহীন'}
};

export const BentoPaymentAnalytics:React.FC<{
  records:readonly DashboardChartRecord[];
  people:readonly DashboardRecipientProfile[];
  year:string;
  ownerTin:string;
  language:'en'|'bn';
  sourceLoadError?:boolean;
  selectedSource?:DashboardChartSource;
  onSourceChange?:(source:DashboardChartSource)=>void;
  onManageBeneficiaries?:()=>void;
  onOpenBeneficiary?:(tin:string)=>void;
  onOpenHistory:(tag?:DashboardChartTag,service?:DashboardChartService|'all',recipientTin?:string)=>void;
}>=({records,people,year,ownerTin,language,sourceLoadError,selectedSource,onSourceChange,onManageBeneficiaries,onOpenBeneficiary,onOpenHistory})=>{
  const bn=language==='bn';
  const tr=(en:string,bengali:string)=>bn?bengali:en;
  // Use the selected year's available source by default. A year with no
  // account-backed allocations must not show two misleading zero-value charts
  // while the same Overview displays illustrative activity for that year.
  // The manual source choice remains explicit and applies only to its year.
  const [sourceChoice,setSourceChoice]=useState<{year:string;source:DashboardChartSource}|null>(null);
  const [service,setService]=useState<DashboardChartService|'all'>('all');
  const [tag,setTag]=useState<DashboardChartTag|null>(null);
  const [beneficiaryView,setBeneficiaryView]=useState<'relationships'|'top'>('relationships');
  const recorded=projectDashboardChartRecords(records,year,'recorded',people,ownerTin);
  const examples=projectDashboardChartRecords(records,year,'example',people,ownerTin);
  const defaultSource=chooseDashboardChartSource(records,year,people,ownerTin);
  const source=selectedSource??(sourceChoice?.year===year?sourceChoice.source:defaultSource);
  const selectSource=(next:DashboardChartSource)=>{
    if(onSourceChange)onSourceChange(next);
    else setSourceChoice({year,source:next});
    setService('all');setTag(null);
  };
  // A service/tag selection from a previous year must not silently filter a new year.
  useEffect(()=>{setService('all');setTag(null);},[year]);
  const all=source==='recorded'?recorded:examples;
  const filtered=projectDashboardChartRecords(records,year,source,people,ownerTin,service);
  const money=(minor:bigint)=>formatDashboardChartMoney(minor,language);
  const hasData=all.totalMinor>0n;
  const selectedTag=tag===null?null:filtered.byTag.find(item=>item.key===tag);
  const topBeneficiaries=filtered.byBeneficiary.filter(item=>!tag||item.tag===tag).slice(0,5);
  const topMax=topBeneficiaries[0]?.amountMinor??0n;
  const displayedBeneficiaryTotal=beneficiaryView==='top'&&selectedTag
    ?selectedTag.amountMinor:filtered.totalMinor;
  const maskedTin=(tin:string)=>'••••'+tin.slice(-4);
  return <section className="taxpay-bento-analytics" aria-labelledby="dashboard-payment-analytics-title"
    data-testid="dashboard-payment-analytics" data-chart-source={source}>
    <div className="taxpay-bento-analytics__header">
      <div>
        <h2 id="dashboard-payment-analytics-title">{tr('Payment breakdown','পেমেন্টের বিস্তারিত')}</h2>
        <p>{source==='recorded'
          ? tr('Recorded payment allocations for the selected assessment year. Not official tax credits.',
              'নির্বাচিত করবর্ষের সংরক্ষিত পেমেন্ট বরাদ্দ। সরকারি কর ক্রেডিট নয়।')
          : tr('Example payer spending for this year. Withholding by others is excluded.',
              'এই করবর্ষে উদাহরণভিত্তিক পরিশোধকারীর ব্যয়। অন্যদের উৎসে কাটা কর অন্তর্ভুক্ত নয়।')}</p>
      </div>
      <div className="taxpay-bento-analytics__sources" role="group"
        aria-label={tr('Payment data source','পেমেন্ট তথ্যের উৎস')} data-testid="dashboard-chart-source">
        <button type="button" aria-pressed={source==='recorded'}
          onClick={()=>selectSource('recorded')}>
          {tr('Recorded','সংরক্ষিত')}
        </button>
        <button type="button" aria-pressed={source==='example'}
          onClick={()=>selectSource('example')}>
          {tr('Examples','নমুনা')}
        </button>
      </div>
    </div>
    {sourceLoadError&&<p role="alert" className="taxpay-bento-analytics__warning">
      {source==='recorded'
        ? tr('Recorded payments could not be loaded. Do not use sample entries as account totals.',
            'সংরক্ষিত পেমেন্ট লোড হয়নি। নমুনা এন্ট্রিকে অ্যাকাউন্টের মোট অর্থ মনে করবেন না।')
        : tr('Account records could not be loaded. Only separate example figures are shown.',
            'অ্যাকাউন্টের রেকর্ড লোড হয়নি। শুধু পৃথক উদাহরণের পরিমাণ দেখানো হচ্ছে।')}
    </p>}
    <div className="taxpay-bento-analytics__cards">
      <section className="taxpay-bento-analytics__card" data-testid="dashboard-service-breakdown"
        aria-labelledby="dashboard-service-breakdown-title">
        <div className="taxpay-bento-analytics__card-header">
          <div>
            <h3 id="dashboard-service-breakdown-title">{tr('By payment service','পেমেন্টের ধরন অনুযায়ী')}</h3>
            <p>{tr('Select a service to filter beneficiary spending','উপকারভোগীর ব্যয় ফিল্টার করতে ধরন বাছুন')}</p>
          </div>
          <strong className="taxpay-bento-analytics__total tabular-nums">{hasData?money(all.totalMinor):'—'}</strong>
        </div>
        {hasData?<div className="taxpay-bento-analytics__bars" role="group"
          aria-label={tr('Select payment service','পেমেন্টের ধরন নির্বাচন')}>
          {[...all.byService].filter(item=>item.amountMinor>0n).sort((a,b)=>a.amountMinor>b.amountMinor?-1:a.amountMinor<b.amountMinor?1:a.key.localeCompare(b.key)).map(item=>{
            const value=dashboardChartPercentage(item.amountMinor,all.totalMinor);
            const label=SERVICE_LABELS[item.key][language];
            return <button key={item.key} type="button" data-service={item.key}
              className="taxpay-bento-analytics__bar-item"
              aria-pressed={service===item.key}
              title={label+': '+money(item.amountMinor)}
              onClick={()=>{setService(current=>current===item.key?'all':item.key);setTag(null);}}
              aria-label={label+': '+money(item.amountMinor)+', '+item.paymentCount+' '+tr('payments','টি পেমেন্ট')}>
              <span className="taxpay-bento-analytics__bar-top">
                <span>{label}</span><strong className="tabular-nums">{money(item.amountMinor)}</strong>
              </span>
              <span className="taxpay-bento-analytics__bar-track" aria-hidden="true">
                <span style={{width:value+'%'}}/>
              </span>
            </button>;
          })}
          {service!=='all'&&<button type="button" className="taxpay-bento-analytics__clear"
            onClick={()=>{setService('all');setTag(null);}}>
            {tr('Show all payment services','সব পেমেন্টের ধরন দেখুন')}
          </button>}
        </div>:<p role="status" className="taxpay-bento-analytics__empty">{tr(
          source==='recorded'?'No itemized recorded payments for this year. Select Examples to view the sample scenario.':'No completed example payments for this year.',
          source==='recorded'?'এই করবর্ষের সংরক্ষিত পেমেন্টের নির্দিষ্ট বরাদ্দ নেই। নমুনা দেখতে নমুনা বাছুন।':'এই করবর্ষে সম্পন্ন নমুনা পেমেন্ট নেই।'
        )}</p>}
        {source==='recorded'&&all.omittedRecords>0&&
          <p className="taxpay-bento-analytics__footnote" role="status">
            {tr('Some historical records lack itemized allocations and are excluded from these totals.',
              'কিছু পুরনো রেকর্ডে পৃথক বরাদ্দ নেই; এগুলো এই মোট হিসাব থেকে বাদ রাখা হয়েছে।')}
          </p>}
      </section>
      <section className="taxpay-bento-analytics__card" data-testid="dashboard-beneficiary-breakdown"
        aria-labelledby="dashboard-beneficiary-breakdown-title">
        <div className="taxpay-bento-analytics__card-header">
          <div>
            <h3 id="dashboard-beneficiary-breakdown-title">{beneficiaryView==='relationships'
              ?tr('By beneficiary relationship','উপকারভোগীর সম্পর্ক অনুযায়ী')
              :tr('Top beneficiaries','শীর্ষ উপকারভোগী')}</h3>
            <p>{service==='all'?tr('All payment services','সব ধরনের পেমেন্ট'):SERVICE_LABELS[service][language]}</p>
          </div>
          <strong className="taxpay-bento-analytics__total tabular-nums">{filtered.totalMinor>0n?money(displayedBeneficiaryTotal):'—'}</strong>
        </div>
        <div className="taxpay-bento-analytics__view-switch" role="group"
          aria-label={tr('Beneficiary chart view','উপকারভোগীর চার্টের ধরন')} data-testid="dashboard-beneficiary-view">
          <button type="button" aria-pressed={beneficiaryView==='relationships'} onClick={()=>{setBeneficiaryView('relationships');setTag(null);}}>
            {tr('Relationships','সম্পর্ক')}
          </button>
          <button type="button" aria-pressed={beneficiaryView==='top'} onClick={()=>setBeneficiaryView('top')}>
            {tr('Top 5','শীর্ষ ৫')}
          </button>
        </div>
        {(service!=='all'||tag!==null)&&<button type="button" className="taxpay-bento-analytics__clear"
          onClick={()=>{setService('all');setTag(null);}}
          data-testid="dashboard-reset-filters">
          {tr('Reset chart filters','চার্ট ফিল্টার মুছুন')}
        </button>}
        {filtered.totalMinor>0n&&beneficiaryView==='top'&&<label className="taxpay-bento-analytics__relation-filter">
          <span>{tr('Relationship','সম্পর্ক')}</span>
          <select aria-label={tr('Filter top beneficiaries by relationship','সম্পর্ক অনুযায়ী শীর্ষ উপকারভোগী ফিল্টার')}
            value={tag??'all'} onChange={event=>setTag(event.target.value==='all'?null:event.target.value as DashboardChartTag)}>
            <option value="all">{tr('All relationships','সব সম্পর্ক')}</option>
            {DASHBOARD_TAG_KEYS.map(key=><option key={key} value={key}>{TAG_LABELS[key][language]}</option>)}
          </select>
        </label>}
        {filtered.totalMinor>0n&&beneficiaryView==='relationships'?<>
          <div className="taxpay-bento-analytics__segments" role="img"
            aria-label={tr('Beneficiary spending proportions','উপকারভোগী অনুযায়ী ব্যয়ের অনুপাত')}>
            {filtered.byTag.filter(item=>item.amountMinor>0n).map(item=>
              <span key={item.key} className={'taxpay-bento-analytics__segment taxpay-bento-analytics__segment--'+item.key}
                style={{width:dashboardChartPercentage(item.amountMinor,filtered.totalMinor)+'%'}}/>)}
          </div>
          <div className="taxpay-bento-analytics__tags" role="group"
            aria-label={tr('Select beneficiary category','উপকারভোগীর শ্রেণি নির্বাচন')}>
            {filtered.byTag.filter(item=>item.amountMinor>0n).map(item=>
              <button type="button" key={item.key} data-tag={item.key}
                aria-pressed={tag===item.key} onClick={()=>setTag(current=>current===item.key?null:item.key)}>
                <span className={'taxpay-bento-analytics__dot taxpay-bento-analytics__dot--'+item.key} aria-hidden="true"/>
                <span className="taxpay-bento-analytics__tag-label">{TAG_LABELS[item.key][language]}</span>
                <strong className="tabular-nums">{money(item.amountMinor)}</strong>
              </button>)}
          </div>
          {selectedTag&&selectedTag.amountMinor>0n&&<div className="taxpay-bento-analytics__selection"
            role="status" data-testid="dashboard-selected-tag">
            <span>{TAG_LABELS[selectedTag.key][language]} · {selectedTag.paymentCount} {tr('payments','টি পেমেন্ট')}</span>
            <strong>{money(selectedTag.amountMinor)}</strong>
          </div>}
          {filtered.byTag.some(item=>item.key==='unassigned'&&item.amountMinor>0n)&&
            <div className="taxpay-bento-analytics__unclassified-details" role="status" data-testid="dashboard-unclassified-recovery">
              <p>{tr('Why some spending is unclassified','কিছু ব্যয় শ্রেণিবিহীন কেন')}</p>
              <dl>
                {filtered.unclassified.recipientKnownMinor>0n&&<div>
                  <dt>{new Intl.NumberFormat(bn?'bn-BD':'en-BD').format(filtered.unclassified.untaggedRecipientCount)} {tr('recipients without a matching saved relationship','জন প্রাপকের সংরক্ষিত সম্পর্ক মেলেনি')}</dt>
                  <dd className="tabular-nums">{money(filtered.unclassified.recipientKnownMinor)}</dd>
                </div>}
                {filtered.unclassified.recipientMissingMinor>0n&&<div>
                  <dt>{new Intl.NumberFormat(bn?'bn-BD':'en-BD').format(filtered.unclassified.missingRecipientPaymentCount)} {tr('payments without a recorded recipient','টি পেমেন্টে প্রাপকের তথ্য নেই')}</dt>
                  <dd className="tabular-nums">{money(filtered.unclassified.recipientMissingMinor)}</dd>
                </div>}
              </dl>
              {filtered.unclassified.recipientKnownMinor>0n&&onManageBeneficiaries&&
                <button type="button" className="taxpay-bento-analytics__link" onClick={onManageBeneficiaries}>
                  {tr('Manage beneficiary tags','উপকারভোগীর ট্যাগ পরিচালনা')}
                </button>}
            </div>}
        </>:null}
        {filtered.totalMinor>0n&&beneficiaryView==='top'&&<>
          {topBeneficiaries.length?<div className="taxpay-bento-analytics__top-list" role="group"
            aria-label={tr('Top five beneficiaries by payment amount','অর্থের পরিমাণ অনুযায়ী শীর্ষ পাঁচ উপকারভোগী')}
            data-testid="dashboard-top-beneficiaries">
            {topBeneficiaries.map((person,index)=>{
              const personName=person.tin===ownerTin?tr('My tax','নিজের কর')
                :person.name??tr('Recipient','প্রাপক')+' '+maskedTin(person.tin);
              const target=person.saved&&person.tin!==ownerTin&&onOpenBeneficiary
                ?()=>onOpenBeneficiary(person.tin)
                :()=>onOpenHistory(tag??undefined,service,person.tin);
              return <button key={person.tin} type="button" className="taxpay-bento-analytics__top-item"
                data-rank={index+1} data-recipient-saved={person.saved?'true':'false'}
                onClick={target}
                aria-label={personName+': '+money(person.amountMinor)+', '+person.paymentCount+' '+tr('payments','টি পেমেন্ট')}
                title={tr('Open beneficiary payments','উপকারভোগীর পেমেন্ট দেখুন')}>
                <span className="taxpay-bento-analytics__top-heading">
                  <span className="taxpay-bento-analytics__top-name">{index+1}. {personName}</span>
                  <strong className="tabular-nums">{money(person.amountMinor)}</strong>
                </span>
                <span className="taxpay-bento-analytics__top-meta">{TAG_LABELS[person.tag][language]}
                  {' · '}{new Intl.NumberFormat(bn?'bn-BD':'en-BD').format(person.paymentCount)}
                  {' '}{tr('payments','টি পেমেন্ট')}
                </span>
                <span className="taxpay-bento-analytics__bar-track" aria-hidden="true">
                  <span style={{width:dashboardChartPercentage(person.amountMinor,topMax)+'%'}}/>
                </span>
              </button>;
            })}
          </div>:<p role="status" className="taxpay-bento-analytics__empty">
            {tr('No identified beneficiaries match this selection. Payments with no recipient cannot appear in the ranking.',
              'এই বাছাইয়ে শনাক্তকৃত উপকারভোগী নেই। প্রাপকবিহীন পেমেন্ট তালিকায় দেখানো যায় না।')}
          </p>}
          {filtered.unclassified.recipientMissingMinor>0n&&<p className="taxpay-bento-analytics__footnote" data-testid="dashboard-unranked-amount">
            {tr('Excluded from ranking: payments without a recorded recipient','তালিকার বাইরে: প্রাপকবিহীন পেমেন্ট')}
            {' · '}{money(filtered.unclassified.recipientMissingMinor)}
          </p>}
          {onManageBeneficiaries&&<button type="button" className="taxpay-bento-analytics__link"
            onClick={onManageBeneficiaries}>{tr('View all saved beneficiaries','সংরক্ষিত সব উপকারভোগী দেখুন')}
            <ArrowRight size={16} aria-hidden="true"/>
          </button>}
        </>}
        {filtered.totalMinor>0n&&<button type="button" className="taxpay-bento-analytics__link"
          onClick={()=>onOpenHistory(tag??undefined,service)}>
          {tr('View payment records','পেমেন্টের রেকর্ড দেখুন')}
          <ArrowRight size={16} aria-hidden="true"/>
        </button>}
        {!filtered.totalMinor&&<p role="status" className="taxpay-bento-analytics__empty">{tr(
          'No beneficiary allocations for this selection.','এই বাছাইয়ের জন্য কোনো উপকারভোগী বরাদ্দ নেই।')}</p>}
      </section>
    </div>
  </section>;
};
