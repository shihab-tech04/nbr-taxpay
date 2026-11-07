import {type ComponentPropsWithoutRef,type ReactNode} from 'react';
import {ChevronLeft,ChevronRight,Filter,Search,X} from 'lucide-react';

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

/** Office Management-style disclosure; callers retain filter and query ownership. */
export function TaxPayTableFilterToggle({expanded,onToggle,label}:{
  expanded:boolean;onToggle:()=>void;label:string;
}) {
  return <button type="button" className="taxpay-office-filter-toggle" onClick={onToggle}
    aria-expanded={expanded} aria-label={label}>
    <Filter size={16} aria-hidden="true"/>{label}
  </button>;
}
export type TaxPayActiveFilter = {key:string;label:string;onRemove:()=>void};
export function TaxPayActiveFilterChips({filters,clearLabel,onClear}:{
  filters:readonly TaxPayActiveFilter[];clearLabel:string;onClear:()=>void;
}) {
  if(!filters.length)return null;
  return <div className="taxpay-office-active-filters" aria-label="Active table filters">
    <div className="taxpay-office-active-filters__chips">{filters.map(filter=>
      <button type="button" key={filter.key} className="taxpay-office-active-filters__chip"
        aria-label={filter.label} onClick={filter.onRemove}>
        <span>{filter.label}</span><X size={13} aria-hidden="true"/>
      </button>
    )}</div>
    <button type="button" className="taxpay-office-active-filters__clear" onClick={onClear}>{clearLabel}</button>
  </div>;
}

/** Count presentation is centralized; caller owns filtering and totals. */
export function TaxPayTableCounter({shown,total,label}:{shown:number;total?:number;label:string}) {
  return <p className="taxpay-table-count" role="status" aria-live="polite">{label}: {shown}{total!==undefined&&<span className="taxpay-table-count__total">/ {total}</span>}</p>;
}
/** Board Meeting-style table toolbar: one owner for count, search and screen-specific filters. */
export type TaxPayRecordToolbarProps = {
  title: string;
  count: number;
  total: number;
  countLabel: string;
  search: string;
  searchLabel: string;
  searchPlaceholder: string;
  onSearchChange: (value:string)=>void;
  filters?: ReactNode;
  actions?: ReactNode;
};
export function TaxPayRecordToolbar({title,count,total,countLabel,search,searchLabel,searchPlaceholder,onSearchChange,filters,actions}:TaxPayRecordToolbarProps) {
  return <TaxPayTableToolbar className="taxpay-record-toolbar">
    <div className="taxpay-record-toolbar__heading">
      <h3>{title}</h3>
      <TaxPayTableCounter label={countLabel} shown={count} total={total}/>
    </div>
    <div className="taxpay-record-toolbar__controls">
      <label className="taxpay-record-toolbar__search">
        <Search size={17} aria-hidden="true"/>
        <input type="search" aria-label={searchLabel} placeholder={searchPlaceholder} value={search}
          onChange={event=>onSearchChange(event.target.value)}/>
      </label>
      {filters}
      {actions}
    </div>
  </TaxPayTableToolbar>;
}


/** Controlled pagination, matching Convay's shared page/total/per-page contract.
 * Data owners pass the current page of rows; this control never silently truncates records.
 */
export type TaxPayTablePaginationProps = {
  page: number;
  perPage: number;
  total: number;
  onPageChange: (page:number)=>void;
  labels?: {previous:string;next:string;showing:string;of:string;records:string;page:string};
};
export function TaxPayTablePagination({page,perPage,total,onPageChange,labels}:TaxPayTablePaginationProps) {
  if(!Number.isFinite(perPage)||perPage<=0||!Number.isFinite(total)||total<=perPage)return null;
  const pages=Math.ceil(total/perPage);
  const current=Math.max(1,Math.min(pages,Math.trunc(page)||1));
  const from=(current-1)*perPage+1;
  const to=Math.min(current*perPage,total);
  const text={previous:'Previous',next:'Next',showing:'Showing',of:'of',records:'records',page:'Page',...labels};
  const first=Math.max(1,Math.min(current-2,pages-4));
  const last=Math.min(pages,first+4);
  return <nav className="taxpay-table-pagination" aria-label={text.page+' navigation'}>
    <span className="taxpay-table-pagination__info" role="status" aria-live="polite">
      {text.showing} {from}–{to} {text.of} {total} {text.records}
    </span>
    <div className="taxpay-table-pagination__controls">
      <button type="button" disabled={current===1} onClick={()=>onPageChange(current-1)}
        aria-label={text.previous} className="taxpay-table-pagination__button">
        <ChevronLeft size={16} aria-hidden="true"/>{text.previous}
      </button>
      {Array.from({length:last-first+1},(_,index)=>first+index).map(value=>
        <button key={value} type="button" onClick={()=>onPageChange(value)}
          aria-label={text.page+' '+value} aria-current={value===current?'page':undefined}
          className="taxpay-table-pagination__page">{value}</button>
      )}
      <button type="button" disabled={current===pages} onClick={()=>onPageChange(current+1)}
        aria-label={text.next} className="taxpay-table-pagination__button">
        {text.next}<ChevronRight size={16} aria-hidden="true"/>
      </button>
    </div>
  </nav>;
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
  return <div {...rest} role="table" aria-label={ariaLabel} data-unified-table="true" data-record-layout={variant} className={merge('taxpay-record-list',className)}>
    <div className={merge('taxpay-record-list__columns',previousHeadingClass)} role="row">
      {headers.map((label,index)=><p key={index} role="columnheader" className="taxpay-record-list__heading">{label}</p>)}
    </div>
    <ul role="rowgroup" className="taxpay-record-list__rows">{children}</ul>
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
  onViewRow?: (row:Row)=>void;
  toolbar?: TaxPayRecordToolbarProps;
  emptyLabel?: string;
  loading?: boolean;
  error?: string;
  onRetry?: ()=>void;
  pagination?: TaxPayTablePaginationProps;
};
export function TaxPayDataGrid<Row>({
  rows,columns,getRowKey,variant,ariaLabel,className,testId,mobileTestId,
  getRowClassName,isSelected,renderMobileCard,onViewRow,toolbar,emptyLabel,loading=false,error,onRetry,pagination
}:UnifiedDataProps<Row>){
  if(variant==='ledger'||variant==='tabular') {
    const desktopTable = <TaxPayUnifiedTable aria-label={ariaLabel} data-testid={testId}
      className={merge(variant==='ledger'?'taxpay-unified-table hidden min-w-[840px] w-full text-left text-xs md:table':'taxpay-unified-table hidden min-w-full w-full text-left text-sm md:table',className)}>
      <thead><tr>{columns.map(column=><th scope="col" key={column.key} className={merge('p-3',column.headerClassName)}>{column.header}</th>)}</tr></thead>
      <tbody>{rows.map(row=><tr key={getRowKey(row)} className={getRowClassName?.(row)??'hover:bg-taxpay-light'}
        data-selected={isSelected?.(row)?'true':'false'}
        data-clickable-row={onViewRow?'true':undefined} tabIndex={onViewRow?0:undefined}
        onClick={onViewRow?(event)=>{
          if((event.target as HTMLElement).closest('button,a,input,select,textarea,[role="button"]'))return;
          onViewRow(row);
        }:undefined}
        onKeyDown={onViewRow?(event)=>{
          if(event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){
            event.preventDefault();onViewRow(row);
          }
        }:undefined}>
        {columns.map(column=><td key={column.key} className={merge('p-3',column.cellClassName)}>{column.renderCell(row)}</td>)}
      </tr>)}</tbody>
    </TaxPayUnifiedTable>;
    return <>
      {toolbar&&<TaxPayRecordToolbar {...toolbar}/>}
      {loading?<TaxPayTableState>{toolbar?.title??ariaLabel}: Loading…</TaxPayTableState>:
       error?<TaxPayTableState><p role="alert">{error}</p>{onRetry&&<button type="button" className="taxpay-record-toolbar__retry" onClick={onRetry}>Retry</button>}</TaxPayTableState>:
       rows.length===0&&emptyLabel?<TaxPayTableState>{emptyLabel}</TaxPayTableState>:<>
      {variant==='tabular'?<TaxPayTableViewport className="hidden md:block">{desktopTable}</TaxPayTableViewport>:desktopTable}
    <ul className="taxpay-mobile-table-cards grid gap-2 p-3 md:hidden" data-testid={mobileTestId} aria-label={ariaLabel}>
      {rows.map(row=><li className="taxpay-mobile-table-card" key={getRowKey(row)}
        role={!renderMobileCard&&onViewRow?'button':undefined}
        tabIndex={!renderMobileCard&&onViewRow?0:undefined}
        onClick={!renderMobileCard&&onViewRow?(event)=>{
          const interactive=(event.target as HTMLElement).closest('button,a,input,select,textarea,[role="button"]');
          if(interactive&&interactive!==event.currentTarget)return;
          onViewRow(row);
        }:undefined}
        onKeyDown={!renderMobileCard&&onViewRow?(event)=>{
          if(event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){
            event.preventDefault();onViewRow(row);
          }
        }:undefined}>
        {renderMobileCard ? renderMobileCard(row) : <dl className="taxpay-mobile-table-card__fields">
          {columns.map(column=><div className="taxpay-mobile-table-card__field" key={column.key}>
            <dt>{column.header}</dt>
            <dd>{column.renderCell(row)}</dd>
          </div>)}
        </dl>}
      </li>)}
    </ul>
    </>}
    {!loading&&!error&&pagination&&<TaxPayTablePagination {...pagination}/>}
  </>;
  }
  return <>
    {toolbar&&<TaxPayRecordToolbar {...toolbar}/>}
    {loading?<TaxPayTableState>{toolbar?.title??ariaLabel}: Loading…</TaxPayTableState>:
     error?<TaxPayTableState><p role="alert">{error}</p>{onRetry&&<button type="button" className="taxpay-record-toolbar__retry" onClick={onRetry}>Retry</button>}</TaxPayTableState>:
     rows.length===0&&emptyLabel?<TaxPayTableState>{emptyLabel}</TaxPayTableState>:
    <TaxPayRecordList variant={variant} aria-label={ariaLabel} className={className}
      headers={columns.map(column=>column.header)} data-testid={testId}>
      {rows.map(row=><li key={getRowKey(row)} role="row" data-selected={isSelected?.(row)?'true':'false'}
        tabIndex={onViewRow?0:undefined} className={merge('taxpay-record-list__row',getRowClassName?.(row))}
        onClick={onViewRow?(event)=>{
          if((event.target as HTMLElement).closest('button,a,input,select,textarea,[role="button"]'))return;
          onViewRow(row);
        }:undefined}
        onKeyDown={onViewRow?(event)=>{
          if(event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){
            event.preventDefault();onViewRow(row);
          }
        }:undefined}>
        {columns.map(column=><div className="taxpay-record-list__cell" role="cell" key={column.key}>
          <p className="sr-only" data-record-column-label>{column.header}: </p>{column.renderCell(row)}
        </div>)}
      </li>)}
    </TaxPayRecordList>}
    {!loading&&!error&&pagination&&<TaxPayTablePagination {...pagination}/>}
  </>;
}
