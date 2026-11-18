import {useState} from 'react';
import {Check,Copy,Eye,EyeOff} from 'lucide-react';
import type {TaxpayerTinField} from '../../contracts/taxpayerTinProfile';

export type SensitiveProfileKind='tin'|'phone'|'email';

/** Only mask actual personal identifiers. Ordinary labels such as "Not Applicable" stay readable. */
export function sensitiveProfileKind(field:TaxpayerTinField,value:string):SensitiveProfileKind|null{
  if((field==='tin'||field==='previousTin') && (value.match(/[0-9]/g)?.length??0)>=8)return 'tin';
  if((field==='mobileNumber'||field==='taxOfficePhone') && (value.match(/[0-9]/g)?.length??0)>=6)return 'phone';
  if(field==='emailAddress' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value))return 'email';
  return null;
}

/** Screen-only masking; preserve the complete source record and explicit copy/export actions. */
export function maskProfileValue(value:string,kind:SensitiveProfileKind):string{
  if(kind==='email'){
    const at=value.indexOf('@');
    if(at<1)return '****';
    const local=value.slice(0,at);
    return local.slice(0,2)+'*'.repeat(Math.max(3,local.length-2))+'@****.***';
  }
  const digitCount=value.match(/[0-9]/g)?.length??0;
  // Show the first three digits only; do not leak the final digits of a TIN
  // or phone number. Short identifiers remain fully masked.
  const visibleDigits=digitCount>3?3:0;
  let seen=0;
  return [...value].map(char=>{
    if(!/[0-9]/.test(char))return char;
    seen++;
    return seen<=visibleDigits?char:'*';
  }).join('');
}

/** Independent, keyboard-accessible reveal state, never persisted to storage. */
export function MaskedProfileValue({value,kind,label,language,testId,allowCopy=false,profileContext=false}:{
  value:string;kind:SensitiveProfileKind;label:string;language:'en'|'bn';testId?:string;allowCopy?:boolean;profileContext?:boolean;
}){
  // TIN copy is profile-only. Other fields keep their existing separately authorized copy behavior.
  const canCopy=allowCopy && (kind!=='tin' || profileContext);
  const [revealed,setRevealed]=useState(false);
  const [copyState,setCopyState]=useState<'idle'|'done'|'failed'>('idle');
  const copyAction=language==='bn'
    ? (copyState==='done'?label+' কপি হয়েছে':'কপি করুন: '+label)
    : (copyState==='done'?label+' copied':'Copy '+label);
  const copyValue=async()=>{
    setCopyState('idle');
    try {
      await navigator.clipboard.writeText(value);
      setCopyState('done');
    } catch {
      setCopyState('failed');
    }
  };
  const action=language==='bn'
    ? label+' '+(revealed?'লুকান':'দেখান')
    : (revealed?'Hide ':'Show ')+label;
  return <span className="inline-flex max-w-full min-w-0 flex-wrap items-center gap-1.5">
    <span data-testid={testId} className="min-w-0 break-all">{revealed?value:maskProfileValue(value,kind)}</span>
    <button type="button" aria-label={action} title={action} aria-pressed={revealed}
      onClick={()=>setRevealed(current=>!current)}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-taxpay-primary hover:bg-taxpay-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taxpay-primary">
      {revealed?<EyeOff size={18} aria-hidden="true"/>:<Eye size={18} aria-hidden="true"/>}
    </button>
    {canCopy&&<button type="button" aria-label={copyAction} title={copyAction}
      onClick={copyValue}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-taxpay-primary hover:bg-taxpay-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taxpay-primary">
      {copyState==='done'?<Check size={18} aria-hidden="true"/>:<Copy size={18} aria-hidden="true"/>}
    </button>}
    {copyState==='failed'&&<span role="alert" className="text-sm text-taxpay-error">
      {language==='bn'?'কপি করা যায়নি। আবার চেষ্টা করুন।':'Could not copy. Please retry.'}
    </span>}
  </span>;
}
