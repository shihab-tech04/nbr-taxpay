import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('src/components/ui/TaxPayDataTable.tsx', 'utf8');

test('default mobile record card opens the same record as the desktop row', () => {
  assert.match(source, /role=\{!renderMobileCard&&onViewRow\?'button':undefined\}/);
  assert.match(source, /tabIndex=\{!renderMobileCard&&onViewRow\?0:undefined\}/);
  assert.match(source, /onClick=\{!renderMobileCard&&onViewRow\?/);
  assert.match(source, /onKeyDown=\{!renderMobileCard&&onViewRow\?/);
  assert.match(source, /event\.key==='Enter'\|\|event\.key===' '/);
  assert.match(source, /const interactive=\(event\.target as HTMLElement\)\.closest/);
  assert.match(source, /if\(interactive&&interactive!==event\.currentTarget\)return;/);
});

test('custom mobile card handlers remain owned by their existing screen', () => {
  assert.match(source, /renderMobileCard \? renderMobileCard\(row\) : <dl/);
  assert.match(source, /onClick=\{!renderMobileCard&&onViewRow\?/);
  assert.match(source, /onKeyDown=\{!renderMobileCard&&onViewRow\?/);
});
