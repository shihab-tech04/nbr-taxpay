import { TAXPAY_PUBLIC_ENDPOINT } from '../config/publicBackend';
import {activePreviewSession,PREVIEW_USER_KEY} from './previewAccountSession';
import type { Beneficiary, BeneficiaryInput, BeneficiaryList } from './beneficiaries';

const capabilityKey = 'korbritto.guest-beneficiaries.capability.v1';
const initializedKey = 'korbritto.guest-beneficiaries.initialized.v1';
const capabilityPattern = /^[A-Za-z0-9_-]{43}$/;
const pageSize = 500;

/** A guest address book can be recovered only from a browser retaining its capability. */
export function hasStoredGuestBeneficiaries(): boolean {
  try { return capabilityPattern.test(window.localStorage.getItem(capabilityKey) ?? '') && window.localStorage.getItem(initializedKey) === '1'; }
  catch { return false; }
}

type GuestList = Pick<BeneficiaryList, 'id' | 'name' | 'created_at'>;
type GuestPerson = Pick<Beneficiary, 'id' | 'list_id' | 'tin' | 'display_name' | 'tag' | 'relationship' | 'other_label' | 'created_at' | 'updated_at'>;

function browserStorage(): Storage {
  try {
    return window.localStorage;
  } catch {
    throw new Error('Guest beneficiary storage is unavailable in this browser. Allow site storage and try again.');
  }
}

function createCapability(): string {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure guest storage is unavailable in this browser. Open Korbritto over HTTPS and try again.');
  }
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

type GuestSource='active'|'legacy';
function getCapability(source:GuestSource='active'): { value: string; needsRegistration: boolean } {
  if(source==='active'){
    const preview=activePreviewSession();
    if(preview)return {value:preview.capability,needsRegistration:false};
    // A stale browser-local preview must never silently load another
    // browser's unrelated anonymous address book as the preview user's data.
    if(import.meta.env?.VITE_SUPABASE_DISABLED!=='true'&&window.sessionStorage.getItem(PREVIEW_USER_KEY))
      throw new Error('Your demo session needs sign-in again. No data was discarded.');
  }
  const storage = browserStorage();
  let value: string | null;
  try {
    value = storage.getItem(capabilityKey);
  } catch {
    throw new Error('Guest beneficiary storage is unavailable in this browser. Allow site storage and try again.');
  }
  if (value !== null) {
    if (!capabilityPattern.test(value)) {
      throw new Error('This browser’s saved beneficiary access key is invalid. Do not clear site data if you need to recover an older list.');
    }
    try {
      return { value, needsRegistration: storage.getItem(initializedKey) !== '1' };
    } catch {
      throw new Error('Guest beneficiary storage is unavailable in this browser. Allow site storage and try again.');
    }
  }
  const created = createCapability();
  try {
    storage.setItem(capabilityKey, created);
    storage.removeItem(initializedKey);
  } catch {
    throw new Error('Guest beneficiary storage is unavailable in this browser. Allow site storage and try again.');
  }
  return { value: created, needsRegistration: true };
}

async function post<T>(action: string, fields: Record<string, unknown> = {}, source:GuestSource='active'): Promise<T> {
  const { url, publishableKey } = TAXPAY_PUBLIC_ENDPOINT;
  if (!url || !publishableKey) throw new Error('Guest beneficiaries are temporarily unavailable. Please try again later.');
  const capability = getCapability(source);
  const endpoint = `${url.replace(/\/$/, '')}/functions/v1/taxpay-guest-beneficiaries`;
  const send = async (nextAction: string, nextFields: Record<string, unknown> = {}) => {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'apikey': publishableKey,
          'content-type': 'application/json',
          'x-taxpay-guest-capability': capability.value,
        },
        cache: 'no-store',
        body: JSON.stringify({ action: nextAction, ...nextFields }),
      });
    } catch {
      // Never discard or rotate the capability on a transient network failure.
      throw new Error('Guest beneficiaries are temporarily unavailable. Please try again later.');
    }
    const result = await response.json().catch(() => null) as { success?: boolean; data?: T; code?: string } | null;
    if (!response.ok || !result?.success) {
      if (response.status === 410 || result?.code === 'GUEST_SESSION_UNAVAILABLE') {
        throw new Error('This browser’s saved beneficiary session has expired or is unavailable. Its access key was kept so it will not be replaced silently.');
      }
      if (response.status === 409 && result?.code === 'BENEFICIARY_ALREADY_IN_LIST') {
        throw new Error('This beneficiary is already saved in the destination list.');
      }
      if (response.status === 409 || result?.code === 'LIST_NAME_TAKEN') {
        throw new Error('A list with this name already exists.');
      }
      if (response.status === 404) throw new Error('The selected beneficiary was not found in this browser. Refresh the list and try again.');
      if (response.status === 400) throw new Error('Check the beneficiary details and try again.');
      throw new Error('Guest beneficiaries are temporarily unavailable. Please try again later.');
    }
    return result.data as T;
  };

  if (capability.needsRegistration) {
    await send('open');
    try {
      browserStorage().setItem(initializedKey, '1');
    } catch {
      // The capability itself remains stored; a later request retries registration.
    }
  }
  return send(action, fields);
}

/** Only idempotent reads retry once on transport/service interruption. A failed
 * write is never replayed automatically; the original capability is preserved.
 */
async function readGuestPage<T>(action:'lists'|'people',fields:Record<string,unknown>={},source:GuestSource='active'):Promise<T[]> {
  for(let attempt=0;attempt<2;attempt++){
    try {
      const rows=await post<T[]>(action,fields,source);
      if(!Array.isArray(rows))throw new Error('Saved beneficiary data could not be read. Please retry.');
      return rows;
    } catch(error) {
      const message=error instanceof Error?error.message:'';
      if(attempt===1||message!=='Guest beneficiaries are temporarily unavailable. Please try again later.')throw error;
    }
  }
  throw new Error('Guest beneficiaries are temporarily unavailable. Please try again later.');
}

async function loadFromSource(source:GuestSource):Promise<{ lists: GuestList[]; people: GuestPerson[] }> {
  // Existing capability sessions can fetch independent lists and the first page
  // concurrently, avoiding a full extra Edge Function round trip on every read.
  // A first-time session must finish capability registration before concurrent reads.
  const initialized = source==='active'&&activePreviewSession()
    ? true : hasStoredGuestBeneficiaries();
  const [lists, firstPage] = initialized
    ? await Promise.all([
        readGuestPage<GuestList>('lists',{},source),
        readGuestPage<GuestPerson>('people', { offset: 0, limit: pageSize },source),
      ])
    : [await readGuestPage<GuestList>('lists',{},source), null];
  const people: GuestPerson[] = firstPage ? [...firstPage] : [];
  for (let offset = firstPage ? pageSize : 0;
       firstPage ? (firstPage.length === pageSize) : true;
       offset += pageSize) {
    const page = await readGuestPage<GuestPerson>('people', { offset, limit: pageSize },source);
    people.push(...page);
    if (page.length < pageSize) break;
  }
  return { lists, people };
}

/** Active preview reads are always server-issued, profile-specific. */
export function loadGuestBeneficiaries(){
  return loadFromSource('active');
}
/** Old anonymous browser books stay available only for explicit recovery. */
export function loadLegacyGuestBeneficiaries(){
  return loadFromSource('legacy');
}

export function createGuestBeneficiaryList(name: string): Promise<GuestList> {
  return post('create-list', { name });
}

export function addGuestBeneficiaries(listId: string, rows: BeneficiaryInput[]): Promise<number> {
  return post('add', { listId, rows });
}

export async function updateGuestBeneficiary(id: string, name: string): Promise<void> {
  await post('update', { id, name });
}

/** One atomic capability-bound edit. Preserves TIN/name and supports tag-only changes. */
export async function editGuestBeneficiaryClassification(
  id:string,sourceListId:string,listId:string,
  classification:Pick<Beneficiary,'tag'|'relationship'|'other_label'>
):Promise<void>{
  await post('edit-classification',{id,sourceListId,listId,...classification});
}

/** Guest preview compatibility: server performs one atomic, capability-bound list move. */
export async function moveGuestBeneficiary(id:string,sourceListId:string,listId:string):Promise<void>{
  await post('move', {id,sourceListId,listId});
}

export async function removeGuestBeneficiary(id: string): Promise<void> {
  await post('remove', { id });
}

export async function renameGuestBeneficiaryList(id: string, name: string): Promise<void> {
  await post('rename-list', { id, name });
}
export async function deleteGuestBeneficiaryList(id: string): Promise<void> {
  await post('delete-list', { id });
}
