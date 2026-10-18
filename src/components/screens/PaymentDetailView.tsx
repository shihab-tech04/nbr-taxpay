import React, { useEffect, useState } from 'react';
import { useTaxState } from '../../services/taxState';
import { ReceiptView } from '../common/ReceiptView';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { receiptReturnRoute } from '../../services/routeContract';
import { useAccountIdentity } from '../../services/accountIdentity';
import { taxpayerPreviewReceipts } from '../../services/taxpayerEvidence';
import { INITIAL_RECEIPTS } from '../../data/mockData';
import type { ChallanReceipt } from '../../types/tax';
import { getConfirmedReceipt, validCertificateTransactionId } from '../../services/confirmedPaymentCertificate';

function downloadDisplayedCertificate(receipt:ChallanReceipt){
  // The exported document reuses the exact receipt DOM and deployed TaxPay
  // stylesheet; it is not a separately drawn Office approximation.
  const paper=document.querySelector('.receipt-view__paper');
  if(!paper)throw new Error('Certificate layout not available');
  const stylesheetLinks=Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
    .map(link=>'<link rel="stylesheet" href="'+link.href.replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'">').join('');
  const html='<!doctype html><html lang="en"><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<title>Payment certificate - '+receipt.paymentTransactionId+'</title>'+stylesheetLinks+
    '<style>@page{size:A4;margin:12mm}body{margin:0;padding:12mm;background:#fff}' +
    '.no-print,button{display:none!important}.receipt-view__paper{box-shadow:none!important;border:none!important}' +
    '</style></head><body><main class="receipt-view receipt-view--page">'+paper.outerHTML+'</main></body></html>';
  const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;
  link.download='Payment-certificate-'+receipt.paymentTransactionId+'.html';
  document.body.appendChild(link);link.click();link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),3000);
}

function SyncedCertificate({transactionId,docAction}:{transactionId:string;docAction?:string}){
  const [receipt,setReceipt]=useState<ChallanReceipt|null>(null);
  const [error,setError]=useState('');
  const [actionError,setActionError]=useState('');
  useEffect(()=>{
    let active=true;setReceipt(null);setError('');setActionError('');
    void getConfirmedReceipt(transactionId)
      .then(value=>{if(active)setReceipt(value);})
      .catch(err=>{if(active)setError(err instanceof Error?err.message:'Unable to load payment certificate');});
    return()=>{active=false;};
  },[transactionId]);
  useEffect(()=>{
    if(!receipt||!docAction)return;
    // Render ReceiptView first, then execute the requested document action.
    const timer=window.setTimeout(()=>{
      try{
        if(docAction==='print')window.print();
        if(docAction==='download')downloadDisplayedCertificate(receipt);
      }catch(err){setActionError(err instanceof Error?err.message:'Certificate action failed');}
    },450);
    return()=>window.clearTimeout(timer);
  },[receipt,docAction]);
  if(error)return <main className="mx-auto max-w-3xl p-6" role="alert"><h1>Payment certificate unavailable</h1><p>{error}</p></main>;
  if(!receipt)return <main className="mx-auto max-w-3xl p-6" role="status">Loading payment certificate…</main>;
  return <main className="mx-auto max-w-5xl pb-10">
    {actionError&&<p role="alert">{actionError}</p>}
    <ReceiptView receipt={receipt} onBack={()=>window.close()}/>
  </main>;
}


export const PaymentDetailView: React.FC = () => {
  const { selectedReceipt, receipts, taxpayerProfile, userRole, demoUser, routeParams, navigate } = useTaxState();
  const confirmedId=routeParams.transactionId;
  const { user: authenticatedUser } = useAccountIdentity();
  const returnTo = receiptReturnRoute(routeParams.returnTo);
  const officerContext = returnTo === 'payment_search' || returnTo === 'taxpayer_360';
  const isPublicFixture = selectedReceipt && INITIAL_RECEIPTS.some(receipt => receipt.id === selectedReceipt.id);
  const allowedPreviewReceipts = taxpayerPreviewReceipts(receipts, taxpayerProfile.tin, userRole, demoUser, Boolean(authenticatedUser));
  const availableReceipt = officerContext || !isPublicFixture || allowedPreviewReceipts.some(receipt => receipt.id === selectedReceipt?.id)
    ? selectedReceipt : null;
  const backLabel = returnTo === 'payment_search' ? 'Back to Payment Search' :
    returnTo === 'taxpayer_360' ? 'Back to Taxpayer 360' :
    returnTo === 'dashboard' || returnTo === 'taxpayer_home' ? 'Back to Dashboard' : 'Back to Payment History';

  if(validCertificateTransactionId(confirmedId))
    return <SyncedCertificate transactionId={confirmedId} docAction={routeParams.docAction}/>;

  if (!availableReceipt) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white rounded-xl border border-slate-200 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-amber-600 mx-auto" />
        <h2 className="font-serif-fraunces text-xl font-bold text-slate-800">No Challan Selected</h2>
        <p className="text-xs text-slate-500">
          Select a payment record from the originating list to inspect its details.
        </p>
        <button
          onClick={() => navigate(returnTo)}
          className="px-4 py-2 bg-emerald-900 text-amber-300 font-bold rounded-lg text-xs cursor-pointer inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{backLabel}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="pb-12">
      <ReceiptView receipt={availableReceipt} onBack={() => navigate(returnTo)} />
    </div>
  );
};
