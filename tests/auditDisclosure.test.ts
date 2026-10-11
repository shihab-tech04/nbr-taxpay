import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { UI_STRINGS } from '../src/services/localization.ts';

const source = (path: string) => new URL(`../src/${path}`, import.meta.url);

test('audit surfaces do not claim unverified immutability or cryptographic integrity', async () => {
  const files = await Promise.all([
    readFile(source('components/screens/OfficerHome.tsx'), 'utf8'),
    readFile(source('components/layout/Footer.tsx'), 'utf8'),
    readFile(source('components/screens/ParityRegisterModal.tsx'), 'utf8'),
    readFile(source('data/taxOntologyData.ts'), 'utf8'),
  ]);
  const copy = files.join('\n');
  assert.doesNotMatch(copy, /Immutable Audit Register|SHA-256 Hashed Logs|Cryptographically hashed immutable|timestamped in the immutable audit register/i);
  assert.match(copy, /auditDemoDetail/);
  assert.match(copy, /Demonstration actions appear in an in-memory log/);
});

test('audit demonstration disclosure is available in English and Bengali', () => {
  for (const language of ['en', 'bn'] as const) {
    assert.ok(UI_STRINGS[language].auditDemoTitle);
    assert.ok(UI_STRINGS[language].auditDemoStatus);
    assert.ok(UI_STRINGS[language].auditDemoDetail);
  }
  assert.match(UI_STRINGS.en.auditDemoDetail, /in-memory|illustrative/i);
  assert.match(UI_STRINGS.bn.auditDemoDetail, /মেমোরিতে|উদাহরণমূলক/);
});