import {useState} from 'react';
import {Eye,EyeOff} from 'lucide-react';
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
  let toMask=digitCount>3?digitCount-3:digitCount;
  return [...value].map(char=>/[0-9]/.test(char)&&toMask-->0?'*':char).join('');
}

/** Independent, keyboard-accessible reveal state, never persisted to storage. */
export function MaskedProfileValue({value,kind,label,language,testId}:{
  value:string;kind:SensitiveProfileKind;label:string;language:'en'|'bn';testId?:string;
}){
  const [revealed,setRevealed]=useState(false);
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
  </span>;
}
