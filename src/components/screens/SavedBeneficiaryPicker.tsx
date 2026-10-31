import React, {useEffect,useState} from 'react';
import {useAccountIdentity} from '../../services/accountIdentity';
import {loadBeneficiaries,type Beneficiary,type BeneficiaryList} from '../../services/beneficiaries';
import {useTaxState} from '../../services/taxState';
import {beneficiaryNameForDisplay,beneficiaryNameForPrefill} from '../../services/beneficiaryNames';
import {UiButton} from '../ui/Controls';

/** Account-only list picker. A saved contact never establishes payment authorization. */
export function SavedBeneficiaryPicker({language,allowMultiple,onChoose}:{
  language:'en'|'bn';allowMultiple:boolean;onChoose:(people:{tin:string;name:string}[])=>void;
}){
  const {user,loading:checkingIdentity}=useAccountIdentity();
  const {navigate}=useTaxState();
  const bn=language==='bn';
  const tr=(en:string,bengali:string)=>bn?bengali:en;
  const [lists,setLists]=useState<BeneficiaryList[]>([]);
  const [people,setPeople]=useState<Beneficiary[]>([]);
  const [selected,setSelected]=useState<string[]>([]);
  const [expanded,setExpanded]=useState<string[]>([]);
  const [search,setSearch]=useState('');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{
    let cancelled=false;
    if(checkingIdentity)return()=>{cancelled=true;};
    setLoading(true);
    loadBeneficiaries(user?.id??null).then(result=>{
      if(!cancelled){setLists(result.lists);setPeople(result.people);setSelected([]);setError('');}
    }).catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:String(e));})
      .finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[user?.id,checkingIdentity]);
  const normalized=search.toLowerCase().trim();
  const matching=(person:Beneficiary,listName:string)=>
    !normalized||(beneficiaryNameForDisplay(person.display_name,tr('Name not provided','নাম দেওয়া হয়নি'))+' '+person.tin+' '+listName).toLowerCase().includes(normalized);
  const groups=lists.map(list=>({list,members:people.filter(p=>p.list_id===list.id&&matching(p,list.name))}))
    .filter(group=>group.members.length>0||(!normalized&&people.every(p=>p.list_id!==group.list.id)));
  const unlisted=people.filter(p=>!lists.some(list=>list.id===p.list_id)&&matching(p,''));
  const toggle=(id:string)=>setSelected(previous=>{
    if(!allowMultiple)return [id];
    return previous.includes(id)?previous.filter(item=>item!==id):[...previous,id];
  });
  const choose=()=>{
    const chosen=selected.map(key=>people.find(person=>person.id===key)).filter((person):person is Beneficiary=>!!person);
    const byTin=chosen.filter((person,index)=>chosen.findIndex(candidate=>candidate.tin===person.tin)===index);
    onChoose(byTin.map(person=>({tin:person.tin,name:beneficiaryNameForPrefill(person.display_name)})));
  };
  return <section aria-label={tr('Choose beneficiaries','উপকারভোগী নির্বাচন করুন')} className="col-span-full space-y-3" data-testid="saved-beneficiary-picker">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-taxpay-text">{tr('Choose beneficiaries','উপকারভোগী নির্বাচন করুন')}</h3>
      <button type="button" className="min-h-10 text-sm font-semibold text-taxpay-primary" onClick={()=>navigate('beneficiaries')}>
        {tr('Manage beneficiaries','উপকারভোগী পরিচালনা')}
      </button>
    </div>
    <p className="text-sm text-slate-600">{tr('Expand a list and choose the beneficiaries for this payment. Payment authorization will be checked separately.','তালিকা খুলে এই পেমেন্টের উপকারভোগীদের নির্বাচন করুন। পেমেন্টের অনুমোদন আলাদাভাবে যাচাই হবে।')}</p>
    {(loading||checkingIdentity)&&<p role="status" className="text-sm text-slate-600">{tr('Loading beneficiaries…','উপকারভোগী লোড হচ্ছে…')}</p>}
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    {!loading&&!checkingIdentity&&!error&&people.length>0&&<>
      <label className="sr-only" htmlFor="saved-beneficiary-search">{tr('Search beneficiaries','উপকারভোগী খুঁজুন')}</label>
      <input id="saved-beneficiary-search" type="search" className="min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        value={search} onChange={event=>setSearch(event.target.value)}
        placeholder={tr('Search name, TIN or list','নাম, টিআইএন বা তালিকা দিয়ে খুঁজুন')}/>
      <div className="overflow-hidden rounded-lg border border-slate-200" role="group" aria-label={tr('Beneficiary lists','উপকারভোগীর তালিকা')}>
        {[...groups,...(unlisted.length?[{list:{id:'unlisted',name:tr('Other beneficiaries','অন্যান্য উপকারভোগী')},members:unlisted}]:[])].map(({list,members})=>{
          const open=expanded.includes(list.id)||Boolean(normalized);
          return <div key={list.id} className="border-b border-slate-200 last:border-b-0">
            <button type="button" aria-expanded={open} aria-controls={`beneficiary-list-${list.id}`}
              className="flex min-h-11 w-full items-center justify-between gap-3 bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-taxpay-dark"
              onClick={()=>setExpanded(previous=>previous.includes(list.id)?previous.filter(key=>key!==list.id):[...previous,list.id])}>
              <span>{open?'▾':'▸'} {list.name}</span><span className="text-xs font-normal text-slate-600">{members.length}</span>
            </button>
            {open&&<div id={`beneficiary-list-${list.id}`} className="divide-y divide-slate-100">
              {members.map(person=><label key={person.id} className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50">
                <input type={allowMultiple?'checkbox':'radio'} name={allowMultiple?undefined:'single-beneficiary'}
                  checked={selected.includes(person.id)} onChange={()=>toggle(person.id)}/>
                <span className="min-w-0"><strong className="block text-taxpay-text">{beneficiaryNameForDisplay(person.display_name,tr('Name not provided','নাম দেওয়া হয়নি'))}</strong>
                  <span className="block font-mono text-xs text-slate-600">{tr('TIN','টিআইএন')}: {person.tin}</span></span>
              </label>)}
              {!members.length&&<p className="p-3 text-sm text-slate-600">{tr('This list is empty.','এই তালিকায় কেউ নেই।')}</p>}
            </div>}
          </div>;
        })}
        {!groups.length&&!unlisted.length&&<p className="p-3 text-sm text-slate-600">{tr('No matching beneficiaries.','কোনো মিল পাওয়া যায়নি।')}</p>}
      </div>
      <UiButton type="button" variant="outline" disabled={!selected.length} onClick={choose}>
        {tr(allowMultiple?'Use selected beneficiaries':'Use selected beneficiary',allowMultiple?'নির্বাচিত উপকারভোগীদের ব্যবহার করুন':'নির্বাচিত উপকারভোগী ব্যবহার করুন')}
      </UiButton>
    </>}
    {!loading&&!checkingIdentity&&!error&&!people.length&&<div className="rounded-lg border border-slate-200 p-4">
      <p className="text-sm font-semibold text-taxpay-text">{tr('No beneficiaries yet','এখনো কোনো উপকারভোগী নেই')}</p>
      <p className="mt-1 text-sm text-slate-600">{tr('Create a list and add beneficiaries before paying for someone else.','অন্যের পক্ষে কর দেওয়ার আগে একটি তালিকা তৈরি করে উপকারভোগী যোগ করুন।')}</p>
      <button type="button" className="mt-3 min-h-11 rounded-lg bg-taxpay-primary px-4 text-sm font-semibold text-white"
        onClick={()=>navigate('beneficiaries')}>{tr('Add beneficiary','উপকারভোগী যোগ করুন')}</button>
    </div>}
  </section>;
}
