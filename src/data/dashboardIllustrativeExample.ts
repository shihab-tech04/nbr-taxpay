/**
 * Illustrative v11 source-scenario figures only, copied from the existing User1
 * front-end example ledger. These rows are NOT owner data, Treasury payments,
 * recognized credits, refunds, government assessed liabilities, or SQL records.
 * Never expose them through payment/ledger/receipt APIs or persistence.
 */
export type DashboardIllustrativeMonth = {
  month:string;
  tds:number;
  ait:number;
  direct:number;
  travel:number;
};
export type DashboardIllustrativeYear = {
  year:string;
  liability:number;
  tds:number;
  ait:number;
  direct:number;
  travel:number;
  applied:number;
  remaining:number;
  months: readonly DashboardIllustrativeMonth[];
};
type ExampleSeed = {
  liability:number;
  months: readonly DashboardIllustrativeMonth[];
};
const samples:Record<string,ExampleSeed>={
  '2025-2026':{
    liability:180000,
    months:[
      {month:'2025-09',tds:27000,ait:0,direct:0,travel:0},
      {month:'2025-12',tds:0,ait:20000,direct:0,travel:0},
      {month:'2026-01',tds:9000,ait:0,direct:0,travel:0},
      {month:'2026-03',tds:12000,ait:12000,direct:0,travel:0},
      {month:'2026-04',tds:0,ait:0,direct:0,travel:6500},
      {month:'2026-06',tds:0,ait:0,direct:30000,travel:0},
      {month:'2026-09',tds:0,ait:0,direct:45000,travel:0},
    ],
  },
  '2024-2025':{
    liability:125000,
    months:[
      {month:'2024-09',tds:25000,ait:0,direct:0,travel:0},
      {month:'2024-11',tds:0,ait:20000,direct:0,travel:0},
      {month:'2025-06',tds:0,ait:0,direct:40000,travel:0},
      {month:'2025-09',tds:0,ait:0,direct:30000,travel:0},
    ],
  },
  '2023-2024':{
    liability:90000,
    months:[
      {month:'2023-09',tds:30000,ait:0,direct:0,travel:0},
      {month:'2024-01',tds:0,ait:15000,direct:0,travel:0},
      {month:'2024-08',tds:0,ait:0,direct:45000,travel:0},
    ],
  },
};
export const illustrativeDashboardYears=Object.freeze(Object.keys(samples).sort((a,b)=>b.localeCompare(a)));
export function getIllustrativeDashboardYear(year:string):DashboardIllustrativeYear|null{
  const seed=samples[year];
  if(!seed)return null;
  const sum=(field:'tds'|'ait'|'direct'|'travel')=>seed.months.reduce((value,month)=>value+month[field],0);
  const tds=sum('tds'),ait=sum('ait'),direct=sum('direct'),travel=sum('travel');
  const applied=tds+ait+direct;
  return {year,liability:seed.liability,tds,ait,direct,travel,applied,
    remaining:Math.max(0,seed.liability-applied),months:seed.months};
}
export function formatIllustrativeTaka(value:number,language:'en'|'bn'):string {
  if(!Number.isSafeInteger(value)||value<0)throw Error('Invalid illustrative taka amount');
  return '৳ '+new Intl.NumberFormat(language==='bn'?'bn-BD':'en-BD',{maximumFractionDigits:0}).format(value);
}
