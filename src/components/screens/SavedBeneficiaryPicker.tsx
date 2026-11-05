import React, {useEffect, useState} from 'react';
import {ChevronDown, ChevronRight} from 'lucide-react';
import {UiButton} from '../ui/Controls';
import {useAccountIdentity} from '../../services/accountIdentity';
import {loadBeneficiaries,recoverGuestBeneficiariesToProfile,recoverLegacyGuestBeneficiariesToPreview,type Beneficiary,type BeneficiaryList} from '../../services/beneficiaries';
import {hasStoredGuestBeneficiaries} from '../../services/guestBeneficiaries';
import {useTaxState} from '../../services/taxState';
import {beneficiaryNameForDisplay,beneficiaryNameForPrefill} from '../../services/beneficiaryNames';
import {beneficiaryTagLabel,beneficiaryFinalTagLabel} from '../../services/beneficiaryTags';

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
  const {navigate,previewAccount,setPaymentServiceChoiceOpen}=useTaxState();
  const bn=language==='bn';
  const tr=(en:string,bengali:string)=>bn?bengali:en;
  const [lists,setLists]=useState<BeneficiaryList[]>([]);
  const [people,setPeople]=useState<Beneficiary[]>([]);
  const [expanded,setExpanded]=useState<string[]>([]);
  const [search,setSearch]=useState('');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [refresh,setRefresh]=useState(0);
  const [restoring,setRestoring]=useState(false);
  const [recoveryDone,setRecoveryDone]=useState(false);
  const [restoreInfo,setRestoreInfo]=useState('');
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
      const detail=e instanceof Error?e.message:'';
      // User-ID preview accounts use capability-scoped browser storage, not
      // a verified Supabase Auth UID. Distinguish an unusable saved capability
      // from a transient request failure without revealing SQL internals.
      const lostCapability=!user && /session has expired|access key is invalid/.test(detail);
      const noStorage=!user && /storage is unavailable/.test(detail);
      setError(lostCapability
        ? tr('This browser’s saved-list access is unavailable. Do not clear site data; open Beneficiaries to review recovery.',
          'এই ব্রাউজারের সংরক্ষিত তালিকায় প্রবেশ করা যাচ্ছে না। সাইটের তথ্য মুছবেন না; উপকারভোগী পাতায় দেখুন।')
        : noStorage
          ? tr('Allow browser storage to access your saved lists, then retry.',
            'সংরক্ষিত তালিকা দেখতে ব্রাউজার স্টোরেজ চালু করে আবার চেষ্টা করুন।')
          : tr('Could not load your beneficiary lists. Please try again.',
            'আপনার উপকারভোগীর তালিকা লোড করা যায়নি। আবার চেষ্টা করুন।'));
      onAvailableTins(null);
    }).finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
    // The available TIN set is intentionally refreshed on account changes, not on each checkbox click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[user?.id,previewAccount?.id,checkingIdentity,refresh,onAvailableTins]);

  // A payment step can remain mounted while beneficiaries change in another
  // tab. Re-read the same identity-scoped source on return to the tab.
  useEffect(()=>{
    const refreshVisible=()=>{if(document.visibilityState!=='hidden')setRefresh(value=>value+1);};
    window.addEventListener('focus',refreshVisible);
    document.addEventListener('visibilitychange',refreshVisible);
    return()=>{window.removeEventListener('focus',refreshVisible);document.removeEventListener('visibilitychange',refreshVisible);};
  },[]);

  const restoreAvailable=Boolean((user?.id||previewAccount)&&hasStoredGuestBeneficiaries()&&!recoveryDone);
  async function restoreSavedLists(){
    if((!user?.id&&!previewAccount)||restoring)return;
    setRestoring(true);setRestoreInfo('');
    try {
      const recovered=user?.id?await recoverGuestBeneficiariesToProfile(user.id)
        :await recoverLegacyGuestBeneficiariesToPreview();
      setRecoveryDone(true);
      setRestoreInfo(recovered.people
        ? tr('Saved beneficiaries restored to your profile.','সংরক্ষিত উপকারভোগীরা আপনার প্রোফাইলে যুক্ত হয়েছে।')
        : tr('Your profile lists are up to date.','আপনার প্রোফাইলের তালিকা হালনাগাদ রয়েছে।'));
      setRefresh(previous=>previous+1);
    } catch {
      setRestoreInfo(tr('Could not restore saved lists. You can safely retry; the original lists are preserved.',
        'সংরক্ষিত তালিকা ফিরিয়ে আনা যায়নি। আবার চেষ্টা করতে পারেন; আগের তালিকা অক্ষত আছে।'));
    } finally {setRestoring(false);}
  }

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
      <UiButton type="button" variant="outline" className="min-h-10 text-sm font-semibold" onClick={manage}>
        {tr('Manage beneficiaries','উপকারভোগী পরিচালনা')}
      </UiButton>
    </div>
    <p className="text-sm text-slate-600">{tr(
      'Select saved beneficiaries from a list below. To add or edit a taxpayer, use Beneficiaries.',
      'নিচের তালিকা থেকে সংরক্ষিত উপকারভোগী নির্বাচন করুন। কাউকে যোগ বা সম্পাদনা করতে উপকারভোগী পাতায় যান।'
    )}</p>
    {(checkingIdentity||loading)&&<p role="status" className="text-sm text-slate-600">{tr('Loading beneficiary lists…','উপকারভোগীর তালিকা লোড হচ্ছে…')}</p>}
    {!checkingIdentity&&!loading&&!error&&restoreAvailable&&<UiButton type="button" variant="outline" className="min-h-10 text-sm font-semibold"
      disabled={restoring} onClick={restoreSavedLists}>{restoring?tr('Restoring…','ফিরিয়ে আনা হচ্ছে…'):tr('Restore saved lists','সংরক্ষিত তালিকা ফিরিয়ে আনুন')}</UiButton>}
    {restoreInfo&&<p role="status" className="text-sm text-slate-600" aria-live="polite">{restoreInfo}</p>}
    {error&&<div className="flex flex-wrap items-center gap-3" role="alert">
      <p className="text-sm text-red-700">{error}</p>
      <UiButton type="button" variant="outline" className="text-sm font-semibold" onClick={()=>setRefresh(v=>v+1)}>{tr('Retry','আবার চেষ্টা')}</UiButton>
    </div>}
    {!loading&&!checkingIdentity&&!error&&lists.length===0&&<div className="rounded-lg border border-dashed border-taxpay-border p-4">
      <p className="font-semibold text-taxpay-text">{tr('No beneficiary lists yet','এখনও কোনো উপকারভোগীর তালিকা নেই')}</p>
      <p className="mt-1 text-sm text-slate-600">{tr('Create a list and add beneficiaries before continuing with this payment.','পেমেন্টে এগোনোর আগে একটি তালিকা তৈরি করে উপকারভোগী যোগ করুন।')}</p>
      <UiButton type="button" variant="primary" className="mt-3 min-h-11 text-sm font-semibold" onClick={manage}>
        {tr('Create your first list','প্রথম তালিকা তৈরি করুন')}
      </UiButton>
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
            ? members.filter(person=>(names(person)+' '+person.tin+' '+beneficiaryTagLabel(person.tag,person.relationship,language,person.other_label)).toLocaleLowerCase().includes(normalized))
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
                filtered.map(person=>{
                  const finalTag=beneficiaryFinalTagLabel(person.tag,person.relationship,language,person.other_label);
                  return <label key={person.id} className="flex min-h-14 cursor-pointer items-center gap-3 bg-white px-3 py-2 hover:bg-taxpay-light">
                    <input type={allowMultiple?'checkbox':'radio'} name={allowMultiple?undefined:'payment-beneficiary'} className="h-4 w-4 shrink-0 accent-taxpay-primary"
                      checked={selectedTins.includes(person.tin)} onChange={()=>change(person)}
                      aria-label={tr('Select '+names(person),'নির্বাচন করুন '+names(person))}/>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-sm font-semibold text-taxpay-text">
                        {names(person)}{finalTag&&<span className="font-normal text-taxpay-muted"> · {finalTag}</span>}
                      </span>
                      <span className="block break-all text-xs text-slate-600">{person.tin}</span>
                    </span>
                  </label>})}
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
