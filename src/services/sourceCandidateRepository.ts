import { supabase } from './supabaseClient';
import { verifyCandidateRows } from './sourceCandidateValidator';
import type { V11Head } from '../data/v11SourceHeads';

export async function verifyPublishedCandidateCatalogue(): Promise<readonly V11Head[]> {
  if (!supabase) throw new Error('Dedicated Supabase project unavailable');
  const { data, error } = await supabase.from('taxpay_head_source_candidates')
    .select('source_head_id,source_map,verification_status,executable,raw_original_record')
    .eq('source_key', 'V11-HTML-20261010')
    .order('source_head_id', { ascending: true })
    .limit(171);
  if (error) throw new Error('Read-only candidate catalogue unavailable: ' + error.message);
  return verifyCandidateRows(data);
}
