import React,{useEffect,useState} from 'react';
import {CitizenMuiScope,MuiButtonBase,MuiInputBase,MuiNativeSelect} from '../../design-system/mui';
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

// Preserve the approved chart, responsive grid, labels and native button DOM.
 // MUI only owns these scoped generic actions; original chart CSS remains authoritative.
const chartFocus={'&.Mui-focusVisible':{outline:'2px solid var(--color-taxpay-primary,#085587)',outlineOffset:2}} as const;
const chartActions={
  link:{...chartFocus,display:'inline-flex',alignItems:'center',justifyContent:'flex-start',gap:'7px',minHeight:'40px',border:0,background:'none',padding:'5px 0',color:'var(--color-taxpay-primary,#085587)',fontSize:'14px',fontWeight:600,justifySelf:'start','&:hover':{textDecoration:'underline'}},
  source:{...chartFocus,justifyContent:'center',fontFamily:'inherit'},
  view:{...chartFocus,justifyContent:'center',fontFamily:'inherit'},
  category:{...chartFocus,justifyItems:'stretch',alignItems:'normal',justifyContent:'normal',fontFamily:'inherit'},
  bar:{...chartFocus,display:'grid',gap:'6px',width:'100%',textAlign:'left',justifyContent:'normal',alignItems:'normal',justifyItems:'stretch',border:'1px solid transparent',borderRadius:'9px',padding:'8px 9px',background:'transparent',minHeight:'54px',color:'var(--color-taxpay-text,#17243c)','&:hover':{background:'#f3f7fc'},'&[aria-pressed="true"]':{background:'#eef5fd',borderColor:'#9dbde3'}},
  top:{...chartFocus,display:'grid',gap:'6px',minWidth:0,width:'100%',padding:'9px 5px',minHeight:'72px',textAlign:'left',justifyContent:'normal',alignItems:'normal',justifyItems:'stretch',border:0,borderBottom:'1px solid var(--color-taxpay-border,#dbe4f0)',background:'transparent',color:'var(--color-taxpay-text,#17243c)',fontSize:'14px','&:hover':{background:'#f3f7fc'},'@media(max-width:479px)':{padding:'10px 0',minHeight:'70px'}},
} as const;
export const BentoPaymentAnalytics:React.FC<{
  records:readonly DashboardChartRecord[];
  people:readonly DashboardRecipientProfile[];
  year:string;
  ownerTin:string;
  language:'en'|'bn';
  sourceLoadError?:boolean;
  allowExamples?:boolean;
  previewOnlyExamples?:boolean;
  selectedSource?:DashboardChartSource;
  onSourceChange?:(source:DashboardChartSource)=>void;
  onManageBeneficiaries?:()=>void;
  onOpenBeneficiary?:(tin:string)=>void;
  onOpenHistory:(tag?:DashboardChartTag,service?:DashboardChartService|'all',recipientTin?:string)=>void;
}>=({records,people,year,ownerTin,language,sourceLoadError,allowExamples=false,previewOnlyExamples=false,selectedSource,onSourceChange,onManageBeneficiaries,onOpenBeneficiary,onOpenHistory})=>{
  const bn=language==='bn';
  const tr=(en:string,bengali:string)=>bn?bengali:en;
  // The signed-in overview has one trustworthy source: the account's recorded
  // allocations. Never replace missing/failed account data with fictional totals.
  const [sourceChoice,setSourceChoice]=useState<{year:string;source:DashboardChartSource}|null>(null);
  const [service,setService]=useState<DashboardChartService|'all'>('all');
  const [tag,setTag]=useState<DashboardChartTag|null>(null);
  const [beneficiaryView,setBeneficiaryView]=useState<'relationships'|'tags'|'top'>('relationships');
  const recorded=projectDashboardChartRecords(records,year,'recorded',people,ownerTin);
  const examples=(allowExamples||previewOnlyExamples)?projectDashboardChartRecords(records,year,'example',people,ownerTin):null;
  const defaultSource=previewOnlyExamples?'example':allowExamples
    ?chooseDashboardChartSource(records,year,people,ownerTin):'recorded';
  const source:DashboardChartSource=previewOnlyExamples?'example':allowExamples
    ?(selectedSource??(sourceChoice?.year===year?sourceChoice.source:defaultSource)):'recorded';
  const selectSource=(next:DashboardChartSource)=>{
    if(!allowExamples||previewOnlyExamples)return;
    if(onSourceChange)onSourceChange(next);
    else setSourceChoice({year,source:next});
    setService('all');setTag(null);
  };
  // A service/tag selection from a previous year must not silently filter a new year.
  useEffect(()=>{setService('all');setTag(null);},[year]);
  const all=source==='example'&&examples?examples:recorded;
  const filtered=projectDashboardChartRecords(records,year,source,people,ownerTin,service);
  // The unassigned category contains no meaningful relationship distribution;
  // explain the missing classification rather than presenting a 100% grey chart.
  const onlyUnclassified=filtered.totalMinor>0n&&
    !filtered.byTag.some(item=>item.key!=='unassigned'&&item.amountMinor>0n);
  const money=(minor:bigint)=>formatDashboardChartMoney(minor,language);
  const hasData=all.totalMinor>0n;
  const selectedTag=tag===null?null:filtered.byTag.find(item=>item.key===tag);
  const topBeneficiaries=filtered.byBeneficiary.filter(item=>!tag||item.tag===tag).slice(0,5);
  const topMax=topBeneficiaries[0]?.amountMinor??0n;
  const displayedBeneficiaryTotal=beneficiaryView==='top'&&selectedTag
    ?selectedTag.amountMinor:filtered.totalMinor;
  // Role breakdown is strictly payer-initiated: received payments have a
  // different ownership boundary and are never added to the payer denominator.
  const selfMinor=all.byTag.find(item=>item.key==='own')?.amountMinor??0n;
  const unknownRecipientMinor=all.unclassified.recipientMissingMinor;
  const forOthersMinor=all.totalMinor-selfMinor-unknownRecipientMinor;
  const rolePercent=(minor:bigint)=>dashboardChartPercentage(minor,all.totalMinor);
  const rankedPeople=filtered.byBeneficiary.filter(person=>person.tin!==ownerTin).slice(0,5);
  const rankedMax=rankedPeople[0]?.amountMinor??0n;
  const maskedTin=(tin:string)=>'••••'+tin.slice(-4);
  // A missing account projection must not turn into a fictional dashboard.
  // Keep its next step visible rather than rendering four empty giant cards.
  if(!hasData&&!allowExamples&&!previewOnlyExamples)return <CitizenMuiScope><section className="taxpay-bento-analytics" aria-labelledby="dashboard-payment-analytics-title"
    data-testid="dashboard-payment-analytics" data-chart-source="recorded" data-empty="true">
    <div className="taxpay-bento-analytics__header">
      <div>
        <h2 id="dashboard-payment-analytics-title">{tr('Payment recipients','পেমেন্টের প্রাপক')}</h2>
        <p>{tr('Account-linked allocations for the selected assessment year. Not official tax credits.',
          'নির্বাচিত করবর্ষে অ্যাকাউন্টের বরাদ্দ তথ্য। সরকারি কর ক্রেডিট নয়।')}</p>
      </div>
    </div>
    <p className="taxpay-bento-analytics__empty" role={sourceLoadError?'alert':'status'}>
      {sourceLoadError
        ?tr('Payment records could not be loaded. Please retry later. No sample figures are shown.',
          'পেমেন্ট রেকর্ড লোড হয়নি। পরে আবার চেষ্টা করুন। কোনো নমুনা পরিমাণ দেখানো হচ্ছে না।')
        :tr('No itemized account payments to chart for this year. Your payment history may contain older records.',
          'এই করবর্ষে চার্টে দেখানোর মতো অ্যাকাউন্টের পেমেন্ট বরাদ্দ নেই। পুরনো রেকর্ড পেমেন্টের ইতিহাসে থাকতে পারে।')}
    </p>
    <MuiButtonBase data-mui-coverage="MUI-ANALYTICS-EMPTY-HISTORY" disableRipple sx={chartActions.link} type="button" className="taxpay-bento-analytics__link" onClick={()=>onOpenHistory(undefined,'all')}>
      {tr('View payment history','পেমেন্টের ইতিহাস দেখুন')}<ArrowRight size={16} aria-hidden="true"/>
    </MuiButtonBase>
  </section></CitizenMuiScope>;
  return <CitizenMuiScope><section className="taxpay-bento-analytics" aria-labelledby="dashboard-payment-analytics-title"
    data-testid="dashboard-payment-analytics" data-chart-source={source}>
    <div className="taxpay-bento-analytics__header">
      <div>
        <h2 id="dashboard-payment-analytics-title">{tr('Payment recipients','পেমেন্টের প্রাপক')}</h2>
        <p>{source==='example'
          ?(previewOnlyExamples
            ?tr('Simulated Activity preview — not real payments, Treasury settlements or tax credits.',
              'কার্যক্রমের সিমুলেটেড প্রিভিউ — প্রকৃত পেমেন্ট, ট্রেজারি নিষ্পত্তি বা কর ক্রেডিট নয়।')
            :tr('Local QA scenario only — not saved account payments.',
              'শুধু স্থানীয় পরীক্ষার নমুনা — অ্যাকাউন্টে সংরক্ষিত পেমেন্ট নয়।'))
          :tr('Account-linked allocations for the selected assessment year. Not official tax credits.',
            'নির্বাচিত করবর্ষে অ্যাকাউন্টের বরাদ্দ তথ্য। সরকারি কর ক্রেডিট নয়।')}</p>
      </div>
      {allowExamples&&!previewOnlyExamples&&<div className="taxpay-bento-analytics__sources" role="group"
        aria-label={tr('Payment data source','পেমেন্ট তথ্যের উৎস')} data-testid="dashboard-chart-source">
        <MuiButtonBase data-mui-coverage="MUI-ANALYTICS-SOURCE-RECORDED" disableRipple sx={chartActions.source} type="button" aria-pressed={source==='recorded'} onClick={()=>selectSource('recorded')}>
          {tr('Recorded','সংরক্ষিত')}
        </MuiButtonBase>
        <MuiButtonBase data-mui-coverage="MUI-ANALYTICS-SOURCE-EXAMPLE" disableRipple sx={chartActions.source} type="button" aria-pressed={source==='example'} onClick={()=>selectSource('example')}>
          {tr('Examples','নমুনা')}
        </MuiButtonBase>
      </div>}
    </div>
    {sourceLoadError&&<p role="alert" className="taxpay-bento-analytics__warning">
      {tr('Recorded payments could not be loaded. No sample figures are shown.',
        'সংরক্ষিত পেমেন্ট লোড হয়নি। কোনো নমুনা পরিমাণ দেখানো হচ্ছে না।')}
    </p>}
    <div className="taxpay-bento-analytics__cards">
      <section className="taxpay-bento-analytics__card" data-testid="dashboard-beneficiary-breakdown"
        aria-labelledby="dashboard-beneficiary-breakdown-title">
        <div className="taxpay-bento-analytics__card-header">
          <div>
            <h3 id="dashboard-beneficiary-breakdown-title">{tr('Payment relationships','পেমেন্টের সম্পর্ক')}</h3>
            <p>{service==='all'?tr('All payment services','সব ধরনের পেমেন্ট'):SERVICE_LABELS[service][language]}</p>
          </div>
          <strong className="taxpay-bento-analytics__total tabular-nums">{filtered.totalMinor>0n?money(displayedBeneficiaryTotal):'—'}</strong>
        </div>
      <div className="taxpay-recipient-snapshot" data-testid="dashboard-recipient-snapshot">
        <div className="taxpay-recipient-snapshot__progress">
          <div><strong>{dashboardChartPercentage(filtered.totalMinor-filtered.unclassified.recipientMissingMinor,filtered.totalMinor)}%</strong>
            <span>{tr('with a recorded recipient','প্রাপক নথিভুক্ত আছে')}</span></div>
          <div className="taxpay-recipient-snapshot__bar" role="img" aria-label={tr('Share with a recorded recipient','প্রাপকের তথ্যসহ পেমেন্টের অনুপাত')}>
            <span style={{width:dashboardChartPercentage(filtered.totalMinor-filtered.unclassified.recipientMissingMinor,filtered.totalMinor)+'%'}}/>
          </div>
        </div>
        <dl className="taxpay-recipient-snapshot__figures">
          <div><dt>{tr('Other taxpayers','অন্য করদাতা')}</dt><dd>{money(filtered.totalMinor-(filtered.byTag.find(item=>item.key==='own')?.amountMinor??0n)-filtered.unclassified.recipientMissingMinor)}</dd></div>
          <div><dt>{tr('Not recorded','নথিভুক্ত নয়')}</dt><dd>{money(filtered.unclassified.recipientMissingMinor)}</dd></div>
          <div><dt>{tr('For myself','নিজের জন্য')}</dt><dd>{money(filtered.byTag.find(item=>item.key==='own')?.amountMinor??0n)}</dd></div>
        </dl>
        {filtered.unclassified.recipientKnownMinor>0n&&
          <p className="taxpay-recipient-snapshot__notice">{tr('Some recipients have no saved relationship yet. Add a relationship for clearer reporting.','কিছু প্রাপকের সংরক্ষিত সম্পর্ক নেই। আরও স্পষ্ট তথ্যের জন্য সম্পর্ক যোগ করুন।')}</p>}
      </div>
        <details className="taxpay-recipient-extra" data-testid="dashboard-recipient-advanced">
          <summary>{tr('Relationship filters and details','সম্পর্কের ফিল্টার ও বিস্তারিত')}</summary>
        <div className="taxpay-bento-analytics__view-switch" role="group"
          aria-label={tr('Beneficiary chart view','উপকারভোগীর চার্টের ধরন')} data-testid="dashboard-beneficiary-view">
          <MuiButtonBase data-mui-coverage="MUI-ANALYTICS-VIEW-RELATIONSHIPS" disableRipple sx={chartActions.view} type="button" aria-pressed={beneficiaryView==='relationships'} onClick={()=>{setBeneficiaryView('relationships');setTag(null);}}>
            {tr('Relationships','সম্পর্ক')}
          </MuiButtonBase>
          <MuiButtonBase data-mui-coverage="MUI-ANALYTICS-VIEW-TAGS" disableRipple sx={chartActions.view} type="button" aria-pressed={beneficiaryView==='tags'} onClick={()=>{setBeneficiaryView('tags');setTag(null);}}>
            {tr('Tags','ট্যাগ')}
          </MuiButtonBase>
          <MuiButtonBase data-mui-coverage="MUI-ANALYTICS-VIEW-TOP" disableRipple sx={chartActions.view} type="button" aria-pressed={beneficiaryView==='top'} onClick={()=>setBeneficiaryView('top')}>
            {tr('Top 5','শীর্ষ ৫')}
          </MuiButtonBase>
        </div>
        {(service!=='all'||tag!==null)&&<MuiButtonBase data-mui-coverage="MUI-ANALYTICS-RESET-FILTERS" disableRipple sx={chartActions.link} type="button" className="taxpay-bento-analytics__clear"
          onClick={()=>{setService('all');setTag(null);}}
          data-testid="dashboard-reset-filters">
          {tr('Reset chart filters','চার্ট ফিল্টার মুছুন')}
        </MuiButtonBase>}
        {filtered.totalMinor>0n&&beneficiaryView==='top'&&<label className="taxpay-bento-analytics__relation-filter">
          <span>{tr('Relationship','সম্পর্ক')}</span>
          <MuiNativeSelect data-mui-coverage="MUI-ANALYTICS-RELATION-FILTER" input={<MuiInputBase/>} IconComponent={()=>null}
            inputProps={{'aria-label':tr('Filter top beneficiaries by relationship','সম্পর্ক অনুযায়ী শীর্ষ উপকারভোগী ফিল্টার')}}
            sx={{maxWidth:'100%',display:'contents','& .MuiNativeSelect-select':{appearance:'auto',height:'auto',font:'inherit',boxSizing:'border-box',padding:'8px 10px','&:focus':{backgroundColor:'#fff'},'&:focus-visible':{outline:'3px solid var(--color-taxpay-primary,#085587)',outlineOffset:2}}}}
            value={tag??'all'} onChange={event=>setTag(event.target.value==='all'?null:event.target.value as DashboardChartTag)}>
            <option value="all">{tr('All relationships','সব সম্পর্ক')}</option>
            {DASHBOARD_TAG_KEYS.map(key=><option key={key} value={key}>{TAG_LABELS[key][language]}</option>)}
          </MuiNativeSelect>
        </label>}
        {filtered.totalMinor>0n&&beneficiaryView==='relationships'?<>
          {onlyUnclassified&&<p className="taxpay-bento-analytics__unclassified-intro" role="status">
            {tr('No saved relationships match these payments. Review the unmatched amounts below.',
              'এই পেমেন্টগুলোর সঙ্গে সংরক্ষিত কোনো সম্পর্ক মেলেনি। নিচে শ্রেণিবিহীন পরিমাণ দেখুন।')}
          </p>}
          {!onlyUnclassified&&<div className="taxpay-bento-analytics__segments" role="img"
            aria-label={tr('Beneficiary spending proportions','উপকারভোগী অনুযায়ী ব্যয়ের অনুপাত')}>
            {filtered.byTag.filter(item=>item.amountMinor>0n).map(item=>
              <span key={item.key} className={'taxpay-bento-analytics__segment taxpay-bento-analytics__segment--'+item.key}
                style={{width:dashboardChartPercentage(item.amountMinor,filtered.totalMinor)+'%'}}/>)}
          </div>}
          <div className="taxpay-bento-analytics__tags" role="group"
            aria-label={tr('Select beneficiary category','উপকারভোগীর শ্রেণি নির্বাচন')}>
            {filtered.byTag.filter(item=>item.amountMinor>0n).map(item=>
              <MuiButtonBase data-mui-coverage="MUI-ANALYTICS-CATEGORY" disableRipple sx={chartActions.category} type="button" key={item.key} data-tag={item.key}
                aria-pressed={tag===item.key} onClick={()=>setTag(current=>current===item.key?null:item.key)}>
                <span className={'taxpay-bento-analytics__dot taxpay-bento-analytics__dot--'+item.key} aria-hidden="true"/>
                <span className="taxpay-bento-analytics__tag-label">{TAG_LABELS[item.key][language]}</span>
                <strong className="tabular-nums">{money(item.amountMinor)}</strong>
              </MuiButtonBase>)}
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
                <MuiButtonBase data-mui-coverage="MUI-ANALYTICS-MANAGE-TAGS" disableRipple sx={chartActions.link} type="button" className="taxpay-bento-analytics__link" onClick={onManageBeneficiaries}>
                  {tr('Manage beneficiary tags','উপকারভোগীর ট্যাগ পরিচালনা')}
                </MuiButtonBase>}
            </div>}
        </>:null}
        {filtered.totalMinor>0n&&beneficiaryView==='tags'&&
          <div className="taxpay-bento-analytics__bars" role="group" aria-label={tr('Saved beneficiary tag allocations','সংরক্ষিত উপকারভোগী ট্যাগের বরাদ্দ')}
            data-testid="dashboard-beneficiary-tags-chart">
            {[...filtered.byTag].filter(item=>item.amountMinor>0n).sort((a,b)=>a.amountMinor>b.amountMinor?-1:a.amountMinor<b.amountMinor?1:0).map(item=>
              <MuiButtonBase data-mui-coverage="MUI-ANALYTICS-TAG-BAR" disableRipple sx={chartActions.bar} type="button" key={item.key} className="taxpay-bento-analytics__bar-item"
                aria-pressed={tag===item.key} onClick={()=>setTag(current=>current===item.key?null:item.key)}>
                <span className="taxpay-bento-analytics__bar-top">
                  <span>{TAG_LABELS[item.key][language]}</span><strong className="tabular-nums">{money(item.amountMinor)}</strong>
                </span>
                <span className="taxpay-bento-analytics__bar-track" aria-hidden="true">
                  <span style={{width:dashboardChartPercentage(item.amountMinor,filtered.totalMinor)+'%'}}/>
                </span>
              </MuiButtonBase>)}
          </div>}
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
              return <MuiButtonBase data-mui-coverage="MUI-ANALYTICS-TOP-FILTERED" disableRipple sx={chartActions.top} key={person.tin} type="button" className="taxpay-bento-analytics__top-item"
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
              </MuiButtonBase>;
            })}
          </div>:<p role="status" className="taxpay-bento-analytics__empty">
            {tr('No identified beneficiaries match this selection. Payments with no recipient cannot appear in the ranking.',
              'এই বাছাইয়ে শনাক্তকৃত উপকারভোগী নেই। প্রাপকবিহীন পেমেন্ট তালিকায় দেখানো যায় না।')}
          </p>}
          {filtered.unclassified.recipientMissingMinor>0n&&<p className="taxpay-bento-analytics__footnote" data-testid="dashboard-unranked-amount">
            {tr('Excluded from ranking: payments without a recorded recipient','তালিকার বাইরে: প্রাপকবিহীন পেমেন্ট')}
            {' · '}{money(filtered.unclassified.recipientMissingMinor)}
          </p>}
          {onManageBeneficiaries&&<MuiButtonBase data-mui-coverage="MUI-ANALYTICS-MANAGE-SAVED" disableRipple sx={chartActions.link} type="button" className="taxpay-bento-analytics__link"
            onClick={onManageBeneficiaries}>{tr('View all saved beneficiaries','সংরক্ষিত সব উপকারভোগী দেখুন')}
            <ArrowRight size={16} aria-hidden="true"/>
          </MuiButtonBase>}
        </>}
        {filtered.totalMinor>0n&&<MuiButtonBase data-mui-coverage="MUI-ANALYTICS-FILTERED-HISTORY" disableRipple sx={chartActions.link} type="button" className="taxpay-bento-analytics__link"
          onClick={()=>onOpenHistory(tag??undefined,service)}>
          {tr('View payment records','পেমেন্টের রেকর্ড দেখুন')}
          <ArrowRight size={16} aria-hidden="true"/>
        </MuiButtonBase>}
        {!filtered.totalMinor&&<p role="status" className="taxpay-bento-analytics__empty">{tr(
          'No beneficiary allocations for this selection.','এই বাছাইয়ের জন্য কোনো উপকারভোগী বরাদ্দ নেই।')}</p>}
        </details>
      </section>

      <section className="taxpay-bento-analytics__card taxpay-bento-analytics__card--ranking"
        data-testid="dashboard-ranked-beneficiaries" aria-labelledby="dashboard-ranked-beneficiaries-title">
        <div className="taxpay-bento-analytics__card-header">
          <div><h3 id="dashboard-ranked-beneficiaries-title">{tr('Top beneficiaries','শীর্ষ উপকারভোগী')}</h3>
            <p>{tr('Highest amounts I paid for others','অন্যদের জন্য আমার সর্বোচ্চ পরিশোধ')}</p></div>
        </div>
        {rankedPeople.length?<div className="taxpay-bento-analytics__top-list" role="group"
          aria-label={tr('Top five beneficiaries','শীর্ষ পাঁচ উপকারভোগী')}>
          {rankedPeople.map((person,index)=>{
            const personName=person.name??tr('Recipient','প্রাপক')+' '+maskedTin(person.tin);
            const target=person.saved&&onOpenBeneficiary
              ?()=>onOpenBeneficiary(person.tin)
              :()=>onOpenHistory(undefined,service,person.tin);
            return <MuiButtonBase data-mui-coverage="MUI-ANALYTICS-TOP-RANKED" disableRipple sx={chartActions.top} key={person.tin} type="button" className="taxpay-bento-analytics__top-item"
              onClick={target} title={tr('Open beneficiary payment history','উপকারভোগীর পেমেন্ট ইতিহাস দেখুন')}
              aria-label={personName+': '+money(person.amountMinor)}>
              <span className="taxpay-bento-analytics__top-heading">
                <span className="taxpay-bento-analytics__top-name">{index+1}. {personName}</span>
                <strong className="tabular-nums">{money(person.amountMinor)}</strong>
              </span>
              <span className="taxpay-bento-analytics__top-meta">
                {TAG_LABELS[person.tag][language]} · {new Intl.NumberFormat(bn?'bn-BD':'en-BD').format(person.paymentCount)} {tr('payments','টি পেমেন্ট')}
              </span>
              <span className="taxpay-bento-analytics__bar-track" aria-hidden="true">
                <span style={{width:dashboardChartPercentage(person.amountMinor,rankedMax)+'%'}}/>
              </span>
            </MuiButtonBase>;
          })}
        </div>:<p className="taxpay-bento-analytics__empty" role="status">
          {tr('No identifiable third-party beneficiaries in the selected records.',
            'নির্বাচিত রেকর্ডে শনাক্তযোগ্য অন্য কোনো উপকারভোগী নেই।')}
        </p>}
        {filtered.unclassified.recipientMissingMinor>0n&&<p className="taxpay-bento-analytics__footnote">
          {tr('Unranked payments without a recorded recipient','নথিভুক্ত প্রাপক না থাকায় তালিকার বাইরে')}
          {' · '}{money(filtered.unclassified.recipientMissingMinor)}
        </p>}
        {onManageBeneficiaries&&<MuiButtonBase data-mui-coverage="MUI-ANALYTICS-MANAGE-ALL" disableRipple sx={chartActions.link} type="button" className="taxpay-bento-analytics__link"
          onClick={onManageBeneficiaries}>{tr('View all beneficiaries','সব উপকারভোগী দেখুন')}
          <ArrowRight size={16} aria-hidden="true"/></MuiButtonBase>}
      </section>
      <details className="taxpay-payment-extra" data-testid="dashboard-payment-extra">
        <summary>{tr('Payment breakdown by service and payer','পেমেন্টের ধরন ও পরিশোধকারীর বিস্তারিত')}</summary>
        <div className="taxpay-payment-extra__cards">
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
            return <MuiButtonBase data-mui-coverage="MUI-ANALYTICS-SERVICE-BAR" disableRipple sx={chartActions.bar} key={item.key} type="button" data-service={item.key}
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
            </MuiButtonBase>;
          })}
          {service!=='all'&&<MuiButtonBase data-mui-coverage="MUI-ANALYTICS-CLEAR-SERVICE" disableRipple sx={chartActions.link} type="button" className="taxpay-bento-analytics__clear"
            onClick={()=>{setService('all');setTag(null);}}>
            {tr('Show all payment services','সব পেমেন্টের ধরন দেখুন')}
          </MuiButtonBase>}
        </div>:<p role="status" className="taxpay-bento-analytics__empty">{source==='recorded'&&allowExamples
          ?tr('No itemized recorded payments for this year. Select Examples to view the sample scenario.',
            'এই করবর্ষের সংরক্ষিত পেমেন্টের পৃথক বরাদ্দ নেই। স্থানীয় নমুনা দেখতে নমুনা বাছুন।')
          :tr('No itemized account payments for this year.','এই করবর্ষে অ্যাকাউন্টের পৃথক পেমেন্ট বরাদ্দ নেই।')}</p>}
        {source==='recorded'&&all.omittedRecords>0&&
          <p className="taxpay-bento-analytics__footnote" role="status">
            {tr('Some historical records lack itemized allocations and are excluded from these totals.',
              'কিছু পুরনো রেকর্ডে পৃথক বরাদ্দ নেই; এগুলো এই মোট হিসাব থেকে বাদ রাখা হয়েছে।')}
          </p>}
      </section>

      <section className="taxpay-bento-analytics__card taxpay-bento-analytics__card--roles"
        data-testid="dashboard-role-breakdown" aria-labelledby="dashboard-role-breakdown-title">
        <div className="taxpay-bento-analytics__card-header">
          <div><h3 id="dashboard-role-breakdown-title">{tr('Payment relationships','পেমেন্টের সম্পর্ক')}</h3>
            <p>{tr('Who received the payments I initiated?','আমার শুরু করা পেমেন্ট কার নামে হয়েছে?')}</p></div>
        </div>
        {hasData?<div className="taxpay-bento-analytics__role-layout">
          <svg viewBox="0 0 160 160" role="img" className="taxpay-bento-analytics__role-donut"
            aria-label={tr('My tax','নিজের কর')+': '+money(selfMinor)+', '+tr('Paid for others','অন্যদের জন্য পরিশোধ')+': '+money(forOthersMinor)+', '+tr('Recipient not recorded','প্রাপক নথিভুক্ত নয়')+': '+money(unknownRecipientMinor)}>
            <circle cx="80" cy="80" r="55" fill="none" stroke="#e8eef4" strokeWidth="19"/>
            <circle cx="80" cy="80" r="55" fill="none" stroke="#085587" strokeWidth="19"
              pathLength="100" strokeDasharray={rolePercent(selfMinor)+' 100'} transform="rotate(-90 80 80)"/>
            <circle cx="80" cy="80" r="55" fill="none" stroke="#568fb7" strokeWidth="19"
              pathLength="100" strokeDasharray={rolePercent(forOthersMinor)+' 100'}
              strokeDashoffset={-rolePercent(selfMinor)} transform="rotate(-90 80 80)"/>
            <circle cx="80" cy="80" r="55" fill="none" stroke="#a9bacb" strokeWidth="19"
              pathLength="100" strokeDasharray={rolePercent(unknownRecipientMinor)+' 100'}
              strokeDashoffset={-(rolePercent(selfMinor)+rolePercent(forOthersMinor))} transform="rotate(-90 80 80)"/>
            <text x="80" y="77" fontSize="13" textAnchor="middle" fill="currentColor" fontWeight="600">{tr('Paid by me','আমার পেমেন্ট')}</text>
            <text x="80" y="94" fontSize="12" textAnchor="middle" fill="currentColor">{new Intl.NumberFormat(bn?'bn-BD':'en-BD').format(all.paymentCount)}</text>
          </svg>
          <dl className="taxpay-bento-analytics__role-legend">
            {([
              {en:'For myself',bn:'নিজের জন্য',minor:selfMinor,color:'#085587'},
              {en:'For other taxpayers',bn:'অন্য করদাতাদের জন্য',minor:forOthersMinor,color:'#568fb7'},
              {en:'Recipient not recorded',bn:'প্রাপক নথিভুক্ত নয়',minor:unknownRecipientMinor,color:'#a9bacb'}
            ] as const).map(row=><div key={row.en}>
              <dt><span style={{background:row.color}} aria-hidden="true"/>{tr(row.en,row.bn)}</dt>
              <dd className="tabular-nums">{money(row.minor)}</dd>
            </div>)}
          </dl>
        </div>:<p className="taxpay-bento-analytics__empty" role="status">
          {tr('No payer allocations to chart for this year.','এই করবর্ষে দেখানোর মতো পরিশোধকারীর বরাদ্দ নেই।')}
        </p>}
        <p className="taxpay-bento-analytics__footnote">
          {tr('Payments received from other people are separate from my spending. View Activity for received payments.',
            'অন্যদের কাছ থেকে প্রাপ্ত পেমেন্ট আমার ব্যয় থেকে পৃথক। প্রাপ্ত পেমেন্ট কার্যক্রমে দেখুন।')}
        </p>
        <MuiButtonBase data-mui-coverage="MUI-ANALYTICS-ROLE-HISTORY" disableRipple sx={chartActions.link} type="button" className="taxpay-bento-analytics__link" onClick={()=>onOpenHistory(undefined,'all')}>
          {tr('View payment history','পেমেন্টের ইতিহাস দেখুন')}<ArrowRight size={16} aria-hidden="true"/>
        </MuiButtonBase>
      </section>

        </div>
      </details>
    </div>
  </section></CitizenMuiScope>;
};
