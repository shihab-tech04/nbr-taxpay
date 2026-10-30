import React, {useEffect,useMemo,useRef,useState} from 'react';
import {Check, CreditCard, Download, FileSpreadsheet, Plus, Trash2, Upload, UsersRound} from 'lucide-react';
import {useAccountIdentity} from '../../services/accountIdentity';
import {useTaxState} from '../../services/taxState';
import {TaxpayerPageHeading} from '../layout/TaxpayerPageStructure';
import {TaxPayModal} from '../ui/TaxPayModal';
import {UiButton,UiInput,UiSelect} from '../ui/Controls';
import {addBeneficiaries,createBeneficiaryList,loadBeneficiaries,removeBeneficiary,updateBeneficiary,type Beneficiary,type BeneficiaryList} from '../../services/beneficiaries';
import {beneficiaryTemplate,parseBeneficiaryWorkbook,type SpreadsheetRecord} from '../../services/beneficiaryExcel';

type Flow='single'|'bulk';
type Phase='upload'|'preview'|'confirm';
interface ImportRow extends SpreadsheetRecord {selected:boolean}
interface ReviewedRow extends ImportRow {error:string}
export function Beneficiaries(){
  const {language,navigate,setPaymentBeneficiaryPrefill,setPaymentServiceChoiceOpen}=useTaxState();
  const {user,loading:checkingIdentity}=useAccountIdentity();
  const bn=language==='bn';
  const tr=(en:string,bengali:string)=>bn?bengali:en;
  const [lists,setLists]=useState<BeneficiaryList[]>([]);
  const [people,setPeople]=useState<Beneficiary[]>([]);
  const [activeList,setActiveList]=useState('');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [flow,setFlow]=useState<Flow|null>(null);
  const [phase,setPhase]=useState<Phase>('upload');
  const [targetList,setTargetList]=useState('new');
  const [listName,setListName]=useState('');
  const [tin,setTin]=useState('');
  const [name,setName]=useState('');
  const [filename,setFilename]=useState('');
  const [rows,setRows]=useState<ImportRow[]>([]);
  const [busy,setBusy]=useState(false);
  const [importError,setImportError]=useState('');
  const [editId,setEditId]=useState('');
  const [editName,setEditName]=useState('');
  const [deleteId,setDeleteId]=useState('');
  const fileRef=useRef<HTMLInputElement>(null);
  const owner=user?.id??null;
  const reload=async()=>{
    const data=await loadBeneficiaries(owner);
    setLists(data.lists);setPeople(data.people);
    setActiveList(current=>data.lists.some(x=>x.id===current)?current:(data.lists[0]?.id??''));
  };
  useEffect(()=>{
    let cancelled=false;
    if(checkingIdentity)return()=>{cancelled=true;};
    setLoading(true);setError('');
    loadBeneficiaries(owner).then(data=>{
      if(cancelled)return;
      setLists(data.lists);setPeople(data.people);
      setActiveList(value=>data.lists.some(x=>x.id===value)?value:(data.lists[0]?.id??''));
    }).catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:String(e));})
      .finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[owner,checkingIdentity]);
  const visible=people.filter(person=>person.list_id===activeList);
  const existing=new Set(people.filter(person=>person.list_id===targetList).map(person=>person.tin));
  const reviewed=useMemo<ReviewedRow[]>(()=>{
    const seen=new Set<string>();
    return rows.map(row=>{
      let reason='';
      if(!/^\d{12}$/.test(row.tin))reason=tr('TIN must contain 12 digits.','টিআইএন ১২ সংখ্যার হতে হবে।');
      else if(!row.name||row.name.length>160)reason=tr('Enter a name (up to 160 characters).','নাম লিখুন (সর্বোচ্চ ১৬০ অক্ষর)।');
      else if(existing.has(row.tin))reason=tr('Already saved in this list.','এই তালিকায় ইতিমধ্যে আছে।');
      else if(seen.has(row.tin))reason=tr('Duplicate TIN in this upload.','আপলোডে একই টিআইএন একাধিকবার আছে।');
      seen.add(row.tin);
      return {...row,error:reason};
    });
  },[rows,people,targetList,language]);
  const valid=reviewed.filter(row=>!row.error);
  const chosen=valid.filter(row=>row.selected);
  function open(next:Flow) {
    setFlow(next);setPhase('upload');setTargetList(activeList||'new');setListName('');
    setTin('');setName('');setRows([]);setFilename('');setImportError('');setNotice('');
  }
  function close(){if(!busy){setFlow(null);setImportError('');}}
  async function resolveList(){
    if(targetList!=='new'){
      const list=lists.find(x=>x.id===targetList);
      if(!list)throw new Error(tr('Choose a valid list.','সঠিক তালিকা নির্বাচন করুন।'));
      return list.id;
    }
    const result=await createBeneficiaryList(owner,listName);
    return result.id;
  }
  async function saveSingle(e:React.FormEvent){
    e.preventDefault();
    if(!/^\d{12}$/.test(tin)||!name.trim()){setImportError(tr('Enter a valid 12-digit TIN and beneficiary name.','সঠিক ১২ সংখ্যার টিআইএন ও উপকারভোগীর নাম লিখুন।'));return;}
    setBusy(true);setImportError('');
    try{
      const id=await resolveList();
      const count=await addBeneficiaries(owner,id,[{tin,display_name:name.trim()}]);
      await reload();setActiveList(id);setFlow(null);
      setNotice(count?tr('Beneficiary saved.','উপকারভোগী সংরক্ষিত হয়েছে।'):tr('This beneficiary is already in the list.','এই উপকারভোগী তালিকায় আগে থেকেই আছেন।'));
    }catch(e){setImportError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
  }
  async function receive(file?:File){
    if(!file)return;
    setImportError('');setFilename('');setRows([]);
    setBusy(true);
    try{
      const imported=await parseBeneficiaryWorkbook(file);
      if(!imported.length)throw new Error(tr('The Excel file contains no beneficiaries.','এক্সেল ফাইলে কোনো উপকারভোগী নেই।'));
      setRows(imported.map(row=>({...row,selected:true})));setFilename(file.name);
      // Keep the uploaded-file confirmation visible. Next opens the preview.
    }catch(e){setImportError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }
  async function finishImport(){
    if(!chosen.length)return;
    setBusy(true);setImportError('');
    try{
      const id=await resolveList();
      const count=await addBeneficiaries(owner,id,chosen.map(row=>({tin:row.tin,display_name:row.name})));
      await reload();setActiveList(id);setFlow(null);
      setNotice(tr(String(count)+' beneficiaries added to the list.',String(count)+' জন উপকারভোগী তালিকায় যুক্ত হয়েছেন।'));
    }catch(e){setImportError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }
  async function rename(person:Beneficiary){
    setError('');
    try{await updateBeneficiary(owner,person.id,editName);await reload();setEditId('');}
    catch(e){setError(e instanceof Error?e.message:String(e));}
  }
  async function remove(person:Beneficiary){
    setError('');
    try{await removeBeneficiary(owner,person.id);await reload();setDeleteId('');setNotice(tr('Beneficiary removed.','উপকারভোগী সরানো হয়েছে।'));}
    catch(e){setError(e instanceof Error?e.message:String(e));}
  }
  const template=()=>{
    const link=document.createElement('a'),url=URL.createObjectURL(beneficiaryTemplate());
    link.href=url;link.download='Korbritto_Beneficiaries_Template.xlsx';document.body.append(link);link.click();link.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  };

  return <section className="taxpayer-account-center" lang={language} data-testid="beneficiaries-page">
    <TaxpayerPageHeading title={tr('Beneficiaries','উপকারভোগী')} description={tr('Save taxpayer details to make payments for others faster.','অন্যের হয়ে দ্রুত কর পরিশোধের জন্য করদাতার তথ্য সংরক্ষণ করুন।')}/>
    <div className="taxpayer-account-panel space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-base font-bold">{tr('Saved beneficiary lists','সংরক্ষিত উপকারভোগীর তালিকা')}</h2>
          <p className="text-sm text-slate-600">{tr('Saving a beneficiary does not grant access to their private tax information.','উপকারভোগী সংরক্ষণ করলে তাঁর ব্যক্তিগত করতথ্যে প্রবেশাধিকার পাওয়া যায় না।')}</p></div>
        <div className="flex flex-wrap gap-2">
          <UiButton type="button" variant="outline" disabled={checkingIdentity} onClick={()=>open('single')}><Plus size={16} aria-hidden="true"/> {tr('Add single','একজন যোগ করুন')}</UiButton>
          <UiButton type="button" variant="primary" disabled={checkingIdentity} onClick={()=>open('bulk')}><Upload size={16} aria-hidden="true"/> {tr('Bulk add','একাধিক যোগ করুন')}</UiButton>
        </div>
      </div>
      <p className="text-xs text-slate-600">{tr('Lists are saved in this browser. Clearing site data removes access to guest lists. A signed-in account keeps its own private lists.','তালিকা এই ব্রাউজারে সংরক্ষিত হয়। সাইটের তথ্য মুছে ফেললে অতিথি তালিকায় প্রবেশ হারাবেন। সাইন-ইন করা অ্যাকাউন্টের তালিকা আলাদাভাবে ব্যক্তিগত থাকে।')}</p>
      {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
      {notice&&<p role="status" className="text-sm text-taxpay-primary">{notice}</p>}
      {checkingIdentity&&<p role="status">{tr('Loading your saved lists…','সংরক্ষিত তালিকা লোড হচ্ছে…')}</p>}
      {loading&&<p role="status">{tr('Loading beneficiaries…','উপকারভোগী লোড হচ্ছে…')}</p>}
      {!!lists.length&&<div className="max-w-sm">
        <label htmlFor="beneficiary-list" className="block mb-1 text-sm font-semibold">{tr('List name','তালিকার নাম')}</label>
        <UiSelect id="beneficiary-list" value={activeList} onChange={e=>setActiveList(e.target.value)}>
          {lists.map(list=><option value={list.id} key={list.id}>{list.name} ({people.filter(p=>p.list_id===list.id).length})</option>)}
        </UiSelect>
      </div>}
      {!checkingIdentity&&!loading&&(!lists.length||!visible.length)&&<div className="rounded-lg border border-slate-200 p-6 text-center">
        <UsersRound className="mx-auto mb-2 text-slate-500" size={30}/>
        <h3 className="font-semibold">{tr('No beneficiaries in this list','এই তালিকায় কোনো উপকারভোগী নেই')}</h3>
        <p className="text-sm text-slate-600">{tr('Add one taxpayer or import an Excel file.','একজন করদাতা যোগ করুন অথবা এক্সেল ফাইল আমদানি করুন।')}</p>
      </div>}
      {!!visible.length&&<div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead><tr className="border-b border-slate-200"><th className="p-3">{tr('TIN','টিআইএন')}</th><th className="p-3">{tr('User Name','নাম')}</th><th className="p-3 text-right">{tr('Actions','কার্যক্রম')}</th></tr></thead>
          <tbody>{visible.map(person=><tr key={person.id} className="border-b border-slate-100">
            <td className="p-3 font-mono whitespace-nowrap">{person.tin}</td>
            <td className="p-3">{editId===person.id?<UiInput aria-label={tr('Edit name','নাম সম্পাদনা')} value={editName} onChange={e=>setEditName(e.target.value)}/>:person.display_name}</td>
            <td className="p-3"><div className="flex flex-wrap justify-end gap-2">
              {editId===person.id?<><UiButton variant="outline" onClick={()=>void rename(person)}>{tr('Save','সংরক্ষণ')}</UiButton><UiButton variant="outline" onClick={()=>setEditId('')}>{tr('Cancel','বাতিল')}</UiButton></>
                :<UiButton variant="outline" onClick={()=>{setEditId(person.id);setEditName(person.display_name);setDeleteId('');}}>{tr('Edit','সম্পাদনা')}</UiButton>}
              <UiButton type="button" variant="outline" onClick={()=>{setPaymentBeneficiaryPrefill({tin:person.tin,name:person.display_name});setPaymentServiceChoiceOpen(true);}}>
                <CreditCard size={16} aria-hidden="true"/> {tr('Pay Tax for Others','অন্যের কর পরিশোধ')}
              </UiButton>
              {deleteId===person.id?<><UiButton variant="outline" onClick={()=>void remove(person)}>{tr('Confirm remove','অপসারণ নিশ্চিত করুন')}</UiButton><UiButton variant="outline" onClick={()=>setDeleteId('')}>{tr('Cancel','বাতিল')}</UiButton></>
                :<UiButton type="button" variant="outline" onClick={()=>{setDeleteId(person.id);setEditId('');}} aria-label={tr('Remove '+person.display_name,person.display_name+' সরান')}><Trash2 size={16}/></UiButton>}
            </div></td>
          </tr>)}</tbody>
        </table>
      </div>}
      <UiButton type="button" variant="outline" onClick={()=>navigate('manage_authorization')}>{tr('Manage taxpayer authorizations','করদাতার অনুমোদন পরিচালনা')}</UiButton>
    </div>

    {flow&&<TaxPayModal title={flow==='single'?tr('Add beneficiary','উপকারভোগী যোগ করুন'):tr('Import beneficiaries','উপকারভোগী আমদানি করুন')}
      onClose={close} ariaLabel={tr('Beneficiary entry','উপকারভোগী যোগ')} motionKey={flow+phase}
      footer={<div className="flex w-full flex-wrap items-center justify-between gap-2">
        <div>{flow==='bulk'&&<UiButton type="button" variant="outline" onClick={template}><Download size={16}/>{tr('Download Template','টেমপ্লেট ডাউনলোড')}</UiButton>}</div>
        <div className="flex gap-2">
          <UiButton type="button" variant="outline" disabled={busy} onClick={()=>{if(flow==='bulk'&&phase!=='upload'){setPhase(phase==='confirm'?'preview':'upload');setImportError('');}else close();}}>
            {flow==='bulk'&&phase!=='upload'?tr('Back','পেছনে'):tr('Cancel','বাতিল')}
          </UiButton>
          {flow==='single'?<UiButton form="beneficiary-single-form" type="submit" variant="primary" disabled={busy}>{busy?tr('Saving…','সংরক্ষণ হচ্ছে…'):tr('Add beneficiary','যোগ করুন')}</UiButton>
            :phase==='upload'?<UiButton type="button" variant="primary" disabled={!filename||busy} onClick={()=>setPhase('preview')}>{tr('Next','পরবর্তী')}</UiButton>
            :phase==='preview'?<UiButton type="button" variant="primary" disabled={!chosen.length||busy||(!targetList||targetList==='new'&&!listName.trim())} onClick={()=>setPhase('confirm')}>{tr('Next','পরবর্তী')}</UiButton>
            :<UiButton type="button" variant="primary" disabled={!chosen.length||busy} onClick={()=>void finishImport()}>{busy?tr('Saving…','সংরক্ষণ হচ্ছে…'):tr('Finish Import','আমদানি সম্পন্ন')}</UiButton>}
        </div>
      </div>}>
      <div className="space-y-4 py-2" data-testid="beneficiary-import">
        {flow==='bulk'&&<div className="flex items-center gap-2" aria-label={tr('Import progress','আমদানির অগ্রগতি')}>
          {(['upload','preview','confirm'] as Phase[]).map((p,index)=><div key={p} className={'flex-1 rounded-md border px-2 py-2 text-center text-xs '+(phase===p?'border-taxpay-primary bg-blue-50 text-taxpay-primary':'border-slate-200 text-slate-600')}>
            {index+1}. {p==='upload'?tr('Upload','আপলোড'):p==='preview'?tr('Preview','পূর্বরূপ'):tr('Review & add','পর্যালোচনা ও যোগ')}
          </div>)}
        </div>}
        <div>
          <label htmlFor="beneficiary-target-list" className="mb-1 block text-sm font-semibold">{tr('List name','তালিকার নাম')} *</label>
          <UiSelect id="beneficiary-target-list" value={targetList} onChange={e=>setTargetList(e.target.value)}>
            <option value="new">{tr('Create new list','নতুন তালিকা তৈরি')}</option>
            {lists.map(list=><option key={list.id} value={list.id}>{list.name}</option>)}
          </UiSelect>
          {targetList==='new'&&<UiInput id="beneficiary-new-list-name" className="mt-2" maxLength={80} required value={listName} placeholder={tr('e.g. Family, Clients','যেমন পরিবার, ক্লায়েন্ট')} onChange={e=>setListName(e.target.value)}/>}
        </div>
        {flow==='single'?<form id="beneficiary-single-form" className="space-y-3" onSubmit={e=>void saveSingle(e)}>
          <div><label className="block mb-1 text-sm font-semibold" htmlFor="beneficiary-tin">{tr('Beneficiary TIN','উপকারভোগীর টিআইএন')} *</label>
            <UiInput id="beneficiary-tin" inputMode="numeric" maxLength={12} required value={tin} onChange={e=>setTin(e.target.value.replace(/\D/g,'').slice(0,12))}/></div>
          <div><label className="block mb-1 text-sm font-semibold" htmlFor="beneficiary-name">{tr('Beneficiary name','উপকারভোগীর নাম')} *</label>
            <UiInput id="beneficiary-name" maxLength={160} required value={name} onChange={e=>setName(e.target.value)}/></div>
        </form>:phase==='upload'?<div className="space-y-3">
          <label htmlFor="beneficiary-file" className="block text-sm font-semibold">{tr('Upload Excel workbook (.xlsx)','এক্সেল ফাইল আপলোড করুন (.xlsx)')}</label>
          <div className="rounded-lg border-2 border-dashed border-slate-300 p-5 text-center"
            onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();void receive(e.dataTransfer.files[0]);}}>
            <FileSpreadsheet className="mx-auto text-taxpay-primary" size={30}/>
            <p className="my-2 text-sm">{tr('Drag and drop an Excel file here','এখানে এক্সেল ফাইল টেনে আনুন')}</p>
            <input ref={fileRef} id="beneficiary-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={e=>{void receive(e.target.files?.[0]);e.target.value='';}}/>
            <UiButton variant="outline" type="button" onClick={()=>fileRef.current?.click()}>{tr('Browse Excel','এক্সেল নির্বাচন')}</UiButton>
          </div>
          {filename&&<p role="status" className="flex items-center gap-2 text-sm text-taxpay-primary"><Check size={17}/>{tr('Upload successful: ','আপলোড সফল: ')}{filename}</p>}
          <p className="text-xs text-slate-600">{tr('Use columns TIN and User Name. Only .xlsx files, maximum 2 MB and 1,000 rows.','TIN এবং User Name কলাম ব্যবহার করুন। শুধু .xlsx, সর্বোচ্চ ২ এমবি ও ১০০০ সারি।')}</p>
        </div>:phase==='preview'?<div>
          <h3 className="font-semibold">{tr('Preview and select','পূর্বরূপ ও নির্বাচন')}</h3>
          <p className="text-sm text-slate-600">{tr(String(valid.length)+' valid, '+String(reviewed.length-valid.length)+' needing attention',String(valid.length)+'টি সঠিক, '+String(reviewed.length-valid.length)+'টি সংশোধন প্রয়োজন')}</p>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={valid.length>0&&chosen.length===valid.length}
  onChange={e=>setRows(old=>old.map(row=>({...row,selected:e.target.checked})))} />{tr('Select all valid rows','সব সঠিক সারি নির্বাচন')}</label>
          <div className="max-h-80 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm"><thead><tr className="sticky top-0 bg-white text-left"><th className="p-2">{tr('Add','যোগ')}</th><th className="p-2">{tr('TIN','টিআইএন')}</th><th className="p-2">{tr('User Name','নাম')}</th><th className="p-2">{tr('Validation','যাচাই')}</th></tr></thead>
              <tbody>{reviewed.map((row,i)=><tr key={row.sourceRow} className="border-t border-slate-100">
                <td className="p-2"><input type="checkbox" aria-label={tr('Include row ','সারি যোগ করুন ')+row.sourceRow} checked={!row.error&&row.selected} disabled={!!row.error}
  onChange={e=>setRows(old=>old.map((r,j)=>i===j?{...r,selected:e.target.checked}:r))}/></td>
                <td className="p-2"><UiInput aria-label={tr('TIN row ','টিআইএন সারি ')+row.sourceRow} className="max-w-36 font-mono" value={row.tin} onChange={e=>setRows(old=>old.map((r,j)=>i===j?{...r,tin:e.target.value.replace(/\D/g,'').slice(0,12)}:r))}/></td>
                <td className="p-2"><UiInput aria-label={tr('Name row ','নাম সারি ')+row.sourceRow} className="min-w-36" maxLength={160} value={row.name}
  onChange={e=>setRows(old=>old.map((r,j)=>i===j?{...r,name:e.target.value}:r))}/></td>
                <td className={'p-2 text-xs '+(row.error?'text-red-700':'text-taxpay-primary')}>{row.error||tr('Ready','প্রস্তুত')}</td>
              </tr>)}</tbody></table>
          </div>
        </div>:<div className="space-y-2 rounded-lg border border-slate-200 p-4">
          <h3 className="font-semibold">{tr('Ready to add','যোগ করার জন্য প্রস্তুত')}</h3>
          <p>{tr('Selected: ','নির্বাচিত: ')}<strong>{chosen.length}</strong></p>
          <p>{tr('Skipped or invalid: ','বাদ দেওয়া বা ভুল: ')}<strong>{reviewed.length-chosen.length}</strong></p>
          <p className="text-sm text-slate-600">{tr('Only selected valid beneficiaries will be saved. This does not grant authorization.','শুধু নির্বাচিত সঠিক উপকারভোগী সংরক্ষিত হবে। এতে অনুমোদন দেওয়া হয় না।')}</p>
        </div>}
        {busy&&<p role="status" className="text-sm text-taxpay-primary">{phase==='upload'?tr('Preparing preview…','পূর্বরূপ প্রস্তুত হচ্ছে…'):tr('Saving beneficiaries…','উপকারভোগী সংরক্ষণ হচ্ছে…')}</p>}
        {importError&&<p role="alert" className="text-sm text-red-700">{importError}</p>}
      </div>
    </TaxPayModal>}
  </section>;
}
