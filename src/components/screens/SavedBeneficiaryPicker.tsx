import React, {useEffect,useState} from 'react';
import {useAccountIdentity} from '../../services/accountIdentity';
import {loadBeneficiaries,type Beneficiary,type BeneficiaryList} from '../../services/beneficiaries';

export function SavedBeneficiaryPicker({language,allowMultiple,onChoose}:{
  language:'en'|'bn';allowMultiple:boolean;onChoose:(people:{tin:string;name:string}[])=>void;
}){
  const {user}=useAccountIdentity();
  const bn=language==='bn';
  const tr=(en:string,bengali:string)=>bn?bengali:en;
  const [lists,setLists]=useState<BeneficiaryList[]>([]);
  const [people,setPeople]=useState<Beneficiary[]>([]);
  const [selected,setSelected]=useState<string[]>([]);
  const [search,setSearch]=useState('');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{
    let cancelled=false;
    if(!user?.id){setLists([]);setPeople([]);return;}
    setLoading(true);
    loadBeneficiaries(user.id).then(result=>{if(!cancelled){setLists(result.lists);setPeople(result.people);setError('');}})
      .catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:String(e));})
      .finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[user?.id]);
  if(!user?.id)return null;
  const filtered=people.filter(p=>(p.display_name+' '+p.tin+' '+lists.find(l=>l.id===p.list_id)?.name).toLowerCase().includes(search.toLowerCase()));
  return <section aria-label={tr('Saved beneficiaries','সংরক্ষিত উপকারভোগী')} className="col-span-full rounded-lg border border-slate-200 bg-white p-3 space-y-2" data-testid="saved-beneficiary-picker">
    <h3 className="text-sm font-semibold">{tr('Saved beneficiaries','সংরক্ষিত উপকারভোগী')}</h3>
    <p className="text-xs text-slate-600">{tr('Choose a saved taxpayer to fill their TIN and name. Authorization-only suggestions stay private.','করদাতার টিআইএন ও নাম পূরণ করতে সংরক্ষিত উপকারভোগী নির্বাচন করুন। অনুমোদনভিত্তিক পরামর্শ ব্যক্তিগত থাকবে।')}</p>
    {loading&&<p role="status" className="text-xs">{tr('Loading saved beneficiaries…','সংরক্ষিত উপকারভোগী লোড হচ্ছে…')}</p>}
    {error&&<p role="alert" className="text-xs text-red-700">{error}</p>}
    {!!people.length&&<>
      <label className="sr-only" htmlFor="saved-beneficiary-search">{tr('Search beneficiaries','উপকারভোগী খুঁজুন')}</label>
      <input id="saved-beneficiary-search" type="search" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={search}
        onChange={e=>setSearch(e.target.value)} placeholder={tr('Search name, TIN or list','নাম, টিআইএন বা তালিকা দিয়ে খুঁজুন')}/>
      <div className="max-h-44 overflow-y-auto space-y-1" role="group" aria-label={tr('Select beneficiaries','উপকারভোগী নির্বাচন')}>
        {filtered.map(p=><label key={p.id} className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-100 p-2 text-sm">
          <input type={allowMultiple?'checkbox':'radio'} name={allowMultiple?undefined:'single-beneficiary'} checked={selected.includes(p.id)}
            onChange={e=>setSelected(old=>allowMultiple?(e.target.checked?[...old,p.id]:old.filter(x=>x!==p.id)):[p.id])}/>
          <span><strong>{p.display_name}</strong> <span className="font-mono text-slate-600">{p.tin}</span>
          <span className="block text-xs text-slate-500">{lists.find(l=>l.id===p.list_id)?.name}</span></span>
        </label>)}
        {!filtered.length&&<p className="text-sm text-slate-600">{tr('No matching beneficiaries.','কোনো মিল পাওয়া যায়নি।')}</p>}
      </div>
      <button type="button" className="taxpay-auth-outline" disabled={!selected.length} onClick={()=>{
        const chosen=selected.map(id=>people.find(x=>x.id===id)).filter((x):x is Beneficiary=>!!x);
        onChoose(chosen.map(x=>({tin:x.tin,name:x.display_name})));setSelected([]);
      }}>{tr(allowMultiple?'Add selected to payment':'Use selected beneficiary',allowMultiple?'নির্বাচিতদের পেমেন্টে যোগ করুন':'নির্বাচিত উপকারভোগী ব্যবহার')}</button>
    </>}
    {!loading&&!error&&!people.length&&<p className="text-sm text-slate-600">{tr('No saved beneficiaries yet. Add them from More → Beneficiaries.','এখনো কোনো উপকারভোগী সংরক্ষিত নেই। More → Beneficiaries থেকে যোগ করুন।')}</p>}
  </section>;
}
