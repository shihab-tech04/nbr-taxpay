import React, {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,ChevronDown,Search} from 'lucide-react';

export interface SearchableSelectOption {
  value: string;
  label: string;
  group?: string;
  secondary?: string;
  disabled?: boolean;
}
interface SearchableSelectProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  ariaLabel?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}
interface MenuPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  inDialog: boolean;
}

/** TaxPay's opt-in, single-value searchable select.
 * Overlay stays in the modal rather than growing/clipping its scrollable body.
 * Values and change handlers are identical to the original select contract.
 */
export function SearchableSelect({
  id,value,onChange,options,placeholder='Select an option',
  searchPlaceholder='Search options',emptyLabel='No matching options',
  ariaLabel,required,disabled,className=''
}:SearchableSelectProps){
  const triggerRef=useRef<HTMLButtonElement>(null);
  const menuRef=useRef<HTMLDivElement>(null);
  const searchRef=useRef<HTMLInputElement>(null);
  const [open,setOpen]=useState(false);
  const [query,setQuery]=useState('');
  const [active,setActive]=useState(0);
  const [position,setPosition]=useState<MenuPosition|null>(null);
  const label=options.find(option=>option.value===value)?.label??placeholder;
  const filtered=useMemo(()=>{
    const term=query.trim().toLocaleLowerCase();
    return options.filter(option=>option.value!==''&&(
      !term||[option.label,option.secondary,option.group,option.value].some(text=>
        text?.toLocaleLowerCase().includes(term))));
  },[options,query]);
  const enabled=useMemo(()=>filtered.map((option,index)=>option.disabled?-1:index).filter(index=>index>=0),[filtered]);

  useEffect(()=>{
    if(!open)return;
    const closeOutside=(event:PointerEvent)=>{
      const target=event.target as Node;
      if(!triggerRef.current?.contains(target)&&!menuRef.current?.contains(target))setOpen(false);
    };
    document.addEventListener('pointerdown',closeOutside);
    return()=>document.removeEventListener('pointerdown',closeOutside);
  },[open]);
  useEffect(()=>{if(open)searchRef.current?.focus();else setQuery('');},[open]);
  useEffect(()=>setActive(enabled[0]??-1),[query,options,open]);

  useLayoutEffect(()=>{
    if(!open)return;
    const trigger=triggerRef.current;
    if(!trigger)return;
    const dialog=trigger.closest<HTMLElement>('.taxpay-modal');
    const modalBody=dialog?.querySelector<HTMLElement>('.taxpay-modal__body');
    const measure=()=>{
      const rect=trigger.getBoundingClientRect();
      const area=modalBody?.getBoundingClientRect();
      const limitTop=area?.top??8;
      const limitBottom=area?.bottom??(window.innerHeight-8);
      const below=Math.max(0,limitBottom-rect.bottom-5);
      const above=Math.max(0,rect.top-limitTop-5);
      const desired=Math.min(270,58+filtered.length*43);
      const abovePreferred=below<Math.min(150,desired)&&above>below;
      const available=Math.max(80,Math.min(desired,abovePreferred?above:below));
      const modalRect=dialog?.getBoundingClientRect();
      const top=(abovePreferred?rect.top-available-4:rect.bottom+4)-(modalRect?.top??0);
      const left=rect.left-(modalRect?.left??0);
      setPosition({top,left,width:rect.width,maxHeight:available,inDialog:!!dialog});
    };
    measure();
    window.addEventListener('resize',measure);
    window.addEventListener('scroll',measure,true);
    return()=>{
      window.removeEventListener('resize',measure);
      window.removeEventListener('scroll',measure,true);
    };
  },[open,filtered.length]);

  const select=(option:SearchableSelectOption)=>{
    if(option.disabled)return;
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  };
  const move=(direction:number)=>{
    if(!enabled.length)return;
    const index=enabled.indexOf(active);
    const next=enabled[(index+direction+enabled.length)%enabled.length];
    setActive(next);
    document.getElementById(id+'-option-'+next)?.scrollIntoView({block:'nearest'});
  };
  const toggle=()=>{
    if(disabled)return;
    setQuery('');
    setOpen(current=>!current);
  };
  const dialog=open?triggerRef.current?.closest<HTMLElement>('.taxpay-modal'):null;
  const popup=open&&position&&createPortal(
    <div ref={menuRef} className="overflow-hidden rounded-lg border border-taxpay-border bg-taxpay-surface shadow-xl"
      style={{position:position.inDialog?'absolute':'fixed',top:position.top,left:position.left,
        width:position.width,maxHeight:position.maxHeight,zIndex:9999}}
      onKeyDown={event=>{
        if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setOpen(false);triggerRef.current?.focus();}
      }}>
      <div className="flex min-h-11 items-center gap-2 border-b border-taxpay-border px-3">
        <Search size={16} className="shrink-0 text-taxpay-muted" aria-hidden="true"/>
        <input ref={searchRef} type="search" role="combobox" aria-expanded="true"
          aria-label={searchPlaceholder} aria-controls={id+'-options'}
          aria-autocomplete="list"
          aria-activedescendant={active>=0?id+'-option-'+active:undefined}
          value={query} onChange={event=>setQuery(event.target.value)}
          onKeyDown={event=>{
            if(event.key==='ArrowDown'){event.preventDefault();move(1);}
            if(event.key==='ArrowUp'){event.preventDefault();move(-1);}
            if(event.key==='Home'){event.preventDefault();setActive(enabled[0]??-1);}
            if(event.key==='End'){event.preventDefault();setActive(enabled[enabled.length-1]??-1);}
            if(event.key==='Enter'){event.preventDefault();if(active>=0&&filtered[active])select(filtered[active]);}
          }}
          placeholder={searchPlaceholder}
          className="min-h-11 w-full bg-transparent text-base text-taxpay-text outline-none placeholder:text-taxpay-muted"/>
      </div>
      <ul id={id+'-options'} role="listbox" aria-label={ariaLabel??id}
        className="overflow-y-auto overscroll-contain py-1"
        style={{maxHeight:Math.max(34,position.maxHeight-48)}}>
        {filtered.length===0&&<li role="presentation" className="px-3 py-3 text-sm text-taxpay-muted">{emptyLabel}</li>}
        {filtered.map((option,index)=>{
          const groupStart=!!option.group&&(index===0||option.group!==filtered[index-1].group);
          return <React.Fragment key={option.value}>
            {groupStart&&<li role="presentation" className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-taxpay-primary">{option.group}</li>}
            <li id={id+'-option-'+index} role="option" aria-selected={value===option.value}
              aria-disabled={option.disabled||undefined}
              className={'flex min-h-10 cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm transition-colors '+
                (option.disabled?'cursor-not-allowed opacity-50 ':'hover:bg-taxpay-light ')+
                (active===index?'bg-taxpay-light ':'')+
                (value===option.value?'text-taxpay-primary':'text-taxpay-text')}
              onMouseEnter={()=>setActive(index)}
              onClick={()=>select(option)}>
              <span className="min-w-0">
                <span className="block break-words">{option.label}</span>
                {option.secondary&&<span className="block text-xs text-taxpay-muted">{option.secondary}</span>}
              </span>
              {value===option.value&&<Check size={16} className="shrink-0" aria-hidden="true"/>}
            </li>
          </React.Fragment>;
        })}
      </ul>
    </div>,
    dialog??document.body
  );
  return <>
    <button ref={triggerRef} id={id} type="button" disabled={disabled}
      aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open}
      aria-controls={open?id+'-options':undefined} aria-required={required||undefined}
      onClick={toggle}
      onKeyDown={event=>{
        if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(!open)toggle();}
        if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();setOpen(false);}
      }}
      className={'flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-taxpay-border bg-taxpay-surface px-3 py-2.5 text-left text-base text-taxpay-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taxpay-primary disabled:opacity-50 '+className}>
      <span className="min-w-0 truncate">{label}</span>
      <ChevronDown size={16} className={'shrink-0 transition-transform motion-reduce:transition-none '+(open?'rotate-180':'')} aria-hidden="true"/>
    </button>
    {popup}
  </>;
}
