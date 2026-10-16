import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';
import {ROUTES, routeContextFromUrl, validRoute, writeRouteContext} from '../src/services/routeContract';

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
