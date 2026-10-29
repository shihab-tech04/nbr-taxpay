import type { ChallanReceipt } from '../types/tax';

/**
 * Receipts and certificate summaries export the same TaxPay document surface
 * shown in the shared modal, with the same approved typography and layout.
 * This is an HTML export, not an invented PDF or a different Office template.
 */
function downloadDisplayedPaper(filename: string, documentTitle: string) {
  const paper = document.querySelector<HTMLElement>('.receipt-view__paper');
  if (!paper) throw new Error('Document is not ready');
  const styles = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
    .map(link => '<link rel="stylesheet" href="' +
      link.href.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '">').join('');
  const locale = paper.getAttribute('lang') === 'bn' ? 'bn' : 'en';
  const title = documentTitle.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = '<!doctype html><html lang="' + locale + '"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + title + '</title>' + styles +
    '<style>@page{size:A4;margin:12mm}body{margin:0;padding:12mm;background:#fff}' +
    '.no-print,button{display:none!important}.receipt-view__paper{box-shadow:none!important;border:none!important}' +
    '</style></head><body class="taxpay-citizen-shell"><main class="receipt-view receipt-view--page">' +
    paper.outerHTML + '</main></body></html>';
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 3000);
}

/** Save exactly the displayed receipt (also linked from Office Management). */
export function downloadDisplayedCertificate(receipt: ChallanReceipt) {
  const title = String(receipt.paymentTransactionId || receipt.challanNo)
    .replace(/[^a-zA-Z0-9-]/g, '').slice(0, 80);
  downloadDisplayedPaper('Payment-certificate-' + title + '.html', 'Payment certificate ' + title);
}

/** Save a selected certificate *summary*, never fabricate a payment receipt. */
export function downloadDisplayedCertificateSummary(summaryType: string) {
  const safe = summaryType.replace(/[^A-Z_]/g, '').slice(0, 50);
  downloadDisplayedPaper('TaxPay-' + safe + '-summary.html', 'TaxPay certificate summary');
}
