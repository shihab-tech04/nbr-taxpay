import React,{useState} from 'react';
import '../../styles/taxpay-dashboard-interactive.css';
import {ArrowRight} from 'lucide-react';
import type {Beneficiary} from '../../services/beneficiaries';
import {
  DASHBOARD_SERVICE_KEYS,DASHBOARD_TAG_KEYS,
  projectDashboardChartRecords,formatDashboardChartMoney,dashboardChartPercentage,
  type DashboardChartRecord,type DashboardChartService,type DashboardChartTag,
  type DashboardChartSource
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
  people:readonly Pick<Beneficiary,'tin'|'tag'|'relationship'>[];
  year:string;
  ownerTin:string;
  language:'en'|'bn';
  sourceLoadError?:boolean;
  onOpenHistory:(tag?:DashboardChartTag)=>void;
}>=({records,people,year,ownerTin,language,sourceLoadError,onOpenHistory})=>{
  const bn=language==='bn';
  const tr=(en:string,bengali:string)=>bn?bengali:en;
  // Use the selected year's available source by default. A year with no
  // account-backed allocations must not show two misleading zero-value charts
  // while the same Overview displays illustrative activity for that year.
  // The manual source choice remains explicit and applies only to its year.
  const [sourceChoice,setSourceChoice]=useState<{year:string;source:DashboardChartSource}|null>(null);
  const [service,setService]=useState<DashboardChartService|'all'>('all');
  const [tag,setTag]=useState<DashboardChartTag|null>(null);
  const recorded=projectDashboardChartRecords(records,year,'recorded',people,ownerTin);
  const examples=projectDashboardChartRecords(records,year,'example',people,ownerTin);
  const defaultSource:DashboardChartSource=recorded.totalMinor>0n||recorded.omittedRecords>0
    ? 'recorded' : examples.totalMinor>0n ? 'example' : 'recorded';
  const source=sourceChoice?.year===year?sourceChoice.source:defaultSource;
  const selectSource=(next:DashboardChartSource)=>{
    setSourceChoice({year,source:next});setService('all');setTag(null);
  };
  const all=source==='recorded'?recorded:examples;
  const filtered=projectDashboardChartRecords(records,year,source,people,ownerTin,service);
  const money=(minor:bigint)=>formatDashboardChartMoney(minor,language);
  const hasData=all.totalMinor>0n;
  const selectedTag=tag===null?null:filtered.byTag.find(item=>item.key===tag);
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
          {all.byService.filter(item=>item.amountMinor>0n).map(item=>{
            const value=dashboardChartPercentage(item.amountMinor,all.totalMinor);
            const label=SERVICE_LABELS[item.key][language];
            return <button key={item.key} type="button" data-service={item.key}
              className="taxpay-bento-analytics__bar-item"
              aria-pressed={service===item.key}
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
            <h3 id="dashboard-beneficiary-breakdown-title">{tr('By beneficiary relationship','উপকারভোগীর সম্পর্ক অনুযায়ী')}</h3>
            <p>{service==='all'?tr('All payment services','সব ধরনের পেমেন্ট'):SERVICE_LABELS[service][language]}</p>
          </div>
          <strong className="taxpay-bento-analytics__total tabular-nums">{filtered.totalMinor>0n?money(filtered.totalMinor):'—'}</strong>
        </div>
        {filtered.totalMinor>0n?<>
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
          <button type="button" className="taxpay-bento-analytics__link"
            onClick={()=>onOpenHistory(tag??undefined)}>
            {tr('View payment records','পেমেন্টের রেকর্ড দেখুন')}<ArrowRight size={16} aria-hidden="true"/>
          </button>
        </>:<p role="status" className="taxpay-bento-analytics__empty">{tr(
          'No beneficiary allocations for this selection.','এই বাছাইয়ের জন্য কোনো উপকারভোগী বরাদ্দ নেই।')}</p>}
      </section>
    </div>
    {source==='example'&&<p className="taxpay-bento-analytics__footnote">
      {tr('Example figures are fictional and separate from recorded account payments.',
        'নমুনার অর্থ কাল্পনিক; অ্যাকাউন্টে সংরক্ষিত পেমেন্ট থেকে পৃথক।')}
    </p>}
  </section>;
};
