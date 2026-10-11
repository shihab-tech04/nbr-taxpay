import React, {useEffect, useId, useRef, useState} from 'react';
import {X, Eye, EyeOff, Search, ChevronLeft, ChevronRight} from 'lucide-react';

export type OfficeButtonVariant = 'primary'|'secondary'|'outline'|'quiet'|'danger';
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {variant?:OfficeButtonVariant; size?:'sm'|'md'|'lg'; loading?:boolean};
export const OfficeButton = React.forwardRef<HTMLButtonElement,ButtonProps>(function OfficeButton({variant='primary',size='md',loading=false,children,className='',disabled,...props},ref){
  return <button ref={ref} type="button" className={`om-btn om-btn--${variant} om-btn--${size} ${className}`} disabled={disabled||loading} {...props}>{loading ? '…' : children}</button>;
});

type InputProps=React.InputHTMLAttributes<HTMLInputElement>&{label:string; error?:string; hint?:string};
export const OfficeInput=React.forwardRef<HTMLInputElement,InputProps>(function OfficeInput({label,error,hint,id,required,className='',...props},ref){
  const uid=useId(); const fid=id||uid;
  return <div className="om-field"><label htmlFor={fid} className="om-label">{label}{required&&<span aria-hidden="true"> *</span>}</label>
    <input {...props} id={fid} ref={ref} required={required} className={`om-input ${className}`} aria-invalid={!!error} aria-describedby={error?fid+'-error':hint?fid+'-hint':undefined}/>
    {hint&&!error&&<p className="om-field-hint" id={fid+'-hint'}>{hint}</p>}{error&&<p className="om-field-error" id={fid+'-error'} role="alert">{error}</p>}</div>;
});
export function OfficePasswordField(props:InputProps){
  const [visible,setVisible]=useState(false); const uid=useId();const fid=props.id||uid;
  const {label,error,hint,className='',...rest}=props;
  return <div className="om-field"><label htmlFor={fid} className="om-label">{label}</label>
    <div className="om-password"><input {...rest} id={fid} type={visible?'text':'password'} className={`om-input ${className}`} aria-invalid={!!error} aria-describedby={error?fid+'-error':hint?fid+'-hint':undefined}/>
    <button type="button" className="om-password-toggle" onClick={()=>setVisible(!visible)} disabled={props.disabled} aria-label={visible?'Hide password':'Show password'} aria-pressed={visible}>{visible?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>
    {hint&&!error&&<p className="om-field-hint" id={fid+'-hint'}>{hint}</p>}{error&&<p className="om-field-error" id={fid+'-error'} role="alert">{error}</p>}</div>;
}
export function OfficeSelect({label,children,id,error,...props}:React.SelectHTMLAttributes<HTMLSelectElement>&{label:string;error?:string}){
  const uid=useId();const fid=id||uid;
  return <div className="om-field"><label className="om-label" htmlFor={fid}>{label}</label><select {...props} id={fid} className="om-input" aria-invalid={!!error}>{children}</select>{error&&<p className="om-field-error" role="alert">{error}</p>}</div>;
}
export function OfficeTextArea({label,id,error,...props}:React.TextareaHTMLAttributes<HTMLTextAreaElement>&{label:string;error?:string}){
  const uid=useId();const fid=id||uid;
  return <div className="om-field"><label className="om-label" htmlFor={fid}>{label}</label><textarea {...props} id={fid} className="om-input om-textarea" aria-invalid={!!error}/>{error&&<p className="om-field-error" role="alert">{error}</p>}</div>;
}
export function OfficeCheckbox({label,...props}:Omit<React.InputHTMLAttributes<HTMLInputElement>,'type'>&{label:string}){
  return <label className="om-checkbox"><input {...props} type="checkbox"/><span>{label}</span></label>;
}
export function OfficeSwitch({label,checked,onChange,disabled=false}: {label:string;checked:boolean;onChange:(checked:boolean)=>void;disabled?:boolean}){
  return <label className="om-switch"><span>{label}</span><input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={e=>onChange(e.target.checked)}/><span className="om-switch-track" aria-hidden="true"/></label>;
}
export function OfficeCard({title,children,className=''}:{title?:string;children:React.ReactNode;className?:string}){
  return <section className={'om-card '+className}>{title&&<h2 className="om-card-title">{title}</h2>}{children}</section>;
}
export function OfficeBadge({status,children}:{status:'success'|'warning'|'error'|'neutral';children:React.ReactNode}){
  return <span className={'om-badge om-badge--'+status}>{children}</span>;
}
export function OfficeAlert({tone='neutral',title,children}:{tone?:'info'|'success'|'warning'|'error'|'neutral';title?:string;children:React.ReactNode}){
  return <div className={'om-alert om-alert--'+tone} role={tone==='error'?'alert':'status'}>{title&&<p className="om-alert-title">{title}</p>}<p>{children}</p></div>;
}
export function OfficeSearchField({label='Search',...props}:React.InputHTMLAttributes<HTMLInputElement>&{label?:string}){
  const id=useId();return <div className="om-search"><label htmlFor={id} className="om-sr-only">{label}</label><Search size={17} aria-hidden="true"/><input id={id} type="search" placeholder={label} {...props}/></div>;
}
export function OfficeModal({open,onClose,title,children,footer}:{open:boolean;onClose:()=>void;title:string;children:React.ReactNode;footer?:React.ReactNode}){
  const titleId=useId();const dialogRef=useRef<HTMLElement>(null);
  useEffect(()=>{if(!open)return;const previous=document.activeElement as HTMLElement|null;dialogRef.current?.focus();
    const h=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();if(e.key!=='Tab')return;
      const items=dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]');
      if(!items?.length){e.preventDefault();return;}const first=items[0],last=items[items.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    };document.addEventListener('keydown',h);return()=>{document.removeEventListener('keydown',h);previous?.focus();};},[open,onClose]);
  if(!open)return null;
  return <div className="om-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section ref={dialogRef} className="om-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}><header className="om-dialog-header"><h2 id={titleId}>{title}</h2><OfficeButton variant="quiet" onClick={onClose} aria-label="Close"><X size={18}/></OfficeButton></header><div className="om-dialog-body">{children}</div>{footer&&<footer className="om-dialog-footer">{footer}</footer>}</section></div>;
}
export function OfficeDrawer({open,onClose,title,children}:{open:boolean;onClose:()=>void;title:string;children:React.ReactNode}){
  const titleId=useId();const drawerRef=useRef<HTMLElement>(null);
  useEffect(()=>{if(!open)return;const previous=document.activeElement as HTMLElement|null;drawerRef.current?.focus();
    const h=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();if(e.key!=='Tab')return;
      const items=drawerRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]');
      if(!items?.length){e.preventDefault();return;}const first=items[0],last=items[items.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    };document.addEventListener('keydown',h);return()=>{document.removeEventListener('keydown',h);previous?.focus();};},[open,onClose]);
  if(!open)return null;
  return <div className="om-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><aside ref={drawerRef} className="om-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}><header className="om-dialog-header"><h2 id={titleId}>{title}</h2><OfficeButton variant="quiet" aria-label="Close" onClick={onClose}><X size={18}/></OfficeButton></header><div className="om-dialog-body">{children}</div></aside></div>;
}
export type OfficeTab={id:string;label:string};
export function OfficeTabs({tabs,active,onChange}:{tabs:OfficeTab[];active:string;onChange:(id:string)=>void}){
  return <div role="tablist" className="om-tabs">{tabs.map(t=><button type="button" role="tab" id={`om-tab-${t.id}`} aria-selected={active===t.id} key={t.id} className={'om-tab'+(active===t.id?' is-active':'')} onClick={()=>onChange(t.id)}>{t.label}</button>)}</div>;
}
export type OfficeColumn<T>={key:keyof T;label:string;render?:(value:T[keyof T],row:T)=>React.ReactNode};
export function OfficeTable<T extends {id:string|number}>({label,columns,rows,onRowClick,emptyText='No records found'}:{label:string;columns:OfficeColumn<T>[];rows:T[];onRowClick?:(row:T)=>void;emptyText?:string}){
  return <div className="om-table-root"><div className="om-table-scroll"><table className="om-table" aria-label={label}><thead><tr>{columns.map(c=><th key={String(c.key)} scope="col">{c.label}</th>)}</tr></thead><tbody>{rows.length===0?<tr><td colSpan={columns.length}><p className="om-empty">{emptyText}</p></td></tr>:rows.map(row=><tr key={row.id} className={onRowClick?'om-clickable':''} tabIndex={onRowClick?0:undefined} onClick={()=>onRowClick?.(row)} onKeyDown={e=>{if(onRowClick && (e.key==='Enter'||e.key===' ')){e.preventDefault();onRowClick(row)}}}>{columns.map(c=><td key={String(c.key)}>{c.render?c.render(row[c.key],row):String(row[c.key]??'')}</td>)}</tr>)}</tbody></table></div>
    <div className="om-mobile-cards" role="list" aria-label={label}>{rows.length===0?<p className="om-empty">{emptyText}</p>:rows.map(row=><article role="listitem" key={row.id} className="om-mobile-card">{columns.map(c=><div className="om-mobile-card-row" key={String(c.key)}><p className="om-cell-label">{c.label}</p><p>{c.render?c.render(row[c.key],row):String(row[c.key]??'')}</p></div>)}{onRowClick&&<OfficeButton variant="outline" onClick={()=>onRowClick(row)}>View details</OfficeButton>}</article>)}</div></div>;
}
export function OfficePagination({page,totalPages,onChange}:{page:number;totalPages:number;onChange:(page:number)=>void}){
  return <nav className="om-pagination" aria-label="Pagination"><OfficeButton variant="outline" aria-label="Previous page" disabled={page<=1} onClick={()=>onChange(page-1)}><ChevronLeft size={16}/></OfficeButton><p>Page {page} of {totalPages}</p><OfficeButton variant="outline" aria-label="Next page" disabled={page>=totalPages} onClick={()=>onChange(page+1)}><ChevronRight size={16}/></OfficeButton></nav>;
}
export function OfficeLoading({label='Loading…'}:{label?:string}){return <p className="om-loading" role="status" aria-live="polite">{label}</p>;}
