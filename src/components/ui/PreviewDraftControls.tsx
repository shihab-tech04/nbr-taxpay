import React, {useEffect,useState} from 'react';
import {Bookmark, RotateCcw, Trash2} from 'lucide-react';
import {activePreviewSession} from '../../services/previewAccountSession';
import {deletePreviewDraft,getPreviewDraft,listPreviewDrafts,savePreviewDraft,
  type DraftJourney,type PreviewDraftSummary,type PreviewFormDraftState} from '../../services/previewPaymentDrafts';

type Props = {
  journey:DraftJourney;
  accountId:string|null;
  language:'en'|'bn';
  disabled?:boolean;
  capture:()=>PreviewFormDraftState;
  restore:(state:PreviewFormDraftState)=>void;
};

/** One approved account-only control: server readback, versioned updates and cross-browser recovery.
 * Never changes the payment journey's own primary/back/footer actions.
 */
export function PreviewDraftControls({journey,accountId,language,disabled=false,capture,restore}:Props) {
  const [items,setItems]=useState<PreviewDraftSummary[]>([]);
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState(false);
  const [open,setOpen]=useState(false);
  const [message,setMessage]=useState('');
  const [active,setActive]=useState<{id:string;version:number}|null>(null);
  const [confirmDelete,setConfirmDelete]=useState<string|null>(null);
  const bn=language==='bn';
  const label=(en:string,bangla:string)=>bn?bangla:en;
  const ownerVerified=Boolean(accountId&&activePreviewSession()?.profileId===accountId);

  const refresh=async()=>{
    if(!ownerVerified)return;
    setLoading(true);
    try{
      const records=await listPreviewDrafts();
      setItems(records.filter(row=>row.journey===journey));
      setMessage('');
    }catch{
      setMessage(label('Saved drafts could not be loaded. Retry.','সংরক্ষিত খসড়া লোড করা যায়নি। আবার চেষ্টা করুন।'));
    }finally{setLoading(false);}
  };
  useEffect(()=>{
    setItems([]);setActive(null);setOpen(false);setMessage('');setConfirmDelete(null);
    if(ownerVerified)void refresh();
  },[accountId,ownerVerified,journey]);

  if(!ownerVerified)return null;
  const save=async()=>{
    if(busy||disabled)return;
    setBusy(true);setMessage('');
    try{
      const state=capture();
      if(state.journey!==journey)throw new Error('INVALID_DRAFT_REQUEST');
      const saved=await savePreviewDraft(state,active);
      // Confirm durable, owner-scoped SQL readback before showing Save successful.
      const reread=await getPreviewDraft(saved.id);
      if(reread.version!==saved.version || reread.journey!==journey ||
        canonical(reread.formState)!==canonical(state))
        throw new Error('DRAFT_READBACK_UNVERIFIED');
      setActive({id:saved.id,version:saved.version});
      await refresh();
      setMessage(label('Draft saved to your account. No payment was submitted.',
        'খসড়াটি আপনার অ্যাকাউন্টে সংরক্ষিত হয়েছে। কোনো পেমেন্ট জমা হয়নি।'));
    }catch(error){
      const code=error instanceof Error?error.message:'';
      setMessage(code==='DRAFT_CONFLICT'
        ?label('This draft changed in another session. Reload the saved draft before editing.',
          'অন্য সেশনে খসড়াটি বদলেছে। সম্পাদনার আগে পুনরায় লোড করুন।')
        :label('Save could not be verified. Review the draft list before saving again.',
          'সংরক্ষণ নিশ্চিত হয়নি। আবার সেভ করার আগে খসড়ার তালিকা দেখুন।'));
      setOpen(true);
    }finally{setBusy(false);}
  };
  const resume=async(row:PreviewDraftSummary)=>{
    if(busy||disabled)return;
    setBusy(true);setMessage('');
    try{
      const full=await getPreviewDraft(row.id);
      if(full.journey!==journey)throw new Error('INVALID_DRAFT_RESPONSE');
      restore(full.formState);
      setActive({id:full.id,version:full.version});
      setMessage(label('Draft restored. Review taxpayer and payment details before continuing.',
        'খসড়া ফেরত এসেছে। এগোনোর আগে করদাতা ও পেমেন্টের তথ্য যাচাই করুন।'));
      setOpen(false);
    }catch{
      setMessage(label('Draft could not be restored. Reload the list and try again.',
        'খসড়া ফেরত আনা যায়নি। তালিকা রিলোড করে আবার চেষ্টা করুন।'));
    }finally{setBusy(false);}
  };
  const remove=async(row:PreviewDraftSummary)=>{
    if(confirmDelete!==row.id){setConfirmDelete(row.id);return;}
    if(busy||disabled)return;
    setBusy(true);setMessage('');
    try{
      await deletePreviewDraft(row.id,row.version);
      if(active?.id===row.id)setActive(null);
      setConfirmDelete(null);
      await refresh();
      setMessage(label('Draft deleted. No transaction was affected.',
        'খসড়া মুছে গেছে। কোনো লেনদেন বদলায়নি।'));
    }catch{
      setMessage(label('Deletion could not be confirmed. Reload the list.',
        'মুছে ফেলা নিশ্চিত হয়নি। তালিকা রিলোড করুন।'));
    }finally{setBusy(false);}
  };
  const buttonClass='inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-taxpay-border bg-white px-3 py-2 text-sm font-medium text-taxpay-primary hover:bg-taxpay-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-taxpay-primary disabled:opacity-50';
  return <section aria-label={label('Saved payment drafts','সংরক্ষিত পেমেন্ট খসড়া')} data-testid={'preview-drafts-'+journey}
    className="rounded-lg border border-taxpay-border bg-white p-3">
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={save} disabled={busy||disabled} className={buttonClass}>
        <Bookmark size={17} aria-hidden="true"/>{busy?label('Working…','কাজ চলছে…'):label('Save draft','খসড়া সংরক্ষণ')}
      </button>
      <button type="button" onClick={()=>setOpen(v=>!v)} aria-expanded={open} disabled={busy}
        className={buttonClass}>{label('My drafts','আমার খসড়া')}{items.length?' ('+items.length+')':''}</button>
    </div>
    {message&&<p className="mt-2 text-sm text-taxpay-text" role="status" aria-live="polite">{message}</p>}
    {open&&<div className="mt-3 border-t border-taxpay-border pt-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-medium text-taxpay-text">{label('Saved work','সংরক্ষিত কাজ')}</h3>
        <button type="button" disabled={busy||loading} className={buttonClass} onClick={()=>void refresh()}>
          <RotateCcw size={15} aria-hidden="true"/>{label('Refresh','নতুন করে দেখুন')}
        </button>
      </div>
      {loading?<p role="status" className="text-sm">{label('Loading…','লোড হচ্ছে…')}</p>:
        items.length===0?<p className="text-sm text-taxpay-muted">{label('No saved drafts.','কোনো সংরক্ষিত খসড়া নেই।')}</p>:
        <ul className="divide-y divide-taxpay-border">{items.map(item=><li key={item.id}
          className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-taxpay-text">{item.category.replaceAll('_',' ')}</p>
            <p className="text-sm text-taxpay-muted">{new Date(item.updatedAt).toLocaleString(bn?'bn-BD':'en-BD')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClass} disabled={busy||disabled}
              onClick={()=>void resume(item)}>{label('Continue','চালিয়ে যান')}</button>
            <button type="button" className={buttonClass} disabled={busy||disabled}
              onClick={()=>void remove(item)}><Trash2 size={15} aria-hidden="true"/>
              {confirmDelete===item.id?label('Confirm delete','মুছে ফেলুন নিশ্চিত করুন'):label('Delete','মুছুন')}</button>
            {confirmDelete===item.id&&<button type="button" className={buttonClass}
              onClick={()=>setConfirmDelete(null)}>{label('Cancel','বাতিল')}</button>}
          </div>
        </li>)}</ul>}
    </div>}
  </section>;
}
function canonical(value:unknown):string {
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.entries(value)
    .sort(([a],[b])=>a.localeCompare(b))
    .map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
  return JSON.stringify(value);
}
