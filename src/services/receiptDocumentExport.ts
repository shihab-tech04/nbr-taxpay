import type {ChallanReceipt} from '../types/tax';

/** Save exactly the TaxPay receipt markup displayed on screen.
 * The document references the approved TaxPay stylesheet; no parallel Office
 * certificate or generic JSON payload is generated. */
export function downloadDisplayedCertificate(receipt:ChallanReceipt){
 const paper=document.querySelector<HTMLElement>('.receipt-view__paper');
 if(!paper)throw new Error('Certificate is not ready');
 const styles=Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
  .map(link=>'<link rel="stylesheet" href="'+link.href.replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'">').join('');
 const title=String(receipt.paymentTransactionId||receipt.challanNo).replace(/[^a-zA-Z0-9-]/g,'').slice(0,80);
 const locale = paper.getAttribute('lang') === 'bn' ? 'bn' : 'en';
 const html='<!doctype html><html lang="'+locale+'"><head><meta charset="utf-8">'+
  '<meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<title>Payment certificate '+title+'</title>'+styles+
  '<style>@page{size:A4;margin:12mm}body{margin:0;padding:12mm;background:#fff}' +
  '.no-print,button{display:none!important}.receipt-view__paper{box-shadow:none!important;border:none!important}' +
  '</style></head><body class="taxpay-citizen-shell"><main class="receipt-view receipt-view--page">'+paper.outerHTML+'</main></body></html>';
 const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download='Payment-certificate-'+title+'.html';
 document.body.appendChild(link);link.click();link.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),3000);
}
