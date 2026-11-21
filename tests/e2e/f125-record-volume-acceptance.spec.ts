import {expect,test,type Page,type TestInfo} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';

const projectRef='nbr-taxpay-test';
const backend=`https://${projectRef}.invalid`;
const HISTORY_COUNT=1000;
const BENEFICIARY_COUNT=1200;
const BENEFICIARY_PAGE_SIZE=500;

type ProfileId='user1'|'user2';
type AccountUser={
  id:string;email:string;aud:'authenticated';role:'authenticated';
  app_metadata:{provider:'email';providers:string[]};
  user_metadata:{taxpay_display_name:string};created_at:string;last_sign_in_at:string;
};
type FixtureState={
  currentUser:AccountUser;profileId:ProfileId;historyRows:Record<string,unknown>[];
  people:Record<string,unknown>[];lists:Record<string,unknown>[];
  failHistoryResponses:number;historySubjects:string[];peopleRangeStarts:number[];
  syntheticClaims:string[];unsafeWrites:string[];
};

const ownerA:AccountUser={id:'00000000-0000-4000-8000-000000000201',email:'f125-owner-a@example.invalid',
  aud:'authenticated',role:'authenticated',app_metadata:{provider:'email',providers:['email']},
  user_metadata:{taxpay_display_name:'F-125 owner A'},created_at:'2026-01-01T00:00:00.000Z',last_sign_in_at:'2026-10-30T10:00:00.000Z'};
const ownerB:AccountUser={...ownerA,id:'00000000-0000-4000-8000-000000000202',
  email:'f125-owner-b@example.invalid',user_metadata:{taxpay_display_name:'F-125 owner B'}};
const listId='00000000-0000-4000-8000-000000000401';

function makeSession(user:AccountUser){
  const expiresAt=Math.floor(Date.now()/1000)+3600;
  const payload=Buffer.from(JSON.stringify({sub:user.id,aud:'authenticated',role:'authenticated',exp:expiresAt})).toString('base64url');
  return {access_token:`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${payload}.synthetic-signature`,
    token_type:'bearer',expires_in:3600,expires_at:expiresAt,refresh_token:`f125-${user.id}`,user};
}

function recordId(value:number){return `F125-ROW-${String(value).padStart(6,'0')}`;}
function makeHistoryRow(value:number,profile:ProfileId){
  const beneficiary:ProfileId=profile==='user1'?'user2':'user2';
  return {id:recordId(value),transactionId:`00000000-0000-4000-8000-${String(value).padStart(12,'0')}`,
    payer:profile,state:'SIMULATED',createdAt:new Date(Date.UTC(2026,0,1,0,0,value)).toISOString(),
    simulationOnly:true,totalMinor:12345,reviewStatus:'PENDING_OFFICER',events:[],
    allocations:[{id:`allocation-${value}`,lineNo:1,beneficiary,category:'ADVANCE_TAX',
      assessmentYear:'2026-27',amountMinor:12345}]};
}
function makePeople(count:number,ownerUid:string){
  return Array.from({length:count},(_,index)=>{
    const value=count-index;
    return {id:`00000000-0000-4000-8000-${String(10000+value).padStart(12,'0')}`,
      owner_uid:ownerUid,list_id:listId,tin:`8${String(value).padStart(11,'0')}`,
      display_name:`Volume contact ${String(value).padStart(4,'0')}`,tag:'clients',relationship:null,
      other_label:null,created_at:new Date(Date.UTC(2026,0,1,0,0,value)).toISOString(),
      updated_at:new Date(Date.UTC(2026,0,1,0,0,value)).toISOString()};
  });
}

function userIdFromRequest(request:{headers:()=>Record<string,string>}){
  const token=request.headers().authorization?.replace(/^Bearer\s+/i,'').split('.')[1];
  if(!token)return null;
  try{return (JSON.parse(Buffer.from(token,'base64url').toString('utf8')) as {sub?:string}).sub??null;}
  catch{return null;}
}

async function installPrivateFixture(page:Page,state:FixtureState){
  await page.addInitScript(({key,value,seedKey})=>{
    (window as Window&{__f125NavigationStart?:number}).__f125NavigationStart=performance.now();
    if(sessionStorage.getItem(seedKey))return;
    localStorage.setItem(key,JSON.stringify(value));
    sessionStorage.setItem(seedKey,'1');
  },{key:`sb-${projectRef}-auth-token`,value:makeSession(state.currentUser),seedKey:'f125-auth-seeded'});

  await page.route(`${backend}/**`,async route=>{
    const request=route.request();
    const url=new URL(request.url());
    const json=(body:unknown,status=200,extraHeaders:Record<string,string>={})=>route.fulfill({
      status,contentType:'application/json',body:JSON.stringify(body),headers:{
        'access-control-allow-origin':'*',
        'access-control-allow-headers':'authorization, apikey, content-type, prefer, x-client-info, range, range-unit',
        'access-control-allow-methods':'GET, HEAD, POST, PATCH, DELETE, OPTIONS',
        'access-control-expose-headers':'content-range, x-total-count',...extraHeaders,
      },
    });
    if(request.method()==='OPTIONS')return json({});
    if(request.method()==='PATCH'||request.method()==='PUT'||request.method()==='DELETE')state.unsafeWrites.push(`${request.method()} ${url.pathname}`);
    const subject=userIdFromRequest(request);
    if(url.pathname==='/auth/v1/user'&&request.method()==='GET'){
      expect(subject).toBe(state.currentUser.id);
      return json(state.currentUser);
    }
    if(url.pathname==='/rest/v1/rpc/sim_my_taxpayer_profile'&&request.method()==='POST'){
      expect(subject).toBe(state.currentUser.id);
      return json(state.profileId);
    }
    if(url.pathname==='/rest/v1/rpc/taxpay_claim_story1_session'&&request.method()==='POST'){
      expect(subject).toBe(state.currentUser.id);
      state.syntheticClaims.push(subject??'missing-subject');
      return json(0);
    }
    if(url.pathname==='/rest/v1/rpc/taxpay_claim_walkin_payer_payments'&&request.method()==='POST'){
      expect(subject).toBe(state.currentUser.id);
      state.syntheticClaims.push(subject??'missing-subject');
      return json(0);
    }
    // This authenticated RPC is a SECURITY DEFINER STABLE read of already
    // owner-indexed payment rows. Supabase transports RPC reads as POST, so
    // mock it explicitly instead of counting its HTTP verb as a data write.
    if(url.pathname==='/rest/v1/rpc/taxpay_my_story1_payments'&&request.method()==='POST'){
      expect(subject).toBe(state.currentUser.id);
      const body=request.postDataJSON() as {p_page?:number;p_per_page?:number};
      const pageNumber=body.p_page??1;
      const perPage=body.p_per_page??100;
      expect(Number.isInteger(pageNumber)&&pageNumber>=1).toBe(true);
      expect(Number.isInteger(perPage)&&perPage>=1&&perPage<=100).toBe(true);
      return json({items:[],total:0,page:pageNumber,perPage});
    }
    if(url.pathname==='/rest/v1/rpc/sim_my_payment_history'&&request.method()==='POST'){
      expect(subject).toBe(state.currentUser.id);
      state.historySubjects.push(subject??'missing-subject');
      const body=request.postDataJSON() as {p_view?:'payer'|'beneficiary'};
      if(body.p_view==='payer'&&state.failHistoryResponses>0){
        state.failHistoryResponses--;
        return json({message:'Synthetic temporary history read failure'},503);
      }
      return json(body.p_view==='beneficiary'
        ?state.historyRows.filter(row=>((row.allocations as Array<{beneficiary:string}>|undefined)??[])
          .some(allocation=>allocation.beneficiary===state.profileId))
        :state.historyRows);
    }
    if(url.pathname==='/rest/v1/taxpay_beneficiary_lists'&&request.method()==='GET'){
      expect(subject).toBe(state.currentUser.id);
      expect(url.searchParams.get('owner_uid')).toBe(`eq.${state.currentUser.id}`);
      const rows=state.lists;
      const range=request.headers().range?.match(/(\d+)-(\d+)$/);
      const from=range?Number(range[1]):0;
      const to=range?Number(range[2]):from+BENEFICIARY_PAGE_SIZE-1;
      const data=rows.slice(from,to+1);
      return json(data,206,{'content-range':rows.length?`${from}-${from+data.length-1}/${rows.length}`:`*/${rows.length}`});
    }
    if(url.pathname==='/rest/v1/taxpay_beneficiaries'&&request.method()==='GET'){
      expect(subject).toBe(state.currentUser.id);
      expect(url.searchParams.get('owner_uid')).toBe(`eq.${state.currentUser.id}`);
      const range=request.headers().range?.match(/(\d+)-(\d+)$/);
      const from=range?Number(range[1]):Number(url.searchParams.get('offset')??0);
      const to=range?Number(range[2]):from+Number(url.searchParams.get('limit')??BENEFICIARY_PAGE_SIZE)-1;
      state.peopleRangeStarts.push(from);
      const data=state.people.slice(from,to+1);
      return json(data,206,{'content-range':state.people.length
        ?`${from}-${from+data.length-1}/${state.people.length}`:`*/${state.people.length}`});
    }
    if(request.method()==='POST')state.unsafeWrites.push(`${request.method()} ${url.pathname}`);
    // Deny unexpected writes and keep unrelated reads outside this fixture closed.
    return json({message:'Outside the read-only F-125 synthetic fixture'},403);
  });
}

function currentHistoryRows(page:Page){
  if((page.viewportSize()?.width??1280)<768)
    return page.getByTestId('signed-in-payment-activity-cards').locator(':scope > li');
  return page.getByTestId('signed-in-payment-activity-table').locator('tbody > tr');
}
function currentBeneficiaryRows(page:Page){
  if((page.viewportSize()?.width??1280)<768)
    return page.getByTestId('beneficiary-directory-mobile').locator(':scope > li');
  return page.getByTestId('beneficiary-directory-desktop').locator('tbody > tr');
}
async function attachMetrics(testInfo:TestInfo,metrics:Record<string,unknown>){
  const path=testInfo.outputPath(`f125-volume-${testInfo.project.name}.json`);
  mkdirSync(testInfo.outputDir,{recursive:true});
  writeFileSync(path,JSON.stringify(metrics,null,2)+'\n');
  await testInfo.attach(`F-125 synthetic volume metrics · ${testInfo.project.name}`,{path,contentType:'application/json'});
  console.log('F125_VOLUME_METRICS '+JSON.stringify(metrics));
}

test('F-125 T01/T04: history and beneficiary search preserve order and responsiveness at representative volume',async({page},testInfo)=>{
  test.skip(testInfo.project.name==='mobile-320','The representative-volume matrix runs at approved 375px mobile and 1280px desktop widths.');
  test.setTimeout(180_000);
  const language=testInfo.project.name==='mobile-375'?'bn':'en';
  const labels=language==='bn'?{
    historySearch:'লেনদেন খুঁজুন',beneficiarySearch:'এই তালিকায় খুঁজুন',viewDetails:'বিস্তারিত দেখুন',
  }:{historySearch:'Search transactions',beneficiarySearch:'Search this list',viewDetails:'View details'};
  const state:FixtureState={currentUser:ownerA,profileId:'user1',
    historyRows:Array.from({length:HISTORY_COUNT},(_,index)=>makeHistoryRow(HISTORY_COUNT-index,'user1')),
    people:makePeople(BENEFICIARY_COUNT,ownerA.id),
    lists:[{id:listId,owner_uid:ownerA.id,name:'Volume list',created_at:'2026-01-01T00:00:00.000Z'}],
    failHistoryResponses:0,historySubjects:[],peopleRangeStarts:[],syntheticClaims:[],unsafeWrites:[]};
  await installPrivateFixture(page,state);
  await page.goto(`/?action=history&lang=${language}`);
  const activity=page.getByTestId('signed-in-payment-activity');
  await expect(activity).toBeVisible();
  const rows=currentHistoryRows(page);
  await expect(rows).toHaveCount(HISTORY_COUNT);
  await expect(rows.first()).toContainText(recordId(HISTORY_COUNT));
  await expect(rows.last()).toContainText(recordId(1));
  const historyReadyMs=await page.evaluate(()=>performance.now()-
    ((window as Window&{__f125NavigationStart?:number}).__f125NavigationStart??0));
  const search=page.getByRole('searchbox',{name:labels.historySearch});
  const historySearchMs:number[]=[];
  for(const value of [recordId(1),recordId(500),recordId(HISTORY_COUNT)]){
    const started=await page.evaluate(()=>performance.now());
    await search.fill(value);
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(value);
    historySearchMs.push(await page.evaluate(start=>performance.now()-start,started));
  }
  await search.fill(recordId(1));
  await rows.first().getByRole('button',{name:labels.viewDetails}).click();
  await expect(page.getByRole('dialog').last()).toContainText(recordId(1));
  await page.reload();
  const refreshedHistory=currentHistoryRows(page);
  await expect(refreshedHistory).toHaveCount(HISTORY_COUNT);
  await expect(refreshedHistory.first()).toContainText(recordId(HISTORY_COUNT));

  state.peopleRangeStarts.length=0;
  await page.goto(`/?action=beneficiaries&lang=${language}`);
  const beneficiaries=page.getByTestId('beneficiaries-page');
  await expect(beneficiaries).toBeVisible();
  const people=currentBeneficiaryRows(page);
  await expect(people).toHaveCount(BENEFICIARY_COUNT);
  await expect(people.first()).toContainText('Volume contact 1200');
  await expect(people.last()).toContainText('Volume contact 0001');
  const beneficiaryReadyMs=await page.evaluate(()=>performance.now()-
    ((window as Window&{__f125NavigationStart?:number}).__f125NavigationStart??0));
  const beneficiarySearch=page.getByRole('searchbox',{name:labels.beneficiarySearch});
  const beneficiarySearchMs:number[]=[];
  for(const value of ['Volume contact 0001','Volume contact 0600','Volume contact 1200']){
    const started=await page.evaluate(()=>performance.now());
    await beneficiarySearch.fill(value);
    await expect(people).toHaveCount(1);
    await expect(people.first()).toContainText(value);
    beneficiarySearchMs.push(await page.evaluate(start=>performance.now()-start,started));
  }
  expect(state.peopleRangeStarts.slice(0,3)).toEqual([0,BENEFICIARY_PAGE_SIZE,BENEFICIARY_PAGE_SIZE*2]);
  await beneficiarySearch.fill('');
  state.people[0].display_name='Volume contact refreshed after reload';
  await page.reload();
  const afterRefresh=currentBeneficiaryRows(page);
  await expect(afterRefresh).toHaveCount(BENEFICIARY_COUNT);
  await expect(afterRefresh.first()).toContainText('Volume contact refreshed after reload');
  expect(state.unsafeWrites).toEqual([]);
  expect(state.syntheticClaims.every(subject=>subject===ownerA.id)).toBe(true);

  const metrics={feature:'F-125',story:'US-109',testIds:['US-109-T01','US-109-T04'],
    sourceCommit:process.env.GITHUB_SHA??'local-worktree',environment:'synthetic read-only Playwright fixture',
    project:testInfo.project.name,language,viewport:page.viewportSize(),
    fixture:{historyRows:HISTORY_COUNT,beneficiaryRows:BENEFICIARY_COUNT,beneficiaryPageSize:BENEFICIARY_PAGE_SIZE},
    timingsMs:{historyReady:historyReadyMs,historySearch:historySearchMs,
      beneficiariesReady:beneficiaryReadyMs,beneficiarySearch:beneficiarySearchMs},
    correctness:{historyCount:HISTORY_COUNT,historyOrder:'descending fixture IDs preserved',
      beneficiaryCount:BENEFICIARY_COUNT,beneficiaryOrder:'descending fixture IDs preserved',
      beneficiaryPageStarts:state.peopleRangeStarts.slice(0,3),refreshReload:'latest synthetic row returned',
      interceptedSyntheticClaims:state.syntheticClaims.length,unscopedReadOrWrite:'none observed'},
    acceptance:{numericBudget:'UNVERIFIED; current acceptance record supplies no approved numeric cutoff',
      TaxpayerSQLReadback:'UNVERIFIED',OfficeSQLReadback:'UNVERIFIED',fieldINP:'UNVERIFIED'}};
  await attachMetrics(testInfo,metrics);
});

test('F-125 T02/T03: account switch hides prior rows and failed history read recovers on retry',async({page},testInfo)=>{
  test.setTimeout(90_000);
  const rowA=makeHistoryRow(1,'user1');
  const rowB=makeHistoryRow(2,'user2');
  const state:FixtureState={currentUser:ownerA,profileId:'user1',historyRows:[rowA],people:[],
    lists:[],failHistoryResponses:0,historySubjects:[],peopleRangeStarts:[],syntheticClaims:[],unsafeWrites:[]};
  await installPrivateFixture(page,state);
  await page.goto('/?action=history&lang=en');
  await expect(currentHistoryRows(page)).toHaveCount(1);
  await expect(currentHistoryRows(page).first()).toContainText(String(rowA.id));

  state.currentUser=ownerB;
  state.profileId='user2';
  state.historyRows=[rowB];
  state.failHistoryResponses=1;
  await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{
    key:`sb-${projectRef}-auth-token`,value:makeSession(ownerB),
  });
  await page.reload();
  const historyAlert=page.getByRole('alert').filter({hasText:'Unable to load transactions.'});
  await expect(historyAlert).toBeVisible();
  await expect(page.getByText(String(rowA.id),{exact:true})).toHaveCount(0);
  await historyAlert.getByRole('button',{name:'Retry'}).click();
  await expect(currentHistoryRows(page)).toHaveCount(1);
  await expect(currentHistoryRows(page).first()).toContainText(String(rowB.id));
  await expect(page.getByText(String(rowA.id),{exact:true})).toHaveCount(0);
  await page.reload();
  await expect(currentHistoryRows(page)).toHaveCount(1);
  await expect(currentHistoryRows(page).first()).toContainText(String(rowB.id));
  expect(state.historySubjects.length).toBeGreaterThanOrEqual(3);
  expect(state.historySubjects.every(subject=>subject===ownerA.id||subject===ownerB.id)).toBe(true);
  expect(state.syntheticClaims.every(subject=>subject===ownerA.id||subject===ownerB.id)).toBe(true);
  expect(state.unsafeWrites).toEqual([]);
});
