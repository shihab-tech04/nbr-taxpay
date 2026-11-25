import React, {useEffect, useMemo, useState} from 'react';
import {ArrowRight, CircleHelp, FileCheck2, FilePenLine, ReceiptText, Users, WalletCards} from 'lucide-react';
import {ASSESSMENT_YEARS} from '../../data/mockData';
import {getDemoStoryPaymentHistory} from '../../services/simulatedPaymentsApi';
import type {SimulationAllocation, SimulationTransaction, SimulationUser} from '../../contracts/paymentSimulationContract';
import {loadBeneficiaries, type Beneficiary} from '../../services/beneficiaries';
import {paymentTagGroupForTin, paymentTagGroupLabels, type PaymentTagGroup} from '../../services/beneficiaryPaymentTags';
import {sampleTinForUserNumber} from '../../data/sampleTinSuggestions';
import {taxpayerGreeting} from '../../services/taxpayerGreeting';
import {TaxpayerPageHeading} from '../layout/TaxpayerPageStructure';
import {DashboardPaymentDrafts} from './DashboardPaymentDrafts';
import {usePreviewCorrectionRegister,previewCorrectionStatus} from '../../services/previewCorrections';
import {DemoServiceRecordsPanel} from './DemoServiceRecordsPanel';
import type {DemoUserId} from '../../data/demoUsers';
import type {PaymentFormDraft} from '../../services/accountPaymentFormDrafts';
import '../../styles/taxpay-dashboard-preview.css';

type LoadState = {
  owner:SimulationUser|null;
  phase:'loading'|'ready'|'error';
  transactions:SimulationTransaction[];
  people:Beneficiary[];
};
type Props = {
  profileId:SimulationUser;
  demoUserId:DemoUserId;
  name:string;
  language:'en'|'bn';
  onNavigate:(route:'history'|'corrections'|'beneficiaries')=>void;
  onPay:()=>void;
  onResumePaymentDraft?:(draft:PaymentFormDraft)=>void;
};
type PaymentRow={id:string;date:string;amountMinor:bigint;allocations:SimulationAllocation[]};
const panel='min-w-0 rounded-2xl border border-taxpay-border bg-white p-4 sm:p-5';
const normalYear=(year:string)=>{
  const match=/^(20\d{2})-(\d{2})$/.exec(year);
  return match?match[1]+'-20'+match[2]:year;
};
const money=(minor:bigint,language:'en'|'bn')=>{
  const locale=language==='bn'?'bn-BD':'en-BD';
  const major=new Intl.NumberFormat(locale).format(minor/100n);
  const fraction=minor%100n;
  return '৳'+major+(fraction?'.'+String(fraction).padStart(2,'0'):'');
};
const EmptyIllustration:React.FC<{icon:'people'|'journey'|'draft'|'request';title:string;detail:string}>=
  ({icon,title,detail})=><div className="taxpay-unified-empty" role="status">
    <span className="taxpay-unified-empty__icon" aria-hidden="true">
      {icon==='people'?<Users size={24}/>:icon==='journey'?<FileCheck2 size={24}/>:icon==='draft'?<FilePenLine size={24}/>:<ReceiptText size={24}/>}
    </span>
    <p className="taxpay-unified-empty__title">{title}</p>
    <p className="taxpay-unified-empty__detail">{detail}</p>
  </div>;

/** Same recipient-first overview structure as user1, with capability-scoped
 * scenario records instead of user1's fixture. A failed read never becomes zero
 * or falls back to somebody else's preview payments. */
export const PreviewDashboardBento:React.FC<Props>=({profileId,demoUserId,name,language,onNavigate,onPay,onResumePaymentDraft})=>{
  const bn=language==='bn';
  const tr=(en:string,local:string)=>bn?local:en;
  const [year,setYear]=useState('2026-2027');
  const [tab,setTab]=useState<'drafts'|'requests'>('drafts');
  const [draftCount,setDraftCount]=useState<number|null>(null);
  const correctionRegister=usePreviewCorrectionRegister(profileId);
  const correctionCount=correctionRegister.count;
  const [snapshot,setSnapshot]=useState<LoadState>({owner:null,phase:'loading',transactions:[],people:[]});
  // Preserve the existing cross-browser Continue Draft journey: once saved drafts
  // load, show their cards without requiring a hidden tab to be opened first.
  useEffect(()=>{
    if(draftCount!==null&&draftCount>0)setTab('drafts');
  },[draftCount]);
  useEffect(()=>{
    let active=true;
    setSnapshot({owner:profileId,phase:'loading',transactions:[],people:[]});
    setDraftCount(null);
    // Only the current signed-in preview capability can read this payer's history.
    void Promise.all([
      getDemoStoryPaymentHistory(profileId,'payer'),
      loadBeneficiaries(null).catch(()=>({people:[] as Beneficiary[]}))
    ]).then(([transactions,result])=>{
      if(!active)return;
      if(transactions.some(t=>t.payer!==profileId||t.simulationOnly!==true))
        throw Error('Dashboard owner mismatch');
      setSnapshot({owner:profileId,phase:'ready',transactions,people:result.people});
    }).catch(()=>{
      if(active)setSnapshot({owner:profileId,phase:'error',transactions:[],people:[]});
    });
    return()=>{active=false;};
  },[profileId]);
  const visible=snapshot.owner===profileId?snapshot:{owner:profileId,phase:'loading' as const,transactions:[],people:[]};
  const valid=visible.phase==='ready';
  const years=useMemo(()=>[...new Set([
    '2026-2027',...ASSESSMENT_YEARS.map(normalYear),
    ...(valid?visible.transactions.flatMap(t=>t.allocations.map(a=>normalYear(a.assessmentYear))):[])
  ])].filter(value=>/^20\d{2}-20\d{2}$/.test(value)).sort((a,b)=>b.localeCompare(a)),[valid,visible.transactions]);
  const rows=useMemo<PaymentRow[]>(()=>{
    if(!valid)return [];
    return visible.transactions.filter(t=>t.payer===profileId&&t.state==='SIMULATED').map(t=>{
      const allocations=t.allocations.filter(a=>normalYear(a.assessmentYear)===year&&
        Number.isSafeInteger(a.amountMinor)&&a.amountMinor>0);
      return {id:t.transactionId,date:t.createdAt,
        amountMinor:allocations.reduce((sum,a)=>sum+BigInt(a.amountMinor),0n),allocations};
    }).filter(t=>t.amountMinor>0n).sort((a,b)=>b.date.localeCompare(a.date));
  },[valid,visible.transactions,profileId,year]);
  const total=rows.reduce((sum,row)=>sum+row.amountMinor,0n);
  const allocations=rows.flatMap(row=>row.allocations);
  const recipientMap=new Map<string,{total:bigint;count:number;tag:PaymentTagGroup}>();
  for(const row of rows){
    const seen=new Set<string>();
    for(const item of row.allocations){
      if(item.beneficiary===profileId)continue;
      const number=/^user(\d+)$/.exec(item.beneficiary);
      const tin=number?sampleTinForUserNumber(Number(number[1])):null;
      const tag=paymentTagGroupForTin(tin??undefined,visible.people);
      const prior=recipientMap.get(item.beneficiary)??{total:0n,count:0,tag};
      recipientMap.set(item.beneficiary,{total:prior.total+BigInt(item.amountMinor),
        count:prior.count+(seen.has(item.beneficiary)?0:1),tag});
      seen.add(item.beneficiary);
    }
  }
  const recipients=[...recipientMap.entries()].sort((a,b)=>a[1].total>b[1].total?-1:a[1].total<b[1].total?1:0);
  const self=allocations.filter(a=>a.beneficiary===profileId).reduce((sum,a)=>sum+BigInt(a.amountMinor),0n);
  const paidForOthers=total-self;
  const categoryAmounts=new Map<string,bigint>();
  for(const item of allocations)
    categoryAmounts.set(item.category,(categoryAmounts.get(item.category)??0n)+BigInt(item.amountMinor));
  const mainCategory=[...categoryAmounts.values()].reduce((a,b)=>a>b?a:b,0n);
  const largestShare=total>0n?Number(mainCategory*10000n/total)/100:0;
  const formatDate=(value:string)=>{
    const time=Date.parse(value);
    return Number.isFinite(time)?new Intl.DateTimeFormat(bn?'bn-BD':'en-GB',
      {day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(time):'—';
  };
  const greeting=taxpayerGreeting(language,new Date().getHours(),name,true);
  const noPayments=valid&&rows.length===0;
  const readMessage=visible.phase==='error'
    ?tr('Payment records could not be loaded. Try again from payment history.','পেমেন্ট রেকর্ড লোড হয়নি। পেমেন্ট ইতিহাস থেকে আবার চেষ্টা করুন।')
    :visible.phase==='loading'
      ?tr('Loading your recorded payment activity…','আপনার পেমেন্ট কার্যক্রম লোড হচ্ছে…')
      :tr('No payments have been recorded for this assessment year.','এই করবর্ষে কোনো পেমেন্ট রেকর্ড নেই।');
  return <div className={'taxpayer-workspace taxpay-unified-preview mx-auto max-w-7xl space-y-4 pb-12 '+(bn?'font-bengali':'')}
    data-testid="dashboard-unified-preview" data-account-id={profileId}>
    <section aria-label={tr('Welcome','স্বাগতম')} className="space-y-1 px-1">
      <p className="text-sm text-taxpay-muted">{greeting.salutation}</p>
      <p className="text-lg font-semibold text-taxpay-text">{greeting.welcome}</p>
      <p className="text-xs text-taxpay-muted">{tr('User ID: ','ইউজার আইডি: ')}{profileId}</p>
    </section>

    <TaxpayerPageHeading title={tr('Your tax overview','আপনার করের সারসংক্ষেপ')}
      description={tr('Payments, recipients and follow-ups for your assessment year.','আপনার করবর্ষের পেমেন্ট, প্রাপক ও পরবর্তী করণীয়।')}
      className="taxpayer-dashboard-header taxpayer-dashboard-header--overview"
      actions={<label className="taxpay-unified-year">{tr('Assessment year','করবর্ষ')}
        <select aria-label={tr('Assessment year','করবর্ষ')} value={year}
          onChange={e=>setYear(e.target.value)}>
          {years.map(value=><option value={value} key={value}>{value}</option>)}
        </select>
      </label>}/>
    <div className="taxpay-bento-grid" data-testid="taxpayer-overview-bento">
      <div className="taxpay-bento-request-row">
        <section className={panel+' taxpay-bento-hero taxpay-bento-summary'}
          aria-label={tr('Payment and request summary','পেমেন্ট ও আবেদনের সারসংক্ষেপ')}>
          <div className="taxpay-overview-feature">
            <p className="taxpay-overview-feature__eyebrow"><WalletCards size={17} aria-hidden="true"/>
              {tr('TOTAL RECORDED','মোট নথিভুক্ত')} · {year}</p>
            <h2>{tr('Payments at a glance','এক নজরে আপনার পেমেন্ট')}</h2>
            <p className="taxpay-overview-feature__source">
              {tr('Application payment activity — not confirmed tax credits','অ্যাপের পেমেন্ট কার্যক্রম — নিশ্চিত কর ক্রেডিট নয়')}
            </p>
            <div className="taxpay-overview-feature__main">
              <div className="taxpay-overview-feature__amount">
                <strong data-testid="dashboard-overview-total" className="tabular-nums">
                  {valid?money(total,language):'—'}
                </strong>
                <p role={visible.phase==='error'?'alert':'status'}>
                  {rows.length?tr('Latest payment activity','সর্বশেষ পেমেন্ট')+': '+money(rows[0].amountMinor,language)+' · '+formatDate(rows[0].date):readMessage}
                </p>
              </div>
              <div className="taxpay-unified-chart" aria-label={tr('Largest payment service share','সর্বোচ্চ সেবার অংশ')}>
                {valid&&total>0n?<>
                  <div className="taxpay-unified-donut" role="img" aria-label={largestShare+'%'}>
                    <strong>{largestShare.toFixed(largestShare%1?2:0)+'%'}</strong>
                    <span>{tr('Largest share','সর্বোচ্চ অংশ')}</span>
                  </div>
                  <p>{tr('Recorded service distribution','নথিভুক্ত সেবার বিভাজন')}</p>
                </>:<div className="taxpay-unified-chart-placeholder" role="status">
                  <CircleHelp size={24} aria-hidden="true"/>
                  <span>{valid?tr('No payment activity yet','এখনও কোনো পেমেন্ট কার্যক্রম নেই')
                    :visible.phase==='loading'?tr('Loading payment activity…','পেমেন্ট কার্যক্রম লোড হচ্ছে…')
                    :tr('Payment distribution unavailable','পেমেন্টের বিভাজন পাওয়া যায়নি')}</span>
                </div>}
              </div>
            </div>
            <button type="button" className="taxpay-overview-feature__action"
              onClick={rows.length||!valid?()=>onNavigate('history'):onPay}>
              {rows.length||!valid?tr('View payment history','পেমেন্ট ইতিহাস দেখুন'):tr('Make your first payment','প্রথম পেমেন্ট করুন')}
              <ArrowRight size={16} aria-hidden="true"/>
            </button>
          </div>
          <div className="taxpay-bento-hero__status" role="group"
            aria-label={tr('Payment and request summary','পেমেন্ট ও আবেদনের সারসংক্ষেপ')}>
            <button type="button" className="taxpay-summary-metric taxpay-summary-metric--completed" onClick={()=>onNavigate('history')}>
              <span className="taxpay-summary-metric__label"><FileCheck2 aria-hidden="true"/>{tr('Completed Payments','সম্পন্ন পেমেন্ট')}</span>
              <strong className="tabular-nums">{valid?rows.length:'—'}</strong>
              {noPayments&&<small>{tr('No activity','কার্যক্রম নেই')}</small>}
            </button>
            <button type="button" className="taxpay-summary-metric taxpay-summary-metric--drafts" onClick={()=>setTab('drafts')}>
              <span className="taxpay-summary-metric__label"><FilePenLine aria-hidden="true"/>{tr('Saved Drafts','সংরক্ষিত খসড়া')}</span>
              <strong className="tabular-nums">{draftCount===null?'—':draftCount}</strong>
              {draftCount===0&&<small>{tr('No drafts','কোনো খসড়া নেই')}</small>}
            </button>
            <button type="button" className="taxpay-summary-metric taxpay-summary-metric--requests"
              onClick={()=>setTab('requests')}>
              <span className="taxpay-summary-metric__label"><ReceiptText aria-hidden="true"/>{tr('Correction Requests','সংশোধনের আবেদন')}</span>
              <strong className="tabular-nums">{correctionCount??"—"}</strong>
              <small>{tr('View requests','আবেদন দেখুন')}</small>
            </button>
          </div>
        </section>
        <div className="taxpay-bento-tasks">
          <div className="taxpay-unified-followups">
            <div className="taxpay-unified-followups__heading">
              <h2>{tr('Follow-ups','পরবর্তী করণীয়')}</h2>
              <div className="taxpay-bento-tasks__tabs" role="group" aria-label={tr('Follow-up type','পরবর্তী করণীয়ের ধরন')}>
                <button type="button" aria-pressed={tab==='drafts'} onClick={()=>setTab('drafts')}>
                  {tr('Drafts','খসড়া')} <span>{draftCount===null?'—':draftCount}</span>
                </button>
                <button type="button" aria-pressed={tab==='requests'} onClick={()=>setTab('requests')}>
                  {tr('Requests','আবেদন')} <span>{correctionCount??'—'}</span>
                </button>
              </div>
            </div>
            <div hidden={tab!=='drafts'} className="taxpay-unified-drafts" id="taxpayer-dashboard-draft-section">
              {onResumePaymentDraft&&<DashboardPaymentDrafts language={language} onResume={onResumePaymentDraft}
                onCountChange={setDraftCount} onStartPayment={onPay}/>}
              {!onResumePaymentDraft&&<EmptyIllustration icon="draft" title={tr('No saved payment drafts','কোনো সংরক্ষিত খসড়া নেই')}
                detail={tr('Start a payment and save it to continue later.','পেমেন্ট শুরু করে পরে চালিয়ে যাওয়ার জন্য সংরক্ষণ করুন।')}/>}
            </div>
            {tab==='requests'&&<div className="taxpay-unified-followups__empty">
              <p className="text-sm text-taxpay-muted">{tr('Correction requests from all assessment years.','সব করবর্ষের সংশোধনের আবেদন।')}</p>
              {correctionRegister.phase==='loading'?<p role="status" className="text-sm text-taxpay-muted">{tr('Loading correction requests…','আবেদন লোড হচ্ছে…')}</p>
                :correctionRegister.phase==='error'?<div role="alert" className="space-y-2 text-sm"><p>{tr('Correction request history unavailable.','আবেদনের ইতিহাস পাওয়া যাচ্ছে না।')}</p><button type="button" className="taxpay-unified-text-link" onClick={correctionRegister.retry}>{tr('Retry','আবার চেষ্টা করুন')}</button></div>
                :correctionRegister.rows.length?<ul data-testid="dashboard-recorded-corrections" className="w-full space-y-2">{correctionRegister.rows.slice(0,3).map(request=><li key={request.id} className="rounded-lg border border-taxpay-border p-3 min-w-0"><p className="break-all text-sm font-semibold">{request.originalReference}</p><p className="text-sm">{previewCorrectionStatus(request,language)} · {request.currentAY} → {request.proposedAY}</p><p className="break-words text-sm">{request.reason}</p></li>)}</ul>
                :<EmptyIllustration icon="request" title={tr('No correction requests yet','এখনো কোনো সংশোধনের আবেদন নেই')}
                  detail={tr('Open your requests to review their current status.','আবেদনগুলোর বর্তমান অবস্থা দেখতে আবেদন বিভাগে যান।')}/>} 
              <button type="button" className="taxpay-unified-text-link" onClick={()=>onNavigate('corrections')}>
                {tr('View requests','আবেদন দেখুন')} <ArrowRight size={15} aria-hidden="true"/>
              </button>
            </div>}
          </div>
        </div>
      </div>
      <section className="taxpay-bento-analytics" aria-labelledby="dashboard-payment-analytics-title">
        <div className="taxpay-bento-analytics__header">
          <div><h2 id="dashboard-payment-analytics-title">{tr('Payment recipients','পেমেন্টের প্রাপক')}</h2></div>
        </div>
        <div className="taxpay-unified-recipients">
          <article className={panel} aria-labelledby="taxpay-unified-rel-title">
            <h3 id="taxpay-unified-rel-title">{tr('Payment relationships','পেমেন্ট সম্পর্ক')}</h3>
            {recipients.length?<>
              <p className="taxpay-unified-subtitle">{tr('Amounts paid for other taxpayers','অন্য করদাতাদের জন্য পরিশোধ')}</p>
              <strong className="taxpay-unified-recipient-total">{money(paidForOthers,language)}</strong>
              <div className="taxpay-unified-progress"><span style={{width:total>0n?Number(paidForOthers*100n/total)+'%':'0%'}}/></div>
              <p className="taxpay-unified-subtitle">{tr('For myself','নিজের জন্য')}: {money(self,language)}</p>
              <button type="button" className="taxpay-unified-text-link" onClick={()=>onNavigate('beneficiaries')}>
                {tr('Manage beneficiaries','উপকারভোগী পরিচালনা')} <ArrowRight size={15} aria-hidden="true"/>
              </button>
            </>:<EmptyIllustration icon="people"
              title={valid?tr('No payment relationships yet','এখনও কোনো পেমেন্ট সম্পর্ক নেই')
                :visible.phase==='loading'?tr('Loading relationships…','সম্পর্কের তথ্য লোড হচ্ছে…')
                :tr('Payment relationships unavailable','পেমেন্ট সম্পর্কের তথ্য পাওয়া যায়নি')}
              detail={valid?tr('Relationships will appear after you make your first payment.','প্রথম পেমেন্টের পর সম্পর্কগুলো এখানে দেখা যাবে।'):readMessage}/>}
          </article>
          <article className={panel} aria-labelledby="taxpay-unified-top-title">
            <h3 id="taxpay-unified-top-title">{tr('Top beneficiaries','শীর্ষ উপকারভোগী')}</h3>
            {recipients.length?<ol className="taxpay-unified-ranked">
              {recipients.slice(0,5).map(([recipient,info],index)=><li key={recipient}>
                <div><span>{index+1}. {tr('Taxpayer Account ','করদাতা অ্যাকাউন্ট ')}{recipient.replace(/^user/,'')}</span>
                  <strong>{money(info.total,language)}</strong></div>
                <p>{paymentTagGroupLabels[info.tag][language]} · {info.count} {tr('payments','পেমেন্ট')}</p>
                <div className="taxpay-unified-progress"><span style={{width:recipients[0][1].total>0n?Number(info.total*100n/recipients[0][1].total)+'%':'0%'}}/></div>
              </li>)}
            </ol>:<EmptyIllustration icon="people"
              title={valid?tr('No beneficiaries to show','দেখানোর মতো উপকারভোগী নেই')
                :visible.phase==='loading'?tr('Loading recipients…','প্রাপকের তথ্য লোড হচ্ছে…')
                :tr('Payment recipients unavailable','পেমেন্টের প্রাপকের তথ্য পাওয়া যায়নি')}
              detail={valid?tr('Your highest-paid beneficiaries will appear here.','যাদের জন্য সবচেয়ে বেশি পরিশোধ করেছেন তাঁরা এখানে দেখানো হবে।'):readMessage}/>}
          </article>
        </div>
      </section>
      <div className="taxpay-bento-recent">
        <section className={panel} aria-labelledby="taxpayer-recent-activity-title">
          <div className="taxpay-unified-journey-header">
            <h2 id="taxpayer-recent-activity-title">{tr('My Tax Journey','আমার কর যাত্রা')}</h2>
            {rows.length>0&&<button type="button" className="taxpay-unified-text-link" onClick={()=>onNavigate('history')}>
              {tr('View all activity','সব কার্যক্রম দেখুন')} <ArrowRight size={15} aria-hidden="true"/>
            </button>}
          </div>
          {rows.length?<ol className="taxpay-unified-timeline">
            {rows.slice(0,5).map(row=><li key={row.id}>
              <div><strong>{tr('Recorded payment','নথিভুক্ত পেমেন্ট')}</strong>
                <p>{formatDate(row.date)}</p></div>
              <strong>{money(row.amountMinor,language)}</strong>
              <button type="button" className="taxpay-unified-text-link" onClick={()=>onNavigate('history')}>
                {tr('Details','বিস্তারিত')}
              </button>
            </li>)}
          </ol>:<EmptyIllustration icon="journey"
            title={valid?tr('Your tax journey is empty','আপনার কর যাত্রা ফাঁকা')
              :visible.phase==='loading'?tr('Loading your tax journey…','আপনার কর যাত্রা লোড হচ্ছে…')
              :tr('Payment activity unavailable','পেমেন্ট কার্যক্রম পাওয়া যায়নি')}
            detail={valid?tr('Completed payments will appear here in chronological order.','সম্পন্ন পেমেন্টগুলো এখানে তারিখ অনুযায়ী দেখা যাবে।'):readMessage}/>}
        </section>
      </div>
    </div>
    <section className="taxpay-unified-source-records" aria-label={tr('Account service records','অ্যাকাউন্ট সেবার রেকর্ড')}>
      <DemoServiceRecordsPanel userId={demoUserId} language={language}/>
    </section>
  </div>;
};
