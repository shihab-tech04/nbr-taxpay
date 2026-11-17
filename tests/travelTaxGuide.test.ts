import test from 'node:test';
import assert from 'node:assert/strict';
import { GUIDE_CONTENT } from '../src/data/publicGuideContent';

test('Travel Tax guide matches the current bilingual passenger-first journey', () => {
  const travel = GUIDE_CONTENT.find(entry => entry.id === 'travel');
  assert.ok(travel);

  const english = travel!.steps.map(step => `${step.title[0]} ${step.web[0]} ${step.mobile[0]}`).join(' ');
  const bangla = travel!.steps.map(step => `${step.title[1]} ${step.web[1]} ${step.mobile[1]}`).join(' ');

  assert.match(english, /Pay Travel Tax/);
  assert.match(english, /sample records/);
  assert.match(english, /not government passport verification/);
  assert.match(english, /foreign passenger/i);
  assert.match(english, /Add passenger/);
  assert.match(english, /11-digit mobile/);
  assert.match(english, /land or water/);
  assert.doesNotMatch(english, /travel banner/i);
  assert.match(bangla, /নমুনা রেকর্ড/);
  assert.match(bangla, /সরকারি পাসপোর্ট যাচাই নয়/);
  assert.match(bangla, /বিদেশি যাত্রী/);
  assert.match(bangla, /যাত্রী যোগ করুন/);
  assert.match(bangla, /১১ অঙ্কের মোবাইল/);
  assert.match(bangla, /স্থলপথ বা নৌপথ/);
});

test('Bilingual payment guidance covers the existing services and source-tax route', () => {
  const english = GUIDE_CONTENT.map(entry => [
    ...entry.steps.flatMap(step => [step.title[0], step.web[0], step.mobile[0]]),
    ...entry.faqs.flatMap(faq => [faq.q[0], faq.a[0]])
  ].join(' ')).join(' ');
  const bangla = GUIDE_CONTENT.map(entry => [
    ...entry.steps.flatMap(step => [step.title[1], step.web[1], step.mobile[1]]),
    ...entry.faqs.flatMap(faq => [faq.q[1], faq.a[1]])
  ].join(' ')).join(' ');
  const withholding = GUIDE_CONTENT.find(entry => entry.id === 'withholding');
  assert.ok(withholding);
  const withholdingText = withholding!.steps.flatMap(step => [...step.title, ...step.web, ...step.mobile]).join(' ');

  for (const service of ['Tax with Return', 'Advance Tax', 'Assessed Demand', 'Tax against Demand', 'Penalty', 'Appellate Tribunal', 'Source Tax Deposit', 'Other Tax Payment', 'Pay Travel Tax']) {
    assert.ok(english.includes(service), `Missing English service guide: ${service}`);
  }
  for (const service of ['রিটার্নসহ কর', 'অগ্রিম কর', 'নির্ধারিত দাবি', 'নোটিশের ভিত্তিতে কর', 'জরিমানা', 'আপিল ট্রাইব্যুনাল', 'উৎসে কর জমা', 'অন্যান্য কর পরিশোধ', 'ভ্রমণ কর']) {
    assert.ok(bangla.includes(service), `Missing Bangla service guide: ${service}`);
  }
  assert.match(withholdingText, /Start source tax deposit/);
  assert.doesNotMatch(withholdingText, /banner/i);
  assert.match(withholdingText, /withholding agent/);
});
