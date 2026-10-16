import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';
import {ROUTES, receiptReturnRoute, receiptSelectionFromHistory, routeContextFromUrl, routeHistoryWriteMode, validatedRouteContext, validRoute, writeRouteContext} from '../src/services/routeContract';

test('the route contract exactly matches the app router, including the Office login branch', () => {
  const app = readFileSync('src/App.tsx', 'utf8');
  const screens = [...app.matchAll(/case '([a-z_0-9]+)':/g)].map(match => match[1]);
  screens.push('office_login');
  assert.deepEqual([...new Set(screens)].sort(), [...ROUTES].sort());
  assert.equal(new Set(ROUTES).size, ROUTES.length);
  assert.equal(validRoute('does_not_exist'), 'landing');
  assert.equal(validRoute(''), 'landing');
  assert.equal(validRoute('history'), 'history');
});

test('published route-to-component index covers every registered screen with an existing file', () => {
  const index = readFileSync('FEATURE_PARITY_v11.md', 'utf8');
  const rows = [...index.matchAll(/^\| ([a-z_0-9]+) \| (src\/components\/screens\/[A-Za-z0-9]+\.tsx) \|$/gm)];
  assert.deepEqual(rows.map(row=>row[1]).sort(), [...ROUTES].sort());
  for (const [,route,filename] of rows) assert.ok(existsSync(filename),route+': missing '+filename);
});

test('literal navigation calls never refer to an unregistered screen', () => {
  function scan(dir: string): string[] {
    return readdirSync(dir, {withFileTypes:true}).flatMap(entry => {
      const filename = path.join(dir, entry.name);
      return entry.isDirectory() ? scan(filename) : filename.endsWith('.tsx') ? [filename] : [];
    });
  }
  for (const filename of scan('src/components')) {
    const content = readFileSync(filename, 'utf8');
    for (const match of content.matchAll(/\bnavigate\(\s*['"]([\w-]+)['"]\s*[,)]/g)) {
      assert.ok(ROUTES.some(route => route === match[1]), filename + ': broken navigate(' + match[1] + ')');
    }
  }
  // Named menu arrays use a variable passed to navigate(), so check their route entries too.
  const menuFiles = [
    ...scan('src/components/layout'),
    'src/components/screens/TaxJourney.tsx',
    'src/components/screens/ParityRegisterModal.tsx',
    'src/components/screens/OfficerHome.tsx'
  ];
  for (const filename of menuFiles) {
    const content = readFileSync(filename, 'utf8');
    for (const match of content.matchAll(/\b(?:route|actionKey):\s*['"]([a-z_0-9]+)['"]/g)) {
      assert.ok(ROUTES.some(route => route === match[1]), filename + ': broken menu destination ' + match[1]);
    }
  }
});

test('navigational context survives deep links, clears across unrelated routes and excludes payment details', () => {
  const search = new URLSearchParams('action=landing&lang=bn&draftCategory=TAX_WITH_RETURN&initialCategory=SOURCE_TAX_DEPOSIT');
  writeRouteContext('user_guide', {category:'security', payerTin:'123456789012'}, search);
  assert.equal(search.get('category'), 'security');
  assert.equal(search.has('draftCategory'), false);
  assert.equal(search.has('initialCategory'), false);
  assert.equal(search.has('payerTin'), false);
  assert.equal(search.get('lang'), 'bn');
  assert.deepEqual(routeContextFromUrl('user_guide', search), {category:'security'});

  writeRouteContext('history', {reviewStatuses:['FAILED','PENDING','UNKNOWN']}, search);
  assert.equal(search.get('category'), null);
  assert.equal(search.get('reviewStatuses'), 'FAILED,PENDING');
  assert.deepEqual(routeContextFromUrl('history', search), {reviewStatuses:['FAILED','PENDING']});
  writeRouteContext('landing', {category:'security'}, search);
  assert.equal(search.has('reviewStatuses'), false);
  assert.deepEqual(routeContextFromUrl('landing', search), {});
});

test('receipt origin remains a safe, reloadable list route and cannot become an arbitrary redirect', () => {
  const search = new URLSearchParams('action=payment_details&returnTo=https://unsafe.example');
  assert.equal(receiptReturnRoute('payment_search'), 'payment_search');
  assert.equal(receiptReturnRoute('taxpayer_360'), 'taxpayer_360');
  assert.equal(receiptReturnRoute('dashboard'), 'dashboard');
  assert.equal(receiptReturnRoute('landing'), 'history');
  assert.equal(receiptReturnRoute('https://unsafe.example'), 'history');
  assert.deepEqual(routeContextFromUrl('payment_details', search), {returnTo:'history'});
  writeRouteContext('payment_details', {returnTo:'payment_search',payerTin:'123456789012'}, search);
  assert.equal(search.get('returnTo'), 'payment_search');
  assert.equal(search.has('payerTin'), false);
  assert.deepEqual(routeContextFromUrl('payment_details',search), {returnTo:'payment_search'});
  writeRouteContext('user_guide', {category:'travel'}, search);
  assert.equal(search.has('returnTo'), false);
});

test('receipt details can restore a tab-local selected record without URL identifiers or forged history', () => {
  const known = new Set(['synthetic-record-1']);
  const state = {taxpayRoute:'payment_details',taxpayReceiptId:'synthetic-record-1'};
  assert.equal(receiptSelectionFromHistory(state,'payment_details',known),'synthetic-record-1');
  assert.equal(receiptSelectionFromHistory(state,'history',known),null);
  assert.equal(receiptSelectionFromHistory({...state,taxpayReceiptId:'other-owner-record'},'payment_details',known),null);
  assert.equal(receiptSelectionFromHistory({...state,taxpayRoute:'landing'},'payment_details',known),null);
  assert.equal(receiptSelectionFromHistory(null,'payment_details',known),null);
  const search = new URLSearchParams('action=payment_details&returnTo=payment_search');
  assert.equal(search.has('receiptId'),false);
  assert.equal(search.has('taxpayReceiptId'),false);
});

test('switching records at an unchanged details URL updates tab history without duplicate Back entries', () => {
  const first = {taxpayRoute:'payment_details',taxpayReceiptId:'sample-1'};
  assert.equal(routeHistoryWriteMode(true,'payment_details',first,'sample-2'),'push');
  assert.equal(routeHistoryWriteMode(false,'payment_details',first,'sample-2'),'replace');
  assert.equal(routeHistoryWriteMode(false,'payment_details',first,'sample-1'),'none');
  assert.equal(routeHistoryWriteMode(false,'payment_details',null,'sample-1'),'replace');
  assert.equal(routeHistoryWriteMode(false,'payment_details',first,null),'replace');
  assert.equal(routeHistoryWriteMode(false,'history',first,null),'none');
  assert.equal(routeHistoryWriteMode(true,'history',first,null),'push');
});

test('state and tab history contain only the navigation keys that survive a URL round-trip', () => {
  assert.deepEqual(validatedRouteContext('guest', {
    initialCategory:'TAX_WITH_RETURN', payerTin:'123456789012', amount:120000, privateForm:{name:'Person'}
  }), {initialCategory:'TAX_WITH_RETURN'});
  assert.deepEqual(validatedRouteContext('history', {
    categoryFilter:'source', reviewStatuses:['FAILED','UNKNOWN','PENDING'], accountEmail:'private@example.invalid'
  }), {categoryFilter:'source', reviewStatuses:['FAILED','PENDING']});
  assert.deepEqual(validatedRouteContext('payment_details', {
    returnTo:'payment_search', receiptId:'sample-1', payerName:'Sensitive name', taxpayReceiptId:'sample-2'
  }), {returnTo:'payment_search'});
  assert.deepEqual(validatedRouteContext('payment_details', {
    returnTo:'https://untrusted.invalid/', receiptId:'sample-1'
  }), {returnTo:'history'});
  assert.deepEqual(validatedRouteContext('landing', {payerTin:'123456789012', password:'not-allowed'}), {});
});
