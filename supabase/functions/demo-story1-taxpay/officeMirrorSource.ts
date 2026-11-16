/** Identifies the signing Taxpayer project for an Office readback request.
 * Never derive this from browser JSON, TIN, or an Office caller.
 * Local loopback is solely a disposable acceptance environment and retains the
 * original simulation contract; unknown hosted projects fail closed.
 */
export function officeMirrorSourceForEndpoint(url:string):'original'|'v2' {
  let hostname:string;
  try {
    const parsed=new URL(url);
    if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password)
      throw Error('UNRECOGNIZED_TAXPAYER_SOURCE');
    hostname=parsed.hostname.toLowerCase();
  }catch{throw Error('UNRECOGNIZED_TAXPAYER_SOURCE');}
  if(hostname==='eyqhoavnitkrajvyqvxn.supabase.co'||hostname==='gmuhitmaynfhipcvbvkh.supabase.co'){
    if(new URL(url).protocol!=='https:')throw Error('UNRECOGNIZED_TAXPAYER_SOURCE');
    return hostname==='eyqhoavnitkrajvyqvxn.supabase.co'?'original':'v2';
  }
  if(['localhost','127.0.0.1','[::1]'].includes(hostname))return 'original';
  throw Error('UNRECOGNIZED_TAXPAYER_SOURCE');
}
