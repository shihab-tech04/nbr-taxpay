import {Fragment,type ComponentPropsWithoutRef,type ReactNode} from 'react';

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
/** A single filter container used by ledger, activity, and beneficiary grids. */
export function TaxPayTableControls({className,...rest}:DivProps) {
  return <div {...rest} className={merge('taxpay-table-controls',className)}/>;
}
/** Count presentation is centralized; caller owns filtering and totals. */
export function TaxPayTableCounter({shown,total,label}:{shown:number;total?:number;label:string}) {
  return <p className="taxpay-table-count" role="status" aria-live="polite">{label}: {shown}{total!==undefined&&<span className="taxpay-table-count__total">/ {total}</span>}</p>;
}
export function TaxPayTableState({className,...rest}:DivProps) {
  return <div {...rest} role="status" className={merge('taxpay-table-state',className)}/>;
}

/** A single semantic HTML table for all desktop record grids. Domain data and
 * interactive cells remain owned by the caller, including official amounts. */
export function TaxPayUnifiedTable({className,...rest}:ComponentPropsWithoutRef<'table'>){
  return <table {...rest} data-unified-table="true" className={merge('taxpay-unified-table',className)}/>;
}

/** Shared Board-Meeting-inspired record-table layout for existing selectable
 * rows. It keeps list semantics where rows contain forms/buttons and wraps to
 * the same record card rhythm below the shared mobile breakpoint. */
type RecordListProps=Omit<DivProps,'children'> & {
  variant:'payments'|'beneficiaries'|'documents'|'exceptions';
  headers:readonly string[];
  children:ReactNode;
};
export function TaxPayRecordList({variant,headers,children,className,'aria-label':ariaLabel,...rest}:RecordListProps){
  const previousHeadingClass=variant==='payments'?'taxpayer-transaction-list__columns':variant==='beneficiaries'?'beneficiary-directory__columns':'';
  return <div {...rest} data-unified-table="true" data-record-layout={variant} className={merge('taxpay-record-list',className)}>
    <div className={merge('taxpay-record-list__columns',previousHeadingClass)} aria-hidden="true">
      {headers.map((label,index)=><p key={index} className="taxpay-record-list__heading">{label}</p>)}
    </div>
    <ul aria-label={ariaLabel} className="taxpay-record-list__rows">{children}</ul>
  </div>;
}

/**
 * Column-driven source of truth for Tax ledger, Payments & activity, and
 * Beneficiaries. Domain screens own business rules and cell interactions;
 * this component owns headers, row identity, responsive rendering and rhythm.
 * Official receipt and certificate print tables are excluded.
 */
export type TaxPayDataColumn<Row> = {
  key: string;
  header: string;
  renderCell: (row:Row) => ReactNode;
  cellClassName?: string;
  headerClassName?: string;
};
type UnifiedDataProps<Row> = {
  rows: readonly Row[];
  columns: readonly TaxPayDataColumn<Row>[];
  getRowKey: (row:Row) => string;
  variant: 'ledger' | 'tabular' | 'payments' | 'beneficiaries' | 'documents' | 'exceptions';
  ariaLabel: string;
  className?: string;
  testId?: string;
  mobileTestId?: string;
  getRowClassName?: (row:Row) => string;
  isSelected?: (row:Row) => boolean;
  renderMobileCard?: (row:Row) => ReactNode;
};
export function TaxPayDataGrid<Row>({
  rows,columns,getRowKey,variant,ariaLabel,className,testId,mobileTestId,
  getRowClassName,isSelected,renderMobileCard
}:UnifiedDataProps<Row>){
  if(variant==='ledger'||variant==='tabular') {
    const desktopTable = <TaxPayUnifiedTable aria-label={ariaLabel} data-testid={testId}
      className={merge(variant==='ledger'?'taxpay-unified-table hidden min-w-[840px] w-full text-left text-xs md:table':'taxpay-unified-table hidden min-w-full w-full text-left text-sm md:table',className)}>
      <thead><tr>{columns.map(column=><th scope="col" key={column.key} className={merge('p-3',column.headerClassName)}>{column.header}</th>)}</tr></thead>
      <tbody>{rows.map(row=><tr key={getRowKey(row)} className={getRowClassName?.(row)??'hover:bg-taxpay-light'}>
        {columns.map(column=><td key={column.key} className={merge('p-3',column.cellClassName)}>{column.renderCell(row)}</td>)}
      </tr>)}</tbody>
    </TaxPayUnifiedTable>;
    return <>
      {variant==='tabular'?<TaxPayTableViewport className="hidden md:block">{desktopTable}</TaxPayTableViewport>:desktopTable}
    <ul className="taxpay-mobile-table-cards grid gap-2 p-3 md:hidden" data-testid={mobileTestId} aria-label={ariaLabel}>
      {rows.map(row=><li className="taxpay-mobile-table-card" key={getRowKey(row)}>
        {renderMobileCard ? renderMobileCard(row) : <dl className="taxpay-mobile-table-card__fields">
          {columns.map(column=><div className="taxpay-mobile-table-card__field" key={column.key}>
            <dt>{column.header}</dt>
            <dd>{column.renderCell(row)}</dd>
          </div>)}
        </dl>}
      </li>)}
    </ul>
  </>;
  }
  return <TaxPayRecordList variant={variant} aria-label={ariaLabel} className={className}
    headers={columns.map(column=>column.header)} data-testid={testId}>
    {rows.map(row=><li key={getRowKey(row)} data-selected={isSelected?.(row)?'true':'false'}
      className={merge('taxpay-record-list__row',getRowClassName?.(row))}>
      {columns.map(column=><Fragment key={column.key}><p className="sr-only" data-record-column-label>{column.header}: </p>{column.renderCell(row)}</Fragment>)}
    </li>)}
  </TaxPayRecordList>;
}
