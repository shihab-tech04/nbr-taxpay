import { expect, test } from '@playwright/test';

const backend = 'https://nbr-taxpay-test.invalid';
const owner = {
  id: '00000000-0000-4000-8000-000000000202',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'fixture-owner@example.invalid',
  app_metadata: { provider: 'email' },
  user_metadata: {},
  created_at: '2026-01-01T00:00:00Z',
};
const receiptDate = '2026-09-01T12:00:00Z';
const fixtures = ['01', '02'].map((suffix, index) => {
  const paymentId = '00000000-0000-4000-8000-0000000005' + suffix;
  return {
    paymentId,
    eventId: paymentId + ':allocation:1',
    receiptReference: 'FIXTURE-' + suffix,
    assessmentYear: '2026-27',
    amountMinor: 28000 + index * 100,
    createdAt: '2026-08-0' + (index + 1) + 'T08:00:00Z',
    recipientTin: null,
    recordState: 'RECORDED_NOT_CONFIRMED_TAX_CREDIT',
    isRead: false,
  };
});

for (const language of ['en', 'bn'] as const) {
 for (const confirmed of [false,true]) {
  test(`authenticated account acknowledges older received payments in order (${language}, ${confirmed?'completed':'legacy'})`, async ({ page }) => {
    test.skip(process.env.VITE_ACCOUNT_RECEIVED_NOTICES_ENABLED !== 'true', 'Requires the existing authenticated notice feature flag.');
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const tokenClaims = Buffer.from(JSON.stringify({ sub: owner.id, aud: 'authenticated', exp: expiresAt })).toString('base64url');
    await page.addInitScript(({ user, token, expiresAt }) => {
      localStorage.setItem('sb-nbr-taxpay-test-auth-token', JSON.stringify({
        access_token: token, refresh_token: 'fixture-refresh', expires_at: expiresAt, user,
      }));
      if (!sessionStorage.getItem('fixture-welcome-initialized')) {
        sessionStorage.setItem('fixture-welcome-initialized', '1');
        sessionStorage.setItem('sohojkor.verified-auth-welcome.v1', user.id);
      }
    }, { user: owner, token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + tokenClaims + '.fixture', expiresAt });

    const receivedFixtures=fixtures.map(fixture=>confirmed?{...fixture,serviceCode:'GIFT_TAX',payerName:'Recorded payer',paymentStatus:'SIMULATED_SUCCESS'}:fixture);
    const acknowledged: string[] = [];
    let completedReads = 0;
    await page.route(backend + '/**', async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const respond = (json: unknown) => route.fulfill({ json, headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': 'authorization, apikey, content-type, prefer, x-client-info',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
      } });
      if (request.method() === 'OPTIONS') return respond({});
      if (path === '/auth/v1/user') return respond(owner);
      if (path !== '/rest/v1/rpc/taxpay_account_received_payment_notices') return respond([]);
      expect(request.headers().authorization).toBe('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + tokenClaims + '.fixture');
      const { p_action, p_event_id, p_offset, p_limit } = request.postDataJSON();
      expect(Object.keys(request.postDataJSON()).sort()).toEqual(['p_action', 'p_event_id', 'p_limit', 'p_offset']);
      if (p_action === 'ack') {
        expect(p_event_id).toBe(receivedFixtures[acknowledged.length]?.eventId);
        acknowledged.push(p_event_id);
        return respond({ eventId: p_event_id, isRead: true, acknowledgedAt: receiptDate });
      }
      expect(['unread','list']).toContain(p_action);
      const items = p_action==='list'?receivedFixtures.map(notice=>({...notice,isRead:acknowledged.includes(notice.eventId),acknowledgedAt:acknowledged.includes(notice.eventId)?receiptDate:null})):receivedFixtures.filter(notice => !acknowledged.includes(notice.eventId));
      if(p_action==='unread')completedReads += 1;
      return respond({ items, total: items.length, offset: p_offset, limit: p_limit, hasMore: false });
    });

    const bangla = language === 'bn';
    await page.goto('/?action=history&lang=' + language);
    const continueToNotices = page.getByRole('button', { name: bangla ? 'বিজ্ঞপ্তি দেখুন' : 'Continue to notifications' });
    if(confirmed) await expect(continueToNotices).toHaveCount(0);
    else {await expect(continueToNotices).toBeVisible();await continueToNotices.click();}
    const popup = page.getByTestId('authenticated-received-payment-notice');
    for (const fixture of receivedFixtures) {
      await expect(popup).toContainText(fixture.receiptReference);
      const dialog=page.getByRole('dialog', { name: confirmed?(bangla?'আপনার পক্ষ থেকে একটি পেমেন্ট করা হয়েছে':'A payment has been made on your behalf.'):(bangla ? 'প্রাপ্ত পেমেন্টের বিজ্ঞপ্তি' : 'Received payment notice') });
      await expect(dialog.getByRole('button',{name:bangla?'পেমেন্ট রিপোর্ট করুন':'Report Payment',exact:true})).toBeVisible();
      await expect(dialog.getByRole('button',{name:bangla?'সংশোধনের অনুরোধ':'Request correction',exact:true})).toHaveCount(0);
      await expect(popup.locator('time')).toHaveAttribute('datetime',fixture.createdAt);
      await expect(popup.locator('dt')).toHaveCount(7);
      await expect(popup).toContainText(confirmed?(bangla?'সম্পন্ন (সিমুলেটেড)':'Completed (simulated)'):(bangla?'নথিভুক্ত — নিষ্পত্তি নিশ্চিত নয়':'Recorded — settlement not confirmed'));
      if(confirmed){await expect(popup).toContainText('Recorded payer');await expect(popup).toContainText(bangla?'দানকর':'Gift Tax');}
      if(fixture===receivedFixtures[1]&&!bangla) await dialog.getByRole('button',{name:'Close modal',exact:true}).click();
      else await dialog.getByTestId('received-notice-close').click();
    }
    await expect(popup).toHaveCount(0);
    const readsBeforeReload = completedReads;
    await page.reload();
    await expect.poll(() => completedReads).toBeGreaterThan(readsBeforeReload);
    await expect(popup).toHaveCount(0);
    expect(acknowledged).toEqual(receivedFixtures.map(fixture => fixture.eventId));
    const receivedActivity=page.getByTestId('recipient-activity-payments');
    await expect(receivedActivity).toBeVisible();
    await expect(receivedActivity).toContainText(receivedFixtures[0].receiptReference);
    const summary=receivedActivity.getByTestId('recipient-completed-summary');
    await expect(summary).toContainText(confirmed?(bangla?'৫৬১':'561'):(bangla?'০':'0'));
    await receivedActivity.getByRole('button',{name:bangla?'বিস্তারিত':'Details',exact:true}).first().click();
    const details=page.getByRole('dialog',{name:bangla?'পেমেন্টের বিস্তারিত':'Payment details'});
    await expect(details.locator('dt')).toHaveCount(7);
    await expect(details.getByRole('button',{name:bangla?'পেমেন্ট রিপোর্ট করুন':'Report Payment',exact:true})).toBeVisible();
    await details.getByRole('button',{name:bangla?'বন্ধ করুন':'Close',exact:true}).click();
  });
}
}
