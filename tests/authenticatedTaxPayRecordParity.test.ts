import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(file:string)=>readFileSync(file,'utf8');

test('authenticated Notifications uses the real account route and unified owner-scoped registers',()=>{
  const app=read('src/App.tsx');
  const account=read('src/components/screens/AccountCenter.tsx');
  assert.match(app,/case 'account_notifications':\s*return <AccountCenter page="notifications"/);
  assert.match(app,/verifiedApplicationUser \? <AccountCenter page="notifications" \/> : <NotificationsView/);
  assert.match(account,/data-testid="authenticated-notification-registers"/);
  assert.match(account,/testId="authenticated-review-notification-register"/);
  assert.match(account,/testId="authenticated-draft-notification-register"/);
  assert.match(account,/TaxPayDataGrid variant="exceptions"/);
  assert.match(account,/TaxPayDataGrid variant="documents"/);
  assert.match(account,/value=\{notificationSearch\}/);
  assert.match(account,/getRowKey=\{item=>item.id\}/);
  assert.match(account,/taxpay_in_app_notifications/);
  assert.match(account,/taxpay_payment_drafts/);
  assert.match(account,/\.eq\('owner_uid', uid\)/);
  assert.match(account,/setReviewNotices\(prev=>prev\.map/);
  assert.match(account,/onClick=\{markViewed\}/);
  assert.match(account,/SessionPaymentNotifications language=\{language\}/);
  assert.doesNotMatch(account,/<ul className="taxpayer-account-notices"/);
});

test('authenticated corrections use the real route and searchable register without altering persistence',()=>{
  const app=read('src/App.tsx');
  const corrections=read('src/components/screens/CorrectionInquiries.tsx');
  assert.match(app,/\? <CorrectionInquiries authenticatedUserId=\{verifiedApplicationUser.id\} language=\{language\} \/>/);
  assert.match(corrections,/data-testid="authenticated-correction-register"/);
  assert.match(corrections,/testId="authenticated-correction-inquiry-table"/);
  assert.match(corrections,/TaxPayDataGrid variant="exceptions"/);
  assert.match(corrections,/value=\{historySearch\}/);
  assert.match(corrections,/getRowKey=\{r=>r.inquiry_id\}/);
  assert.match(corrections,/sameAuthenticatedOwner/);
  assert.match(corrections,/\.eq\('requester_uid',authenticatedUserId\)/);
  assert.match(corrections,/validateCorrectionInquiry/);
  assert.match(corrections,/\.insert\(/);
  assert.match(corrections,/onClick=\{retryLoad\}/);
  assert.match(corrections,/<summary/);
  assert.match(corrections,/r\.requested_outcome/);
  assert.match(corrections,/r\.office_review_revision/);
  assert.match(corrections,/r\.office_review_updated_at/);
});

test('real receipts page exposes searchable payment-record register outside government print layout',()=>{
  const source=read('src/components/screens/CertificatesView.tsx');
  assert.match(source,/data-testid="account-certificate-record-register"/);
  assert.match(source,/TaxPayDataGrid variant="tabular"/);
  assert.match(source,/testId="account-certificate-payment-table"/);
  assert.match(source,/mobileTestId="account-certificate-payment-cards"/);
  assert.match(source,/value=\{recordSearch\}/);
  assert.match(source,/getRowKey=\{row=>row.key\}/);
  assert.match(source,/getAccountStoryPayments\(authenticatedUser.id\)/);
  assert.match(source,/getDetailedStorySessionPayments\(\)/);
  assert.match(source,/setReceiptReturnToSummary\(false\)/);
  assert.match(source,/if\(receiptReturnToSummary\)setSummaryOpen\(true\)/);
  assert.match(source,/receipt-view__financial-table/);
  assert.match(source,/Saved payment records are not government-issued certificates/);
});
