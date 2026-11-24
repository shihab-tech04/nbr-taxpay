import test from 'node:test';
import assert from 'node:assert/strict';
import { downloadDisplayedCertificateSummary } from '../src/services/receiptDocumentExport';

test('certificate summary HTML exports use Sohojkor name and retain EN/BN document language', async () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const originalRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
  const downloads: string[] = [];
  const blobs: Blob[] = [];
  let language = 'en';
  const paper = {
    getAttribute: (name: string) => name === 'lang' ? language : null,
    outerHTML: '<section class="receipt-view__paper">Recorded summary</section>',
  };
  try {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        querySelector: (selector: string) => selector === '.receipt-view__paper' ? paper : null,
        querySelectorAll: () => [],
        createElement: () => {
          const link = {
            href: '', download: '',
            click() { downloads.push(link.download); },
            remove() {},
          };
          return link;
        },
        body: { appendChild() {} },
      },
    });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { setTimeout: () => 0 },
    });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: (blob: Blob) => { blobs.push(blob); return 'blob:sohojkor-summary'; },
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: () => {},
    });

    downloadDisplayedCertificateSummary('OTHER_TAX');
    language = 'bn';
    downloadDisplayedCertificateSummary('TRAVEL_TAX');

    assert.deepEqual(downloads, [
      'Sohojkor-OTHER_TAX-summary.html',
      'Sohojkor-TRAVEL_TAX-summary.html',
    ]);
    assert.equal(blobs.length, 2);
    for (const [index, locale] of ['en', 'bn'].entries()) {
      assert.equal(blobs[index].type, 'text/html;charset=utf-8');
      const html = await blobs[index].text();
      assert.match(html, new RegExp('<html lang="' + locale + '">'));
      assert.match(html, /<title>Sohojkor certificate summary<\/title>/);
      assert.doesNotMatch(html, /Korbritto/);
      assert.match(html, /Recorded summary/);
    }
  } finally {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    if (originalCreate) Object.defineProperty(URL, 'createObjectURL', originalCreate);
    else Reflect.deleteProperty(URL, 'createObjectURL');
    if (originalRevoke) Object.defineProperty(URL, 'revokeObjectURL', originalRevoke);
    else Reflect.deleteProperty(URL, 'revokeObjectURL');
  }
});
