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
  assert.match(english, /Foreign passenger/);
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
