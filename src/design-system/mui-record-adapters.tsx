import type {ComponentPropsWithoutRef,PropsWithChildren} from 'react';
import {useEffect,useId} from 'react';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import ButtonBase from '@mui/material/ButtonBase';
import InputBase from '@mui/material/InputBase';
import {X} from 'lucide-react';
import {TaxPayRecordControlContext,type TaxPayRecordControlSlots,type TaxPayDesktopTableSlots} from '../components/ui/TaxPayDataTable';
import type {TaxPayModalProps} from '../components/ui/TaxPayModal';

/** Route-opt-in adapters, not global replacements. The original register CSS
 * still owns row density, sticky columns, numeric alignment and mobile cards. */
export const citizenMuiDesktopTableSlots:TaxPayDesktopTableSlots={
  Table:({className,...props}:ComponentPropsWithoutRef<'table'>)=>
    <Table {...props} className={className} data-unified-table="true" data-mui-record-table="true"
      sx={{display:'none','@media (min-width:768px)':{display:'table'},borderCollapse:'separate',borderSpacing:0,font:'inherit'}}/>,
  Head:props=><TableHead {...props}/>,
  Body:props=><TableBody {...props}/>,
  Row:props=><TableRow {...props}/>,
  HeaderCell:({align,...props})=><TableCell {...props} align={align==="char"?undefined:align} component="th" variant="head" sx={{font:'inherit',color:'inherit'}}/>,
  Cell:({align,...props})=><TableCell {...props} align={align==="char"?undefined:align} component="td" variant="body" sx={{font:'inherit',color:'inherit'}}/>,
};

/** Only migrated record regions opt in. Native renderers remain identical elsewhere. */
const recordControlSlots:TaxPayRecordControlSlots={
  Action:({type='button',...props})=><ButtonBase {...props} type={type} disableRipple
    sx={{font:'inherit','&.Mui-focusVisible':{outline:'2px solid var(--taxpay-table-primary,#2c5ead)',outlineOffset:2},
      '&.taxpay-record-toolbar__retry':{border:'1px solid var(--taxpay-table-border,#e1e6ee)',minHeight:44,padding:'8px 14px',borderRadius:'8px'}}}/>,
  Search:({value,onChange,type='search',className,placeholder,...props})=>
    <InputBase className={className} type={type} value={value} onChange={onChange}
      placeholder={placeholder} inputProps={props}
      sx={{flex:1,minWidth:0,font:'inherit','& .MuiInputBase-input':{boxSizing:'border-box',padding:0,width:'100%',font:'inherit'}}}/>,
};
export function MuiRecordControlsScope({children}:PropsWithChildren){
  return <TaxPayRecordControlContext.Provider value={recordControlSlots}>{children}</TaxPayRecordControlContext.Provider>;
}

/** Only the read-only ledger event dialog opts in. MUI owns escape/backdrop,
 * focus trap/restoration and dialog semantics. Existing payment modals and
 * draft/receipt footer contexts are not touched. */
export function MuiReadOnlyLedgerDialog({title,onClose,onBackdropClose,children,
 className='',closeIconLabel='Close modal',ariaLabel}:TaxPayModalProps){
  const id=useId();
  useEffect(()=>{
    const previous=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return()=>{document.body.style.overflow=previous;};
  },[]);
  return <Dialog open
    container={()=>document.querySelector<HTMLElement>('.taxpay-citizen-shell')??document.body}
    disableScrollLock hideBackdrop transitionDuration={0} maxWidth={false}
    className="taxpay-modal__overlay public-service-overlay"
    aria-label={ariaLabel} aria-labelledby={ariaLabel?undefined:id}
    onClose={(_,reason)=>reason==='backdropClick'?(onBackdropClose??onClose)():onClose()}
    // Keep padding on the MUI container only. The original mobile overlay
    // :has() rule otherwise adds another 2px and lifts the bottom sheet.
    style={{padding:0}}
    sx={{'&&':{display:'block',zIndex:120}}}
    slotProps={{
      container:{sx:{display:'flex',height:'100%',width:'100%',alignItems:'center',justifyContent:'center',
        padding:'clamp(.6rem, 2.5vw, 1.5rem)',
        '@media(max-width:700px)':{alignItems:'flex-end',padding:'0 0 2px'}}},
      paper:{className:('relative taxpay-modal public-service-dialog '+className).trim(),
        sx:{margin:0,boxShadow:'var(--taxpay-shadow-modal)',backgroundImage:'none'}}
    }}>
    <header className="taxpay-modal__header public-service-dialog__header">
      <span className="taxpay-modal__back-placeholder" aria-hidden="true"/>
      <h2 id={id} className="taxpay-modal__title">{title}</h2>
      <IconButton autoFocus disableRipple type="button" className="taxpay-modal__close" onClick={onClose} aria-label={closeIconLabel}>
        <X size={20} aria-hidden="true"/>
      </IconButton>
    </header>
    <div className="taxpay-modal__body public-service-dialog__body">{children}</div>
  </Dialog>;
}
