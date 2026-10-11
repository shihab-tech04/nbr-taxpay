import React, {useId, useState} from 'react';
import {Menu, X, ChevronRight, CalendarDays, UploadCloud} from 'lucide-react';
import {OfficeButton} from './OfficeControls';

export type OfficeNavItem = {id:string;label:string;icon?:React.ReactNode;disabled?:boolean};
export function OfficeAppShell({brand='TaxPay Preview',navigation,active,onNavigate,children,footerText='Independent development preview'}:{brand?:string;navigation:OfficeNavItem[];active:string;onNavigate:(id:string)=>void;children:React.ReactNode;footerText?:string}){
  const [mobileOpen,setMobileOpen]=useState(false);
  function change(id:string){onNavigate(id);setMobileOpen(false)}
  return <div className="om-app-shell">
    <a className="om-skip-link" href="#om-main">Skip to main content</a>
    <header className="om-app-header"><OfficeButton variant="quiet" className="om-menu-trigger" aria-label="Toggle navigation" aria-controls="om-main-nav" aria-expanded={mobileOpen} onClick={()=>setMobileOpen(v=>!v)}>{mobileOpen?<X size={22}/>:<Menu size={22}/>}</OfficeButton><h1>{brand}</h1><p>{footerText}</p></header>
    {mobileOpen&&<button className="om-mobile-backdrop" type="button" aria-label="Close navigation" onClick={()=>setMobileOpen(false)}/>}
    <aside id="om-main-nav" className={'om-sidebar'+(mobileOpen?' is-open':'')} aria-label="Main navigation"><nav>{navigation.map(item=><button type="button" key={item.id} disabled={item.disabled} aria-current={active===item.id?'page':undefined} onClick={()=>change(item.id)} className={'om-nav-item'+(active===item.id?' is-active':'')}>{item.icon}<span>{item.label}</span></button>)}</nav></aside>
    <main className="om-main" id="om-main" tabIndex={-1}>{children}</main>
  </div>;
}
export function OfficePageHeader({title,description,action}:{title:string;description?:string;action?:React.ReactNode}){
  return <header className="om-page-header"><div><h1>{title}</h1>{description&&<p>{description}</p>}</div>{action&&<div>{action}</div>}</header>;
}
export function OfficeBreadcrumb({items}:{items:{label:string;onClick?:()=>void}[]}){
  return <nav aria-label="Breadcrumb" className="om-breadcrumb"><ol>{items.map((item,i)=><li key={i}>{i>0&&<ChevronRight size={13} aria-hidden="true"/>}{item.onClick?<button type="button" onClick={item.onClick}>{item.label}</button>:<span aria-current="page">{item.label}</span>}</li>)}</ol></nav>;
}
export function OfficeFormSection({title,description,children,collapsible=false}:{title:string;description?:string;children:React.ReactNode;collapsible?:boolean}){
  const [open,setOpen]=useState(true);const id=useId();
  return <section className="om-form-section"><header><h2>{title}</h2>{description&&<p>{description}</p>}{collapsible&&<OfficeButton variant="quiet" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(v=>!v)}>{open?'Collapse':'Expand'}</OfficeButton>}</header>{open&&<div id={id} className="om-form-content">{children}</div>}</section>;
}
export function OfficeDateField({label,...props}:Omit<React.InputHTMLAttributes<HTMLInputElement>,'type'>&{label:string}){
  const id=useId();return <div className="om-field"><label className="om-label" htmlFor={id}>{label}</label><div className="om-date-control"><CalendarDays size={16} aria-hidden="true"/><input id={id} type="date" {...props}/></div></div>;
}
export function OfficeRadioGroup({name,label,options,value,onChange,disabled=false}:{name:string;label:string;options:{value:string;label:string}[];value:string;onChange:(value:string)=>void;disabled?:boolean}){
  return <fieldset className="om-radio-group" disabled={disabled}><legend className="om-label">{label}</legend>{options.map(o=><label key={o.value}><input type="radio" name={name} value={o.value} checked={value===o.value} onChange={()=>onChange(o.value)}/><span>{o.label}</span></label>)}</fieldset>;
}
export function OfficeFileField({label,accept,onChange,disabled=false}:{label:string;accept?:string;onChange:(file:File|null)=>void;disabled?:boolean}){
  const id=useId();return <div className="om-field"><label className="om-label" htmlFor={id}>{label}</label><div className="om-file-control"><UploadCloud size={20} aria-hidden="true"/><input id={id} type="file" accept={accept} disabled={disabled} onChange={e=>onChange(e.target.files?.[0]||null)}/></div></div>;
}
export function OfficeStepper({steps,active}:{steps:{id:string;label:string}[];active:string}){
  const pos=steps.findIndex(s=>s.id===active);
  return <ol className="om-stepper" aria-label="Progress">{steps.map((step,i)=><li key={step.id} className={i<=pos?'is-complete':''} aria-current={i===pos?'step':undefined}><span className="om-step-dot" aria-hidden="true">{i+1}</span><p>{step.label}</p></li>)}</ol>;
}
export function OfficeEmptyState({title,description,action}:{title:string;description?:string;action?:React.ReactNode}){
  return <div className="om-empty-state"><h2>{title}</h2>{description&&<p>{description}</p>}{action}</div>;
}
export function OfficeToast({message,tone='neutral',onDismiss}:{message:string;tone?:'neutral'|'success'|'warning'|'error';onDismiss:()=>void}){
  return <div role="status" aria-live="polite" className={'om-toast om-toast--'+tone}><p>{message}</p><OfficeButton variant="quiet" aria-label="Dismiss notification" onClick={onDismiss}><X size={16}/></OfficeButton></div>;
}
