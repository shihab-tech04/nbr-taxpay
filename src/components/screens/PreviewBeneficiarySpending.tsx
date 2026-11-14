import React,{useEffect,useState} from 'react';
import type {SimulationTransaction,SimulationUser} from '../../contracts/paymentSimulationContract';
import {getDemoStoryPaymentHistory,formatSimulatedAmount} from '../../services/simulatedPaymentsApi';
import {loadBeneficiaries,type Beneficiary} from '../../services/beneficiaries';
import {sampleTinForUserNumber} from '../../data/sampleTinSuggestions';
import {PAYMENT_TAG_GROUPS,paymentTagGroupForTin,paymentTagGroupLabels,type PaymentTagGroup} from '../../services/beneficiaryPaymentTags';

type Props={profileId:SimulationUser;language:'en'|'bn'};
type Snapshot={profileId:SimulationUser|null;state:'loading'|'ready'|'error';people:Beneficiary[];payments:SimulationTransaction[]};

/** Preview-account payer amounts only. Uses its own capability, not a public user-id-only RPC. */
export const PreviewBeneficiarySpending:React.FC<Props>=({profileId,language})=>{
  const [snapshot,setSnapshot]=useState<Snapshot>({profileId:null,state:'loading',people:[],payments:[]});
  const tr=(en:string,bn:string)=>language==='bn'?bn:en;
  useEffect(()=>{
    let active=true;
    setSnapshot({profileId,state:'loading',people:[],payments:[]});
    Promise.all([loadBeneficiaries(null),getDemoStoryPaymentHistory(profileId,'payer')]).then(([data,payments])=>{
      if(payments.some(payment=>payment.payer!==profileId||payment.simulationOnly!==true))
        throw Error('Payment history owner mismatch');
      if(active)setSnapshot({profileId,state:'ready',people:data.people,payments});
    }).catch(()=>{
      if(active)setSnapshot({profileId,state:'error',people:[],payments:[]});
    });
    return()=>{active=false;};
  },[profileId]);
  const valid=snapshot.profileId===profileId&&snapshot.state==='ready';
  const amounts=new Map<PaymentTagGroup,bigint>(PAYMENT_TAG_GROUPS.map(group=>[group,0n]));
  if(valid){
    for(const payment of snapshot.payments){
      if(payment.state!=='SIMULATED')continue;
      for(const allocation of payment.allocations){
        const match=/^user(\d+)$/.exec(allocation.beneficiary);
        const tin=match?sampleTinForUserNumber(Number(match[1])):null;
        if(!Number.isSafeInteger(allocation.amountMinor)||allocation.amountMinor<=0)continue;
        const group=paymentTagGroupForTin(tin??undefined,snapshot.people);
        amounts.set(group,(amounts.get(group)??0n)+BigInt(allocation.amountMinor));
      }
    }
  }
  const total=[...amounts.values()].reduce((sum,value)=>sum+value,0n);
  const display=(n:bigint)=>formatSimulatedAmount(Number(n));
  return <section className="rounded-2xl border border-taxpay-border bg-taxpay-surface p-4 shadow-sm sm:p-5"
    data-testid="preview-beneficiary-spending">
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-taxpay-text">{tr('Payments by beneficiary tag','উপকারভোগীর ট্যাগ অনুযায়ী পেমেন্ট')}</h2>
        <p className="mt-1 text-xs text-taxpay-muted">{tr('Recorded profile payments across assessment years; failed, pending and reversed excluded.','সব করবর্ষের নথিভুক্ত প্রোফাইল পেমেন্ট; ব্যর্থ, অপেক্ষমাণ ও ফেরত লেনদেন বাদ।')}</p>
      </div>
      <p className="text-lg font-semibold text-taxpay-text tabular-nums" data-testid="preview-tag-spending-total">{valid?display(total):'—'}</p>
    </div>
    {snapshot.state==='loading'&&<p role="status" className="mt-3 text-sm text-taxpay-muted">{tr('Loading your saved payment categories…','সংরক্ষিত পেমেন্টের শ্রেণি লোড হচ্ছে…')}</p>}
    {snapshot.state==='error'&&<p role="alert" className="mt-3 text-sm text-taxpay-muted">{tr('Payment categories are temporarily unavailable.','পেমেন্টের শ্রেণিগুলো সাময়িকভাবে পাওয়া যাচ্ছে না।')}</p>}
    {valid&&<div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {PAYMENT_TAG_GROUPS.map(group=><div key={group} data-testid={'preview-tag-spend-'+group}
        className="rounded-lg border border-taxpay-border bg-white px-3 py-3">
        <p className="text-xs text-taxpay-muted">{paymentTagGroupLabels[group][language]}</p>
        <p className="mt-1 font-semibold text-taxpay-text tabular-nums">{display(amounts.get(group)??0n)}</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-taxpay-light">
          <div className="h-full rounded-full bg-taxpay-primary" style={{width:(total>0n?Number((amounts.get(group)??0n)*100n/total):0)+'%'}}/>
        </div>
      </div>)}
    </div>}
  </section>;
};
