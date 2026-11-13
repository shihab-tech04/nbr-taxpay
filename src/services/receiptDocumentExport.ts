import type { ChallanReceipt } from '../types/tax';

/**
 * Account summaries retain their existing HTML export.
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

/** Export the shared receipt surface, including Bengali text and all allocations. */
export async function downloadDisplayedCertificate(receipt: ChallanReceipt, paper: HTMLElement, certificate = true) {
  const title = String(receipt.paymentTransactionId || receipt.challanNo)
    .replace(/[^a-zA-Z0-9-]/g, '').slice(0, 80);
  const [{ default: renderPaper }, { jsPDF }] = await Promise.all([
    import('html2canvas-pro'),
    import('jspdf'),
  ]);
  await document.fonts.ready;
  const scale = 2;
  const canvas = await renderPaper(paper, {
    backgroundColor: '#fff', logging: false, scale,
    ignoreElements: element => element.matches('button, .no-print'),
  });
  if (!canvas.width || !canvas.height) throw new Error('Document is not ready');

  const pdf = new jsPDF({ format: 'a4', unit: 'mm', compress: true });
  const margin = 12;
  const width = pdf.internal.pageSize.getWidth() - 2 * margin;
  const pixelsPerMm = canvas.width / width;
  const pageHeight = Math.floor((pdf.internal.pageSize.getHeight() - 2 * margin) * pixelsPerMm);
  const top = paper.getBoundingClientRect().top;
  const breaks = Array.from(paper.querySelectorAll('tr, article, header, section'))
    .map(element => Math.floor((element.getBoundingClientRect().bottom - top) * scale))
    .filter(position => position > 0 && position < canvas.height)
    .sort((left, right) => right - left);

  const page = document.createElement('canvas');
  page.width = canvas.width;
  const context = page.getContext('2d');
  if (!context) throw new Error('Unable to render the payment certificate');
  for (let start = 0; start < canvas.height;) {
    const limit = Math.min(start + pageHeight, canvas.height);
    const end = limit === canvas.height ? limit :
      breaks.find(position => position <= limit && position >= start + pageHeight / 2) ?? limit;
    const height = end - start;
    page.height = height;
    context.drawImage(canvas, 0, start, canvas.width, height, 0, 0, canvas.width, height);
    if (start > 0) pdf.addPage();
    pdf.addImage(page, 'PNG', margin, margin, width, height / pixelsPerMm);
    start = end;
  }
  pdf.setProperties({ title: (certificate ? 'Sohojkor Payment Certificate ' : 'Sohojkor Payment Receipt ') + title });
  pdf.save((certificate ? 'Payment-certificate-' : 'Payment-receipt-') + title + '.pdf');
}

/** Save a selected certificate *summary*, never fabricate a payment receipt. */
export function downloadDisplayedCertificateSummary(summaryType: string) {
  const safe = summaryType.replace(/[^A-Z_]/g, '').slice(0, 50);
  downloadDisplayedPaper('Korbritto-' + safe + '-summary.html', 'Korbritto certificate summary');
}
