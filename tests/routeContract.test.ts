import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';
import {OFFICE_MANAGEMENT_ROUTE_ALIASES, ROUTES, publicDemoReceiptId, receiptReturnRoute, routeContextFromUrl, validRoute, writeRouteContext} from '../src/services/routeContract';

test('the TaxPay route contract matches its public and taxpayer app router', () => {
  const app = readFileSync('src/App.tsx', 'utf8');
  const screens = [...app.matchAll(/case '([a-z_0-9]+)':/g)].map(match => match[1]);
  screens.push('office_login');
  assert.deepEqual([...new Set(screens)].sort(), [...ROUTES].sort());
  assert.equal(new Set(ROUTES).size, ROUTES.length);
  assert.equal(validRoute('does_not_exist'), 'landing');
  assert.equal(validRoute(''), 'landing');
  assert.equal(validRoute('history'), 'history');
  for (const route of OFFICE_MANAGEMENT_ROUTE_ALIASES) {
    assert.equal((ROUTES as readonly string[]).includes(route), false, route + ' must stay outside TaxPay routes');
    assert.equal(validRoute(route), 'landing', route);
  }
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
      assert.ok(ROUTES.some(route => route === match[1]) || OFFICE_MANAGEMENT_ROUTE_ALIASES.some(route => route === match[1]), filename + ': broken navigate(' + match[1] + ')');
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
      assert.ok(ROUTES.some(route => route === match[1]) || OFFICE_MANAGEMENT_ROUTE_ALIASES.some(route => route === match[1]), filename + ': broken menu destination ' + match[1]);
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
  assert.equal(receiptReturnRoute('payment_search'), 'history');
  assert.equal(receiptReturnRoute('taxpayer_360'), 'history');
  assert.equal(receiptReturnRoute('dashboard'), 'dashboard');
  assert.equal(receiptReturnRoute('landing'), 'history');
  assert.equal(receiptReturnRoute('https://unsafe.example'), 'history');
  assert.deepEqual(routeContextFromUrl('payment_details', search), {returnTo:'history'});
  writeRouteContext('payment_details', {returnTo:'payment_search',payerTin:'123456789012'}, search);
  assert.equal(search.get('returnTo'), 'history');
  assert.equal(search.has('payerTin'), false);
  assert.deepEqual(routeContextFromUrl('payment_details',search), {returnTo:'history'});
  writeRouteContext('user_guide', {category:'travel'}, search);
  assert.equal(search.has('returnTo'), false);
});

test('public synthetic receipt deep links restore only known fixtures and never private record identifiers', () => {
  assert.equal(publicDemoReceiptId('rcpt-101'), 'rcpt-101');
  assert.equal(publicDemoReceiptId('rcpt-104'), 'rcpt-104');
  assert.equal(publicDemoReceiptId('rcpt-105'), null);
  assert.equal(publicDemoReceiptId('rcpt-private-123'), null);
  const search = new URLSearchParams('action=payment_details&lang=bn');
  writeRouteContext('payment_details', {
    returnTo:'taxpayer_360',receiptId:'private-record-42',demoReceipt:'rcpt-101',payerTin:'123456789012'
  },search);
  assert.equal(search.toString(),'action=payment_details&lang=bn&returnTo=history&demoReceipt=rcpt-101');
  assert.deepEqual(routeContextFromUrl('payment_details',search),{returnTo:'history',demoReceipt:'rcpt-101'});
  search.set('demoReceipt','private-record-42');
  assert.deepEqual(routeContextFromUrl('payment_details',search),{returnTo:'history'});
  writeRouteContext('history',{},search);
  assert.equal(search.has('demoReceipt'),false);
});
