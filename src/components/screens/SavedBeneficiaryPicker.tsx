import React, {useEffect, useState} from 'react';
import {ChevronDown, ChevronRight} from 'lucide-react';
import {useAccountIdentity} from '../../services/accountIdentity';
import {loadBeneficiaries,type Beneficiary,type BeneficiaryList} from '../../services/beneficiaries';
import {useTaxState} from '../../services/taxState';
import {beneficiaryNameForDisplay,beneficiaryNameForPrefill} from '../../services/beneficiaryNames';

interface SelectedBeneficiary {tin:string;name:string}
interface SavedBeneficiaryPickerProps {
  language:'en'|'bn';
  allowMultiple:boolean;
  selectedTins:string[];
  onChoose:(people:SelectedBeneficiary[])=>void;
  onAvailableTins:(tins:string[] | null)=>void;
}

/** Signed-in Step 1 uses the existing private beneficiary lists, never free-form taxpayer entry. */
export function SavedBeneficiaryPicker({language,allowMultiple,selectedTins,onChoose,onAvailableTins}:SavedBeneficiaryPickerProps){
  const {user,loading:checkingIdentity}=useAccountIdentity();
  const {navigate,setPaymentServiceChoiceOpen}=useTaxState();
  const bn=language==='bn';
  const tr=(en:string,bengali:string)=>bn?bengali:en;
  const [lists,setLists]=useState<BeneficiaryList[]>([]);
  const [people,setPeople]=useState<Beneficiary[]>([]);
  const [expanded,setExpanded]=useState<string[]>([]);
  const [search,setSearch]=useState('');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{
    let cancelled=false;
    setLists([]);setPeople([]);setExpanded([]);setLoading(true);setError('');
    onAvailableTins(null);
    if(checkingIdentity)return()=>{cancelled=true;};
    loadBeneficiaries(user?.id??null).then(result=>{
      if(cancelled)return;
      setLists(result.lists);setPeople(result.people);
      const containingSelection=result.lists.filter(list=>result.people.some(person=>
        person.list_id===list.id&&selectedTins.includes(person.tin))).map(list=>list.id);
      setExpanded(containingSelection.length?containingSelection:result.lists[0]?[result.lists[0].id]:[]);
      onAvailableTins(Array.from(new Set(result.people.map(person=>person.tin))));
    }).catch(e=>{
      if(cancelled)return;
      setError(e instanceof Error?e.message:String(e));
      onAvailableTins(null);
    }).finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
    // The available TIN set is intentionally refreshed on account changes, not on each checkbox click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[user?.id,checkingIdentity,refresh,onAvailableTins]);

  const normalized=search.trim().toLocaleLowerCase();
  const names=(person:Beneficiary)=>beneficiaryNameForDisplay(person.display_name,tr('Name not provided','নাম দেওয়া হয়নি'));
  const uniqueSelected=Array.from(new Set(selectedTins.filter(tin=>people.some(person=>person.tin===tin))));
  const manage=()=>{setPaymentServiceChoiceOpen(false);navigate('beneficiaries');};
  const change=(person:Beneficiary)=>{
    const next=allowMultiple
      ? selectedTins.includes(person.tin)?selectedTins.filter(tin=>tin!==person.tin):[...selectedTins,person.tin]
      : [person.tin];
    const seen=new Set<string>();
    const selected=next.map(tin=>people.find(candidate=>candidate.tin===tin))
      .filter((candidate):candidate is Beneficiary=>Boolean(candidate))
      .filter(candidate=>{if(seen.has(candidate.tin))return false;seen.add(candidate.tin);return true;})
      .map(candidate=>({tin:candidate.tin,name:beneficiaryNameForPrefill(candidate.display_name)}));
    onChoose(selected);
  };

  return <section className="col-span-full space-y-3" data-testid="saved-beneficiary-picker"
      aria-label={tr('Choose beneficiaries','উপকারভোগী নির্বাচন')}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-taxpay-text">{tr('Choose beneficiaries','উপকারভোগী নির্বাচন')}</h3>
      <button type="button" className="min-h-10 text-sm font-semibold text-taxpay-primary" onClick={manage}>
        {tr('Manage beneficiaries','উপকারভোগী পরিচালনা')}
      </button>
    </div>
    <p className="text-sm text-slate-600">{tr(
      'Select saved beneficiaries from a list below. To add or edit a taxpayer, use Beneficiaries.',
      'নিচের তালিকা থেকে সংরক্ষিত উপকারভোগী নির্বাচন করুন। কাউকে যোগ বা সম্পাদনা করতে উপকারভোগী পাতায় যান।'
    )}</p>
    {(checkingIdentity||loading)&&<p role="status" className="text-sm text-slate-600">{tr('Loading beneficiary lists…','উপকারভোগীর তালিকা লোড হচ্ছে…')}</p>}
    {error&&<div className="flex flex-wrap items-center gap-3" role="alert">
      <p className="text-sm text-red-700">{error}</p>
      <button type="button" className="text-sm font-semibold text-taxpay-primary" onClick={()=>setRefresh(v=>v+1)}>{tr('Retry','আবার চেষ্টা')}</button>
    </div>}
    {!loading&&!checkingIdentity&&!error&&lists.length===0&&<div className="rounded-lg border border-dashed border-taxpay-border p-4">
      <p className="font-semibold text-taxpay-text">{tr('No beneficiary lists yet','এখনও কোনো উপকারভোগীর তালিকা নেই')}</p>
      <p className="mt-1 text-sm text-slate-600">{tr('Create a list and add beneficiaries before continuing with this payment.','পেমেন্টে এগোনোর আগে একটি তালিকা তৈরি করে উপকারভোগী যোগ করুন।')}</p>
      <button type="button" className="mt-3 min-h-11 rounded-lg bg-taxpay-primary px-4 text-sm font-semibold text-white" onClick={manage}>
        {tr('Create your first list','প্রথম তালিকা তৈরি করুন')}
      </button>
    </div>}
    {!loading&&!checkingIdentity&&!error&&lists.length>0&&<>
      {people.length>0&&<div>
        <label htmlFor="payment-beneficiary-search" className="sr-only">{tr('Search beneficiaries','উপকারভোগী খুঁজুন')}</label>
        <input id="payment-beneficiary-search" type="search" value={search} onChange={e=>setSearch(e.target.value)}
          placeholder={tr('Search list, name or TIN','তালিকা, নাম বা টিআইএন দিয়ে খুঁজুন')}
          className="min-h-11 w-full rounded-lg border border-taxpay-border bg-white px-3 text-sm"/>
      </div>}
      <div className="overflow-hidden rounded-lg border border-taxpay-border" data-testid="beneficiary-list-accordion">
        {lists.map(list=>{
          const members=people.filter(person=>person.list_id===list.id);
          const matchesList=list.name.toLocaleLowerCase().includes(normalized);
          const filtered=normalized&&!matchesList
            ? members.filter(person=>(names(person)+' '+person.tin).toLocaleLowerCase().includes(normalized))
            : members;
          if(normalized&&!matchesList&&!filtered.length)return null;
          const isExpanded=expanded.includes(list.id)||Boolean(normalized);
          const count=Array.from(new Set(members.filter(person=>selectedTins.includes(person.tin)).map(person=>person.tin))).length;
          return <div key={list.id} className="border-b border-taxpay-border last:border-b-0">
            <button type="button" className="flex min-h-12 w-full items-center justify-between gap-3 bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-taxpay-dark hover:bg-taxpay-light"
              aria-expanded={isExpanded} aria-controls={'payment-beneficiary-list-'+list.id}
              onClick={()=>{if(!normalized)setExpanded(old=>old.includes(list.id)?old.filter(id=>id!==list.id):[...old,list.id]);}}>
              <span className="flex min-w-0 items-center gap-2">
                {isExpanded?<ChevronDown size={16} aria-hidden="true"/>:<ChevronRight size={16} aria-hidden="true"/>}
                <span className="break-words">{list.name}</span>
              </span>
              <span className="shrink-0 text-xs font-normal text-slate-600">
                {count>0?tr(String(count)+' selected',String(count)+' জন নির্বাচিত')+' · ':''}
                {members.length}
              </span>
            </button>
            {isExpanded&&<div id={'payment-beneficiary-list-'+list.id} className="divide-y divide-taxpay-border">
              {filtered.length===0?<p className="p-3 text-sm text-slate-600">{tr('This list is empty. Add beneficiaries from Manage beneficiaries.','এই তালিকা খালি। উপকারভোগী পরিচালনা থেকে সদস্য যোগ করুন।')}</p>:
                filtered.map(person=><label key={person.id} className="flex min-h-14 cursor-pointer items-center gap-3 bg-white px-3 py-2 hover:bg-taxpay-light">
                  <input type={allowMultiple?'checkbox':'radio'} name={allowMultiple?undefined:'payment-beneficiary'} className="h-4 w-4 shrink-0 accent-taxpay-primary"
                    checked={selectedTins.includes(person.tin)} onChange={()=>change(person)}
                    aria-label={tr('Select '+names(person),'নির্বাচন করুন '+names(person))}/>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-semibold text-taxpay-text">{names(person)}</span>
                    <span className="block break-all text-xs text-slate-600">{tr('TIN','টিআইএন')}: {person.tin}</span>
                  </span>
                </label>)}
            </div>}
          </div>;
        })}
      </div>
      {people.length===0&&<p className="text-sm text-slate-600">{tr('All lists are empty. Add a beneficiary from Manage beneficiaries.','সব তালিকা খালি। উপকারভোগী পরিচালনা থেকে সদস্য যোগ করুন।')}</p>}
      <p className="text-sm font-semibold text-taxpay-dark" role="status" aria-live="polite">
        {tr(String(uniqueSelected.length)+' selected for this payment',String(uniqueSelected.length)+' জন এই পেমেন্টের জন্য নির্বাচিত')}
      </p>
    </>}
  </section>;
}
