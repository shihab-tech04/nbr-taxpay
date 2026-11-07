import { expect, test, type BrowserContext } from '@playwright/test';

/**
 * Real two-browser SQL draft persistence through disposable local Edge Functions.
 * No mocked REST responses or storage. Rejects non-loopback database endpoints.
 * Preview account capabilities never escape the local test process.
 */
test('same account resumes, updates and deletes a SQL payment draft from a different browser', async ({ browser }) => {
  test.setTimeout(120_000);
  const raw = process.env.TAXPAY_LOCAL_SUPABASE_URL;
  const key = process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
  if (!raw || !key) throw new Error('Disposable Supabase credentials are required.');
  const url = new URL(raw);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
    throw new Error('Refusing hosted SQL draft test.');
  const endpoint = new URL('/functions/v1/taxpay-guest-beneficiaries', url.origin).href;
  const contexts: BrowserContext[] = [];
  const newBrowser = async () => {
    const context = await browser.newContext({
      baseURL: 'http://127.0.0.1:4173', viewport: { width: 375, height: 812 },
    });
    contexts.push(context);
    return context;
  };
  const invoke = async (context: BrowserContext, action: string, fields: Record<string, unknown>, capability?: string) => {
    const response = await context.request.post(endpoint, {
      headers: {
        origin: 'http://127.0.0.1:4173',
        apikey: key,
        'content-type': 'application/json',
        ...(capability ? { 'x-taxpay-guest-capability': capability } : {}),
      },
      data: { action, ...fields },
    });
    const result = await response.json();
    return { status: response.status(), result };
  };
  let cleanupId = '';
  let latestRevision = 0;
  let ownerCapability = '';
  let cleanupContext: BrowserContext | null = null;
  try {
    const browserA = await newBrowser();
    cleanupContext = browserA;
    const first = await invoke(browserA, 'demo-login', { userId: 'user9', password: 'user9' });
    expect(first.status).toBe(200);
    expect(first.result.success).toBe(true);
    ownerCapability = first.result.data.capability;
    const payload = {
      schemaVersion: 1, category: 'TAX_WITH_RETURN', step: 2, forSelf: true,
      assessmentYear: '2026-27', selectedHeadIds: [1], amountInputs: { '1': '123.45' },
    };
    const saved = await invoke(browserA, 'payment-draft-create',
      { service: 'TAX_WITH_RETURN', payload }, ownerCapability);
    expect(saved.status).toBe(200);
    expect(saved.result.success).toBe(true);
    cleanupId = saved.result.data.id;
    latestRevision = saved.result.data.revision;
    expect(latestRevision).toBe(1);
    expect(saved.result.data.form_payload).toEqual(payload);

    const browserB = await newBrowser();
    const second = await invoke(browserB, 'demo-login', { userId: 'user9', password: 'user9' });
    expect(second.status).toBe(200);
    expect(second.result.data.profileId).toBe('user9');
    const secondCapability: string = second.result.data.capability;
    const listB = await invoke(browserB, 'payment-draft-list', { service: 'TAX_WITH_RETURN' }, secondCapability);
    expect(listB.status).toBe(200);
    const restored = listB.result.data.find((row: { id: string }) => row.id === cleanupId);
    expect(restored?.form_payload).toEqual(payload);

    const updatedPayload = { ...payload, amountInputs: { '1': '987.60' } };
    const updated = await invoke(browserB, 'payment-draft-update', {
      id: cleanupId, revision: latestRevision, service: 'TAX_WITH_RETURN',
      payload: updatedPayload,
    }, secondCapability);
    expect(updated.status).toBe(200);
    expect(updated.result.data.form_payload).toEqual(updatedPayload);
    latestRevision = updated.result.data.revision;
    expect(latestRevision).toBe(2);

    // No loss of updates when the first browser still holds revision 1.
    const stale = await invoke(browserA, 'payment-draft-update', {
      id: cleanupId, revision: 1, service: 'TAX_WITH_RETURN', payload,
    }, ownerCapability);
    expect(stale.status).toBe(409);
    expect(stale.result.code).toBe('DRAFT_CONFLICT');

    const browserC = await newBrowser();
    const other = await invoke(browserC, 'demo-login', { userId: 'user10', password: 'user10' });
    expect(other.status).toBe(200);
    const otherCapability = other.result.data.capability as string;
    const otherList = await invoke(browserC, 'payment-draft-list',
      { service: 'TAX_WITH_RETURN' }, otherCapability);
    expect(otherList.status).toBe(200);
    expect(otherList.result.data.some((row: { id: string }) => row.id === cleanupId)).toBe(false);
    const forbidden = await invoke(browserC, 'payment-draft-get', { id: cleanupId }, otherCapability);
    expect(forbidden.status).toBe(404);
    const forbiddenDelete = await invoke(browserC, 'payment-draft-delete',
      { id: cleanupId, revision: latestRevision }, otherCapability);
    expect(forbiddenDelete.status).toBe(409);

    const rereadA = await invoke(browserA, 'payment-draft-get', { id: cleanupId }, ownerCapability);
    expect(rereadA.status).toBe(200);
    expect(rereadA.result.data.revision).toBe(latestRevision);
    expect(rereadA.result.data.form_payload).toEqual(updatedPayload);

    const deleted = await invoke(browserB, 'payment-draft-delete',
      { id: cleanupId, revision: latestRevision }, secondCapability);
    expect(deleted.status).toBe(200);
    expect(deleted.result.data.deleted).toBe(cleanupId);
    cleanupId = '';
    const verifyDeleted = await invoke(browserA, 'payment-draft-list',
      { service: 'TAX_WITH_RETURN' }, ownerCapability);
    expect(verifyDeleted.result.data.some((row: { id: string }) => row.id === deleted.result.data.deleted)).toBe(false);
  } finally {
    if (cleanupId && cleanupContext && ownerCapability) {
      await invoke(cleanupContext, 'payment-draft-delete',
        { id: cleanupId, revision: latestRevision }, ownerCapability).catch(() => undefined);
    }
    await Promise.all(contexts.map(context => context.close()));
  }
});
