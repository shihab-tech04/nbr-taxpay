/** One-use-window proof for server-to-server readback of synthetic payment records.
 * The secret remains inside the TaxPay Edge runtime. The Office Edge runtime
 * forwards the proof to TaxPay; it never handles TaxPay service credentials.
 */
const uuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const encoder = new TextEncoder();
const purpose = 'taxpay:office:simulated-payment:v1';
const lifetimeSeconds = 120;

async function signingKey(secret: string): Promise<CryptoKey> {
  if (typeof secret !== 'string' || secret.length < 20) throw new Error('MIRROR_SIGNING_UNAVAILABLE');
  return crypto.subtle.importKey('raw', encoder.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign','verify']);
}
function subject(id: string, sessionId: string, issuedAt: number): string {
  if (!uuid.test(id) || !uuid.test(sessionId)) throw new Error('INVALID_MIRROR_IDENTIFIERS');
  return `${purpose}:${id.toLowerCase()}:${sessionId.toLowerCase()}:${issuedAt}`;
}
function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function decodeBase64Url(value: string): ArrayBuffer {
  const raw=atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4));
  // ArrayBuffer is accepted by both modern WebCrypto and TypeScript 7's
  // stricter BufferSource (which excludes SharedArrayBuffer-like views).
  const bytes=new Uint8Array(new ArrayBuffer(raw.length));
  for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  return bytes.buffer;
}

export async function createOfficeMirrorProof(secret: string,id: string,sessionId: string,nowMs=Date.now()): Promise<string> {
  const issuedAt=Math.floor(nowMs/1000);
  const message=subject(id,sessionId,issuedAt);
  const signature=await crypto.subtle.sign('HMAC',await signingKey(secret),encoder.encode(message));
  return `v1.${issuedAt}.${base64Url(new Uint8Array(signature))}`;
}
export async function verifyOfficeMirrorProof(secret: string,id: string,sessionId: string,proof: string,nowMs=Date.now()): Promise<boolean> {
  try {
    const match=/^v1\.(\d{10})\.([A-Za-z0-9_-]{43})$/.exec(proof);
    if (!match) return false;
    const issuedAt=Number(match[1]);
    const current=Math.floor(nowMs/1000);
    if (!Number.isSafeInteger(issuedAt) || issuedAt>current+10 || current-issuedAt>lifetimeSeconds) return false;
    return await crypto.subtle.verify('HMAC',await signingKey(secret),decodeBase64Url(match[2]),encoder.encode(subject(id,sessionId,issuedAt)));
  } catch { return false; }
}
