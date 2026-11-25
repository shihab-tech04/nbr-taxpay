import React, { useContext, useEffect, useId, useRef, useState } from 'react';
import {createPortal} from 'react-dom';
import {TaxPayModalFooterTarget} from '../ui/TaxPayModal';
import {UiButton,UiSelect} from '../ui/Controls';
import {
  Send,
  CheckCircle2
} from 'lucide-react';
import {TaxpayerActivityTabs, TaxpayerPageHeading} from '../layout/TaxpayerPageStructure';
import { useTaxState } from '../../services/taxState';
import { ASSESSMENT_YEARS } from '../../data/mockData';
import { MASTER_PAYMENT_HEADS } from '../../data/paymentHeads';
import { useAccountIdentity } from '../../services/accountIdentity';
import { taxpayerPreviewReceipts } from '../../services/taxpayerEvidence';
import {TaxPayDataGrid,TaxPayTableControls,TaxPayTableCounter,TaxPayTableState} from '../ui/TaxPayDataTable';
import type {ChallanReceipt,CorrectionRequest} from '../../types/tax';
import {listPreviewCorrections,submitPreviewCorrection,previewCorrectionStatus,type PreviewCorrectionRecord} from '../../services/previewCorrections';
import {activePreviewSession} from '../../services/previewAccountSession';
import {getDetailedStorySessionPayments} from '../../services/story1AccountPaymentHistory';
import {makeConfirmedReceipt} from '../../services/confirmedPaymentCertificate';

type HistoricalCorrectionReference={reference:string;year:string;amount:number;title:string};
export const CorrectionRequests: React.FC<{activityTabs?:boolean;recordedReceipts?:readonly ChallanReceipt[];historicalRecords?:readonly HistoricalCorrectionReference[];preferredReference?:string;embedded?:boolean;historyOnly?:boolean;assessmentYear?:string;onViewRequests?:()=>void}> =
  ({activityTabs=false,recordedReceipts=[],historicalRecords=[],preferredReference='',embedded=false,historyOnly=false,assessmentYear='all',onViewRequests}) => {
  const formId=useId();
  const footerTarget=useContext(TaxPayModalFooterTarget);
  const { corrections, receipts, taxpayerProfile, userRole, demoUser, addCorrectionRequest, language, previewAccount, routeParams } = useTaxState();
  const tr=(en:string,bn:string)=>language==='bn'?bn:en;
  const {user:authenticatedUser}=useAccountIdentity();
  const session=activePreviewSession();
  const ownerKey=previewAccount&&session?.profileId===previewAccount.id?session.capability:null;
  const serverMode=Boolean(ownerKey);
  const [receiptState,setReceiptState]=useState<{key:string|null;phase:'loading'|'ready'|'error';rows:ChallanReceipt[]}>({key:null,phase:'loading',rows:[]});
  const [receiptRetry,setReceiptRetry]=useState(0);
  useEffect(()=>{
    let active=true;
    setReceiptState({key:ownerKey,phase:ownerKey?'loading':'ready',rows:[]});
    if(!ownerKey||historyOnly){setReceiptState({key:ownerKey,phase:'ready',rows:[]});return()=>{active=false;};}
    // The existing preview capability authorizes this owner-scoped read.
    // Do not infer a receipt from route parameters or from illustrative cases.
    void getDetailedStorySessionPayments().then(payments=>{
      if(!active||activePreviewSession()?.capability!==ownerKey)return;
      const rows=payments.flatMap(payment=>{
        try{return [makeConfirmedReceipt(payment)];}catch{return [];}
      });
      setReceiptState({key:ownerKey,phase:'ready',rows});
    }).catch(()=>{if(active)setReceiptState({key:ownerKey,phase:'error',rows:[]});});
    return()=>{active=false;};
  },[ownerKey,receiptRetry,historyOnly]);
  const receiptPhase=receiptState.key===ownerKey?receiptState.phase:'loading';
  // Server-mode receipt ownership comes from the private session API, not a
  // client-supplied e-TIN or an illustrative profile's legacy identifier.
  const visibleReceipts=[...new Map((serverMode
    ?(receiptState.key===ownerKey?receiptState.rows:[])
    :previewAccount?[]:[
      ...taxpayerPreviewReceipts(receipts,taxpayerProfile.tin,userRole,demoUser,Boolean(authenticatedUser)),
      ...recordedReceipts
    ].filter(r=>r.isSimulatedDemo===true && r.payerTin===taxpayerProfile.tin)
  ).map(r=>[r.paymentTransactionId||r.challanNo,r])).values()];
  const [serverRecords,setServerRecords]=useState<PreviewCorrectionRecord[]>([]);
  const [historyLoading,setHistoryLoading]=useState(Boolean(previewAccount));
  const [historyError,setHistoryError]=useState(false);
  const [historyRetry,setHistoryRetry]=useState(0);
  const [historyOwner,setHistoryOwner]=useState<string|null>(null);
  useEffect(()=>{
    let active=true, sequence=0;
    setServerRecords([]);setHistoryOwner(ownerKey);
    setHistoryError(Boolean(previewAccount&&!serverMode));setHistoryLoading(serverMode&&!embedded);
    if(!serverMode||embedded)return()=>{active=false;};
    const load=()=>{
      const attempt=++sequence;
      setHistoryLoading(true);setHistoryError(false);
      void listPreviewCorrections().then(rows=>{
        if(active&&attempt===sequence)setServerRecords(rows);
      }).catch(()=>{if(active&&attempt===sequence)setHistoryError(true);})
        .finally(()=>{if(active&&attempt===sequence)setHistoryLoading(false);});
    };
    load();
    window.addEventListener('taxpay:preview-corrections-changed',load);
    window.addEventListener('focus',load);
    const refreshVisible=()=>{if(document.visibilityState==='visible')load();};
    document.addEventListener('visibilitychange',refreshVisible);
    const timer=window.setInterval(refreshVisible,60000);
    return()=>{active=false;window.clearInterval(timer);document.removeEventListener('visibilitychange',refreshVisible);window.removeEventListener('taxpay:preview-corrections-changed',load);window.removeEventListener('focus',load);};
  },[ownerKey,serverMode,historyRetry,embedded,Boolean(previewAccount)]);
  const localCorrections = corrections.filter(c=>visibleReceipts.some(r=>r.challanNo===c.challanNo && r.payerTin===c.taxpayerTin));
  const visibleCorrections:(CorrectionRequest&{simulationRecorded?:boolean;officeSyncState?:PreviewCorrectionRecord['officeSyncState'];reviewState?:PreviewCorrectionRecord['reviewState'];initiatedBy?:PreviewCorrectionRecord['initiatedBy'];requestedOutcome?:string|null;evidenceNote?:string|null})[]=serverMode
    ?(historyOwner===ownerKey?serverRecords:[]).map(row=>({
      id:row.id,ticketNo:'SIM-CORR-'+row.id,challanNo:row.originalReference,taxpayerTin:taxpayerProfile.tin,
      taxpayerName:taxpayerProfile.nameEn,requestedBy:taxpayerProfile.nameEn,
      requestDate:row.createdAt,lastUpdated:row.createdAt,currentAssessmentYear:row.currentAY,
      proposedAssessmentYear:row.proposedAY,currentCircle:row.currentCircle,proposedCircle:row.proposedCircle,
      currentHeadCode:row.currentHeadCode,proposedHeadCode:row.proposedHeadCode,reason:row.reason,
      workflowStage:'MAKER_SUBMITTED',simulationRecorded:true,officeSyncState:row.officeSyncState,reviewState:row.reviewState,
      approverRemarks:row.reviewReason??undefined,initiatedBy:row.initiatedBy,requestedOutcome:row.requestedOutcome,evidenceNote:row.evidenceNote,
      ...(row.allocationIndex!==null?{targetAllocationIndex:row.allocationIndex}:{}),
      ...(row.allocationId?{targetAllocationId:row.allocationId}:{})
    }))
    :localCorrections;

  const routeReference=typeof routeParams?.originalReference==='string'
    ?routeParams.originalReference.slice(0,80):'';
  const [challanNo, setChallanNo] = useState(preferredReference||routeReference);
  const visibleHistorical=serverMode&&previewAccount?.id==='user1'?historicalRecords:[];
  const selectedHistorical=visibleHistorical.find(x=>x.reference===challanNo);
  const selectedReceipt = selectedHistorical?undefined:visibleReceipts.find(r=>r.challanNo===challanNo || r.paymentTransactionId===challanNo) ??
    (!challanNo?visibleReceipts[0]:undefined);
  const selectedChallanNo = selectedHistorical?.reference??selectedReceipt?.challanNo??'';
  const allocations=selectedReceipt?.allocationItems??[];
  const [allocationIndex,setAllocationIndex]=useState('');
  const selectedIndex=allocations.length===1?0:allocationIndex===''?-1:Number(allocationIndex);
  const selectedAllocation=allocations[selectedIndex];
  const requiresAllocation=allocations.length>1;
  const currentAY = selectedHistorical?.year??selectedAllocation?.assessmentYear??(requiresAllocation?'':selectedReceipt?.assessmentYear??'');
  const [proposedAY, setProposedAY] = useState('');
  const currentCircle = selectedReceipt?.taxCircle ?? '';
  const [proposedCircle, setProposedCircle] = useState('');
  const currentHeadCode = selectedAllocation?.economicCode ?? (requiresAllocation?'':selectedReceipt?.items?.[0]?.economicCode??'');
  const [proposedHeadCode, setProposedHeadCode] = useState('');
  const proposedHead = proposedHeadCode || currentHeadCode;
  const effectiveAY=proposedAY||currentAY;
  const effectiveCircle=proposedCircle.trim()||currentCircle;
  const [busy,setBusy]=useState(false);
  const submitLock=useRef(false);
  const pendingSubmission=useRef<{fingerprint:string;key:string}|null>(null);
  const [reason, setReason] = useState('');
  const [submittedTicket, setSubmittedTicket] = useState<string | null>(null);
  const [caseSearch,setCaseSearch]=useState(typeof routeParams?.correctionRequestId==='string'?routeParams.correctionRequestId:'');
  const [error, setError] = useState('');
  useEffect(()=>{
    setAllocationIndex('');setProposedAY('');setProposedCircle('');setProposedHeadCode('');
    setReason('');setError('');setSubmittedTicket(null);
  },[selectedChallanNo,ownerKey]);
  const normalizeYear=(year:string)=>year.trim().replace(/^(\d{4})-(\d{2})$/,(_,start:string,end:string)=>start+'-'+start.slice(0,2)+end);

  const caseNeedle=caseSearch.trim().toLocaleLowerCase();
  const yearCases=visibleCorrections.filter(c=>assessmentYear==='all'||normalizeYear(c.currentAssessmentYear)===normalizeYear(assessmentYear));
  const filteredCases=yearCases.filter(c=>!caseNeedle || [
    c.ticketNo,c.challanNo,c.simulationRecorded?previewCorrectionStatus(c,language):c.workflowStage,c.reason,c.currentAssessmentYear,c.proposedAssessmentYear
  ].some(value=>String(value??'').toLocaleLowerCase().includes(caseNeedle)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(submitLock.current)return;
    setSubmittedTicket(null);
    if ((!selectedReceipt&&!selectedHistorical) || !selectedChallanNo) {
      setError(tr('Select a payment reference.','একটি পেমেন্ট রেফারেন্স নির্বাচন করুন।'));return;
    }
    if(requiresAllocation && !selectedAllocation){
      setError(tr('Select the exact payment allocation to correct.','সংশোধনের জন্য নির্দিষ্ট পরিশোধের বরাদ্দ নির্বাচন করুন।'));return;
    }
    if(reason.trim().length<10){
      setError(tr('Explain the correction in at least 10 characters.','সংশোধনের কারণ অন্তত ১০ অক্ষরে লিখুন।'));return;
    }
    if (normalizeYear(currentAY)===normalizeYear(effectiveAY) && currentCircle===effectiveCircle && currentHeadCode===proposedHead) {
      setError(tr('Choose at least one different year, circle or payment head.','অন্তত একটি ভিন্ন করবর্ষ, সার্কেল বা কর খাত নির্বাচন করুন।'));return;
    }
    submitLock.current=true;setBusy(true);setError('');
    try{
      if(previewAccount && !serverMode)throw Error('Session expired');
      if(serverMode){
        if(!selectedHistorical&&!selectedReceipt?.paymentTransactionId)throw Error('Payment unavailable');
        const payload={
          paymentId:selectedHistorical?null:selectedReceipt!.paymentTransactionId!,
          ...(selectedHistorical?{historicalReference:selectedHistorical.reference}:{}),
          allocationIndex:selectedAllocation?selectedIndex:null,
          allocationId:selectedAllocation?.allocationId??null,
          proposedAY,proposedCircle:proposedCircle.trim(),proposedHeadCode,reason:reason.trim()
        };
        const fingerprint=JSON.stringify([previewAccount?.id,payload]);
        if(pendingSubmission.current?.fingerprint!==fingerprint)
          pendingSubmission.current={fingerprint,key:crypto.randomUUID()};
        const saved=await submitPreviewCorrection({...payload,requestKey:pendingSubmission.current.key});
        pendingSubmission.current=null;
        setServerRecords(rows=>[saved,...rows.filter(row=>row.id!==saved.id)]);
        setHistoryError(false);setHistoryLoading(false);
        if(activePreviewSession()?.capability!==ownerKey)return;
        setSubmittedTicket('SIM-CORR-'+saved.id);setReason('');
        setProposedAY('');setProposedCircle('');setProposedHeadCode('');
        return;
      }
      const ticketNo = addCorrectionRequest({
        challanNo: selectedChallanNo,
        ...(selectedAllocation?{targetAllocationIndex:selectedIndex,...(selectedAllocation.allocationId?{targetAllocationId:selectedAllocation.allocationId}:{})}:{}),
        taxpayerTin: taxpayerProfile.tin,
        taxpayerName: taxpayerProfile.nameEn,
        requestedBy: `${taxpayerProfile.nameEn} (Self)`,
        requestDate: new Date().toISOString().split('T')[0],
        currentAssessmentYear: currentAY,
        proposedAssessmentYear: effectiveAY,
        currentCircle,
        proposedCircle:effectiveCircle,
        currentHeadCode,
        proposedHeadCode: proposedHead,
        reason:reason.trim(),
        workflowStage: 'MAKER_SUBMITTED',
        makerRemarks: 'Local sample request only. No official petition or Revenue Officer workflow initiated.'
      });
      setSubmittedTicket(ticketNo);setReason('');
      setProposedAY('');setProposedCircle('');setProposedHeadCode('');
    }catch{
      setError(serverMode
        ?tr('Could not confirm the request. Your entries are preserved; retry to safely recover the same request.','আবেদন নিশ্চিত করা যায়নি। আপনার তথ্য রাখা হয়েছে; একই আবেদন পুনরুদ্ধার করতে আবার চেষ্টা করুন।')
        :tr('Unable to save this local draft. Check your session and payment, then try again.','খসড়া সংরক্ষণ করা যায়নি। সেশন ও পরিশোধ যাচাই করে আবার চেষ্টা করুন।'));
    }finally{submitLock.current=false;setBusy(false);}
  };

  const formAvailable=!(serverMode&&receiptPhase==='loading'&&!selectedHistorical)&&
    !(serverMode&&receiptPhase==='error'&&!selectedHistorical&&!visibleHistorical.length)&&
    Boolean(visibleReceipts.length||visibleHistorical.length);
  const saveAction=<UiButton type="submit" form={formId} variant="primary" disabled={busy} className="gap-2">
    <Send size={16} aria-hidden="true"/>
    <span>{busy?tr('Submitting…','জমা হচ্ছে…'):serverMode?tr('Submit correction request','সংশোধনের আবেদন জমা দিন'):tr('Save request locally','স্থানীয়ভাবে খসড়া সংরক্ষণ করুন')}</span>
  </UiButton>;
  return (
    <div className={embedded||historyOnly ? 'w-full min-w-0 space-y-4' : 'max-w-4xl mx-auto space-y-6 pb-12'}>
      {!embedded && !historyOnly && <TaxpayerPageHeading title={tr('Tax Payment Challan Correction Requests','কর পরিশোধের চালান সংশোধনের আবেদন')}
        description={tr('Request a change to the assessment year, tax circle or payment head.','করবর্ষ, সার্কেল বা কর খাত সংশোধনের আবেদন করুন।')} />}
      {!embedded && activityTabs && <TaxpayerActivityTabs />}
      {!historyOnly&&<div className={embedded ? 'w-full min-w-0' : 'bg-white border border-slate-200 rounded-xl p-6 shadow-sm'}>
        {submittedTicket && (
          <div role="status" className="mb-4 p-3 rounded-lg border border-taxpay-border bg-taxpay-light space-y-1">
            <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span className="break-all">{serverMode?tr('Request recorded:','আবেদন নথিভুক্ত:'):tr('Request saved locally:','স্থানীয় খসড়া সংরক্ষিত:')} {submittedTicket}</span>
            </div>
            <p className="text-xs text-emerald-700">
              {serverMode?tr('Request recorded. Check the register for Office delivery and review status. No payment amount or ledger changed.','আবেদন নথিভুক্ত। অফিসে প্রেরণ ও পর্যালোচনার অবস্থা তালিকায় দেখুন। পরিশোধের পরিমাণ বা লেজার পরিবর্তিত হয়নি।'):tr('Not submitted to NBR or an official review queue.','এনবিআর বা অফিসের পর্যালোচনায় জমা হয়নি।')}
            </p>
            {embedded&&onViewRequests&&<UiButton variant="outline" onClick={onViewRequests}>{tr('View correction requests','সংশোধনের আবেদন দেখুন')}</UiButton>}
          </div>
        )}

        {error && (
          <div role="alert" className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm">
            {error}
          </div>
        )}

        {/* New Correction Form */}
        {serverMode&&receiptPhase==='loading'&&!selectedHistorical?<p role="status" className="text-sm">{tr('Loading payment records…','পেমেন্ট রেকর্ড লোড হচ্ছে…')}</p>
           :serverMode&&receiptPhase==='error'&&!selectedHistorical&&!visibleHistorical.length?<div role="alert" className="space-y-2 text-sm"><p>{tr('Payment records could not be loaded.','পেমেন্ট রেকর্ড লোড করা যায়নি।')}</p><UiButton variant="outline" type="button" onClick={()=>setReceiptRetry(n=>n+1)}>{tr('Retry','আবার চেষ্টা করুন')}</UiButton></div>
          :(visibleReceipts.length||visibleHistorical.length) ? <form id={formId} onSubmit={handleSubmit} className="space-y-3 text-sm" aria-busy={busy} data-testid="correction-request-form">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="correction-challan" className="block font-semibold text-slate-700 mb-1">
                {visibleHistorical.length?tr('Select payment reference *','পেমেন্ট রেফারেন্স নির্বাচন করুন *'):tr('Select A-Challan for Rectification *','সংশোধনের জন্য এ-চালান নির্বাচন করুন *')}
              </label>
              <select
                id="correction-challan"
                value={selectedChallanNo}
                onChange={(e) => {
                  setChallanNo(e.target.value);
                  setProposedCircle('');
                  setProposedAY('');
                  setAllocationIndex('');
                  setProposedHeadCode('');
                }}
                disabled={Boolean(preferredReference)||busy}
                className="w-full min-h-11 min-w-0 px-3 py-2 rounded-lg border border-taxpay-border text-sm"
              >
                {!selectedChallanNo&&<option value="" disabled>{tr('Select a payment','পেমেন্ট নির্বাচন করুন')}</option>}
                {visibleHistorical.map(r=><option key={r.reference} value={r.reference}>{r.reference} — {r.title} — ৳ {r.amount} ({r.year})</option>)}
                {visibleReceipts.map(r => (
                  <option key={r.paymentTransactionId||r.id||r.challanNo} value={r.challanNo}>
                    {r.challanNo} — ৳ {r.totalAmount} ({r.assessmentYear})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="correction-tin" className="block font-semibold text-slate-700 mb-1">
                {tr('Taxpayer e-TIN','করদাতার ই-টিআইএন')}
              </label>
              <input
                id="correction-tin"
                type="text"
                disabled
                value={selectedAllocation?.taxpayerTin||selectedReceipt?.taxpayerTin||selectedReceipt?.payerTin||taxpayerProfile.tin}
                className="w-full min-h-11 min-w-0 px-3 py-2 rounded-lg border border-slate-200 bg-slate-100 font-mono-plex text-slate-500"
              />
            </div>

            {requiresAllocation&&<label className="sm:col-span-2 block font-medium text-taxpay-text">
              {tr('Payment allocation to correct','সংশোধনের জন্য পরিশোধের বরাদ্দ')}
              <UiSelect className="mt-1" value={allocationIndex} disabled={busy} onChange={e=>{setAllocationIndex(e.target.value);setProposedAY('');setProposedCircle('');setProposedHeadCode('');setError('');}}>
                <option value="">{tr('Select a payment allocation','পরিশোধের বরাদ্দ নির্বাচন করুন')}</option>
                {allocations.map((a,i)=><option key={a.allocationId??i} value={i}>{a.taxpayerName} — {language==='bn'?a.paymentServiceBn:a.paymentServiceEn} — {a.assessmentYear} — ৳ {(a.amountMinor/100).toLocaleString('en-BD')}</option>)}
              </UiSelect>
            </label>}
            <div>
              <label htmlFor="correction-current-year" className="block font-semibold text-slate-700 mb-1">
                {tr('Current Assessment Year','বর্তমান করবর্ষ')}
              </label>
              <input
                id="correction-current-year"
                value={currentAY}
                readOnly
                className="w-full min-h-11 min-w-0 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 font-medium"
              />
            </div>

            <div>
              <label htmlFor="correction-proposed-year" className="block font-semibold text-taxpay-dark mb-1">
                {tr('Proposed Correct Assessment Year','প্রস্তাবিত সঠিক করবর্ষ')}
              </label>
              <select
                id="correction-proposed-year"
                value={proposedAY}
                disabled={busy||requiresAllocation&&!selectedAllocation}
                onChange={(e) => setProposedAY(e.target.value)}
                className="w-full min-h-11 min-w-0 px-3 py-2 rounded-lg border border-taxpay-border text-sm"
              >
                <option value="">{tr("No change","পরিবর্তন নেই")}</option>
                {ASSESSMENT_YEARS.map(ay => (
                  <option key={ay} value={ay}>{ay}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="correction-current-circle" className="block font-semibold text-slate-700 mb-1">
                {tr('Current Circle','বর্তমান সার্কেল')}
              </label>
              <input
                id="correction-current-circle"
                type="text"
                value={currentCircle}
                readOnly
                className="w-full min-h-11 min-w-0 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50"
              />
            </div>

            <div>
              <label htmlFor="correction-proposed-circle" className="block font-semibold text-taxpay-dark mb-1">
                {tr('Proposed Correct Circle','প্রস্তাবিত সঠিক সার্কেল')}
              </label>
              <input
                id="correction-proposed-circle"
                type="text"
                value={proposedCircle}
                placeholder={currentCircle||tr("No change","পরিবর্তন নেই")}
                disabled={busy||requiresAllocation&&!selectedAllocation}
                onChange={(e) => setProposedCircle(e.target.value)}
                className="w-full min-h-11 min-w-0 px-3 py-2 rounded-lg border border-taxpay-border text-sm"
              />
            </div>

            <div>
              <label htmlFor="correction-current-head" className="block font-semibold text-slate-700 mb-1">
                {tr('Current payment head','বর্তমান কর খাত')}
              </label>
              <input id="correction-current-head" value={currentHeadCode} readOnly
                className="w-full min-h-11 min-w-0 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 font-mono-plex" />
            </div>
            <div>
              <label htmlFor="correction-proposed-head" className="block font-semibold text-taxpay-dark mb-1">
                {serverMode?tr('Proposed payment head','প্রস্তাবিত কর খাত'):tr('Proposed payment head (unverified options)','প্রস্তাবিত কর খাত (যাচাই হয়নি)')}
              </label>
              <select id="correction-proposed-head" value={serverMode?proposedHeadCode:proposedHead}
                disabled={busy||requiresAllocation&&!selectedAllocation}
                onChange={(e) => setProposedHeadCode(e.target.value)}
                className="w-full min-h-11 min-w-0 px-3 py-2 rounded-lg border border-taxpay-border text-sm">
                {serverMode&&<option value="">{tr("No change","পরিবর্তন নেই")}</option>}
                {!serverMode&&currentHeadCode&&!MASTER_PAYMENT_HEADS.some(head=>head.status!=='BLOCKED'&&head.economicCode===currentHeadCode)&&<option value={currentHeadCode}>{currentHeadCode}</option>}
                {MASTER_PAYMENT_HEADS.filter(head => head.status !== 'BLOCKED').map(head => (
                  <option key={head.id} value={head.economicCode}>{head.economicCode} — {language==='bn'?head.nameBn:head.nameEn}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="correction-reason" className="block font-semibold text-slate-700 mb-1">
              {tr('Detailed Reason for Amendment & Supporting Evidence *','সংশোধনের বিস্তারিত কারণ ও সমর্থনকারী প্রমাণ *')}
            </label>
            <textarea
              id="correction-reason"
              rows={3}
              maxLength={1000}
              disabled={busy}
              placeholder={tr('State the clerical error or reason for misattribution.','ভুলের কারণ বা সংশোধনের প্রয়োজন ব্যাখ্যা করুন।')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full min-h-11 min-w-0 px-3 py-2 rounded-lg border border-taxpay-border text-sm"
            />
          </div>

          {selectedHistorical&&<p role="note" className="text-sm text-taxpay-muted">{tr('Historical simulated reference: no verified receipt, circle or payment-head code is available. Office can review the request; no payment or tax credit is changed.','পুরনো সিমুলেটেড রেফারেন্স: যাচাইকৃত চালান, সার্কেল বা কর খাতের কোড নেই। অফিস আবেদন পর্যালোচনা করতে পারবে; কোনো পেমেন্ট বা কর ক্রেডিট পরিবর্তিত হবে না।')}</p>}
          <p className="text-sm text-taxpay-muted">{serverMode
            ?tr('Records a simulated correction request without changing the original payment.','মূল পরিশোধ পরিবর্তন ছাড়াই সিমুলেটেড সংশোধন আবেদন নথিভুক্ত হয়।')
            :tr('Local draft only. This does not submit a request to the Office.','শুধু স্থানীয় খসড়া। এটি অফিসে জমা হবে না।')}</p>
          {!embedded&&<div className="flex justify-end">{saveAction}</div>}
        </form> : <p role="status" className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">{tr('No payment records are available for correction.','সংশোধনের জন্য কোনো পেমেন্ট রেকর্ড নেই।')}</p>}
      </div>}
      {embedded&&footerTarget&&formAvailable&&!historyOnly&&createPortal(saveAction,footerTarget)}

      {!embedded&&<section className="taxpayer-records-panel rounded-xl border border-taxpay-border bg-white p-4 sm:p-6 space-y-3"
        data-testid="preview-correction-register" aria-label={tr('Saved correction requests','সংরক্ষিত সংশোধনের অনুরোধ')}>
        <div className="taxpay-table-toolbar">
          <h3 className="text-base font-semibold text-taxpay-text">{serverMode?tr('Correction requests','সংশোধনের আবেদন'):tr('Saved correction requests','সংরক্ষিত সংশোধনের অনুরোধ')}</h3>
          {serverMode&&<UiButton variant="outline" type="button" disabled={historyLoading} onClick={()=>setHistoryRetry(n=>n+1)}>{tr('Refresh','রিফ্রেশ')}</UiButton>}
          {(!serverMode||(!historyLoading&&!historyError&&historyOwner===ownerKey))&&<TaxPayTableCounter label={tr('Requests','অনুরোধ')} shown={filteredCases.length} total={yearCases.length}/>}
        </div>
        <TaxPayTableControls className="taxpay-record-page-filters">
          <label className="taxpayer-transaction-filter">
            <span>{tr('Search correction requests','সংশোধনের অনুরোধ খুঁজুন')}</span>
            <input type="search" className="min-h-11 w-full rounded-lg border border-taxpay-border bg-white px-3 text-base"
              aria-label={tr('Search correction requests','সংশোধনের অনুরোধ খুঁজুন')}
              placeholder={tr('Search reference, reason or status','রেফারেন্স, কারণ বা অবস্থা খুঁজুন')}
              value={caseSearch} onChange={event=>setCaseSearch(event.target.value)}/>
          </label>
          {caseSearch&&<button type="button" className="min-h-11 rounded-lg border border-taxpay-border px-3 font-semibold text-taxpay-primary"
            onClick={()=>setCaseSearch('')}>{tr('Clear search','অনুসন্ধান মুছুন')}</button>}
        </TaxPayTableControls>
        {(historyLoading||serverMode&&historyOwner!==ownerKey)?<TaxPayTableState>{tr('Loading correction requests…','আবেদন লোড হচ্ছে…')}</TaxPayTableState>:historyError?<div role="alert" className="space-y-2 text-sm"><p>{tr('Correction history unavailable.','আবেদনের ইতিহাস পাওয়া যাচ্ছে না।')}</p><UiButton type="button" variant="outline" onClick={()=>setHistoryRetry(n=>n+1)}>{tr('Retry','আবার চেষ্টা করুন')}</UiButton></div>:filteredCases.length===0?<TaxPayTableState>{visibleCorrections.length
          ?tr('No requests match your filters.','নির্বাচিত ফিল্টারে কোনো অনুরোধ পাওয়া যায়নি।')
          :tr('No correction requests saved yet.','এখনো কোনো সংশোধনের অনুরোধ সংরক্ষিত হয়নি।')}</TaxPayTableState>:
          <TaxPayDataGrid variant="tabular" rows={filteredCases} getRowKey={c=>c.id}
            ariaLabel={tr('Correction request history','সংশোধনের অনুরোধের ইতিহাস')}
            testId="preview-correction-table" mobileTestId="preview-correction-cards"
            columns={[
              {key:'reference',header:tr('Case / challan','বিষয় / চালান'),renderCell:c=><div>
                <p className="break-all font-semibold text-taxpay-text">{c.ticketNo}</p>
                <p className="break-all font-mono-plex text-sm text-taxpay-muted">{c.challanNo}</p>
              </div>},
              {key:'change',header:tr('Proposed change','প্রস্তাবিত পরিবর্তন'),renderCell:c=><div>
                <p className="text-taxpay-text">{tr('Assessment year','করবর্ষ')}: {c.currentAssessmentYear} → {c.proposedAssessmentYear}</p>
                <p className="text-sm text-taxpay-muted">{tr('Circle','সার্কেল')}: {c.currentCircle} → {c.proposedCircle}</p>
              </div>},
              {key:'status',header:tr('Recorded status','নথিভুক্ত অবস্থা'),renderCell:c=><p className="font-semibold text-taxpay-text">{c.simulationRecorded?previewCorrectionStatus(c,language):c.makerRemarks?.startsWith('Local sample request only')?tr('Saved locally','স্থানীয়ভাবে সংরক্ষিত'):c.workflowStage.replaceAll('_',' ')}</p>},
              {key:'detail',header:tr('Details','বিস্তারিত'),renderCell:c=><details className="max-w-[22rem] rounded-lg border border-taxpay-border p-2">
                <summary className="min-h-11 cursor-pointer font-semibold text-taxpay-primary">{tr('View request','অনুরোধ দেখুন')}</summary>
                <div className="mt-2 space-y-2 text-sm text-taxpay-text">
                  <p className="break-words">{tr('Payment head','কর খাত')}: {c.currentHeadCode||'—'} → {c.proposedHeadCode||'—'}</p>
                  {c.initiatedBy==='OFFICE'&&<p className="font-semibold">{tr('Initiated by Office','অফিস থেকে শুরু হয়েছে')}</p>}
                  <p className="break-words">{tr('Reason','কারণ')}: {c.reason}</p>
                  {c.requestedOutcome&&<p className="break-words">{tr('Requested outcome','প্রত্যাশিত ফলাফল')}: {c.requestedOutcome}</p>}
                  {c.evidenceNote&&<p className="break-words">{tr('Evidence note','প্রমাণের বিবরণ')}: {c.evidenceNote}</p>}
                  {c.approverRemarks&&<p className="break-words">{tr('Review note','পর্যালোচনার মন্তব্য')}: {c.approverRemarks}</p>}
                </div>
              </details>}
            ]}
            renderMobileCard={c=><div className="space-y-2">
              <div className="taxpay-mobile-table-card__header">
                <p className="taxpay-mobile-table-card__title">{c.ticketNo}</p>
                <p className="text-sm font-semibold text-taxpay-primary">{c.simulationRecorded?previewCorrectionStatus(c,language):c.makerRemarks?.startsWith('Local sample request only')?tr('Saved locally','স্থানীয়ভাবে সংরক্ষিত'):c.workflowStage.replaceAll('_',' ')}</p>
              </div>
              <p className="taxpay-mobile-table-card__meta break-all">{tr('Challan','চালান')}: {c.challanNo}</p>
              <p className="taxpay-mobile-table-card__meta">{tr('Year','করবর্ষ')}: {c.currentAssessmentYear} → {c.proposedAssessmentYear}</p>
              <p className="taxpay-mobile-table-card__meta">{tr('Circle','সার্কেল')}: {c.currentCircle} → {c.proposedCircle}</p>
              <details className="mt-2 rounded-lg border border-taxpay-border p-2">
                <summary className="min-h-11 cursor-pointer font-semibold text-taxpay-primary">{tr('View request','অনুরোধ দেখুন')}</summary>
                {c.initiatedBy==='OFFICE'&&<p className="mt-2 text-sm font-semibold">{tr('Initiated by Office','অফিস থেকে শুরু হয়েছে')}</p>}
                <p className="mt-2 break-words text-sm">{c.reason}</p>
                {c.requestedOutcome&&<p className="break-words text-sm">{tr('Requested outcome','প্রত্যাশিত ফলাফল')}: {c.requestedOutcome}</p>}
                {c.evidenceNote&&<p className="break-words text-sm">{tr('Evidence note','প্রমাণের বিবরণ')}: {c.evidenceNote}</p>}
                {c.approverRemarks&&<p className="mt-2 break-words text-sm">{tr('Review note','পর্যালোচনার মন্তব্য')}: {c.approverRemarks}</p>}
              </details>
            </div>}/>}
      </section>}
    </div>
  );
};
