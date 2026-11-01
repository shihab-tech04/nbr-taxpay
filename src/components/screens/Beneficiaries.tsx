import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Check, ChevronDown, ChevronRight, CreditCard, Download, FileSpreadsheet, Pencil, Plus, Search, Trash2, UserPlus, UsersRound} from 'lucide-react';
import {useAccountIdentity} from '../../services/accountIdentity';
import {useTaxState} from '../../services/taxState';
import {TaxPayModal} from '../ui/TaxPayModal';
import {TaxpayerTinLookup} from '../ui/TaxpayerTinLookup';
import {lookupSampleTaxpayer} from '../../services/sampleTaxpayerLookup';
import {UiButton,UiInput,UiSelect} from '../ui/Controls';
import {addBeneficiaries,createBeneficiaryList,recoverGuestBeneficiariesToProfile,renameBeneficiaryList,deleteBeneficiaryList,loadBeneficiaries,removeBeneficiary,moveBeneficiary,type Beneficiary,type BeneficiaryList} from '../../services/beneficiaries';
import {beneficiaryTemplate,parseBeneficiaryWorkbook,type SpreadsheetRecord} from '../../services/beneficiaryExcel';
import {beneficiaryNameForDisplay,beneficiaryNameForPrefill} from '../../services/beneficiaryNames';
import {hasStoredGuestBeneficiaries} from '../../services/guestBeneficiaries';

type Flow='single'|'bulk';
type Phase='upload'|'preview'|'confirm';
interface ImportRow extends SpreadsheetRecord {selected:boolean}
interface ReviewedRow extends ImportRow {error:string}

export function Beneficiaries(){
  const {language,setPaymentBeneficiaryPrefill,setPaymentServiceChoiceOpen}=useTaxState();
  const {user,loading:checkingIdentity}=useAccountIdentity();
  const bn=language==='bn';
  const tr=(en:string,bengali:string)=>bn?bengali:en;
  const displayName=(person:Pick<Beneficiary,'display_name'>)=>beneficiaryNameForDisplay(person.display_name,tr('Name not provided','নাম দেওয়া হয়নি'));
  const [lists,setLists]=useState<BeneficiaryList[]>([]);
  const [people,setPeople]=useState<Beneficiary[]>([]);
  const [activeList,setActiveList]=useState('');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState<{en:string;bn:string}|null>(null);
  const [flow,setFlow]=useState<Flow|null>(null);
  const [entryChoiceOpen,setEntryChoiceOpen]=useState(false);
  const [createListOpen,setCreateListOpen]=useState(false);
  const [phase,setPhase]=useState<Phase>('upload');
  const [targetList,setTargetList]=useState('new');
  const [listName,setListName]=useState('');
  const [tin,setTin]=useState('');
  const [name,setName]=useState('');
  const [searchedBeneficiaryTin,setSearchedBeneficiaryTin]=useState<string|null>(null);
  const [filename,setFilename]=useState('');
  const [rows,setRows]=useState<ImportRow[]>([]);
  const [busy,setBusy]=useState(false);
  const [restoring,setRestoring]=useState(false);
  const [guestRecoveryDone,setGuestRecoveryDone]=useState(false);
  const [modalError,setModalError]=useState('');
  const [search,setSearch]=useState('');
  const [selectedIds,setSelectedIds]=useState<string[]>([]);
  const [editPerson,setEditPerson]=useState<Beneficiary|null>(null);
  const [editTargetList,setEditTargetList]=useState('');
  const [deletePerson,setDeletePerson]=useState<Beneficiary|null>(null);
  const [listMenuOpen,setListMenuOpen]=useState(false);
  const [editingList,setEditingList]=useState<BeneficiaryList|null>(null);
  const [editingListName,setEditingListName]=useState('');
  const [confirmListDelete,setConfirmListDelete]=useState(false);
  const listMenuRef=useRef<HTMLDivElement>(null);
  const listTriggerRef=useRef<HTMLButtonElement>(null);
  const fileRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    if(!listMenuOpen)return;
    const closeOutside=(event:PointerEvent)=>{if(!listMenuRef.current?.contains(event.target as Node))setListMenuOpen(false);};
    const closeEscape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setListMenuOpen(false);listTriggerRef.current?.focus();}};
    document.addEventListener('pointerdown',closeOutside);
    document.addEventListener('keydown',closeEscape);
    return()=>{document.removeEventListener('pointerdown',closeOutside);document.removeEventListener('keydown',closeEscape);};
  },[listMenuOpen]);
  const owner=user?.id??null;
  const reload=async(preferredList?:string)=>{
    const data=await loadBeneficiaries(owner);
    setLists(data.lists);setPeople(data.people);
    setActiveList(current=>preferredList&&data.lists.some(list=>list.id===preferredList)
      ?preferredList:data.lists.some(list=>list.id===current)?current:(data.lists[0]?.id??''));
    setSelectedIds([]);
    return data;
  };

  useEffect(()=>{
    let cancelled=false;
    if(checkingIdentity)return()=>{cancelled=true;};
    setLists([]);setPeople([]);setActiveList('');setSelectedIds([]);setLoading(true);setError('');
    loadBeneficiaries(owner).then(data=>{
      if(cancelled)return;
      setLists(data.lists);setPeople(data.people);
      setActiveList(data.lists[0]?.id??'');
    }).catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:String(e));})
      .finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[owner,checkingIdentity]);

  const listPeople=people.filter(person=>person.list_id===activeList);
  const filteredPeople=listPeople.filter(person=>(displayName(person)+' '+person.tin).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const selectedPeople=listPeople.filter(person=>selectedIds.includes(person.id));
  const activeListRecord=lists.find(list=>list.id===activeList);
  const existingTins=new Set(people.filter(person=>person.list_id===targetList).map(person=>person.tin));
  const reviewed=useMemo<ReviewedRow[]>(()=>{
    const seen=new Set<string>();
    return rows.map(row=>{
      let reason='';
      if(!/^\d{12}$/.test(row.tin))reason=tr('TIN must contain 12 digits.','টিআইএন ১২ সংখ্যার হতে হবে।');
      else if(row.name.length>160)reason=tr('Name must be 160 characters or fewer.','নাম ১৬০ অক্ষরের বেশি হতে পারবে না।');
      else if(existingTins.has(row.tin))reason=tr('Already saved in this list.','এই তালিকায় ইতিমধ্যে আছে।');
      else if(seen.has(row.tin))reason=tr('Duplicate TIN in this upload.','আপলোডে একই টিআইএন একাধিকবার আছে।');
      seen.add(row.tin);
      return {...row,error:reason};
    });
  },[rows,people,targetList,language]);
  const valid=reviewed.filter(row=>!row.error);
  const chosen=valid.filter(row=>row.selected);
  const allFilteredSelected=filteredPeople.length>0&&filteredPeople.every(person=>selectedIds.includes(person.id));

  function switchList(id:string){
    setActiveList(id);setSelectedIds([]);setSearch('');setListMenuOpen(false);
    listTriggerRef.current?.focus();
  }
  function openListEditor(list:BeneficiaryList){
    setListMenuOpen(false);setEditingList(list);setEditingListName(list.name);setConfirmListDelete(false);setModalError('');
  }
  async function saveListEdit(event:React.FormEvent){
    event.preventDefault();
    if(!editingList)return;
    const normalized=editingListName.trim();
    if(!normalized||normalized.length>80){setModalError(tr('Enter a list name of up to 80 characters.','সর্বোচ্চ ৮০ অক্ষরের একটি তালিকার নাম লিখুন।'));return;}
    if(normalized===editingList.name){setEditingList(null);return;}
    setBusy(true);setModalError('');
    try{
      await renameBeneficiaryList(owner,editingList.id,normalized);
      await reload(editingList.id);setEditingList(null);
      setNotice({en:'List name updated.',bn:'তালিকার নাম পরিবর্তন হয়েছে।'});
    }catch(e){
      const message=e instanceof Error?e.message:String(e);
      setModalError(message.includes('name already exists')?tr('A list with this name already exists.','এই নামে একটি তালিকা ইতিমধ্যে আছে।'):message);
    }
    finally{setBusy(false);}
  }
  async function removeList(){
    if(!editingList)return;
    const toDelete=editingList.id;
    setBusy(true);setModalError('');
    try{
      await deleteBeneficiaryList(owner,toDelete);
      await reload();setEditingList(null);setConfirmListDelete(false);setSearch('');
      setNotice({en:'Beneficiary list deleted.',bn:'উপকারভোগীর তালিকা মুছে ফেলা হয়েছে।'});
    }catch(e){setModalError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }
  function open(next:Flow){
    setEntryChoiceOpen(false);setFlow(next);setCreateListOpen(false);setPhase('upload');setTargetList(activeList||'new');setListName('');
    setTin('');setName('');setSearchedBeneficiaryTin(null);setRows([]);setFilename('');setModalError('');setNotice(null);
  }
  function closeFlow(){if(!busy){setFlow(null);setModalError('');}}

  async function saveList(event:React.FormEvent){
    event.preventDefault();
    if(!listName.trim()||listName.trim().length>80){setModalError(tr('Enter a list name of up to 80 characters.','সর্বোচ্চ ৮০ অক্ষরের একটি তালিকার নাম লিখুন।'));return;}
    setBusy(true);setModalError('');
    try{
      const list=await createBeneficiaryList(owner,listName);
      setLists(current=>current.some(value=>value.id===list.id)?current:[...current,list]);
      setActiveList(list.id);setSelectedIds([]);setCreateListOpen(false);setListName('');
      setNotice({en:'List created.',bn:'তালিকা তৈরি হয়েছে।'});
    }catch(e){setModalError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }

  async function resolveList(){
    if(targetList!=='new'){
      const list=lists.find(value=>value.id===targetList);
      if(!list)throw new Error(tr('Choose a valid list.','সঠিক তালিকা নির্বাচন করুন।'));
      return list.id;
    }
    if(!listName.trim())throw new Error(tr('Enter a list name.','তালিকার নাম লিখুন।'));
    const list=await createBeneficiaryList(owner,listName);
    setLists(current=>current.some(value=>value.id===list.id)?current:[...current,list]);
    setActiveList(list.id);setSelectedIds([]);setTargetList(list.id);setListName('');
    return list.id;
  }

  async function saveSingle(event:React.FormEvent){
    event.preventDefault();
    if(!/^\d{12}$/.test(tin)||name.trim().length>160){
      setModalError(tr('Enter a valid 12-digit TIN and a name of up to 160 characters.','সঠিক ১২ সংখ্যার টিআইএন এবং সর্বোচ্চ ১৬০ অক্ষরের নাম লিখুন।'));return;
    }
    setBusy(true);setModalError('');
    try{
      const id=await resolveList();
      const count=await addBeneficiaries(owner,id,[{tin,display_name:name.trim()}]);
      await reload(id);setFlow(null);
      setNotice(count?{en:'Beneficiary saved.',bn:'উপকারভোগী সংরক্ষিত হয়েছে।'}:{en:'This beneficiary is already in the list.',bn:'এই উপকারভোগী তালিকায় আগে থেকেই আছেন।'});
    }catch(e){setModalError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }

  async function receive(file?:File){
    if(!file)return;
    setModalError('');setFilename('');setRows([]);setBusy(true);
    try{
      const imported=await parseBeneficiaryWorkbook(file);
      if(!imported.length)throw new Error(tr('The Excel file contains no beneficiaries.','এক্সেল ফাইলে কোনো উপকারভোগী নেই।'));
      setRows(imported.map(row=>({...row,selected:true})));setFilename(file.name);
    }catch(e){setModalError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }

  async function finishImport(){
    if(!chosen.length)return;
    setBusy(true);setModalError('');
    try{
      const id=await resolveList();
      const count=await addBeneficiaries(owner,id,chosen.map(row=>({tin:row.tin,display_name:row.name.trim()})));
      await reload(id);setFlow(null);
      setNotice(count?{en:`${count} beneficiaries added to the list.`,bn:`${count} জন উপকারভোগী তালিকায় যুক্ত হয়েছেন।`}:{en:'No new beneficiaries were added.',bn:'নতুন কোনো উপকারভোগী যোগ হয়নি।'});
    }catch(e){setModalError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }

  async function saveEdit(event:React.FormEvent){
    event.preventDefault();
    if(!editPerson)return;
    if(!editTargetList||editTargetList===editPerson.list_id||!lists.some(list=>list.id===editTargetList)){
      setModalError(tr('Choose another saved list.','অন্য একটি সংরক্ষিত তালিকা বাছুন।'));return;
    }
    setBusy(true);setModalError('');
    try{
      await moveBeneficiary(owner,editPerson.id,editPerson.list_id,editTargetList);
      await reload(editTargetList);setEditPerson(null);setEditTargetList('');
      setNotice({en:'Beneficiary moved to the selected list.',bn:'উপকারভোগী নির্বাচিত তালিকায় স্থানান্তরিত হয়েছেন।'});
    }catch(e){setModalError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }

  async function confirmRemove(){
    if(!deletePerson)return;
    setBusy(true);setError('');
    try{
      await removeBeneficiary(owner,deletePerson.id);await reload();setDeletePerson(null);
      setNotice({en:'Beneficiary removed.',bn:'উপকারভোগী সরানো হয়েছে।'});
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }

  function payWith(peopleToPrefill:Beneficiary[]){
    if(!peopleToPrefill.length)return;
    const [first,...additional]=peopleToPrefill;
    setPaymentBeneficiaryPrefill({tin:first.tin,name:beneficiaryNameForPrefill(first.display_name),additional:additional.map(person=>({tin:person.tin,name:beneficiaryNameForPrefill(person.display_name)}))});
    setPaymentServiceChoiceOpen(true);
  }

  const template=()=>{
    const link=document.createElement('a'),url=URL.createObjectURL(beneficiaryTemplate());
    link.href=url;link.download='Korbritto_Beneficiaries_Template.xlsx';document.body.append(link);link.click();link.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const restoreFromThisBrowser=async()=>{
    if(!owner||restoring)return;
    setRestoring(true);setError('');
    try {
      const result=await recoverGuestBeneficiariesToProfile(owner);
      await reload();
      setGuestRecoveryDone(true);
      setNotice({en:result.people?`Restored ${result.people} beneficiaries to your profile.`:'Your saved beneficiaries are already available in your profile.',bn:result.people?`আপনার প্রোফাইলে ${result.people} জন উপকারভোগী ফিরিয়ে আনা হয়েছে।`:'সংরক্ষিত উপকারভোগীরা ইতিমধ্যে আপনার প্রোফাইলে আছেন।'});
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setRestoring(false);}
  };
  const reloadData=async()=>{
    setLoading(true);setError('');
    try{await reload();}catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setLoading(false);}
  };

  return <section className="mx-auto w-full max-w-7xl space-y-5" lang={language} data-testid="beneficiaries-page" aria-labelledby="beneficiaries-title">
    <header className="flex flex-col gap-4 rounded-xl border border-taxpay-border bg-taxpay-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="min-w-0">
        <h1 id="beneficiaries-title" className="text-2xl font-bold tracking-tight text-taxpay-text sm:text-3xl">{tr('Beneficiaries','উপকারভোগী')}</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">{tr('Organize saved taxpayers and continue to payment when you are ready.','সংরক্ষিত করদাতাদের সাজান এবং প্রস্তুত হলে পেমেন্টে এগিয়ে যান।')}</p>
      </div>
      <div className="grid w-full grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:w-auto sm:flex sm:flex-wrap sm:justify-end">
        <UiButton className="w-full gap-2 sm:w-auto" type="button" variant="outline" disabled={checkingIdentity||loading} onClick={()=>{setCreateListOpen(true);setModalError('');setListName('');}}><Plus size={17} aria-hidden="true"/>{tr('Create list','তালিকা তৈরি')}</UiButton>
        <UiButton className="w-full gap-2 sm:w-auto" type="button" variant="primary" disabled={checkingIdentity||loading} onClick={()=>setEntryChoiceOpen(true)}><Plus size={17} aria-hidden="true"/>{tr('Add beneficiary','উপকারভোগী যোগ')}</UiButton>
      </div>
    </header>
    {owner&&hasStoredGuestBeneficiaries()&&!guestRecoveryDone&&<div className="flex flex-col gap-2 rounded-lg border border-taxpay-border bg-taxpay-surface p-3 sm:flex-row sm:items-center sm:justify-between" data-testid="guest-beneficiary-recovery">
      <p className="text-sm text-taxpay-text">{tr('Saved beneficiaries from this browser can be added to your signed-in profile. Existing profile records will be kept.','এই ব্রাউজারে সংরক্ষিত উপকারভোগীদের আপনার প্রোফাইলে যোগ করা যাবে। প্রোফাইলের বিদ্যমান তথ্য অক্ষত থাকবে।')}</p>
      <UiButton type="button" variant="outline" disabled={restoring||checkingIdentity} onClick={()=>void restoreFromThisBrowser()}>{restoring?tr('Restoring…','ফিরিয়ে আনা হচ্ছে…'):tr('Restore to my profile','আমার প্রোফাইলে ফিরিয়ে আনুন')}</UiButton>
    </div>}
    {notice&&<p role="status" aria-live="polite" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">{notice[bn?'bn':'en']}</p>}

    <section className="rounded-xl border border-taxpay-border bg-taxpay-surface p-4 shadow-sm sm:p-6" aria-labelledby="beneficiary-list-heading">
      {checkingIdentity&&<p role="status" className="py-8 text-center text-sm text-slate-600">{tr('Opening your beneficiary workspace…','উপকারভোগীর কর্মক্ষেত্র খোলা হচ্ছে…')}</p>}
      {!checkingIdentity&&loading&&<p role="status" className="py-8 text-center text-sm text-slate-600">{tr('Loading saved lists…','সংরক্ষিত তালিকা লোড হচ্ছে…')}</p>}
      {!checkingIdentity&&error&&<div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p role="alert" className="text-sm text-red-800">{error}</p>
        <UiButton type="button" variant="outline" onClick={()=>void reloadData()}>{tr('Try again','আবার চেষ্টা করুন')}</UiButton>
      </div>}
      {!checkingIdentity&&!loading&&!error&&<>
        <div className="taxpayer-transaction-panel__heading beneficiary-directory__heading">
          <div className="min-w-0">
            <h2 id="beneficiary-list-heading" className="text-xl font-bold text-taxpay-text">{tr('Beneficiary list','উপকারভোগীর তালিকা')}</h2>
            <p className="mt-1 text-sm text-taxpay-muted">{tr('Search and manage your saved taxpayers','সংরক্ষিত করদাতাদের খুঁজুন ও পরিচালনা করুন')}</p>
          </div>
          {lists.length>0&&<p className="beneficiary-directory__list-total" role="status" aria-live="polite">
            <UsersRound size={17} aria-hidden="true"/>
            <strong>{listPeople.length}</strong> {tr(listPeople.length===1?'beneficiary':'beneficiaries','জন উপকারভোগী')}
          </p>}
        </div>

        {!lists.length?<div className="mx-auto flex max-w-xl flex-col items-center py-5 text-center sm:py-6">
          <span className="mb-3 rounded-full bg-taxpay-light p-3 text-taxpay-primary"><UsersRound size={28} aria-hidden="true"/></span>
          <h2 className="text-lg font-semibold text-taxpay-text">{tr('Create your first list','আপনার প্রথম তালিকা তৈরি করুন')}</h2>
          <p className="mt-1 text-sm text-slate-600">{tr('Save taxpayer TINs and optional names for a faster payment start.','দ্রুত পেমেন্ট শুরু করতে করদাতার টিআইএন ও ঐচ্ছিক নাম সংরক্ষণ করুন।')}</p>

        </div>:<>
          <div className="taxpayer-transaction-filters beneficiary-directory__filters">
            <div className="taxpayer-transaction-filter beneficiary-directory__list-filter">
              <p id="beneficiary-selected-list-label">{tr('Selected list','নির্বাচিত তালিকা')}</p>
              <div className="beneficiary-list-picker" ref={listMenuRef}>
                <button id="beneficiary-list" ref={listTriggerRef} type="button" className="beneficiary-list-picker__trigger" aria-label={tr('Selected list','নির্বাচিত তালিকা')} aria-haspopup="dialog" aria-expanded={listMenuOpen} aria-controls="beneficiary-list-menu" onClick={()=>setListMenuOpen(current=>!current)}>
                  <span className="truncate text-left">{activeListRecord?.name??tr('Choose a list','তালিকা বাছুন')}</span>
                  <ChevronDown size={18} className={listMenuOpen?'rotate-180 transition-transform':'transition-transform'} aria-hidden="true"/>
                </button>
                {listMenuOpen&&<div id="beneficiary-list-menu" className="beneficiary-list-picker__menu" role="dialog" aria-label={tr('Choose beneficiary list','উপকারভোগীর তালিকা বাছুন')}>
                  <p className="beneficiary-list-picker__caption">{tr('Your lists','আপনার তালিকা')}</p>
                  {lists.map(list=><div className="beneficiary-list-picker__row" key={list.id}>
                    <button type="button" className="beneficiary-list-picker__select" aria-current={activeList===list.id?'true':undefined} onClick={()=>switchList(list.id)}>
                      <span className="truncate">{list.name}</span>{activeList===list.id&&<Check size={18} aria-hidden="true"/>}
                    </button>
                    <button type="button" className="beneficiary-list-picker__edit" aria-label={tr(`Edit ${list.name}`,`${list.name} সম্পাদনা`)} title={tr('Edit list','তালিকা সম্পাদনা')} onClick={()=>openListEditor(list)}><Pencil size={17} aria-hidden="true"/></button>
                  </div>)}
                </div>}
              </div>
            </div>
            <label className="taxpayer-transaction-filter taxpayer-transaction-filter--search">
              <span>{tr('Search','খুঁজুন')}</span>
              <span className="taxpayer-transaction-filter__search">
                <Search size={17} aria-hidden="true"/>
                <input type="search" aria-label={tr('Search this list','এই তালিকায় খুঁজুন')}
                  value={search} onChange={event=>setSearch(event.target.value)}
                  placeholder={tr('Search name or TIN','নাম বা টিআইএন দিয়ে খুঁজুন')}/>
              </span>
            </label>
          </div>
          <div className="taxpayer-transaction-count beneficiary-directory__count">
            <p className="text-xs text-taxpay-muted" aria-live="polite">{tr('Records','রেকর্ড')}: {filteredPeople.length} <span className="text-taxpay-muted">/ {listPeople.length}</span></p>
            <div className="beneficiary-directory__bulk-actions">
              {filteredPeople.length>0&&<label className="beneficiary-directory__select-all">
                <input type="checkbox" aria-label={tr('Select all visible beneficiaries','দেখানো সব উপকারভোগী নির্বাচন')} checked={allFilteredSelected}
                  onChange={event=>setSelectedIds(current=>event.target.checked
                    ?Array.from(new Set([...current,...filteredPeople.map(person=>person.id)]))
                    :current.filter(id=>!filteredPeople.some(person=>person.id===id)))}/>
                <span>{tr('Select all','সব নির্বাচন')}</span>
              </label>}
              {selectedPeople.length>0&&<>
                <p className="beneficiary-directory__selected-count" role="status">{tr(`${selectedPeople.length} selected`,`${selectedPeople.length} জন নির্বাচিত`)}</p>
                <UiButton type="button" variant="primary" onClick={()=>payWith(selectedPeople)}><CreditCard size={17} aria-hidden="true"/>{tr('Pay Tax for Others','অন্যদের কর পরিশোধ')}</UiButton>
                <UiButton type="button" variant="quiet" onClick={()=>setSelectedIds([])}>{tr('Clear','মুছুন')}</UiButton>
              </>}
            </div>
          </div>

          {listPeople.length===0?<div className="rounded-lg border border-dashed border-taxpay-border px-4 py-5 text-center">
            <h2 className="font-semibold text-taxpay-text">{tr(`“${lists.find(list=>list.id===activeList)?.name??''}” is empty`,`“${lists.find(list=>list.id===activeList)?.name??''}” তালিকাটি খালি`)}</h2>
            <p className="mt-1 text-sm text-slate-600">{tr('Add a taxpayer or import a spreadsheet into this list.','এই তালিকায় করদাতার তথ্য যোগ করুন অথবা স্প্রেডশিট আমদানি করুন।')}</p>
          </div>:filteredPeople.length===0?<div className="rounded-lg border border-dashed border-taxpay-border px-4 py-8 text-center">
            <p className="font-medium text-taxpay-text">{tr('No matching beneficiaries','কোনো উপকারভোগী মেলেনি')}</p>
            <UiButton type="button" variant="quiet" className="mt-2" onClick={()=>setSearch('')}>{tr('Clear search','অনুসন্ধান মুছুন')}</UiButton>
          </div>:<>
            <div className="taxpayer-transaction-list beneficiary-directory" role="region"
              aria-label={tr('Saved beneficiaries table','সংরক্ষিত উপকারভোগীর তালিকা')} data-testid="beneficiary-records">
              <div className="taxpayer-transaction-list__columns beneficiary-directory__columns" aria-hidden="true">
                <span>{tr('Beneficiary','উপকারভোগী')}</span>
                <span>{tr('Actions','কার্যক্রম')}</span>
              </div>
              <ul aria-label={tr('Saved beneficiaries','সংরক্ষিত উপকারভোগী')}>
                {filteredPeople.map(person=><li key={person.id}
                  className="taxpayer-transaction-row beneficiary-directory__row"
                  data-selected={selectedIds.includes(person.id)?'true':'false'}>
                  <div className="beneficiary-directory__identity">
                    <input id={'beneficiary-select-'+person.id} type="checkbox"
                      aria-label={tr(`Select ${displayName(person)}`,`${displayName(person)} নির্বাচন`)}
                      checked={selectedIds.includes(person.id)}
                      onChange={event=>setSelectedIds(current=>event.target.checked
                        ?Array.from(new Set([...current,person.id]))
                        :current.filter(id=>id!==person.id))}/>
                    <label htmlFor={'beneficiary-select-'+person.id} className="taxpayer-transaction-row__identity beneficiary-directory__person">
                      <p className="taxpayer-transaction-row__title">{displayName(person)}</p>
                      <p className="taxpayer-transaction-row__ref">{tr('TIN','টিআইএন')}: <span className="tabular-nums">{person.tin}</span></p>
                    </label>
                  </div>
                  <div className="beneficiary-directory__actions" role="group"
                    aria-label={tr(`Actions for ${displayName(person)}`,`${displayName(person)}-এর কার্যক্রম`)}>
                    <UiButton type="button" variant="quiet" className="beneficiary-directory__secondary text-sm"
                      onClick={()=>{setEditPerson(person);setEditTargetList('');setModalError('');}}>{tr('Edit','সম্পাদনা')}</UiButton>
                    <UiButton type="button" variant="outline" className="beneficiary-directory__pay gap-2 text-sm" onClick={()=>payWith([person])}>
                      <CreditCard size={16} aria-hidden="true"/>{tr('Pay Tax for Others','অন্যের কর পরিশোধ')}
                    </UiButton>
                    <UiButton type="button" variant="quiet" className="beneficiary-directory__secondary gap-2 text-sm text-taxpay-error"
                      aria-label={tr(`Remove ${displayName(person)}`,`${displayName(person)} সরান`)}
                      onClick={()=>setDeletePerson(person)}><Trash2 size={16} aria-hidden="true"/>{tr('Remove','সরান')}</UiButton>
                  </div>
                </li>)}
              </ul>
            </div>
          </>}
        </>}
      </>}
    </section>

    {entryChoiceOpen&&<TaxPayModal title={tr('Add beneficiary','উপকারভোগী যোগ')} ariaLabel={tr('Choose how to add beneficiaries','কীভাবে উপকারভোগী যোগ করবেন')} className="beneficiary-workflow-modal beneficiary-choice-modal" hideFooter
      initialFocusSelector="#beneficiary-entry-single" onClose={()=>setEntryChoiceOpen(false)}>
      <div className="beneficiary-entry-choice">
        <p className="beneficiary-entry-choice__intro">{tr('How would you like to add beneficiaries?','কীভাবে উপকারভোগী যোগ করতে চান?')}</p>
        <div className="beneficiary-entry-choice__grid" role="group" aria-label={tr('Beneficiary entry method','উপকারভোগী যোগ করার পদ্ধতি')}>
          <button id="beneficiary-entry-single" type="button" className="tax-service-choice__card beneficiary-entry-choice__card" onClick={()=>open('single')}>
            <span className="tax-service-choice__icon beneficiary-entry-choice__icon"><UserPlus size={22} aria-hidden="true"/></span>
            <span className="tax-service-choice__copy"><strong>{tr('Add one beneficiary','একজন উপকারভোগী যোগ')}</strong><span className="tax-service-choice__description">{tr('Enter a TIN and an optional name.','টিআইএন ও ঐচ্ছিক নাম লিখুন।')}</span></span>
            <ChevronRight size={20} className="beneficiary-entry-choice__arrow" aria-hidden="true"/>
          </button>
          <button type="button" className="tax-service-choice__card beneficiary-entry-choice__card" onClick={()=>open('bulk')}>
            <span className="tax-service-choice__icon beneficiary-entry-choice__icon"><FileSpreadsheet size={22} aria-hidden="true"/></span>
            <span className="tax-service-choice__copy"><strong>{tr('Import from Excel','এক্সেল থেকে আমদানি')}</strong><span className="tax-service-choice__description">{tr('Add multiple beneficiaries from an .xlsx file.','.xlsx ফাইল থেকে একাধিক উপকারভোগী যোগ করুন।')}</span></span>
            <ChevronRight size={20} className="beneficiary-entry-choice__arrow" aria-hidden="true"/>
          </button>
        </div>
      </div>
    </TaxPayModal>}

    {createListOpen&&<TaxPayModal className="beneficiary-workflow-modal" title={tr('Create beneficiary list','উপকারভোগীর তালিকা তৈরি')} ariaLabel={tr('Create list','তালিকা তৈরি')}
      onClose={()=>{if(!busy){setCreateListOpen(false);setModalError('');}}} initialFocusSelector="#beneficiary-create-list-name"
      footer={<div className="flex w-full justify-end gap-2"><UiButton type="button" variant="outline" disabled={busy} onClick={()=>setCreateListOpen(false)}>{tr('Cancel','বাতিল')}</UiButton><UiButton type="submit" form="beneficiary-create-list-form" variant="primary" disabled={busy}>{busy?tr('Creating…','তৈরি হচ্ছে…'):tr('Create list','তালিকা তৈরি')}</UiButton></div>}>
      <form id="beneficiary-create-list-form" className="space-y-3 py-2" onSubmit={event=>void saveList(event)}>
        <div><label htmlFor="beneficiary-create-list-name" className="mb-1 block text-sm font-semibold">{tr('List name','তালিকার নাম')} *</label><UiInput id="beneficiary-create-list-name" maxLength={80} required value={listName} onChange={event=>setListName(event.target.value)} placeholder={tr('e.g. Family or Clients','যেমন পরিবার বা ক্লায়েন্ট')}/></div>
        {modalError&&<p role="alert" className="text-sm text-red-700">{modalError}</p>}
      </form>
    </TaxPayModal>}

    {editingList&&!confirmListDelete&&<TaxPayModal className="beneficiary-workflow-modal" title={tr('Edit beneficiary list','উপকারভোগীর তালিকা সম্পাদনা')} ariaLabel={tr('Edit beneficiary list','উপকারভোগীর তালিকা সম্পাদনা')}
      initialFocusSelector="#beneficiary-edit-list-name" onClose={()=>{if(!busy){setEditingList(null);setModalError('');}}}
      footer={<div className="beneficiary-list-edit__footer">
        <UiButton type="button" variant="quiet" disabled={busy} className="gap-2 text-red-700 hover:bg-red-50" onClick={()=>{setModalError('');setConfirmListDelete(true);}}><Trash2 size={17} aria-hidden="true"/>{tr('Delete list','তালিকা মুছুন')}</UiButton>
        <div className="flex items-center gap-2"><UiButton type="button" variant="outline" disabled={busy} onClick={()=>setEditingList(null)}>{tr('Cancel','বাতিল')}</UiButton>
          <UiButton type="submit" form="beneficiary-edit-list-form" variant="primary" disabled={busy}>{busy?tr('Saving…','সংরক্ষণ হচ্ছে…'):tr('Save changes','পরিবর্তন সংরক্ষণ')}</UiButton></div>
      </div>}>
      <form id="beneficiary-edit-list-form" className="space-y-3 py-2" onSubmit={event=>void saveListEdit(event)}>
        <div><label htmlFor="beneficiary-edit-list-name" className="mb-1 block text-sm font-semibold">{tr('List name','তালিকার নাম')} *</label><UiInput id="beneficiary-edit-list-name" maxLength={80} required value={editingListName} onChange={event=>setEditingListName(event.target.value)}/></div>
        {modalError&&<p role="alert" className="text-sm text-red-700">{modalError}</p>}
      </form>
    </TaxPayModal>}

    {editingList&&confirmListDelete&&<TaxPayModal className="beneficiary-workflow-modal" title={tr('Delete beneficiary list?','উপকারভোগীর তালিকা মুছবেন?')} ariaLabel={tr('Confirm list deletion','তালিকা মুছে ফেলা নিশ্চিত করুন')}
      onClose={()=>{if(!busy){setConfirmListDelete(false);setModalError('');}}}
      footer={<div className="flex w-full flex-wrap justify-end gap-2"><UiButton type="button" variant="outline" disabled={busy} onClick={()=>setConfirmListDelete(false)}>{tr('Cancel','বাতিল')}</UiButton>
        <UiButton type="button" variant="primary" disabled={busy} className="gap-2" onClick={()=>void removeList()}><Trash2 size={17} aria-hidden="true"/>{busy?tr('Deleting…','মুছে ফেলা হচ্ছে…'):tr('Delete list','তালিকা মুছুন')}</UiButton></div>}>
      <p className="text-sm text-slate-700">{tr(`Delete “${editingList.name}” and all its ${people.filter(person=>person.list_id===editingList.id).length} saved beneficiaries? This cannot be undone. Existing payment and tax records will not be affected.`,`“${editingList.name}” তালিকা এবং এর ${people.filter(person=>person.list_id===editingList.id).length} জন সংরক্ষিত উপকারভোগী মুছে ফেলবেন? এটি ফিরিয়ে আনা যাবে না। বিদ্যমান পেমেন্ট বা করের রেকর্ড পরিবর্তন হবে না।`)}</p>
      {modalError&&<p role="alert" className="mt-2 text-sm text-red-700">{modalError}</p>}
    </TaxPayModal>}

    {flow&&<TaxPayModal className="beneficiary-workflow-modal" title={flow==='single'?tr('Add beneficiary','উপকারভোগী যোগ করুন'):tr('Import beneficiaries','উপকারভোগী আমদানি করুন')}
      onClose={closeFlow} ariaLabel={tr('Beneficiary entry','উপকারভোগী যোগ')} motionKey={flow+phase}
      initialFocusSelector={flow==='single'?'#beneficiary-tin':'#beneficiary-file'}
      footer={<div className="flex w-full flex-wrap items-center justify-between gap-2">
        <div>{flow==='bulk'&&<UiButton type="button" variant="outline" onClick={template}><Download size={16} aria-hidden="true"/>{tr('Download template','টেমপ্লেট ডাউনলোড')}</UiButton>}</div>
        <div className="flex gap-2">
          <UiButton type="button" variant="outline" disabled={busy} onClick={()=>{if(flow==='bulk'&&phase!=='upload'){setPhase(phase==='confirm'?'preview':'upload');setModalError('');}else closeFlow();}}>
            {flow==='bulk'&&phase!=='upload'?tr('Back','পেছনে'):tr('Cancel','বাতিল')}
          </UiButton>
          {flow==='single'?<UiButton form="beneficiary-single-form" type="submit" variant="primary" disabled={busy}>{busy?tr('Saving…','সংরক্ষণ হচ্ছে…'):tr('Add beneficiary','উপকারভোগী যোগ')}</UiButton>
            :phase==='upload'?<UiButton type="button" variant="primary" disabled={!filename||busy} onClick={()=>setPhase('preview')}>{tr('Next','পরবর্তী')}</UiButton>
            :phase==='preview'?<UiButton type="button" variant="primary" disabled={!chosen.length||busy||(!targetList||targetList==='new'&&!listName.trim())} onClick={()=>setPhase('confirm')}>{tr('Next','পরবর্তী')}</UiButton>
            :<UiButton type="button" variant="primary" disabled={!chosen.length||busy} onClick={()=>void finishImport()}>{busy?tr('Saving…','সংরক্ষণ হচ্ছে…'):tr('Finish import','আমদানি সম্পন্ন')}</UiButton>}
        </div>
      </div>}>
      <div className="space-y-4 py-2" data-testid="beneficiary-import">
        {flow==='bulk'&&<div className="flex items-center gap-2" aria-label={tr('Import progress','আমদানির অগ্রগতি')}>
          {(['upload','preview','confirm'] as Phase[]).map((value,index)=><div key={value} className={'flex-1 rounded-md border px-2 py-2 text-center text-xs '+(phase===value?'border-taxpay-primary bg-blue-50 text-taxpay-primary':'border-slate-200 text-slate-600')}>
            {index+1}. {value==='upload'?tr('Upload','আপলোড'):value==='preview'?tr('Preview','পূর্বরূপ'):tr('Review and add','পর্যালোচনা ও যোগ')}
          </div>)}
        </div>}
        <div><label htmlFor="beneficiary-target-list" className="mb-1 block text-sm font-semibold">{tr('Add to list','তালিকায় যোগ করুন')} *</label>
          <UiSelect id="beneficiary-target-list" value={targetList} onChange={event=>setTargetList(event.target.value)}>
            <option value="new">{tr('Create new list','নতুন তালিকা তৈরি')}</option>{lists.map(list=><option key={list.id} value={list.id}>{list.name}</option>)}
          </UiSelect>
          {targetList==='new'&&<UiInput id="beneficiary-new-list-name" aria-label={tr('New list name','নতুন তালিকার নাম')} className="mt-2" maxLength={80} required value={listName} placeholder={tr('e.g. Family or Clients','যেমন পরিবার বা ক্লায়েন্ট')} onChange={event=>setListName(event.target.value)}/>}
        </div>
        {flow==='single'?<form id="beneficiary-single-form" className="space-y-3" onSubmit={event=>void saveSingle(event)}>
          <TaxpayerTinLookup language={language} card heading={tr('Taxpayer Information','করদাতার তথ্য')}
            tinId="beneficiary-tin" nameId="beneficiary-name"
            tin={tin}
            name={searchedBeneficiaryTin === tin && lookupSampleTaxpayer(tin)
              ? (bn ? lookupSampleTaxpayer(tin)!.nameBn : lookupSampleTaxpayer(tin)!.nameEn) : name}
            canSearch={/^\d{12}$/.test(tin)}
            editableName={!(searchedBeneficiaryTin === tin && lookupSampleTaxpayer(tin))}
            onNameChange={setName}
            tinPlaceholder={tr('12-digit TIN','১২ সংখ্যার টিআইএন')}
            onTinChange={value=>{setTin(value);setName('');setSearchedBeneficiaryTin(null);setModalError('');}}
            onClear={()=>{setTin('');setName('');setSearchedBeneficiaryTin(null);setModalError('');}}
            onSearch={()=>{const found=lookupSampleTaxpayer(tin);setSearchedBeneficiaryTin(tin);if(found)setName(found.nameEn);}}
            status={searchedBeneficiaryTin === tin && tin.length === 12 && !lookupSampleTaxpayer(tin)
              ? <p className="text-sm text-slate-600" role="status">{tr('No sample name found. You may enter a name or leave it empty.','নমুনা তথ্য থেকে নাম পাওয়া যায়নি। নাম লিখতে পারেন অথবা ফাঁকা রাখতে পারেন।')}</p> : undefined} />

        </form>:phase==='upload'?<div className="space-y-3">
          <label htmlFor="beneficiary-file" className="block text-sm font-semibold">{tr('Upload an Excel workbook (.xlsx)','এক্সেল ফাইল আপলোড করুন (.xlsx)')}</label>
          <div className="rounded-lg border-2 border-dashed border-slate-300 p-5 text-center" onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();void receive(event.dataTransfer.files[0]);}}>
            <FileSpreadsheet className="mx-auto text-taxpay-primary" size={30} aria-hidden="true"/><p className="my-2 text-sm">{tr('Drag and drop an Excel file here','এখানে এক্সেল ফাইল টেনে আনুন')}</p>
            <input ref={fileRef} id="beneficiary-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={event=>{void receive(event.target.files?.[0]);event.target.value='';}}/>
            <UiButton variant="outline" type="button" onClick={()=>fileRef.current?.click()}>{tr('Browse files','ফাইল নির্বাচন')}</UiButton>
          </div>
          {filename&&<p role="status" className="flex items-center gap-2 text-sm text-taxpay-primary"><Check size={17} aria-hidden="true"/>{tr('Upload ready: ','আপলোড প্রস্তুত: ')}{filename}</p>}
          <p className="text-xs text-slate-600">{tr('Use TIN (required) and User Name (optional) columns. .xlsx only, up to 2 MB and 1,000 rows.','TIN (আবশ্যক) এবং User Name (ঐচ্ছিক) কলাম ব্যবহার করুন। শুধু .xlsx, সর্বোচ্চ ২ এমবি ও ১,০০০ সারি।')}</p>
        </div>:phase==='preview'?<div>
          <h3 className="font-semibold">{tr('Review imported rows','আমদানি করা সারি পর্যালোচনা')}</h3>
          <p className="text-sm text-slate-600">{tr(`${valid.length} valid, ${reviewed.length-valid.length} needing attention`,`${valid.length}টি সঠিক, ${reviewed.length-valid.length}টি সংশোধন প্রয়োজন`)}</p>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={valid.length>0&&chosen.length===valid.length} onChange={event=>setRows(old=>old.map(row=>({...row,selected:event.target.checked})))}/>{tr('Select all valid rows','সব সঠিক সারি নির্বাচন')}</label>
          <div className="max-h-80 overflow-auto rounded-lg border border-slate-200"><table className="w-full text-sm"><thead><tr className="sticky top-0 bg-white text-left"><th className="p-2">{tr('Add','যোগ')}</th><th className="p-2">{tr('TIN','টিআইএন')}</th><th className="p-2">{tr('Name (optional)','নাম (ঐচ্ছিক)')}</th><th className="p-2">{tr('Validation','যাচাই')}</th></tr></thead>
            <tbody>{reviewed.map((row,index)=><tr key={row.sourceRow} className="border-t border-slate-100">
              <td className="p-2"><input type="checkbox" aria-label={tr('Include row ','সারি যোগ করুন ')+row.sourceRow} checked={!row.error&&row.selected} disabled={!!row.error} onChange={event=>setRows(old=>old.map((value,rowIndex)=>index===rowIndex?{...value,selected:event.target.checked}:value))}/></td>
              <td className="p-2"><UiInput aria-label={tr('TIN row ','টিআইএন সারি ')+row.sourceRow} className="max-w-36 font-mono" value={row.tin} onChange={event=>setRows(old=>old.map((value,rowIndex)=>index===rowIndex?{...value,tin:event.target.value.replace(/\D/g,'').slice(0,12)}:value))}/></td>
              <td className="p-2"><UiInput aria-label={tr('Name row ','নাম সারি ')+row.sourceRow} className="min-w-36" maxLength={160} placeholder={tr('Optional','ঐচ্ছিক')} value={row.name} onChange={event=>setRows(old=>old.map((value,rowIndex)=>index===rowIndex?{...value,name:event.target.value}:value))}/></td>
              <td className={'p-2 text-xs '+(row.error?'text-red-700':'text-taxpay-primary')}>{row.error||tr('Ready','প্রস্তুত')}</td>
            </tr>)}</tbody></table></div>
        </div>:<div className="space-y-2 rounded-lg border border-slate-200 p-4">
          <h3 className="font-semibold">{tr('Confirm import','আমদানি নিশ্চিত করুন')}</h3><p>{tr('Selected: ','নির্বাচিত: ')}<strong>{chosen.length}</strong></p>
          <p>{tr('Skipped or invalid: ','বাদ দেওয়া বা ভুল: ')}<strong>{reviewed.length-chosen.length}</strong></p>
          <p className="text-sm text-slate-600">{tr('Only selected valid beneficiaries will be saved.','শুধু নির্বাচিত সঠিক উপকারভোগী সংরক্ষিত হবে।')}</p>
        </div>}
        {busy&&<p role="status" className="text-sm text-taxpay-primary">{tr('Saving beneficiaries…','উপকারভোগী সংরক্ষণ হচ্ছে…')}</p>}
        {modalError&&<p role="alert" className="text-sm text-red-700">{modalError}</p>}
      </div>
    </TaxPayModal>}

    {editPerson&&<TaxPayModal className="beneficiary-workflow-modal" title={tr('Edit beneficiary','উপকারভোগী সম্পাদনা')} ariaLabel={tr('Edit beneficiary','উপকারভোগী সম্পাদনা')}
      onClose={()=>{if(!busy){setEditPerson(null);setEditTargetList('');setModalError('');}}} initialFocusSelector="#beneficiary-edit-list"
      footer={<div className="flex w-full justify-end gap-2"><UiButton type="button" variant="outline" disabled={busy} onClick={()=>{setEditPerson(null);setEditTargetList('');}}>{tr('Cancel','বাতিল')}</UiButton><UiButton type="submit" form="beneficiary-edit-form" variant="primary" disabled={busy||!editTargetList||editTargetList===editPerson.list_id}>{busy?tr('Saving…','সংরক্ষণ হচ্ছে…'):tr('Save changes','পরিবর্তন সংরক্ষণ')}</UiButton></div>}>
      <form id="beneficiary-edit-form" className="space-y-3 py-2" onSubmit={event=>void saveEdit(event)}>
        <p className="text-sm text-taxpay-text">{tr('Beneficiary','উপকারভোগী')}: <strong>{displayName(editPerson)}</strong></p>
        <p className="text-sm text-slate-600">{tr('TIN','টিআইএন')}: <span className="font-mono">{editPerson.tin}</span></p>
        <div><label htmlFor="beneficiary-edit-list" className="mb-1 block text-sm font-semibold">{tr('Move to list','তালিকা পরিবর্তন করুন')} *</label>
          <UiSelect id="beneficiary-edit-list" required value={editTargetList} onChange={event=>{setEditTargetList(event.target.value);setModalError('');}}>
            <option value="">{tr('Choose another list','অন্য তালিকা বাছুন')}</option>
            {lists.filter(list=>list.id!==editPerson.list_id).map(list=><option key={list.id} value={list.id}>{list.name}</option>)}
          </UiSelect>
        </div>
        {lists.every(list=>list.id===editPerson.list_id)&&<p className="text-sm text-slate-600">{tr('Create another list before moving this beneficiary.','এই উপকারভোগীকে সরানোর আগে আরেকটি তালিকা তৈরি করুন।')}</p>}
        {modalError&&<p role="alert" className="text-sm text-red-700">{modalError}</p>}
      </form>
    </TaxPayModal>}

    {deletePerson&&<TaxPayModal className="beneficiary-workflow-modal" title={tr('Remove beneficiary?','উপকারভোগী সরাবেন?')} ariaLabel={tr('Confirm beneficiary removal','উপকারভোগী সরানো নিশ্চিত করুন')}
      onClose={()=>{if(!busy)setDeletePerson(null);}}
      footer={<div className="flex w-full justify-end gap-2"><UiButton type="button" variant="outline" disabled={busy} onClick={()=>setDeletePerson(null)}>{tr('Cancel','বাতিল')}</UiButton><UiButton type="button" variant="primary" disabled={busy} onClick={()=>void confirmRemove()}>{busy?tr('Removing…','সরানো হচ্ছে…'):tr('Remove','সরান')}</UiButton></div>}>
      <p className="py-2 text-sm text-slate-700">{tr(`Remove ${displayName(deletePerson)} (${deletePerson.tin}) from this saved list? This will not affect payment or tax records.`,`এই সংরক্ষিত তালিকা থেকে ${displayName(deletePerson)} (${deletePerson.tin})-কে সরাবেন? এতে পেমেন্ট বা করের রেকর্ডে কোনো পরিবর্তন হবে না।`)}</p>
      {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    </TaxPayModal>}
  </section>;
}
