import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dhakaTravelDate, isPlannedTravelDate, LAND_PORT_NAMES, TRAVEL_TAX_ECONOMIC_CODE, TRAVEL_TAX_ZONES,
  makeTravelPassenger, travelPassengerAmount, travelPartyTotal, validateTravelParty, travelPassengerAge, assessTravelPassenger, travelTaxRateEvidence } from '../src/data/travelTax2026';

test('client accounting reference has nine unique organizational codes and one economic code', () => {
  assert.equal(TRAVEL_TAX_ZONES.length, 9);
  assert.equal(new Set(TRAVEL_TAX_ZONES.map(z=>z.code)).size, 9);
  assert.equal(TRAVEL_TAX_ECONOMIC_CODE, '1144102');
  for(const zone of TRAVEL_TAX_ZONES) assert.match(zone.code,/^\d{13}$/);
  assert.equal(LAND_PORT_NAMES.length,16);
});

test('Travel Tax preview rates carry an explicit non-statutory version and exact age mapping', () => {
  assert.deepEqual(travelTaxRateEvidence('LAND', 1000), {
    referenceVersion: 'APP_PREVIEW_2026-11-02',
    classification: 'ILLUSTRATIVE',
    source: 'IN_APP_PREVIEW',
    mode: 'LAND',
    economicCode: '1144102',
    currency: 'BDT',
    adultUnitRateMinor: 100000,
    ageBands: [
      { band: 'UNDER5', minAgeInclusive: 0, maxAgeInclusive: 5, multiplierBps: 0 },
      { band: 'CHILD', minAgeInclusive: 6, maxAgeInclusive: 12, multiplierBps: 5000 },
      { band: 'ADULT', minAgeInclusive: 13, maxAgeInclusive: null, multiplierBps: 10000 },
    ],
  });
  assert.equal(travelTaxRateEvidence('WATER', 1000).mode, 'WATER');
  assert.throws(() => travelTaxRateEvidence('LAND', Number.NaN), /preview rate is invalid/);
});

test('changing the planned date recalculates the illustrative passenger amount and mode evidence', () => {
  const child = {
    ...makeTravelPassenger('date-sensitive', 'FOREIGN'),
    passport: 'PASSENGER123', name: 'Date Sensitive Passenger',
    birthDate: '2014-08-10', country: 'India',
  };
  assert.equal(travelPartyTotal([child], 1000, '2027-08-09'), 500);
  assert.equal(travelPartyTotal([child], 1000, '2027-08-10'), 1000);
  assert.equal(travelTaxRateEvidence('LAND', 1000).mode, 'LAND');
  assert.equal(travelTaxRateEvidence('WATER', 1000).mode, 'WATER');
});

test('family/friend amounts sum individual illustrative amounts without rounding drift', () => {
  const a={...makeTravelPassenger('a'),passport:'PASSPORT123',name:'One'};
  const b={...makeTravelPassenger('b'),passport:'PASSPORT456',name:'Two',ageBand:'CHILD' as const};
  const c={...makeTravelPassenger('c'),passport:'PASSPORT789',name:'Three',ageBand:'UNDER5' as const};
  assert.equal(travelPassengerAmount(1000, a.ageBand),1000);
  assert.equal(travelPassengerAmount(1000, b.ageBand),500);
  assert.equal(travelPassengerAmount(1000, c.ageBand),0);
  assert.equal(travelPartyTotal([a,b,c],1000),1500);
  assert.equal(validateTravelParty([a,b,c]),null);
});

test('passport duplicates and false government identity are rejected', () => {
  const a={...makeTravelPassenger('a'),passport:'PASSPORT123',name:'One'};
  const b={...makeTravelPassenger('b'),passport:'passport123',name:'Two'};
  assert.match(validateTravelParty([a,b])??'', /same passport/);
  assert.match(validateTravelParty([{...a,nationality:'BD',identitySource:'PENDING'}])??'',/verification/);
  assert.match(validateTravelParty([{...a,medicalPortReferral:true}])??'',/Medical/);
});

test('travel-date DOB calculation explains the preview amount and safely handles unknown age', () => {
  assert.equal(travelPassengerAge('1992-04-18','2026-11-20'),34);
  assert.equal(travelPassengerAge('2017-08-10','2026-11-20'),9);
  assert.equal(travelPassengerAge('2023-08-10','2026-11-20'),3);
  assert.equal(travelPassengerAge('2027-01-01','2026-11-20'),null);
  assert.equal(travelPassengerAge('2000-02-30','2026-11-20'),null);
  const foreign = {...makeTravelPassenger('foreign'), passport:'FOREIGN123', name:'Visitor', country:'India', birthDate:'2017-08-10'};
  assert.equal(assessTravelPassenger(foreign,1000,'2026-11-20')?.amount,500);
  assert.equal(assessTravelPassenger({...foreign,birthDate:'2023-08-10'},1000,'2026-11-20')?.amount,0);
  assert.equal(assessTravelPassenger({...foreign,birthDate:''},1000,'2026-11-20'),null);
  const bd = {...makeTravelPassenger('bd','BD'), passport:'TEST123456', name:'Sample', birthDate:'1992-04-18'};
  assert.equal(assessTravelPassenger(bd,1000,'2026-11-20'),null);
  assert.equal(assessTravelPassenger({...bd,identitySource:'PASSPORT_SAMPLE' as const},1000,'2026-11-20')?.amount,1000);
  assert.equal(validateTravelParty([foreign],'2026-11-20'),null);
  assert.match(validateTravelParty([{...foreign,birthDate:''}],'2026-11-20')??'',/date of birth/);
});

test('planned travel dates use Dhaka midnight and reject past or invalid dates', () => {
  const now = new Date('2026-11-12T18:00:00Z');
  assert.equal(dhakaTravelDate(now), '2026-11-13');
  assert.equal(isPlannedTravelDate('2026-11-12', now), false);
  assert.equal(isPlannedTravelDate('2026-11-13', now), true);
  assert.equal(isPlannedTravelDate('2026-11-14', now), true);
  assert.equal(isPlannedTravelDate('2027-02-29', now), false);
  assert.equal(isPlannedTravelDate('2026-13-01', now), false);
});


// F-150-C01 / US-147-T01–T03: account for each birthday on the selected
// travel date. All bands below are explicitly illustrative, not law/issuer proof.
test('F-150 US-147: travel-day age boundaries use birthdays, not the current clock',()=>{
  const cases:Array<[string,string,number,number]>=[
    ['2020-11-15','2026-11-14',5,0],
    ['2020-11-15','2026-11-15',6,500],
    ['2014-11-16','2026-11-15',11,500],
    ['2014-11-16','2026-11-16',12,500],
    ['2013-11-16','2026-11-15',12,500],
    ['2013-11-16','2026-11-16',13,1000],
    ['2021-11-16','2026-11-15',4,0],
    ['2021-11-16','2026-11-16',5,0],
  ];
  for(const [birthDate,travelDate,expectedAge,expectedAmount] of cases){
    const passenger={...makeTravelPassenger('age-boundary','FOREIGN'),passport:'FOREIGN123',
      name:'BOUNDARY PASSENGER',birthDate,country:'India'};
    assert.equal(travelPassengerAge(birthDate,travelDate),expectedAge,birthDate+' '+travelDate);
    assert.equal(assessTravelPassenger(passenger,1000,travelDate)?.amount,
      expectedAmount,birthDate+' '+travelDate);
  }
});

test('F-150 US-147: invalid dates and future DOB cannot become an age or amount',()=>{
  const malformed=['2026-02-30','2027-02-29','2026-13-01','2026-00-10','not-a-date',''];
  for(const date of malformed){
    assert.equal(travelPassengerAge(date,'2026-11-16'),null,'DOB '+date);
  }
  assert.equal(travelPassengerAge('2026-11-17','2026-11-16'),null);
  const passenger={...makeTravelPassenger('future','FOREIGN'),
    passport:'FOREIGN123',name:'FUTURE PASSENGER',country:'India',birthDate:'2026-11-17'};
  assert.equal(assessTravelPassenger(passenger,1000,'2026-11-16'),null);
  assert.match(validateTravelParty([passenger],'2026-11-16')??'',/date of birth/);
});

test('F-150 US-147: changing travel date recalculates all ages but keeps passenger identities',()=>{
  const base={...makeTravelPassenger('first','FOREIGN'),passport:'FOREIGN123',
    name:'TRAVELLER ONE',country:'India',birthDate:'2020-11-16'};
  const sibling={...makeTravelPassenger('second','FOREIGN'),passport:'FOREIGN456',
    name:'TRAVELLER TWO',country:'India',birthDate:'2013-11-16'};
  const party=[base,sibling];
  const before=structuredClone(party);
  assert.equal(travelPartyTotal(party,1000,'2026-11-15'),500);
  assert.equal(travelPartyTotal(party,1000,'2026-11-16'),1500);
  assert.equal(validateTravelParty(party,'2026-11-16'),null);
  assert.deepEqual(party,before,'Changing selected date does not rewrite confirmed passenger data');
});

test('F-150 US-147: Dhaka local day, not UTC day, determines whether DOB is future',()=>{
  const now=new Date('2026-11-14T20:00:00.000Z');
  assert.equal(now.toISOString().slice(0,10),'2026-11-14');
  assert.equal(dhakaTravelDate(now),'2026-11-15');
  assert.equal(travelPassengerAge('2026-11-15',dhakaTravelDate(now)),0);
  assert.equal(travelPassengerAge('2026-11-16',dhakaTravelDate(now)),null);
});
