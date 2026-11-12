import test from 'node:test';
import assert from 'node:assert/strict';
import { GUIDE_CONTENT } from '../src/data/publicGuideContent';
import { getMaintainedGuideAnswer } from '../src/services/publicGuideAnswer';

test('public Help returns the maintained FAQ that matches the question in English and Bangla', () => {
  const english = getMaintainedGuideAnswer('Where can I read the available terms and privacy information?', GUIDE_CONTENT, 'en');
  const bangla = getMaintainedGuideAnswer('প্রকাশিত ব্যবহারের শর্ত ও গোপনীয়তার তথ্য কোথায় পড়ব?', GUIDE_CONTENT, 'bn');

  assert.match(english ?? '', /NBR VAT Portal/);
  assert.match(english ?? '', /May 2012/);
  assert.match(bangla ?? '', /NBR VAT Portal/);
  assert.match(bangla ?? '', /মে ২০১২/);
});

test('public Help keeps supported receipt answers specific and does not invent unsupported responses', () => {
  const missingReference = getMaintainedGuideAnswer('Why is my reference not found?', GUIDE_CONTENT, 'en');
  const unknown = getMaintainedGuideAnswer('Tell me an unsupported legal ruling.', GUIDE_CONTENT, 'en');

  assert.match(missingReference ?? '', /Check the reference/);
  assert.equal(unknown, null);
});
