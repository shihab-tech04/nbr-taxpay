import test from 'node:test';
import assert from 'node:assert/strict';
import { GLOSSARY_TERMS } from '../src/data/glossaryData';
import { GUIDE_CONTENT } from '../src/data/publicGuideContent';

test('public guide questions and service instructions have English and Bangla content', () => {
  assert.equal(GUIDE_CONTENT.length, 6);
  for (const topic of GUIDE_CONTENT) {
    assert.ok(topic.en.trim() && topic.bn.trim(), `${topic.id} has bilingual topic labels`);
    assert.ok(topic.description[0].trim() && topic.description[1].trim(), `${topic.id} has bilingual descriptions`);
    for (const step of topic.steps) {
      for (const [field, pair] of Object.entries(step)) {
        assert.ok(pair[0].trim() && pair[1].trim(), `${topic.id} step ${field} has bilingual text`);
      }
    }
    for (const faq of topic.faqs) {
      assert.ok(faq.q[0].trim() && faq.q[1].trim(), `${topic.id} FAQ has bilingual questions`);
      assert.ok(faq.a[0].trim() && faq.a[1].trim(), `${topic.id} FAQ has bilingual answers`);
    }
  }
});

test('glossary covers service terms in plain English and Bangla without unverified statute citations', () => {
  const names = new Set(GLOSSARY_TERMS.map(term => term.termEn));
  for (const required of [
    'Tax with Return', 'Advance Tax', 'Demand Notice', 'Tax Credit', 'Travel Tax',
    'Source Tax Deposit', 'Payment Head', 'Payment Reference', 'Payment Receipt',
    'Payment Status', 'Example Payment Record'
  ]) assert.ok(names.has(required), `Missing glossary term: ${required}`);

  for (const term of GLOSSARY_TERMS) {
    assert.ok(term.termEn.trim() && term.termBn.trim(), `${term.termEn} has bilingual labels`);
    assert.ok(term.definitionEn.trim() && term.definitionBn.trim(), `${term.termEn} has bilingual definitions`);
    assert.equal('actReference' in term, false, `${term.termEn} does not assert an unverified legal citation`);
    assert.doesNotMatch(term.definitionEn, /section\s+\d|chapter\s+[ivx\d]/i);
  }
});
