import {expect,test,type Page} from '@playwright/test';
import {setWorkspaceLanguage} from './workspace-language';

const projectRef='nbr-taxpay-test';
const supabaseUrl=`https://${projectRef}.invalid`;
const owner={
  id:'00000000-0000-4000-8000-000000000202',
  email:'private-dashboard-owner@example.invalid',
  aud:'authenticated',role:'authenticated',
  app_metadata:{provider:'email',providers:['email']},
  user_metadata:{taxpay_display_name:'Private dashboard owner'},
  created_at:'2026-01-01T00:00:00.000Z',
  last_sign_in_at:'2026-10-30T10:00:00.000Z',
};

function sessionFor(user:typeof owner){
  const expiresAt=Math.floor(Date.now()/1000)+3600;
  const payload=btoa(JSON.stringify({sub:user.id,aud:'authenticated',role:'authenticated',exp:expiresAt}));
  return {
    access_token:`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${payload}.synthetic-signature`,
    token_type:'bearer',expires_in:3600,expires_at:expiresAt,
    refresh_token:`synthetic-refresh-${user.id}`,user,
  };
}

const privateHistory=[{
  id:'SIM-PAY-OWNER-2026',
  transactionId:'00000000-0000-4000-8000-000000000901',
  payer:'user1',state:'SIMULATED',createdAt:'2026-10-28T10:00:00Z',
  simulationOnly:true,totalMinor:16450,reviewStatus:'PENDING_OFFICER',events:[],
  allocations:[
    {id:'own-2026',lineNo:1,beneficiary:'user2',category:'TAX_WITH_RETURN',assessmentYear:'2026-27',amountMinor:6550},
    {id:'other-2026',lineNo:2,beneficiary:'user3',category:'ADVANCE_TAX',assessmentYear:'2026-27',amountMinor:6450},
    {id:'own-2025',lineNo:3,beneficiary:'user2',category:'PENALTY',assessmentYear:'2025-26',amountMinor:3450},
  ],
}];

async function mockPrivateAccount(page:Page,profile:'user1'|'user2'|null,displayName?:string){
  // Optional identity variation isolates the privacy regression from all other
  // tests; it does not change the signed-in Auth UID or source owner scopes.
  const currentOwner=displayName===undefined?owner:{
    ...owner,user_metadata:{...owner.user_metadata,taxpay_display_name:displayName}
  };
  const session=sessionFor(currentOwner);
  await page.addInitScript(({key,value})=>{
    localStorage.setItem(key,JSON.stringify(value));
  },{key:`sb-${projectRef}-auth-token`,value:session});
  await page.route(`${supabaseUrl}/**`,async route=>{
    const request=route.request();
    const url=new URL(request.url());
    const json=(body:unknown,status=200,headers:Record<string,string>={})=>route.fulfill({
      status,contentType:'application/json',
      headers:{
        'access-control-allow-origin':'*',
        'access-control-allow-headers':'authorization, apikey, content-type, prefer, x-client-info',
        'access-control-allow-methods':'GET, HEAD, POST, PATCH, DELETE, OPTIONS',
        ...headers,
      },body:JSON.stringify(body),
    });
    const ownerFromToken=()=>{
      const token=request.headers().authorization?.replace(/^Bearer\s+/i,'').split('.')[1];
      if(!token)return null;
      try{return (JSON.parse(atob(token)) as {sub?:string}).sub??null;}catch{return null;}
    };
    if(request.method()==='OPTIONS')return json({});
    if(url.pathname==='/auth/v1/user'&&request.method()==='GET'){
      expect(ownerFromToken()).toBe(owner.id);
      return json(currentOwner);
    }
    if(url.pathname==='/rest/v1/rpc/taxpay_claim_office_initiated_corrections'&&request.method()==='POST'){
      expect(ownerFromToken()).toBe(owner.id);
      expect(request.postDataJSON()).toEqual({p_limit:20});
      return json(0);
    }
    if(url.pathname==='/rest/v1/rpc/sim_my_taxpayer_profile'&&request.method()==='POST'){
      expect(ownerFromToken()).toBe(owner.id);
      return profile?json(profile):json({code:'42501',message:'No approved synthetic profile binding'},403);
    }
    if(url.pathname==='/rest/v1/rpc/sim_my_payment_history'&&request.method()==='POST'){
      expect(ownerFromToken()).toBe(owner.id);
      const body=request.postDataJSON() as {p_view:'payer'|'beneficiary'};
      const beneficiaryRows=profile==='user2'?privateHistory.map(row=>({
        ...row,allocations:row.allocations.filter(allocation=>allocation.beneficiary===profile),
      })):[];
      return json(body.p_view==='beneficiary'?beneficiaryRows:(profile==='user1'?privateHistory:[]));
    }
    if(url.pathname==='/rest/v1/taxpay_account_payment_form_drafts'||
       url.pathname==='/rest/v1/taxpay_payment_requests'||
       url.pathname==='/rest/v1/taxpay_correction_inquiries'||
       url.pathname==='/rest/v1/taxpay_in_app_notifications'){
      expect(ownerFromToken()).toBe(owner.id);
      const ownerFilter=url.searchParams.get('owner_uid')??url.searchParams.get('requester_uid')??url.searchParams.get('recipient_uid');
      expect(ownerFilter).toBe(`eq.${owner.id}`);
      const count=url.pathname.endsWith('payment_form_drafts')?1:url.pathname.endsWith('payment_requests')?2:url.pathname.endsWith('correction_inquiries')?1:1;
      return route.fulfill({status:200,headers:{
        'content-range':`0-0/${count}`,
        'access-control-expose-headers':'content-range, x-total-count',
        'access-control-allow-origin':'*',
        'access-control-allow-headers':'authorization, apikey, content-type, prefer, x-client-info',
        'access-control-allow-methods':'GET, HEAD, POST, PATCH, DELETE, OPTIONS',
      },body:''});
    }
    return json({message:'Blocked by the account-dashboard browser test'},403);
  });
}

async function verifyPaperParity(el:import('@playwright/test').Locator){
 await expect(el).toBeVisible();
 await expect(el).toHaveClass(/MuiPaper-root/);
 const result=await el.evaluate(node=>{
  const native=document.createElement('section');
  for(const a of Array.from(node.attributes))if(!['class','style','data-mui-coverage'].includes(a.name))native.setAttribute(a.name,a.value);
  native.className=Array.from(node.classList).filter(c=>!c.startsWith('Mui')&&!c.startsWith('css-')).join(' ');
  for(const child of Array.from(node.childNodes))native.append(child.cloneNode(true));
  const metrics=(e:Element)=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {tag:e.tagName,width:r.width,height:r.height,color:s.color,bg:s.backgroundColor,radius:s.borderTopLeftRadius,border:s.borderTopWidth,padding:s.paddingTop,shadow:s.boxShadow,display:s.display,gap:s.gap};};
  const actual=metrics(node);node.replaceWith(native);const original=metrics(native);native.replaceWith(node);return {actual,original};
 });
 expect(result.actual).toEqual(result.original);
}
test('MUI monthly chart surface preserves owner-scoped amounts and native geometry',async({page})=>{
  await mockPrivateAccount(page,'user1');
  await page.setViewportSize({width:375,height:820});
  await page.goto('/?action=taxpayer_home');
  const summary=page.getByTestId('account-workflow-summary');
  const monthly=summary.getByTestId('account-scenario-monthly');
  await expect(monthly).toHaveAttribute('data-mui-coverage','MUI-MONTHLY-PAPER-SCENARIO');
  await verifyPaperParity(monthly);
  await expect(monthly.getByRole('heading',{name:'Monthly payment activity'})).toBeVisible();
  await expect(monthly.locator('[data-month="2026-10"]')).toHaveAttribute('data-amount-minor','13000');
  await expect(monthly).toContainText('not Treasury-confirmed payments or tax credits');
  const correction=page.locator('#dashboard-correction-requests');
  const [activityBox,correctionBox]=await Promise.all([summary.boundingBox(),correction.boundingBox()]);
  expect(activityBox&&correctionBox).toBeTruthy();
  expect(activityBox!.y).toBeLessThan(correctionBox!.y);
  await summary.getByRole('combobox',{name:'Assessment year'}).selectOption('2025-26');
  await expect(monthly.locator('[data-month="2026-10"]')).toHaveAttribute('data-amount-minor','3450');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  await setWorkspaceLanguage(page,'bn');
  await expect(monthly.getByRole('heading',{name:'মাসভিত্তিক পেমেন্ট কার্যক্রম'})).toBeVisible();
  await verifyPaperParity(monthly);
});
