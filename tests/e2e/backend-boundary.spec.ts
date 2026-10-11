import { test, expect } from '@playwright/test';
const localSupabaseUrl = process.env.TAXPAY_LOCAL_SUPABASE_URL?.trim() ?? '';
const localSupabaseAnonKey = process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY?.trim() ?? '';
if (localSupabaseUrl) {
  const host = new URL(localSupabaseUrl).hostname;
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host)) {
    throw new Error('Backend boundary tests require a loopback-only Supabase URL.');
  }
}
const base = localSupabaseUrl ? `${localSupabaseUrl}/rest/v1` : '';
const headers = { apikey: localSupabaseAnonKey, Accept: 'application/json' };
const requireLocalSupabase = (projectName: string) => {
  test.skip(!base || !localSupabaseAnonKey, 'Requires the disposable loopback Supabase test stack.');
  test.skip(projectName !== 'desktop-1280', 'Backend API contract is viewport-independent');
};

test('public can read only the unverified non-executable 170-head candidate snapshot', async ({ request }, testInfo) => {
  requireLocalSupabase(testInfo.project.name);
  const response = await request.get(
    base + '/taxpay_head_source_candidates?select=source_head_id,verification_status,executable,source_map&order=source_head_id.asc&limit=170',
    { headers }
  );
  expect(response.status(), await response.text()).toBe(200);
  const records = await response.json() as Array<{source_head_id:number;verification_status:string;executable:boolean;source_map:string}>;
  expect(records).toHaveLength(170);
  expect(records.map(x=>x.source_head_id)).toEqual(Array.from({ length:170 },(_,i)=>i+1));
  expect(records.every(x=>x.verification_status==='UNVERIFIED' && x.executable===false)).toBe(true);
  expect(records.filter(x=>x.source_map==='OWNER_REVIEW').map(x=>x.source_head_id)).toEqual([5,150]);
});

test('anonymous browser key cannot select or insert personal drafts', async ({ request }, testInfo) => {
  requireLocalSupabase(testInfo.project.name);
  const url = base + '/taxpay_payment_drafts';
  const get = await request.get(url + '?select=id', { headers });
  expect([401,403], await get.text()).toContain(get.status());
  const post = await request.post(url, {
    headers: { ...headers, 'Content-Type':'application/json', Prefer:'return=minimal' },
    data: {
      owner_uid:'00000000-0000-4000-8000-000000000001',
      purpose:'TAX_LIABILITY_PAYMENT',
      category:'TAX_WITH_RETURN',
      assessment_year:'2026-27', amount_minor:100
    }
  });
  expect([401,403], await post.text()).toContain(post.status());
});

test('secure workspace shows actual sign-in, never a fake signed-in state', async ({ page }) => {
  await page.goto('/?action=secure_workspace');
  await expect(page.getByRole('heading', { name:'Secure TaxPay workspace' })).toBeVisible();
  await expect(page.getByRole('heading', { name:'Sign in with email' })).toBeVisible();
  await expect(page.getByRole('heading',{name:'Dedicated database is not configured yet'})).toHaveCount(0);
  await expect(page.getByRole('textbox',{name:'Email address'})).toBeVisible();
});

test('secure workspace email sign-in sends only a real Supabase OTP request, never a fake account', async ({ page }) => {
  let sent = 0;
  await page.route('**/auth/v1/otp**', route => {
    sent++;
    const body = route.request().postDataJSON();
    expect(body.email).toBe('test-identity@example.invalid');
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/?action=secure_workspace');
  await page.getByRole('textbox', { name: 'Email address' }).fill('test-identity@example.invalid');
  await page.getByRole('button', { name: 'Email sign-in link' }).click();
  await expect(page.getByRole('status').last()).toContainText('Check your email for the secure sign-in link.');
  expect(sent).toBe(1);
  await expect(page.getByText('Signed-in application user')).toHaveCount(0);
});

test('secure workspace fails closed when email sign-in network request fails', async ({ page }) => {
  await page.route('**/auth/v1/otp**', route => route.abort('failed'));
  await page.goto('/?action=secure_workspace');
  await page.getByRole('textbox', { name: 'Email address' }).fill('offline@example.invalid');
  await page.getByRole('button', { name: 'Email sign-in link' }).click();
  await expect(page.getByRole('status').last()).toContainText(/sign-in|Sign-in|service unavailable/);
  await expect(page.getByText('Signed-in application user')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Email sign-in link' })).toBeEnabled();
});

test('secure workspace starts without a presumed legal AY and remains usable on narrow screens', async ({ page }) => {
  await page.goto('/?action=secure_workspace');
  await expect(page.getByRole('heading', { name: 'Secure TaxPay workspace' })).toBeVisible();
  const email = page.getByRole('textbox', { name: 'Email address' });
  const bounds = await email.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.height).toBeGreaterThanOrEqual(44);
  const main = await page.locator('main').boundingBox();
  expect(main).not.toBeNull();
  expect(main!.x + main!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 2);
  await page.getByRole('button', { name: 'বাংলা' }).click();
  await expect(page.getByRole('heading', { name: 'নিরাপদ TaxPay ওয়ার্কস্পেস' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'সাইন ইন লিংক পাঠান' })).toBeVisible();
});

test('income tax guidance refuses unverified calculations and official-payment promises', async ({ page }) => {
  await page.goto('/?action=guidance');
  await expect(page.getByRole('heading', { name: 'Individual income tax estimator — unavailable' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Proceed to Pay Estimated Tax' })).toHaveCount(0);
  await expect(page.getByText(/No verified, year-specific income tax thresholds/)).toBeVisible();
  await page.getByRole('button', { name: 'বাংলা' }).click();
  await expect(page.getByRole('heading', { name: 'ব্যক্তিগত আয়কর হিসাব — বর্তমানে বন্ধ' })).toBeVisible();
});

test('travel-tax page explicitly denies real official receipts and clearance', async ({ page }) => {
  await page.goto('/?action=travel');
  await expect(page.getByText(/No official passenger verification, government fee collection or immigration clearance/)).toBeVisible();
  await expect(page.getByText(/SOURCE NOT IN INPUTS \/ LEGAL VALIDITY UNVERIFIED/)).toBeVisible();
});

test('anonymous users cannot read or write source change proposals', async ({ request }, info) => {
  requireLocalSupabase(info.project.name);
  const endpoint=base+'/taxpay_head_change_proposals';
  const get=await request.get(endpoint+'?select=proposal_id', {headers});
  expect([401,403],await get.text()).toContain(get.status());
  const post=await request.post(endpoint, {
    headers:{...headers,'Content-Type':'application/json'},
    data:{
      proposer_uid:'00000000-0000-4000-8000-000000000001',
      source_key:'V11-HTML-20261010', source_head_id:1,
      source_document_sha256:'0'.repeat(64),
      submission_reason:'Synthetic invalid anonymous request',
      proposed_patch:{suggestedEnglishLabel:'Change not permitted'}
    }
  });
  expect([401,403],await post.text()).toContain(post.status());
});

test('COR-001 anonymous cannot read, submit or mutate evidence-pending correction inquiries', async ({ request }, testInfo) => {
  requireLocalSupabase(testInfo.project.name);
  const url = base + '/taxpay_correction_inquiries';
  const read = await request.get(url+'?select=inquiry_id', { headers });
  expect([401,403], await read.text()).toContain(read.status());

  const insert = await request.post(url, {
    headers: { ...headers, 'Content-Type':'application/json', Prefer:'return=minimal' },
    data: {
      requester_uid:'00000000-0000-4000-8000-000000000001',
      original_reference:'TPAY-REF-123456',
      reason:'I would like clarification about this sample reference.',
      requested_outcome:'Please review the reference and explain the mismatch.'
    }
  });
  expect([401,403], await insert.text()).toContain(insert.status());
  const update = await request.patch(url+'?inquiry_id=eq.00000000-0000-4000-8000-000000000002', {
    headers: { ...headers, 'Content-Type':'application/json', Prefer:'return=minimal' },
    data: { evidence_state:'APPROVED', may_change_financial_records:true }
  });
  expect([401,403],await update.text()).toContain(update.status());
});

test('COR-001 unauthenticated route never offers correction request as an approved financial service', async ({ page }) => {
  await page.goto('/?action=secure_workspace');
  await expect(page.getByRole('heading',{name:'Sign in with email'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Request a review of an original reference'})).toHaveCount(0);
});

test('COR-002 anonymous before/after attribution cannot mutate or initiate financial correction',async({request},testInfo)=>{
  requireLocalSupabase(testInfo.project.name);
  const url=base+'/taxpay_correction_inquiries';
  const payload={
    requester_uid:'00000000-0000-4000-8000-000000000001',
    original_reference:'TPAY-REF-123456',
    reason:'There is a discrepancy in the draft attribution on this reference.',
    requested_outcome:'Please review the proposed assessment year attribution.',
    change_kind:'ASSESSMENT_YEAR',
    old_value:'2024-25',
    new_value:'2025-26'
  };
  const post=await request.post(url,{
    headers:{...headers,'Content-Type':'application/json',Prefer:'return=representation'},data:payload
  });
  expect([401,403],await post.text()).toContain(post.status());
  const patch=await request.patch(url+'?inquiry_id=eq.00000000-0000-4000-8000-000000000002',{
    headers:{...headers,'Content-Type':'application/json',Prefer:'return=minimal'},
    data:{change_kind:'PAYMENT_HEAD',old_value:'A',new_value:'B',may_change_financial_records:true}
  });
  expect([401,403],await patch.text()).toContain(patch.status());
});
