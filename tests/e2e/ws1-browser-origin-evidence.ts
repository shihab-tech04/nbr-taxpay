import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Capture the exact serialized test-browser POST for WS3's isolated handoff.
 * Runs ONLY in the synthetic, mocked-ACK Playwright workflow; the secret-free
 * request body is not proof of SQL persistence, Office readback, or settlement.
 * Never capture HTTP headers, bearer tokens or real signed-in credentials.
 */
export async function recordWs1BrowserOrigin(
  scenario: 'guest' | 'signed-in',
  originalJsonBody: string,
  projectName: string
): Promise<void> {
  if (process.env.WS1_CAPTURE_BROWSER_REQUEST !== '1') return;
  const parsed: unknown = JSON.parse(originalJsonBody);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw Error('UI-origin payment request must be an object');
  }
  const body = parsed as Record<string, unknown>;
  if (body.service !== 'OTHER_TAX_PAYMENT' || !body.idempotencyKey ||
      !body.sessionId || !body.details || typeof body.details !== 'object') {
    throw Error('Only the existing combined-payment test request can be exported');
  }
  // Request fixtures are sourced from fixed, fictional test identities. Refuse
  // any unexpected auth material even if a fixture evolves later.
  if (/"(?:authorization|access_token|refresh_token|password|capability|api_key)"\s*:/i.test(originalJsonBody)) {
    throw Error('Refusing to export an authentication credential');
  }
  const safeProject = projectName.replace(/[^a-zA-Z0-9-]/g, '-');
  const directory = join(process.cwd(), 'ws1-f137-evidence');
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, `ui-${scenario}-${safeProject}.json`), JSON.stringify({
    contract: 'WS1-UI-ORIGIN-POST-V1',
    scenario,
    project: projectName,
    source: 'Playwright route.request().postData(), after real UI form submission',
    endpoint: '/functions/v1/demo-story1-taxpay/payments',
    httpMethod: 'POST',
    sourceResponse: 'MOCKED_ACK_TEST_ONLY',
    sqlOfficeReadback: 'NOT_VERIFIED_BY_THIS_ARTIFACT',
    headers: 'NOT_CAPTURED; WS3 must establish fresh authorized isolated session',
    bodySha256: createHash('sha256').update(originalJsonBody).digest('hex'),
    rawJsonBody: originalJsonBody
  }, null, 2) + '\n', 'utf8');
}
