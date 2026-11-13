import React, {useEffect, useState} from 'react';
import {ChevronDown, ChevronRight} from 'lucide-react';
import {UiButton} from '../ui/Controls';
import {TaxpayerTinLookup} from '../ui/TaxpayerTinLookup';
import {SAMPLE_TIN_SUGGESTIONS} from '../../data/sampleTinSuggestions';
import {lookupSampleTaxpayer} from '../../services/sampleTaxpayerLookup';
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
  allowOneTimeFallback?:boolean;
  fallbackSelection?:SelectedBeneficiary|null;
  onFallbackSelect?:(person:SelectedBeneficiary)=>void;
  onFallbackClear?:()=>void;
}

/** Saved contacts remain first; an explicit one-time sample lookup is available only when enabled by the payment flow. */
export function SavedBeneficiaryPicker({language,allowMultiple,selectedTins,onChoose,onAvailableTins,allowOneTimeFallback=false,fallbackSelection=null,onFallbackSelect,onFallbackClear}:SavedBeneficiaryPickerProps){
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
  const [fallbackOpen,setFallbackOpen]=useState(false);
  const [fallbackTin,setFallbackTin]=useState('');
  const [searchedFallbackTin,setSearchedFallbackTin]=useState('');
  const [fallbackResult,setFallbackResult]=useState<ReturnType<typeof lookupSampleTaxpayer>>(null);
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
  // Saved lists are immutable here; only the payment chooser prioritizes preselected TINs.
  const paymentOrder=(tin:string)=>{const index=uniqueSelected.indexOf(tin);return index<0?Number.MAX_SAFE_INTEGER:index;};
  const orderedLists=[...lists].sort((left,right)=>{
    const first=(listId:string)=>people.filter(person=>person.list_id===listId)
      .reduce((index,person)=>Math.min(index,paymentOrder(person.tin)),Number.MAX_SAFE_INTEGER);
    return first(left.id)-first(right.id);
  });
  const manage=()=>{setPaymentServiceChoiceOpen(false);navigate('beneficiaries');};
  const change=(person:Beneficiary)=>{
    const next=allowMultiple
      ? selectedTins.includes(person.tin)?selectedTins.filter(tin=>tin!==person.tin):[...selectedTins,person.tin]
      : [person.tin];
    const seen=new Set<string>();
    const selected=next.map(tin=>{
      const candidate=people.find(person=>person.tin===tin);
      if(candidate)return {tin:candidate.tin,name:beneficiaryNameForPrefill(candidate.display_name)};
      if(allowMultiple&&fallbackSelection?.tin===tin)return fallbackSelection;
      return null;
    }).filter((candidate):candidate is SelectedBeneficiary=>Boolean(candidate))
      .filter(candidate=>{if(seen.has(candidate.tin))return false;seen.add(candidate.tin);return true;});
    if(fallbackSelection&&!selected.some(person=>person.tin===fallbackSelection.tin))onFallbackClear?.();
    onChoose(selected);
  };
  const beginFallbackSearch=(prefill='')=>{
    setFallbackTin(prefill);setSearchedFallbackTin('');setFallbackResult(null);setFallbackOpen(true);
  };
  const runFallbackSearch=()=>{
    const match=/^\d{12}$/.test(fallbackTin)?lookupSampleTaxpayer(fallbackTin):null;
    setSearchedFallbackTin(fallbackTin);setFallbackResult(match);
  };
  const currentSavedSelection=()=>selectedTins.filter(tin=>tin!==fallbackSelection?.tin)
    .map(tin=>people.find(person=>person.tin===tin))
    .filter((person):person is Beneficiary=>Boolean(person))
    .map(person=>({tin:person.tin,name:beneficiaryNameForPrefill(person.display_name)}));
  const removeFallback=()=>{
    const remaining=currentSavedSelection();
    onFallbackClear?.();onChoose(remaining);
  };
  const changeFallback=()=>{
    const currentTin=fallbackSelection?.tin??'';
    removeFallback();beginFallbackSearch(currentTin);
  };
  const confirmFallback=()=>{
    if(!fallbackResult||fallbackResult.tin!==fallbackTin)return;
    onFallbackSelect?.({tin:fallbackResult.tin,name:bn?fallbackResult.nameBn:fallbackResult.nameEn});
    setFallbackOpen(false);setFallbackTin('');setSearchedFallbackTin('');setFallbackResult(null);
  };
  const selectedFallback=fallbackSelection&&selectedTins.includes(fallbackSelection.tin)&&
    !people.some(person=>person.tin===fallbackSelection.tin)?fallbackSelection:null;
  const pendingFallbackTin=selectedTins.find(tin=>/^\d{12}$/.test(tin)&&
    !people.some(person=>person.tin===tin)&&tin!==fallbackSelection?.tin)??null;
  const selectionCount=uniqueSelected.length+(selectedFallback?1:0);

  return <section className="col-span-full space-y-3" data-testid="saved-beneficiary-picker"
      aria-label={tr('Choose beneficiaries','উপকারভোগী নির্বাচন')}>
    {/* The parent PaymentFormSection owns the one heading and description. */}
    <div className="flex justify-end">
      <UiButton type="button" variant="outline" className="min-h-10 text-sm font-semibold" onClick={manage}>
        {tr('Manage beneficiaries','উপকারভোগী পরিচালনা')}
      </UiButton>
    </div>
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
      <p className="mt-1 text-sm text-slate-600">{allowOneTimeFallback?tr('Create a list for future payments, or search a TIN for this payment only.','ভবিষ্যৎ পেমেন্টের জন্য তালিকা তৈরি করুন, অথবা শুধু এই পেমেন্টের জন্য টিআইএন খুঁজুন।'):tr('Create a list and add beneficiaries before continuing with this payment.','পেমেন্টে এগোনোর আগে একটি তালিকা তৈরি করে উপকারভোগী যোগ করুন।')}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <UiButton type="button" variant="primary" className="min-h-11 text-sm font-semibold" onClick={manage}>
          {tr('Create your first list','প্রথম তালিকা তৈরি করুন')}
        </UiButton>
        {allowOneTimeFallback&&!fallbackSelection&&!fallbackOpen&&<UiButton type="button" variant="outline" className="min-h-11 text-sm font-semibold" data-testid="one-time-tin-fallback-open" onClick={()=>beginFallbackSearch()}>
          {tr('Look up a TIN once','একবারের জন্য টিআইএন খুঁজুন')}
        </UiButton>}
      </div>
    </div>}
    {!loading&&!checkingIdentity&&!error&&selectedFallback&&<div className="rounded-lg border border-taxpay-border bg-white p-3" data-testid="one-time-tin-selection">
        <p className="font-semibold text-taxpay-text">{tr('One-time taxpayer','একবারের জন্য নির্বাচিত করদাতা')}</p>
        <p className="mt-1 text-sm font-medium text-taxpay-text">{selectedFallback.name}</p>
        <p className="text-sm text-slate-600">{selectedFallback.tin}</p>
        <p className="mt-1 text-xs text-slate-600">{tr('Not saved to your beneficiary lists. This does not grant access to private records.','আপনার উপকারভোগীর তালিকায় সংরক্ষিত নয়। এতে ব্যক্তিগত রেকর্ড দেখার অনুমতি মেলে না।')}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <UiButton type="button" variant="outline" className="min-h-10 text-sm font-semibold" onClick={changeFallback}>{tr('Change taxpayer','করদাতা পরিবর্তন')}</UiButton>
          <UiButton type="button" variant="outline" className="min-h-10 text-sm font-semibold" onClick={removeFallback}>{tr('Remove from this payment','এই পেমেন্ট থেকে সরান')}</UiButton>
        </div>
      </div>}
    {!loading&&!checkingIdentity&&!error&&allowOneTimeFallback&&pendingFallbackTin&&!fallbackOpen&&<div className="rounded-lg border border-taxpay-border bg-white p-3" data-testid="one-time-tin-reconfirmation">
      <p className="text-sm text-taxpay-text">{tr('This payment TIN is not in your saved lists. Search and confirm it before continuing.','এই পেমেন্টের টিআইএনটি সংরক্ষিত তালিকায় নেই। এগোনোর আগে খুঁজে নিশ্চিত করুন।')}</p>
      <UiButton type="button" variant="outline" className="mt-2 min-h-10 text-sm font-semibold" onClick={()=>beginFallbackSearch(pendingFallbackTin)}>
        {tr('Search and confirm this TIN','এই টিআইএন খুঁজে নিশ্চিত করুন')}
      </UiButton>
    </div>}
    {!loading&&!checkingIdentity&&!error&&allowOneTimeFallback&&fallbackOpen&&<div className="space-y-3 rounded-lg border border-taxpay-border bg-white p-3" data-testid="one-time-tin-fallback">
      <h3 className="text-sm font-semibold text-taxpay-text">{tr('One-time TIN lookup','একবারের জন্য টিআইএন অনুসন্ধান')}</h3>
      <TaxpayerTinLookup language={language} tinId="payment-fallback-tin" nameId="payment-fallback-name"
        tin={fallbackTin} name={fallbackResult?.tin===fallbackTin?(bn?fallbackResult.nameBn:fallbackResult.nameEn):''}
        onTinChange={value=>{setFallbackTin(value);setSearchedFallbackTin('');setFallbackResult(null);}}
        onSearch={runFallbackSearch} onClear={()=>{setFallbackTin('');setSearchedFallbackTin('');setFallbackResult(null);}}
        canSearch={/^\d{12}$/.test(fallbackTin)} searchLabel={tr('Search TIN','টিআইএন খুঁজুন')}
        suggestedTins={SAMPLE_TIN_SUGGESTIONS} nameLabel={tr('Matching taxpayer name','মিলে যাওয়া করদাতার নাম')}
        tinPlaceholder={tr('Enter a 12-digit TIN','১২ সংখ্যার টিআইএন লিখুন')}
        status={searchedFallbackTin===fallbackTin&&searchedFallbackTin?
          fallbackResult?<p className="text-xs text-slate-600" role="status">{tr('A sample profile matches. Confirm it before using it for this payment.','একটি নমুনা প্রোফাইল মিলেছে। এই পেমেন্টে ব্যবহারের আগে নিশ্চিত করুন।')}</p>
            :<p className="text-xs text-red-700" role="alert">{tr('No sample profile found. Check the TIN and try again.','কোনো নমুনা প্রোফাইল পাওয়া যায়নি। টিআইএন যাচাই করে আবার চেষ্টা করুন।')}</p>:null}
        helper={<p className="text-xs text-slate-600">{tr('Suggestions and matches are sample profiles, not official NBR records. They do not prove identity or grant access to private history.','প্রস্তাবনা ও মিলগুলো নমুনা প্রোফাইল, NBR-এর সরকারি রেকর্ড নয়। এগুলো পরিচয় প্রমাণ করে না বা ব্যক্তিগত ইতিহাস দেখার অনুমতি দেয় না।')}</p>} />
      {fallbackResult?.tin===fallbackTin&&<UiButton type="button" variant="primary" className="min-h-11 text-sm font-semibold" onClick={confirmFallback}>
        {tr('Confirm this taxpayer','এই করদাতাকে নিশ্চিত করুন')}
      </UiButton>}
      <UiButton type="button" variant="outline" className="min-h-10 text-sm font-semibold" onClick={()=>setFallbackOpen(false)}>{tr('Cancel','বাতিল')}</UiButton>
    </div>}
    {!checkingIdentity&&!loading&&!error&&<p className="text-sm font-semibold text-taxpay-dark" role="status" aria-live="polite">
      {tr(String(selectionCount)+' selected for this payment',String(selectionCount)+' জন এই পেমেন্টের জন্য নির্বাচিত')}
    </p>}
    {!loading&&!checkingIdentity&&!error&&lists.length>0&&<>
      {people.length>0&&<div>
        <label htmlFor="payment-beneficiary-search" className="sr-only">{tr('Search beneficiaries','উপকারভোগী খুঁজুন')}</label>
        <input id="payment-beneficiary-search" type="search" value={search} onChange={e=>setSearch(e.target.value)}
          placeholder={tr('Search list, name or TIN','তালিকা, নাম বা টিআইএন দিয়ে খুঁজুন')}
          className="min-h-11 w-full rounded-lg border border-taxpay-border bg-white px-3 text-sm"/>
      </div>}
      {allowOneTimeFallback&&!fallbackSelection&&!fallbackOpen&&/^\d{12}$/.test(search.trim())&&!people.some(person=>person.tin===search.trim())&&
        <div className="rounded-lg border border-taxpay-border bg-white p-3" data-testid="one-time-tin-fallback-open-panel">
          <p className="text-sm text-taxpay-text">{tr('No saved beneficiary matches this TIN. You can look it up once for this payment.','এই টিআইএনটি সংরক্ষিত উপকারভোগীদের মধ্যে নেই। শুধু এই পেমেন্টের জন্য একবার খুঁজতে পারেন।')}</p>
          <UiButton type="button" variant="outline" className="mt-2 min-h-10 text-sm font-semibold" data-testid="one-time-tin-fallback-open" onClick={()=>beginFallbackSearch(search.trim())}>
            {tr('Search this TIN once','এই টিআইএন একবার খুঁজুন')}
          </UiButton>
        </div>}
      <div className="overflow-hidden rounded-lg border border-taxpay-border" data-testid="beneficiary-list-accordion">
        {orderedLists.map(list=>{
          const members=people.filter(person=>person.list_id===list.id)
            .sort((left,right)=>paymentOrder(left.tin)-paymentOrder(right.tin));
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
      {people.length===0&&<div className="space-y-2">
        <p className="text-sm text-slate-600">{tr('All lists are empty. Add a beneficiary from Manage beneficiaries.','সব তালিকা খালি। উপকারভোগী পরিচালনা থেকে সদস্য যোগ করুন।')}</p>
        {allowOneTimeFallback&&!fallbackSelection&&!fallbackOpen&&<UiButton type="button" variant="outline" className="min-h-10 text-sm font-semibold" data-testid="one-time-tin-fallback-open" onClick={()=>beginFallbackSearch()}>
          {tr('Look up a TIN once','একবারের জন্য টিআইএন খুঁজুন')}
        </UiButton>}
      </div>}
    </>}
  </section>;
}
