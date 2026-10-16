import {TAXPAY_PUBLIC_ENDPOINT} from '../config/publicBackend';

// By default an Auth session survives a browser restart. When the user unchecks
// Remember me, the Supabase client's storage is limited to the current tab.
const SESSION_ONLY_FLAG='taxpay:session-only:v1';
const authStorageKey=()=>{
  try{return `sb-${new URL(TAXPAY_PUBLIC_ENDPOINT.url).hostname.split('.')[0]}-auth-token`;}
  catch{return '';}
};
const inBrowser=()=>typeof window!=='undefined';
const sessionOnly=()=>inBrowser()&&window.sessionStorage.getItem(SESSION_ONLY_FLAG)==='1';

export const taxpayAuthStorage={
  getItem(key:string):string|null{
    if(!inBrowser())return null;
    return sessionOnly()?window.sessionStorage.getItem(key):window.localStorage.getItem(key);
  },
  setItem(key:string,value:string):void{
    if(!inBrowser())return;
    if(sessionOnly())window.sessionStorage.setItem(key,value);
    else window.localStorage.setItem(key,value);
  },
  removeItem(key:string):void{
    if(!inBrowser())return;
    window.sessionStorage.removeItem(key);
    window.localStorage.removeItem(key);
  }
};

/** Called only after the existing account session has been checked and is absent. */
export function configureLoginPersistence(remember:boolean):void{
  if(!inBrowser())return;
  const key=authStorageKey();
  if(key){window.localStorage.removeItem(key);window.sessionStorage.removeItem(key);}
  if(remember)window.sessionStorage.removeItem(SESSION_ONLY_FLAG);
  else window.sessionStorage.setItem(SESSION_ONLY_FLAG,'1');
}
