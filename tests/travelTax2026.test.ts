import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAND_PORT_NAMES, TRAVEL_TAX_ECONOMIC_CODE, TRAVEL_TAX_ZONES,
  makeTravelPassenger, travelPassengerAmount, travelPartyTotal, validateTravelParty, travelPassengerAge, assessTravelPassenger } from '../src/data/travelTax2026';

test('client accounting reference has nine unique organizational codes and one economic code', () => {
  assert.equal(TRAVEL_TAX_ZONES.length, 9);
  assert.equal(new Set(TRAVEL_TAX_ZONES.map(z=>z.code)).size, 9);
  assert.equal(TRAVEL_TAX_ECONOMIC_CODE, '1144102');
  for(const zone of TRAVEL_TAX_ZONES) assert.match(zone.code,/^\d{13}$/);
  assert.equal(LAND_PORT_NAMES.length,16);
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
