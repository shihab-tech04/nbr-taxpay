import { test } from 'node:test';
import { strict as assert } from 'node:assert';

// Exercise the actual profile-login request without hitting production Supabase.
test('a provider 402 is an explicit service restriction, never a signed-in identity', async () => {
  process.env.VITE_SUPABASE_URL = 'https://unit-test.invalid';
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'public-test-key';
  process.env.VITE_SUPABASE_DISABLED = 'false';
  const { signInPreviewProfile, PreviewServiceRestrictedError } =
    await import('../src/services/previewAccountSession.ts');
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response('{"message":"service restricted"}', {
      status: 402, headers: {'content-type':'application/json'}
    });
  };
  try {
    await assert.rejects(
      () => signInPreviewProfile('user1', 'user1'),
      error => error instanceof PreviewServiceRestrictedError &&
        error.message.includes('temporarily restricted')
    );
    assert.equal(calls, 1, 'never retry or create a fallback identity after 402');
    assert.equal(await signInPreviewProfile('user1', 'incorrect'), null);
    assert.equal(calls, 1, 'invalid credentials do not contact the provider');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
