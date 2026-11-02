import { TAXPAY_PUBLIC_ENDPOINT } from '../config/publicBackend';
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
type GuestPerson = Pick<Beneficiary, 'id' | 'list_id' | 'tin' | 'display_name' | 'created_at' | 'updated_at'>;

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

function getCapability(): { value: string; needsRegistration: boolean } {
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

async function post<T>(action: string, fields: Record<string, unknown> = {}): Promise<T> {
  const { url, publishableKey } = TAXPAY_PUBLIC_ENDPOINT;
  if (!url || !publishableKey) throw new Error('Guest beneficiaries are temporarily unavailable. Please try again later.');
  const capability = getCapability();
  const endpoint = `${url.replace(/\/$/, '')}/functions/v1/taxpay-guest-beneficiaries`;
  const send = async (nextAction: string, nextFields: Record<string, unknown> = {}) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'apikey': publishableKey,
        'content-type': 'application/json',
        'x-taxpay-guest-capability': capability.value,
      },
      cache: 'no-store',
      body: JSON.stringify({ action: nextAction, ...nextFields }),
    });
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

export async function loadGuestBeneficiaries(): Promise<{ lists: GuestList[]; people: GuestPerson[] }> {
  const lists = await post<GuestList[]>('lists');
  const people: GuestPerson[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await post<GuestPerson[]>('people', { offset, limit: pageSize });
    people.push(...page);
    if (page.length < pageSize) break;
  }
  return { lists, people };
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
