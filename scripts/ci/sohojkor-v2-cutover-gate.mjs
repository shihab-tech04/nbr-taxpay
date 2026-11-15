/**
 * Protected GitHub Pages cutover gate. A green PR build is not an Auth/SQL/Office
 * migration; the original site must remain live until hosted gates are proven.
 *
 * Intentionally no "approval=true" bypass: once hosted restore and identity
 * continuity have been independently verified, replace this denial in a
 * reviewed, exact-head release with evidence and a tested rollback.
 */
import {pathToFileURL} from 'node:url';

export const ORIGINAL_TAXPAYER = 'https://eyqhoavnitkrajvyqvxn.supabase.co';
export const PRIMARY_V2_CANDIDATE = 'https://gmuhitmaynfhipcvbvkh.supabase.co';
export const SEPARATE_OFFICE = 'https://ihbtabrvmyiwikqqbhrf.supabase.co';

export function assertProductionCutoverSafe({primaryUrl, originalUrl, officeUrl}) {
  if (originalUrl !== ORIGINAL_TAXPAYER)
    throw new Error('Legacy source changed: preserve the original Taxpayer project as read-only recovery source.');
  if (officeUrl !== SEPARATE_OFFICE)
    throw new Error('Office project identity changed: preserve distinct Office SQL and Auth.');
  if (primaryUrl === ORIGINAL_TAXPAYER)
    return {status: 'ORIGINAL_PRIMARY_UNCHANGED'};
  if (primaryUrl === PRIMARY_V2_CANDIDATE) {
    throw new Error(
      'BLOCKED V2 production cutover: original Auth identities are not present in V2; ' +
      'hosted SQL/Auth/Storage backup and restore, owner-scoped historical fallback, ' +
      'V2 Edge behavior, and separate Office two-way readback are not verified. ' +
      'Never deploy V2 from a successful build alone.'
    );
  }
  throw new Error('Unrecognized Taxpayer production project: refusing implicit fallback.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = assertProductionCutoverSafe({
      primaryUrl: process.env.SOHOJKOR_PRODUCTION_SUPABASE_URL,
      originalUrl: process.env.SOHOJKOR_ORIGINAL_SUPABASE_URL,
      officeUrl: process.env.SOHOJKOR_OFFICE_SUPABASE_URL,
    });
    console.log('Safe release source:', result.status);
  } catch (error) {
    console.error('::error::' + error.message);
    process.exitCode = 1;
  }
}
