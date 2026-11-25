import type {Page} from '@playwright/test';

/**
 * Disconnected Playwright UI fixtures only. A fake gateway POST must not
 * shortcut the real client's exact owner-scoped Taxpayer SQL readback.
 * This mock never makes or claims hosted database writes.
 */
export async function mockSubmittedPaymentSqlReadback(page: Page) {
  let latest: Record<string, unknown> | null = null;
  page.on('request', request => {
    if (request.method() !== 'POST') return;
    try {
      if (!new URL(request.url()).pathname.endsWith('/functions/v1/demo-story1-taxpay/payments')) return;
      const input: unknown = request.postDataJSON();
      if (input && typeof input === 'object' && !Array.isArray(input)) latest = input as Record<string, unknown>;
    } catch { /* Keep invalid requests unverified rather than manufacturing a row. */ }
  });
  await page.route('**/functions/v1/demo-story1-taxpay/payments/*', async route => {
    if (route.request().method() !== 'GET') return route.continue();
    const url = new URL(route.request().url());
    const id = url.pathname.split('/').pop() ?? '';
    if (!latest || !/^[0-9a-f-]{36}$/i.test(id) ||
        url.searchParams.get('sessionId') !== latest.sessionId) {
      return route.fulfill({status: 404, contentType: 'application/json',
        body: '{"success":false,"error":"TEST_SOURCE_UNAVAILABLE"}'});
    }
    return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({
      success: true, simulationOnly: true,
      data: {id, status: 'SIMULATED_SUCCESS', data: latest},
    })});
  });
}
