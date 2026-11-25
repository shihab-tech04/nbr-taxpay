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
 await signIn(baseline);
 const width=page.viewportSize()!.width;
 // Only the exact earlier A/A failure contexts. This is diagnostic, not an acceptance matrix.
 const targets=width===320?homes.filter(h=>h.name==='default'||(h.name==='landing'&&lang==='bn'&&theme==='dark'&&!signedIn)):homes.filter(h=>h.name==='landing'&&lang==='bn'&&theme==='light'&&!signedIn);
 const cdp=await page.context().newCDPSession(page);
 const result=[];
 for(const h of targets){
  const name=h.name+'-'+lang+'-'+theme+'-'+(signedIn?'local-account':'guest');
  const captures=[];
  const metadata=async()=>page.evaluate((width)=>{
   const box=width===320?{x:94,y:768,w:82,h:18}:{x:714,y:7,w:49,h:49};
   const intersects=(r:DOMRect)=>r.right>=box.x&&r.left<=box.x+box.w&&r.bottom>=box.y&&r.top<=box.y+box.h;
   const nodes=[...document.querySelectorAll('*')].filter(e=>intersects(e.getBoundingClientRect())).map(e=>{
    const r=e.getBoundingClientRect(),s=getComputedStyle(e);
    return {tag:e.tagName,id:e.id,cls:e.getAttribute('class'),box:[r.x,r.y,r.width,r.height],text:e.childElementCount===0?e.textContent?.slice(0,150):undefined,svg:e instanceof SVGElement?e.outerHTML.slice(0,1000):undefined,styles:[s.position,s.transform,s.fontFamily,s.fontSize,s.fontWeight,s.color,s.backgroundColor,s.opacity,s.filter,s.boxShadow,s.stroke,s.fill,s.animationName]};
   });
   return {viewport:[innerWidth,innerHeight,devicePixelRatio],scroll:[scrollX,scrollY],document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],fonts:document.fonts.status,active:document.activeElement?.tagName,animations:document.getAnimations().map(a=>({state:a.playState,time:a.currentTime,name:(a.effect as KeyframeEffect)?.target?.nodeName})),nodes};
  },width);
  async function cdpFull(){
   const metrics=await cdp.send('Page.getLayoutMetrics');
   const {width,height}=metrics.cssContentSize;
   const image=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:true,clip:{x:0,y:0,width:Math.ceil(width),height:Math.ceil(height),scale:1}});
   return Buffer.from(image.data,'base64');
  }
  for(let pass=0;pass<3;pass++){
   const fonts=await visit(baseline,h);
   const before=await metadata();
   const pw=await page.screenshot(screenshotOptions),pw2=await page.screenshot(screenshotOptions);
   const afterPW=await metadata();
   const cdp1=await cdpFull(),cdp2=await cdpFull();
   const afterCDP=await metadata();
   for(const [suffix,png] of [['pw',pw],['pw2',pw2],['cdp',cdp1],['cdp2',cdp2]] as const)writeFileSync(join(dir,name+'-'+pass+'-'+suffix+'.png'),png);
   writeFileSync(join(dir,name+'-'+pass+'.json'),JSON.stringify({fonts,before,afterPW,afterCDP},null,2));
   captures.push({pw,pw2,cdp1,cdp2,before,afterPW,afterCDP});
  }
  const comparisons=captures.map((f,i)=>({pass:i,pwWithin:f.pw.equals(f.pw2),cdpWithin:f.cdp1.equals(f.cdp2),pwAcross:f.pw.equals(captures[0].pw),cdpAcross:f.cdp1.equals(captures[0].cdp1),pwGeometry:JSON.stringify(f.before)===JSON.stringify(f.afterPW),cdpGeometry:JSON.stringify(f.afterPW)===JSON.stringify(f.afterCDP),regionNodes:f.before.nodes.filter(n=>n.tag==='svg'||n.tag==='path'||n.tag==='BUTTON'||n.text).map(n=>({tag:n.tag,cls:n.cls,box:n.box,text:n.text,svg:n.svg?.slice(0,160)}))}));
  result.push({scenario:name,width,comparisons});
 }
 writeFileSync(join(dir,'diagnosis-'+lang+'-'+theme+'-'+(signedIn?'local-account':'guest')+'.json'),JSON.stringify(result,null,2));
 console.log('EXACT_AA_DIAGNOSIS '+JSON.stringify(result));
 await cdp.detach();
});
