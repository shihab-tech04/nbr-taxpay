import React, {useId, useState} from 'react';
import {Eye,EyeOff} from 'lucide-react';

type Props={id:string;label:string;placeholder:string;disabled?:boolean;password?:boolean};
/** UI-only replica of the source AppTextField/AppPasswordField outlined MUI control.
 * Source library is @mui/material; TaxPay's backend-independent build does not import it.
 */
export function SourceOutlinedField({id,label,placeholder,disabled=true,password=false}:Props){
  const [show,setShow]=useState(false);
  const [value,setValue]=useState('');
  const [focused,setFocused]=useState(false);
  const shrink=focused||Boolean(value);
  const type=password&&!show?'password':'text';
  return <div className={'login-source-field'+(shrink?' is-shrunk':'')}>
    <label htmlFor={id} className="login-source-floating-label">{label}</label>
    <div className="login-source-outline-box">
      <input id={id} aria-label={label} type={type} autoComplete={password?'off':'off'} disabled={disabled}
        placeholder={shrink?placeholder:undefined} value={value} onChange={e=>setValue(e.target.value)}
        onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}/>
      {password&&<button type="button" className="login-source-visibility" aria-label={show?'Hide password':'Show password'}
        disabled={disabled} onClick={()=>setShow(v=>!v)}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button>}
    </div>
    <fieldset aria-hidden="true" className="login-source-notched-outline"><legend><span>{shrink?label:' '}</span></legend></fieldset>
  </div>;
}
export function SourceCheckbox({label,disabled=true}:{label:string;disabled?:boolean}){
  return <label className="login-source-checkbox"><input type="checkbox" disabled={disabled}/><span>{label}</span></label>;
}
