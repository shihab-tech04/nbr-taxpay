import type {ComponentPropsWithoutRef,ReactNode} from 'react';

/** Shared Korbritto table primitives.
 * The Board Meeting reference guides presentation only; the caller retains
 * its existing data source, filters, sorting, actions, permissions and columns.
 * Never wrap receipt/certificate print tables in these components.
 */
type DivProps=ComponentPropsWithoutRef<'div'>;
const merge=(base:string,rest:string|undefined)=>rest?`${base} ${rest}`:base;

export function TaxPayTablePanel({className,...rest}:DivProps) {
  return <div {...rest} className={merge('taxpay-data-table',className)}/>;
}
export function TaxPayTableToolbar({className,...rest}:DivProps) {
  return <div {...rest} className={merge('taxpay-table-toolbar',className)}/>;
}
export function TaxPayTableViewport({className,...rest}:DivProps) {
  return <div {...rest} className={merge('taxpay-table-viewport',className)}/>;
}
export function TaxPayMobileTableCards({className,...rest}:DivProps) {
  return <div {...rest} className={merge('taxpay-mobile-table-cards',className)}/>;
}
export function TaxPayMobileTableCard({className,...rest}:ComponentPropsWithoutRef<'article'>) {
  return <article {...rest} className={merge('taxpay-mobile-table-card',className)}/>;
}
export function TaxPayTableState({className,...rest}:DivProps) {
  return <div {...rest} role="status" className={merge('taxpay-table-state',className)}/>;
}

/** A single semantic HTML table for all desktop record grids. Domain data and
 * interactive cells remain owned by the caller, including official amounts. */
export function TaxPayUnifiedTable({className,...rest}:ComponentPropsWithoutRef<'table'>){
  return <table {...rest} className={merge('taxpay-unified-table',className)}/>;
}

/** Shared Board-Meeting-inspired record-table layout for existing selectable
 * rows. It keeps list semantics where rows contain forms/buttons and wraps to
 * the same record card rhythm below the shared mobile breakpoint. */
type RecordListProps=Omit<DivProps,'children'> & {
  variant:'payments'|'beneficiaries';
  headers:readonly string[];
  children:ReactNode;
};
export function TaxPayRecordList({variant,headers,children,className,...rest}:RecordListProps){
  const previousHeadingClass=variant==='payments'?'taxpayer-transaction-list__columns':'beneficiary-directory__columns';
  return <div {...rest} data-record-layout={variant} className={merge('taxpay-record-list',className)}>
    <div className={merge('taxpay-record-list__columns',previousHeadingClass)} aria-hidden="true">
      {headers.map((label,index)=><p key={index} className="taxpay-record-list__heading">{label}</p>)}
    </div>
    <ul className="taxpay-record-list__rows">{children}</ul>
  </div>;
}
