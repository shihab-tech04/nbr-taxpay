import {expect,test,type Route} from '@playwright/test';
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {mockPublishedBannerCms} from '../e2e/mock-published-banners';
const homes=[
 {name:'default',query:'',root:'.public-record-discovery'},
 {name:'landing',query:'action=landing&',root:'.public-record-discovery'},
 {name:'home2',query:'action=home-2&',root:'[data-testid="home2-root"]'},
 {name:'home3',query:'action=home-3&',root:'[data-testid="home3-root"]'},
];
const baseline='http://127.0.0.1:4174';
const candidate='http://127.0.0.1:4173';
const screenshotOptions={fullPage:true,animations:'disabled' as const,caret:'hide' as const};
for(const lang of ['en','bn'] as const)
for(const theme of ['light','dark'] as const)
for(const signedIn of [false,true])
test('frozen homepage '+lang+' '+theme+' '+(signedIn?'local-account':'guest'),async({page},info)=>{
 await page.clock.setFixedTime(new Date('2026-11-25T10:00:00+06:00'));
 await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});
 await page.route('**/*.supabase.co/**',route=>route.abort());
 await mockPublishedBannerCms(page);
 // Google Fonts returns different stylesheets/subsets and occasionally fails between navigations.
 // Preserve the same successful resource bytes across Main, its self-control, and the candidate.
 // No production files, typography, screenshots, pixel masks or acceptance tolerances are changed.
 type FontAsset={status:number;headers:Record<string,string>;body:Buffer;sha256:string};
 const fontAssets=new Map<string,Promise<FontAsset>>();
 const fontErrors:string[]=[];
 await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//,async(route:Route)=>{
   const url=route.request().url();
   let cached=fontAssets.get(url);
   if(!cached){
     cached=(async()=>{
       let last:unknown;
       for(let i=0;i<3;i++){
         try{
           const response=await route.fetch({timeout:20000,maxRetries:2});
           if(!response.ok())throw new Error('HTTP '+response.status());
           const body=await response.body();
           const headers={...response.headers()};
           for(const key of ['content-encoding','content-length','transfer-encoding','connection','vary'])delete headers[key];
           headers['access-control-allow-origin']='*';
           return {status:response.status(),headers,body,sha256:createHash('sha256').update(body).digest('hex')};
         }catch(error){last=error;}
       }
       throw new Error('Unable to obtain approved font '+url+': '+String(last));
     })();
     fontAssets.set(url,cached);
   }
   try{
     const resource=await cached;
     await route.fulfill({status:resource.status,headers:resource.headers,body:resource.body});
   }catch(error){
     fontErrors.push(String(error));
     await route.abort().catch(()=>{});
   }
 });
 const dir=join(process.env.MUI_SNAPSHOT_DIR!,info.project.name);
 mkdirSync(dir,{recursive:true});
 async function signIn(origin:string) {
  await page.goto(origin+'/?action=landing&lang='+lang);
  if(signedIn && !(await page.evaluate(()=>sessionStorage.getItem('taxpay-taxpayer-preview-user')))){
   await page.goto(origin+'/?action=taxpayer_login&lang='+lang);
   const login=page.getByRole('dialog');
   await login.locator('#taxpayer-login-user-id').fill('user1');
   await login.locator('#taxpayer-login-password').fill('user1');
   await login.getByTestId('taxpayer-login-submit').click();
   await expect(page).toHaveURL(/action=taxpayer_home/);
  }
  expect(await page.evaluate(()=>sessionStorage.getItem('taxpay-taxpayer-preview-user'))).toBe(signedIn?'user1':null);
 }
 async function visit(origin:string,h:typeof homes[number]){
  await page.goto(origin+'/?'+h.query+'lang='+lang,{waitUntil:'domcontentloaded'});
  await expect(page.locator(h.root)).toBeVisible();
  await expect(page.locator('.taxpay-citizen-shell')).toHaveAttribute('lang',lang);
  expect(await page.evaluate(()=>sessionStorage.getItem('taxpay-taxpayer-preview-user'))).toBe(signedIn?'user1':null);
  await page.waitForLoadState('load');
  await page.mouse.move(0,0);
  await page.evaluate(()=>window.scrollTo({top:0,left:0,behavior:'instant'}));
  const fontState=await page.evaluate(async()=>{
   await document.fonts.ready;
   const requests=new Map<string,Set<string>>();
   const walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
   for(let n=walk.nextNode();n;n=walk.nextNode()){
     const el=n.parentElement,text=n.textContent?.trim();
     if(!el||!text||!el.getClientRects().length)continue;
     const style=getComputedStyle(el);
     const descriptor=style.fontStyle+' '+style.fontWeight+' '+style.fontSize+' '+style.fontFamily;
     const chars=requests.get(descriptor)??new Set<string>();
     for(const ch of text)chars.add(ch);
     requests.set(descriptor,chars);
   }
   await Promise.all([...requests].map(([descriptor,chars])=>document.fonts.load(descriptor,[...chars].join(''))));
   await Promise.all([...document.images].map(image=>image.decode().catch(()=>undefined)));
   await document.fonts.ready;
   return [...document.fonts].filter(face=>face.status==='loaded').map(face=>[face.family,face.style,face.weight,face.unicodeRange].join('|')).sort();
  });
  // Preserve the same fully settled state, including finite entrance and focus
  // transitions, for both unmodified Main captures and the MUI candidate.
  await page.evaluate(async()=>{
    const finite=document.getAnimations().filter(animation=>animation.playState==='running'&&Number.isFinite(animation.effect?.getComputedTiming().endTime));
    await Promise.all(finite.map(animation=>animation.finished.catch(()=>undefined)));
    await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
  });
  expect(fontErrors,'Failed approved font resource').toEqual([]);
  expect(fontState.length,'No approved web fonts loaded').toBeGreaterThan(0);
  await expect(page.locator('[data-mui-citizen-region]')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  return fontState;
 }
 // Keep the two builds in the same Chromium process, page, viewport and software renderer.
 // Baselines are written only from the exact Main server. Both A/A and A/B must pass zero tolerance.
 // Capture protocol chosen only from unchanged Main diagnostic 45685491353.
 // At width 320 the first two Playwright full-page captures reproduce exactly;
 // at 768 CDP full-page capture reproduces exactly. All other widths retain
 // Playwright. The candidate cannot influence method, reference, or threshold.
 const width=page.viewportSize()!.width,method=width===768?'CDP':'PLAYWRIGHT';
 const cdp=await page.context().newCDPSession(page);
 async function cdpFull(){
  const metrics=await cdp.send('Page.getLayoutMetrics');
  const size=metrics.cssContentSize;
  const result=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:true,clip:{x:0,y:0,width:Math.ceil(size.width),height:Math.ceil(size.height),scale:1}});
  return Buffer.from(result.data,'base64');
 }
 const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
 const dimensions=(b:Buffer)=>[b.readUInt32BE(16),b.readUInt32BE(20)];
 async function geometry(){
  return page.evaluate(()=>{
   const selector='.citizen-bottom-nav,.citizen-bottom-nav svg,.public-help-launch,.public-help-launch svg,.public-record-discovery,[data-testid="home2-root"],[data-testid="home3-root"]';
   return {viewport:[innerWidth,innerHeight,devicePixelRatio],scroll:[scrollX,scrollY],document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],
    focused:document.activeElement?.tagName,fonts:document.fonts.status,
    nodes:[...document.querySelectorAll(selector)].map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {tag:e.tagName,cls:e.getAttribute('class'),rect:[r.x,r.y,r.width,r.height],style:[s.position,s.transform,s.opacity,s.filter,s.stroke,s.fill,s.fontFamily,s.fontSize,s.fontWeight],svg:e instanceof SVGElement?e.outerHTML:undefined};})};
  });
 }
 // The exact diagnostic order is reproduced, not a retry-until-equal loop.
 // Both capture methods are executed for affected widths; only the fixed
 // method is used for strict comparison. Dimensions and geometry must match.
 async function capture(name:string){
  const before=await geometry();
  const pw=await page.screenshot(screenshotOptions),pw2=await page.screenshot(screenshotOptions);
  const afterPW=await geometry();
  let primary=pw,second=pw2,altHashes:string[]=[];
  if(width===320||width===768){
   const c1=await cdpFull(),c2=await cdpFull(),afterCDP=await geometry();
   expect(afterCDP,'Capture must not change frozen DOM geometry').toEqual(afterPW);
   expect(dimensions(c1),'CDP must cover exactly the same full-page area').toEqual(dimensions(pw));
   expect(dimensions(c2),'CDP second capture dimensions').toEqual(dimensions(pw2));
   if(method==='CDP'){primary=c1;second=c2;altHashes=[sha(pw),sha(pw2)];}
   else altHashes=[sha(c1),sha(c2)];
  }
  expect(afterPW,'Capture must not change frozen DOM geometry').toEqual(before);
  writeFileSync(join(dir,name+'.png'),primary);
  writeFileSync(join(dir,name+'.json'),JSON.stringify({method,geometry:before,primary:sha(primary),second:sha(second),alternate:altHashes,dimensions:dimensions(primary)},null,2));
  if(!primary.equals(second))writeFileSync(join(dir,name+'-second-failure.png'),second);
  expect(primary.equals(second),'Exact consecutive full-page captures: '+name).toBe(true);
  return {image:primary,geometry:before};
 }
 for(const h of homes){
  const name=h.name+'-'+lang+'-'+theme+'-'+(signedIn?'local-account':'guest');
  await signIn(baseline);
  const baselineFonts=await visit(baseline,h);
  const reference=await capture('main-reference-'+name);
  for(let pass=1;pass<=2;pass++){
   expect(await visit(baseline,h),'Same approved fonts on independent Main navigation').toEqual(baselineFonts);
   const control=await capture('main-control-'+pass+'-'+name);
   expect(control.geometry,'Independent Main DOM geometry '+name).toEqual(reference.geometry);
   expect(control.image.equals(reference.image),'Independent unchanged Main exact full-page PNG '+name).toBe(true);
  }
  await signIn(candidate);
  expect(await visit(candidate,h),'Same approved fonts on candidate').toEqual(baselineFonts);
  const compared=await capture('candidate-'+name);
  expect(compared.geometry,'Exact frozen candidate DOM geometry '+name).toEqual(reference.geometry);
  expect(compared.image.equals(reference.image),'MUI candidate versus exact unchanged Main PNG '+name).toBe(true);
 }
 const manifest=await Promise.all([...fontAssets].map(async([url,asset])=>({url,sha256:(await asset).sha256})));
 writeFileSync(join(dir,'fonts-'+lang+'-'+theme+'-'+(signedIn?'local-account':'guest')+'.json'),JSON.stringify(manifest,null,2));
 await cdp.detach();
});
