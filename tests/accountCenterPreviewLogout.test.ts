import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

test('preview account sign-out awaits confirmed saved settings before clearing session',()=>{
  const screen=readFileSync('src/components/screens/AccountCenter.tsx','utf8');
  const state=readFileSync('src/services/taxState.tsx','utf8');
  assert.match(screen,/try\s*\{\s*await logoutPreviewAccount\(\);\s*\}/);
  assert.match(screen,/catch\s*\{\s*setFeedback\(\{error:true/);
  assert.match(screen,/disabled=\{previewSigningOut\}/);
  assert.match(state,/await flushPreviewSettings\(\)/);
  assert.ok(state.indexOf('await flushPreviewSettings()') < state.indexOf('clearPreviewAccount();'));
});

test('preview sign-out does not add an email login or alter the frozen login form',()=>{
  const screen=readFileSync('src/components/screens/AccountCenter.tsx','utf8');
  const login=readFileSync('src/components/screens/TaxpayerLoginDialog.tsx','utf8');
  assert.match(screen,/if \(!previewAccount\) \{ setUserRole\('GUEST'\); navigate\('landing'\); return; \}/);
  assert.match(login,/id="taxpayer-login-user-id"/);
  assert.match(login,/id="taxpayer-login-password"/);
});
