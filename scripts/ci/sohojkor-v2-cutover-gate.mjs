/**
 * Sohojkor production project selection gate.
 * A V2 cutover is eligible only for the fictional user1-user30 simulation
 * scope and after a real hosted V2 capability/login smoke. No actual bank
 * settlement, Supabase Auth migration or Office mirror activation is implied.
 *
 * Production Main and GitHub Pages remain protected by the approved workflow.
 */
import {pathToFileURL} from 'node:url';
import {runV2DemoSmoke} from './sohojkor-v2-demo-smoke.mjs';

export const ORIGINAL_TAXPAYER = 'https://eyqhoavnitkrajvyqvxn.supabase.co';
export const PRIMARY_V2_CANDIDATE = 'https://gmuhitmaynfhipcvbvkh.supabase.co';
export const SEPARATE_OFFICE = 'https://ihbtabrvmyiwikqqbhrf.supabase.co';
export const SIMULATION_SCOPE = 'fictional-user1-user30-only';

export function assertProductionCutoverSafe({primaryUrl, frontendUrl, originalUrl, officeUrl, releaseScope}) {
  if (originalUrl !== ORIGINAL_TAXPAYER)
    throw new Error('Legacy source changed: preserve original Taxpayer as a distinct database.');
  if (officeUrl !== SEPARATE_OFFICE)
    throw new Error('Office identity changed: preserve separate Office SQL and Auth.');
  if (frontendUrl !== primaryUrl)
    throw new Error('Frontend project does not match the selected production primary: refusing a project swap.');
  if (primaryUrl === ORIGINAL_TAXPAYER)
    return {status:'ORIGINAL_PRIMARY_UNCHANGED'};
  if (primaryUrl !== PRIMARY_V2_CANDIDATE)
    throw new Error('Unrecognized Taxpayer primary endpoint: refusing implicit fallback.');
  if (releaseScope !== SIMULATION_SCOPE)
    throw new Error('BLOCKED V2 production cutover: only reviewed fictional simulation scope is eligible.');
  return {status:'V2_SIMULATION_HOSTED_SMOKE_REQUIRED'};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = assertProductionCutoverSafe({
      primaryUrl:process.env.SOHOJKOR_PRODUCTION_SUPABASE_URL,
      frontendUrl:process.env.VITE_SUPABASE_URL,
      originalUrl:process.env.SOHOJKOR_ORIGINAL_SUPABASE_URL,
      officeUrl:process.env.SOHOJKOR_OFFICE_SUPABASE_URL,
      releaseScope:process.env.SOHOJKOR_RELEASE_SCOPE,
    });
    if (result.status === 'V2_SIMULATION_HOSTED_SMOKE_REQUIRED') {
      if (process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_REF !== 'refs/heads/main' ||
          !['push','workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME))
        throw new Error('V2 deployment requires an authorized protected Main GitHub Actions release.');
      await runV2DemoSmoke(process.env.SOHOJKOR_V2_PUBLISHABLE_KEY);
    }
    console.log('Safe release source:', result.status);
  } catch (error) {
    console.error('::error::' + error.message);
    process.exitCode = 1;
  }
}
