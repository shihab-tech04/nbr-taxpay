import { supabase } from './supabaseClient';
import { addBeneficiaries, createBeneficiaryList, loadBeneficiaries, type BeneficiaryList } from './beneficiaries';
import { hasExistingGuestBeneficiaryAccess, loadGuestBeneficiaries } from './guestBeneficiaries';

export interface BeneficiaryRecoveryResult {
  listsChecked: number;
  beneficiariesChecked: number;
  listsCreated: number;
  beneficiariesCreated: number;
}

/**
 * Imports the lists already accessible in this browser into the *verified*
 * application's Auth UID. This is an explicit, one-way, non-destructive copy:
 * guest records are left untouched, existing account data wins conflicts,
 * and an interrupted attempt can be retried without duplicating TINs/lists.
 *
 * This is NOT a link to an NBR taxpayer identity or a delegation grant.
 */
export async function recoverBrowserBeneficiariesToAccount(ownerUid: string): Promise<BeneficiaryRecoveryResult> {
  if (!ownerUid || !hasExistingGuestBeneficiaryAccess()) {
    throw new Error('There is no saved beneficiary address book to import from this browser.');
  }
  if (!supabase) throw new Error('Account sign-in is unavailable.');

  const ensureOwner = async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== ownerUid) {
      throw new Error('Your signed-in account has changed. Sign in again before importing.');
    }
  };

  await ensureOwner();
  const guest = await loadGuestBeneficiaries();
  if (!guest.lists.length) {
    return { listsChecked: 0, beneficiariesChecked: 0, listsCreated: 0, beneficiariesCreated: 0 };
  }

  const privateData = await loadBeneficiaries(ownerUid);
  const accountLists = new Map(privateData.lists.map(list => [list.name.trim().toLocaleLowerCase(), list]));
  const destinationBySourceId = new Map<string, BeneficiaryList>();
  let listsCreated = 0;

  for (const source of guest.lists) {
    await ensureOwner();
    const key = source.name.trim().toLocaleLowerCase();
    let destination = accountLists.get(key);
    if (!destination) {
      try {
        destination = await createBeneficiaryList(ownerUid, source.name);
        listsCreated++;
      } catch (error) {
        // Another same-account session might have created the list. Never
        // substitute a different owner, and never discard source records.
        if ((error as { code?: string })?.code !== '23505') throw error;
        const fresh = await loadBeneficiaries(ownerUid);
        destination = fresh.lists.find(list => list.name.trim().toLocaleLowerCase() === key);
        if (!destination) throw error;
      }
      accountLists.set(key, destination);
    }
    destinationBySourceId.set(source.id, destination);
  }

  let beneficiariesCreated = 0;
  for (const source of guest.lists) {
    const target = destinationBySourceId.get(source.id);
    if (!target) throw new Error('A saved list could not be matched to the signed-in account.');
    const members = guest.people.filter(person => person.list_id === source.id);
    for (let offset = 0; offset < members.length; offset += 500) {
      await ensureOwner();
      beneficiariesCreated += await addBeneficiaries(
        ownerUid,
        target.id,
        members.slice(offset, offset + 500).map(person => ({
          tin: person.tin,
          display_name: person.display_name,
        })),
      );
    }
  }

  // Do not announce success solely because an API call returned 2xx.
  // Every source TIN must be readable back from the verified account.
  await ensureOwner();
  const saved = await loadBeneficiaries(ownerUid);
  const savedIds = new Set(saved.lists.map(list => list.id));
  for (const source of guest.lists) {
    const target = destinationBySourceId.get(source.id);
    if (!target || !savedIds.has(target.id)) throw new Error('A beneficiary list was not saved. Retry the import.');
    const savedTins = new Set(saved.people.filter(person => person.list_id === target.id).map(person => person.tin));
    if (guest.people.some(person => person.list_id === source.id && !savedTins.has(person.tin))) {
      throw new Error('Some beneficiaries were not saved. Retry the import; existing entries will not be duplicated.');
    }
  }

  return {
    listsChecked: guest.lists.length,
    beneficiariesChecked: guest.people.length,
    listsCreated,
    beneficiariesCreated,
  };
}
