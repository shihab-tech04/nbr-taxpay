import {TaxPayDataGrid,TaxPayTableState,TaxPayTableCounter,TaxPayTableFilterToggle,TaxPayActiveFilterChips,TaxPayOfficeRegisterToolbar,TaxPayOfficeRegisterFilters,TaxPayOfficeRegisterFooter} from '../ui/TaxPayDataTable';
import React, { useEffect, useState } from 'react';
import { ArrowRight, Download, Search } from 'lucide-react';
import { DemoPaymentActivity } from './DemoPaymentActivity';
import {RecoveredStoryHistory} from './RecoveredStoryHistory';
import {activePreviewSession} from '../../services/previewAccountSession';
import {recoverableLegacyStorySession,recoverLegacyStoryPayments} from '../../services/legacyStoryPaymentRecovery';
import { AuthenticatedHistorySwitch } from './AuthenticatedHistorySwitch';
import {useAccountIdentity} from '../../services/accountIdentity';
import { useTaxState } from '../../services/taxState';
import { ASSESSMENT_YEARS } from '../../data/mockData';
import { CATEGORY_LABELS } from '../../data/paymentHeads';
import { ServiceCategoryTag } from '../ui/ServiceCategoryTag';
import { formatCurrency } from '../../services/numberFormat';
import { taxpayerPreviewReceipts } from '../../services/taxpayerEvidence';
import type { ChallanReceipt, PaymentCategory, Language } from '../../types/tax';
import {TaxpayerActivityTabs, TaxpayerPageHeading} from '../layout/TaxpayerPageStructure';
import {PaymentLifecycleDetails,type PaymentLifecycleRecord} from './EventBasedTaxLedger';
import {TaxPayModal} from '../ui/TaxPayModal';
import {ReceiptView} from '../common/ReceiptView';
import {getDetailedStorySessionPayments} from '../../services/story1AccountPaymentHistory';
import {makeConfirmedReceipt} from '../../services/confirmedPaymentCertificate';
import {TAXPAY_PUBLIC_ENDPOINT} from '../../config/publicBackend';

export function LegacyPaymentRecovery({language}:{language:Language}) {
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [restored,setRestored]=useState<number|null>(null);
  // No unrequested automatic merge from guest data to a public User ID.
  if(!recoverableLegacyStorySession() || restored!==null)return null;
  const bn=language==='bn';
  return <section className="mx-auto mb-4 max-w-7xl rounded-lg border border-taxpay-border bg-white p-3"
    aria-label={bn?'আগের পেমেন্ট ফিরিয়ে আনুন':'Recover earlier saved payments'}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-taxpay-text">
        {bn?'এই ব্রাউজারের আগের সংরক্ষিত পেমেন্টগুলো আপনার বর্তমান প্রোফাইলে যোগ করতে পারবেন।':
          'Earlier saved payments in this browser can be added to your current profile. Existing records will be preserved.'}
      </p>
      <button type="button" disabled={busy}
        className="min-h-11 rounded-lg border border-taxpay-border bg-white px-4 text-sm font-medium text-taxpay-primary disabled:opacity-60"
        onClick={()=>{setBusy(true);setError('');
          void recoverLegacyStoryPayments().then(n=>{setRestored(n);window.dispatchEvent(new Event('taxpay:story-payments-recovered'));})
            .catch(e=>setError(e instanceof Error?e.message:'Recovery was not confirmed.'))
            .finally(()=>setBusy(false));
        }}>
        {busy?(bn?'ফিরিয়ে আনা হচ্ছে…':'Restoring…'):(bn?'আগের পেমেন্ট ফিরিয়ে আনুন':'Restore earlier payments')}
      </button>
    </div>
    {error&&<p role="alert" className="mt-2 text-sm text-taxpay-error">{error}</p>}
  </section>;
}

const statusText: Record<string, {en:string; bn:string}> = {
  INITIATED:{en:'Initiated',bn:'শুরু হয়েছে'},
  GATEWAY_PENDING:{en:'Payment pending',bn:'পেমেন্ট অপেক্ষমাণ'},
  GATEWAY_SUCCESS:{en:'Gateway completed',bn:'গেটওয়ে সম্পন্ন'},
  TREASURY_SCROLLED:{en:'Treasury recorded',bn:'ট্রেজারিতে নথিভুক্ত'},
  FAILED:{en:'Failed',bn:'ব্যর্থ'},
  EXPIRED:{en:'Expired',bn:'মেয়াদ শেষ'},
  REVERSED:{en:'Reversed',bn:'প্রত্যাবর্তিত'},
  NOT_APPLICABLE:{en:'Not applicable',bn:'প্রযোজ্য নয়'},
  PENDING_RECONCILIATION:{en:'Reconciliation pending',bn:'সমন্বয় অপেক্ষমাণ'},
  CREDITED_TO_LEDGER:{en:'Credit not verified',bn:'ক্রেডিট যাচাই হয়নি'},
  CLAIMED_IN_RETURN:{en:'Claim not verified',bn:'দাবি যাচাই হয়নি'},
  DISPUTED:{en:'Disputed',bn:'বিরোধপূর্ণ'}
};

/** Read-only detail projection: a session receipt alone proves no Treasury settlement or tax credit. */
function historyLifecycleRecord(receipt:ChallanReceipt,language:Language):PaymentLifecycleRecord {
  return {
    reference:receipt.challanNo,
    taxEventId:receipt.taxEventId,
    transactionId:receipt.paymentTransactionId||receipt.gatewayTransactionId,
    challanNo:receipt.challanNo,
    payerName:receipt.payerName,payerTin:receipt.payerTin,
    // Attribute a single known beneficiary; multi-taxpayer details stay in allocations.
    taxpayerName:receipt.allocationItems?.length===1?receipt.allocationItems[0].taxpayerName:undefined,
    taxpayerTin:receipt.taxpayerTin,
    assessmentYear:receipt.assessmentYear,
    paymentType:CATEGORY_LABELS[receipt.paymentCategory]?.[language]||receipt.paymentCategory.replaceAll('_',' '),
    taxZone:receipt.taxZone,taxCircle:receipt.taxCircle,
    channel:receipt.paymentMethod.replaceAll('_',' '),
    amountMinor:Math.round(receipt.totalAmount*100),
    createdAt:receipt.createdAt,status:receipt.treasuryStatus.replaceAll('_',' '),
    financialReceiptStatus:'Not verified',taxCreditStatus:'Not verified',
    source:'TaxPay payment record',
    events:[
      {id:receipt.id+':created',title:'Payment record created',occurredAt:receipt.createdAt,source:'TaxPay payment record'},
      ...(receipt.completedAt?[{id:receipt.id+':status',title:receipt.treasuryStatus.replaceAll('_',' '),
        occurredAt:receipt.completedAt,source:'TaxPay payment record'}]:[])
    ],
    allocations:receipt.allocationItems?.map((a,index)=>({
      id:String(index),title:a.taxpayerName+' · '+a.paymentServiceEn,
      assessmentYear:a.assessmentYear,amountMinor:a.amountMinor
    }))||receipt.items.map((a,index)=>({id:String(index),title:a.headNameEn,
      assessmentYear:receipt.assessmentYear,amountMinor:Math.round(a.totalAmount*100)}))
  };
}

const escapeCsv = (value: unknown) => {
  let raw = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(raw)) raw = "'" + raw;
  return '"' + raw.replace(/"/g, '""') + '"';
};

export const PaymentHistory: React.FC<{activityTabs?:boolean}> = ({activityTabs=false}) => {
  const { receipts, selectReceipt, language, taxpayerProfile, userRole, demoUser, previewAccount } = useTaxState();
  const {user:authenticatedUser}=useAccountIdentity();
  const [query, setQuery] = useState('');
  const [tableFiltersExpanded,setTableFiltersExpanded]=useState(false);
  const [year, setYear] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [lifecycleReceipt,setLifecycleReceipt]=useState<ChallanReceipt|null>(null);
  const [storedTravelReceipts,setStoredTravelReceipts]=useState<ChallanReceipt[]>([]);
  const [selectedStoredReceipt,setSelectedStoredReceipt]=useState<ChallanReceipt|null>(null);
  const [travelHistoryError,setTravelHistoryError]=useState(false);
  const [travelHistoryLoading,setTravelHistoryLoading]=useState(false);
  const [travelHistoryRevision,setTravelHistoryRevision]=useState(0);
  const guestSourceEnabled=!authenticatedUser&&!demoUser&&!previewAccount&&
    Boolean(TAXPAY_PUBLIC_ENDPOINT.url&&TAXPAY_PUBLIC_ENDPOINT.publishableKey);
  // Only an existing browser session can read its original simulated payments.
  // An entered TIN, passport or public reference never grants guest history.
  useEffect(()=>{
    if(!guestSourceEnabled){setStoredTravelReceipts([]);setTravelHistoryError(false);setTravelHistoryLoading(false);return;}
    let hasSession=false;
    try{hasSession=Boolean(sessionStorage.getItem('taxpay-guest-simulation-session'));}catch{hasSession=false;}
    if(!hasSession){setStoredTravelReceipts([]);setTravelHistoryError(false);setTravelHistoryLoading(false);return;}
    let active=true;
    setTravelHistoryLoading(true);setTravelHistoryError(false);
    void getDetailedStorySessionPayments().then(rows=>{
      if(!active)return;
      // The immutable original Taxpayer SQL record is authoritative for both
      // receipt and certificate; never promote a local preview-only snapshot.
      const travel=rows.filter(row=>row.service==='TRAVEL_TAX')
        .map(row=>makeConfirmedReceipt(row));
      if(travel.some(receipt=>receipt.paymentCategory!=='TRAVEL_TAX'||
        !receipt.isSimulatedDemo||!receipt.paymentTransactionId))
        throw new Error('Travel Tax source history is inconsistent');
      setStoredTravelReceipts(travel);
    }).catch(()=>{if(active){setStoredTravelReceipts([]);setTravelHistoryError(true);}})
      .finally(()=>{if(active)setTravelHistoryLoading(false);});
    return()=>{active=false;};
  },[guestSourceEnabled,travelHistoryRevision]);
  const bn = language === 'bn';
  const label = (en:string,bengali:string)=> bn ? bengali : en;
  // payerTin is not authoritative taxpayer/credit ownership. Only initiated demo receipts
  // are visible until a separate beneficiary and entitlement contract has been certified.
  const localPreview=taxpayerPreviewReceipts(receipts, taxpayerProfile.tin, userRole, demoUser, Boolean(authenticatedUser));
  const originalTravel=guestSourceEnabled?storedTravelReceipts:[];
  const recoveredIds=new Set(originalTravel.map(receipt=>receipt.paymentTransactionId));
  const allVisible=[...originalTravel,...localPreview.filter(receipt=>
    !receipt.paymentTransactionId||!recoveredIds.has(receipt.paymentTransactionId))];
  const openReceipt=(receipt:ChallanReceipt)=>{
    if(guestSourceEnabled&&recoveredIds.has(receipt.paymentTransactionId))
      setSelectedStoredReceipt(receipt);
    else selectReceipt(receipt.id);
  };
  const filtered = allVisible
    .filter(r => (r.challanNo + ' ' + r.tokenNumber + ' ' + r.payerName).toLowerCase().includes(query.trim().toLowerCase()))
    .filter(r => year === 'ALL' || r.assessmentYear === year)
    .filter(r => category === 'ALL' || r.paymentCategory === category);
  const categoryText = (value: PaymentCategory) =>
    bn ? (CATEGORY_LABELS[value]?.bn || value) : (CATEGORY_LABELS[value]?.en || value);
  const statusLabel = (value:string) => statusText[value] ? (bn ? statusText[value].bn : statusText[value].en) : value;
  const treasuryLabel = (receipt:ChallanReceipt) => receipt.isSimulatedDemo && receipt.treasuryStatus === 'TREASURY_SCROLLED'
    ? label('Treasury status not verified','ট্রেজারির অবস্থা যাচাই হয়নি')
    : receipt.isSimulatedDemo && receipt.treasuryStatus === 'GATEWAY_SUCCESS'
      ? label('Payment record saved','পেমেন্ট রেকর্ড সংরক্ষিত') : statusLabel(receipt.treasuryStatus);
  const exportDemo = () => {
    const headings=['Reference','Token','Payment category','Assessment year','Payer TIN','Amount ৳','Treasury status','Credit status'];
    const lines = filtered.map((r:ChallanReceipt)=>[
      r.challanNo,r.tokenNumber,r.paymentCategory,r.assessmentYear,r.payerTin,r.totalAmount,treasuryLabel(r),statusLabel(r.taxCreditStatus)
    ].map(escapeCsv).join(','));
    const csv=[headings.map(escapeCsv).join(','),...lines].join('\r\n');
    const url=URL.createObjectURL(new Blob(['\uFEFF',csv],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='Sohojkor_payment_activity.csv';
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  };

  if (authenticatedUser) return <AuthenticatedHistorySwitch ownerUid={authenticatedUser.id}
    language={language} activityTabs={activityTabs} />;
  if (demoUser) return <>{previewAccount&&<LegacyPaymentRecovery language={language}/>}<DemoPaymentActivity activityTabs={activityTabs}/>{previewAccount&&activePreviewSession()?.profileId===previewAccount.id&&<RecoveredStoryHistory profileId={previewAccount.id} language={language}/>}</>;

  return (
    <div data-taxpay-register-page="true" className={`mx-auto max-w-7xl space-y-4 pb-12 ${bn?'font-bengali':''}`}>
      <TaxpayerPageHeading title={label('Payments & activity','পেমেন্ট ও লেনদেন')}
        description={label('Activity overview','লেনদেনের সারসংক্ষেপ')} />
      {activityTabs && <TaxpayerActivityTabs />}
      <section className="taxpay-office-register-frame rounded-xl border border-taxpay-border bg-white px-4 sm:px-5" aria-label={label('Payment register','পেমেন্ট নিবন্ধন')}>
        <TaxPayOfficeRegisterToolbar title={label('Payment records','পেমেন্টের তথ্য')}
          count={filtered.length} total={allVisible.length} countLabel={label('records','রেকর্ড')}
          searchValue={query} onSearchChange={setQuery}
          searchLabel={label('Search payments','পেমেন্ট খুঁজুন')}
          searchPlaceholder={label('Reference or payer','রেফারেন্স বা পরিশোধকারী')}
          filterLabel={label('Filter','ফিল্টার')} filtersOpen={tableFiltersExpanded}
          onToggleFilters={()=>setTableFiltersExpanded(open=>!open)}
          actions={<button type="button" onClick={exportDemo} disabled={!filtered.length}
            className="inline-flex items-center gap-2 rounded-lg border border-taxpay-border px-3 text-sm font-semibold text-taxpay-dark hover:bg-taxpay-light disabled:opacity-50">
            <Download aria-hidden="true" size={16}/>{label('Export records','রেকর্ড নিন')}
          </button>}/>
        <TaxPayOfficeRegisterFilters open={tableFiltersExpanded} ariaLabel={label('Search and filters','খোঁজ ও ফিল্টার')}>
          {/* Keep previous accessibility contract for the expanded panel without a second visible count. */}
          <p className="sr-only" aria-live="polite">{label('Records','রেকর্ড')}: {filtered.length}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="activity-year" className="mb-1 block text-sm font-semibold text-taxpay-text">{label('Assessment year','করবর্ষ')}</label>
            <select id="activity-year" value={year} onChange={e=>setYear(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-taxpay-border bg-white px-3 text-sm text-taxpay-text">
              <option value="ALL">{label('All years','সব করবর্ষ')}</option>
              {ASSESSMENT_YEARS.map(y=><option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="activity-category" className="mb-1 block text-sm font-semibold text-taxpay-text">{label('Payment type','পেমেন্টের ধরন')}</label>
            <select id="activity-category" value={category} onChange={e=>setCategory(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-taxpay-border bg-white px-3 text-sm text-taxpay-text">
              <option value="ALL">{label('All types','সব ধরন')}</option>
              {Object.entries(CATEGORY_LABELS).map(([key,value])=><option key={key} value={key}>{bn?value.bn:value.en}</option>)}
            </select>
          </div>
        </div>
        </TaxPayOfficeRegisterFilters>
        <TaxPayActiveFilterChips clearLabel={label('Clear all','সব ফিল্টার মুছুন')}
        onClear={()=>{setQuery('');setYear('ALL');setCategory('ALL');}}
        filters={[
          ...(query.trim()?[{key:'search',label:label('Search: ','অনুসন্ধান: ')+query.trim(),onRemove:()=>setQuery('')}]:[]),
          ...(year!=='ALL'?[{key:'year',label:year,onRemove:()=>setYear('ALL')}]:[]),
          ...(category!=='ALL'?[{key:'category',label:bn?CATEGORY_LABELS[category]?.bn??category:CATEGORY_LABELS[category]?.en??category,onRemove:()=>setCategory('ALL')}]:[])
        ]}/>
      {guestSourceEnabled&&travelHistoryLoading&&<p role="status" className="mb-2 text-sm text-taxpay-muted">
        {label('Checking your saved Travel Tax receipts…','আপনার সংরক্ষিত ভ্রমণ করের রসিদ যাচাই হচ্ছে…')}
      </p>}
      {guestSourceEnabled&&travelHistoryError&&<div role="alert" className="mb-2 flex flex-wrap items-center gap-2 text-sm text-taxpay-error">
        <span>{label('Saved Travel Tax records are temporarily unavailable. No missing-record result has been confirmed.',
          'সংরক্ষিত ভ্রমণ করের তথ্য সাময়িকভাবে পাওয়া যাচ্ছে না। রেকর্ড নেই বলে নিশ্চিত হওয়া যায়নি।')}</span>
        <button type="button" onClick={()=>setTravelHistoryRevision(v=>v+1)}
          className="min-h-11 rounded-lg border border-taxpay-border px-3 text-taxpay-primary">
          {label('Retry','আবার চেষ্টা করুন')}
        </button>
      </div>}
      <div className="taxpay-office-register__body">
        {filtered.length===0 ? (
          <TaxPayTableState className="rounded-lg bg-taxpay-background p-5">
            <h2 className="text-base font-semibold text-taxpay-text">{label('No matching records','মিল পাওয়া যায়নি')}</h2>
            <p className="mt-1 text-sm text-taxpay-muted">{label('Try another reference, year, or payment type.','অন্য রেফারেন্স, করবর্ষ বা পেমেন্টের ধরন নির্বাচন করুন।')}</p>
          </TaxPayTableState>
        ) : <>

          <TaxPayDataGrid variant="tabular" rows={filtered} getRowKey={r=>r.id}
            ariaLabel={label('Payment records','পেমেন্টের তথ্য')}
            columns={[
              {key:'reference',header:label('Reference','রেফারেন্স'),renderCell:r=><p className="break-all font-mono-plex text-sm">{r.challanNo}</p>},
              {key:'type',header:label('Payment type','পেমেন্টের ধরন'),renderCell:r=><ServiceCategoryTag code={r.paymentCategory}>{categoryText(r.paymentCategory)}</ServiceCategoryTag>},
              {key:'year',header:label('Year','বর্ষ'),renderCell:r=><p className="whitespace-nowrap">{r.assessmentYear}</p>},
              {key:'amount',header:label('Amount','টাকার পরিমাণ'),headerClassName:'text-right',cellClassName:'text-right tabular-nums',renderCell:r=><p className="whitespace-nowrap font-semibold">{formatCurrency(r.totalAmount,language)}</p>},
              {key:'status',header:label('Status','অবস্থা'),renderCell:r=><p>{treasuryLabel(r)}</p>},
              {key:'details',header:label('Details','বিস্তারিত'),renderCell:r=><div className="flex flex-wrap gap-1">
                <button type="button" onClick={()=>setLifecycleReceipt(r)} className="min-h-11 rounded-lg px-3 font-semibold text-taxpay-dark hover:bg-taxpay-light">{label('Lifecycle','পেমেন্ট ধাপ')}</button>
                <button type="button" onClick={()=>openReceipt(r)} data-testid={recoveredIds.has(r.paymentTransactionId)?'travel-session-history-view':undefined} className="min-h-11 rounded-lg px-3 font-semibold text-taxpay-dark hover:bg-taxpay-light">{label('View','দেখুন')}</button>
              </div>}
            ]}
            renderMobileCard={r=><>
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 break-all font-mono-plex text-sm font-semibold text-taxpay-text">{r.challanNo}</p>
                <p className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(r.totalAmount,language)}</p>
              </div>
              <p className="taxpay-mobile-table-card__meta"><ServiceCategoryTag code={r.paymentCategory}>{categoryText(r.paymentCategory)}</ServiceCategoryTag> · {label('AY','করবর্ষ')} {r.assessmentYear}</p>
              <p className="taxpay-mobile-table-card__meta">{label('Treasury status','ট্রেজারির অবস্থা')}: {treasuryLabel(r)}</p>
              <p className="taxpay-mobile-table-card__meta">{label('Credit status','ক্রেডিটের অবস্থা')}: {statusLabel(r.taxCreditStatus)}</p>
              <div className="taxpay-mobile-table-card__actions">
                <button type="button" onClick={()=>setLifecycleReceipt(r)} className="min-h-11 flex-1 rounded-lg border border-taxpay-border px-3 text-sm font-semibold text-taxpay-dark">{label('Payment lifecycle','পেমেন্টের ধাপসমূহ')} <ArrowRight aria-hidden="true" size={16}/></button>
                <button type="button" onClick={()=>openReceipt(r)} data-testid={recoveredIds.has(r.paymentTransactionId)?'travel-session-history-view':undefined} className="min-h-11 flex-1 rounded-lg bg-taxpay-light px-3 text-sm font-semibold text-taxpay-dark">{label('View details','বিস্তারিত দেখুন')} <ArrowRight aria-hidden="true" size={16}/></button>
              </div>
            </>}/>

        </>}
      </div>
        <TaxPayOfficeRegisterFooter shown={filtered.length} total={allVisible.length}
          labels={{showing:label('Showing','দেখানো হচ্ছে'),of:label('of','মোট'),records:label('records','রেকর্ড')}}/>
      </section>
      {selectedStoredReceipt&&guestSourceEnabled&&<TaxPayModal title={label('Payment receipt','পেমেন্ট রসিদ')}
        service="status" className="receipt-modal" onClose={()=>setSelectedStoredReceipt(null)} footer={<></>}>
        <ReceiptView receipt={selectedStoredReceipt} embedded onBack={()=>setSelectedStoredReceipt(null)}/>
      </TaxPayModal>}
      {lifecycleReceipt&&<TaxPayModal title={label('Payment details','পেমেন্টের বিবরণ')}
        onClose={()=>setLifecycleReceipt(null)} hideFooter className="taxpayer-transaction-detail">
        <PaymentLifecycleDetails language={language} record={historyLifecycleRecord(lifecycleReceipt,language)}/>
      </TaxPayModal>}
    </div>
  );
};
