import { TAXPAY_PUBLIC_ENDPOINT } from '../config/publicBackend';
import type { Beneficiary, BeneficiaryInput, BeneficiaryList } from './beneficiaries';

const capabilityKey = 'korbritto.guest-beneficiaries.capability.v1';
const initializedKey = 'korbritto.guest-beneficiaries.initialized.v1';
const capabilityPattern = /^[A-Za-z0-9_-]{43}$/;
/** Preview user IDs are not credentials, but their browser-scoped saved lists
 * must never silently bleed into a different sample login on the same device.
 * Legacy unscoped capabilities remain untouched for explicit recovery.
 */
export function guestBeneficiaryStorageKeys(previewId:string|null):{capability:string;initialized:string}{
  const scope=previewId && /^user(?:10|[1-9])$/.test(previewId)?':preview:'+previewId:'';
  return {capability:capabilityKey+scope,initialized:initializedKey+scope};
}
function activeGuestStorageKeys(){
  let previewId:string|null=null;
  try {previewId=window.sessionStorage?.getItem('taxpay-taxpayer-preview-user')??null;}
  catch { /* Real guest browsing has no preview identity. */ }
  return guestBeneficiaryStorageKeys(previewId);
}

const pageSize = 500;

/** A guest address book can be recovered only from a browser retaining its capability. */
export function hasStoredGuestBeneficiaries(scope:'current'|'legacy'='current'): boolean {
  try { const keys=scope==='legacy'?guestBeneficiaryStorageKeys(null):activeGuestStorageKeys(); return capabilityPattern.test(window.localStorage.getItem(keys.capability) ?? '') && window.localStorage.getItem(keys.initialized) === '1'; }
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

function getCapability(scope:'current'|'legacy'='current'): { value: string; needsRegistration: boolean; initializedStorageKey:string } {
  const storage = browserStorage();
  const keys=scope==='legacy'?guestBeneficiaryStorageKeys(null):activeGuestStorageKeys();
  let value: string | null;
  try {
    value = storage.getItem(keys.capability);
  } catch {
    throw new Error('Guest beneficiary storage is unavailable in this browser. Allow site storage and try again.');
  }
  if (value !== null) {
    if (!capabilityPattern.test(value)) {
      throw new Error('This browser’s saved beneficiary access key is invalid. Do not clear site data if you need to recover an older list.');
    }
    try {
      return { value, needsRegistration: storage.getItem(keys.initialized) !== '1',initializedStorageKey:keys.initialized };
    } catch {
      throw new Error('Guest beneficiary storage is unavailable in this browser. Allow site storage and try again.');
    }
  }
  const created = createCapability();
  try {
    storage.setItem(keys.capability, created);
    storage.removeItem(keys.initialized);
  } catch {
    throw new Error('Guest beneficiary storage is unavailable in this browser. Allow site storage and try again.');
  }
  return { value: created, needsRegistration: true,initializedStorageKey:keys.initialized };
}

async function post<T>(action: string, fields: Record<string, unknown> = {},scope:'current'|'legacy'='current'): Promise<T> {
  const { url, publishableKey } = TAXPAY_PUBLIC_ENDPOINT;
  if (!url || !publishableKey) throw new Error('Guest beneficiaries are temporarily unavailable. Please try again later.');
  const capability = getCapability(scope);
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
      browserStorage().setItem(capability.initializedStorageKey, '1');
    } catch {
      // The capability itself remains stored; a later request retries registration.
    }
  }
  return send(action, fields);
}

/** Only idempotent reads retry once on transport/service interruption. A failed
 * write is never replayed automatically; the original capability is preserved.
 */
async function readGuestPage<T>(action:'lists'|'people',fields:Record<string,unknown>={},scope:'current'|'legacy'='current'):Promise<T[]> {
  for(let attempt=0;attempt<2;attempt++){
    try {
      const rows=await post<T[]>(action,fields,scope);
      if(!Array.isArray(rows))throw new Error('Saved beneficiary data could not be read. Please retry.');
      return rows;
    } catch(error) {
      const message=error instanceof Error?error.message:'';
      if(attempt===1||message!=='Guest beneficiaries are temporarily unavailable. Please try again later.')throw error;
    }
  }
  throw new Error('Guest beneficiaries are temporarily unavailable. Please try again later.');
}

export async function loadGuestBeneficiaries(scope:'current'|'legacy'='current'): Promise<{ lists: GuestList[]; people: GuestPerson[] }> {
  // Existing capability sessions can fetch independent lists and the first page
  // concurrently, avoiding a full extra Edge Function round trip on every read.
  // A first-time session must finish capability registration before concurrent reads.
  const initialized = hasStoredGuestBeneficiaries(scope);
  const [lists, firstPage] = initialized
    ? await Promise.all([
        readGuestPage<GuestList>('lists',{},scope),
        readGuestPage<GuestPerson>('people', { offset: 0, limit: pageSize },scope),
      ])
    : [await readGuestPage<GuestList>('lists',{},scope), null];
  const people: GuestPerson[] = firstPage ? [...firstPage] : [];
  for (let offset = firstPage ? pageSize : 0;
       firstPage ? (firstPage.length === pageSize) : true;
       offset += pageSize) {
    const page = await readGuestPage<GuestPerson>('people', { offset, limit: pageSize },scope);
    people.push(...page);
    if (page.length < pageSize) break;
  }
  return { lists, people };
}

export function createGuestBeneficiaryList(name: string,scope:'current'|'legacy'='current'): Promise<GuestList> {
  return post('create-list', { name },scope);
}

export function addGuestBeneficiaries(listId: string, rows: BeneficiaryInput[],scope:'current'|'legacy'='current'): Promise<number> {
  return post('add', { listId, rows },scope);
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

/** One explicit, retryable transfer. Unscoped legacy data may have been used
 * by several sample IDs; never assign it automatically to any preview login.
 * The source capability and records are kept intact on success or failure.
 */
export async function restoreLegacyGuestListsToSelectedPreview():Promise<{lists:number;people:number}> {
  const preview=(()=>{try{return window.sessionStorage?.getItem('taxpay-taxpayer-preview-user')??null;}catch{return null;}})();
  if(!preview || !/^user(?:10|[1-9])$/.test(preview))
    throw new Error('Select a sample user before restoring old browser lists.');
  if(!hasStoredGuestBeneficiaries('legacy'))return {lists:0,people:0};
  const legacy=await loadGuestBeneficiaries('legacy');
  const current=await loadGuestBeneficiaries('current');
  let created=0,added=0;
  const lists=[...current.lists];
  const people=[...current.people];
  for(const oldList of legacy.lists){
    let destination=lists.find(item=>item.name.trim().toLocaleLowerCase()===oldList.name.trim().toLocaleLowerCase());
    if(!destination){
      destination=await createGuestBeneficiaryList(oldList.name,'current');
      lists.push(destination);
      created++;
    }
    const oldPeople=legacy.people.filter(person=>person.list_id===oldList.id);
    for(let i=0;i<oldPeople.length;i+=50){
      const pending=oldPeople.slice(i,i+50).filter(person=>!people.some(existing=>
        existing.list_id===destination!.id&&existing.tin===person.tin));
      if(!pending.length)continue;
      const count=await addGuestBeneficiaries(destination.id,pending.map(person=>({
        tin:person.tin,display_name:person.display_name,
        tag:person.tag,relationship:person.relationship,other_label:person.other_label
      })),'current');
      added+=count;
      for(const person of pending)people.push({...person,list_id:destination.id});
    }
  }
  return {lists:created,people:added};
}
