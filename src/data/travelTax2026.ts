/**
 * Travel Tax product-reference configuration for the 02 Nov 2026 client minutes.
 * Port names come from the 2024–25 BLPA traffic report and are NOT a verified
 * live immigration/open-port list.  Never infer a port→tax-zone relationship.
 * Rates remain existing illustrative app rates until the legal rate table is approved.
 */
export type TravelMode = 'LAND' | 'WATER';
export type TravellerNationality = 'BD' | 'FOREIGN';
export type TravelAgeBand = 'ADULT' | 'CHILD' | 'UNDER5';

export interface TravelPassenger {
  id: string;
  nationality: TravellerNationality;
  passport: string;
  name: string;
  ageBand: TravelAgeBand;
  birthDate: string;
  country: string;
  identitySource: 'PASSPORT_SAMPLE' | 'MANUAL' | 'PENDING';
  medicalPortReferral: boolean;
}

export const TRAVEL_TAX_YEAR = '2026-27';
export const TRAVEL_TAX_ECONOMIC_CODE = '1144102';

export const TRAVEL_TAX_ZONES = [
  { name: 'Tax Zone-1, Dhaka', code: '1110215102417' },
  { name: 'Tax Zone, Khulna', code: '1110215102434' },
  { name: 'Tax Zone, Rangpur', code: '1110215102438' },
  { name: 'Tax Zone, Noakhali', code: '1110215143726' },
  { name: 'Tax Zone, Dinajpur', code: '1110215143727' },
  { name: 'Tax Zone, Cumilla', code: '1110215102416' },
  { name: 'Tax Zone, Sylhet', code: '1110215102439' },
  { name: 'Tax Zone, Rajshahi', code: '1110215102437' },
  { name: 'Tax Zone, Jashore', code: '1110215143724' },
] as const;

/** Historical 2024–25 passenger-port names only; no 2026 operating claim. */
export const LAND_PORT_NAMES = [
  'Benapole', 'Burimari', 'Nakugaon', 'Banglabandha',
  'Sheola', 'Bhomra', 'Sonamasjid', 'Hili', 'Akhaura',
  'Tamabil', 'Bibirbazar', 'Bholaganj',
  'Sonahat', 'Dhanua Kamalpur', 'Gobrakura-Koroitoli', 'Teknaf',
] as const;

/** Clearly fictional identities for local UI review only. Never represent as real government results. */
export const SAMPLE_BD_PASSPORTS = [
  { passport: 'TEST123456', name: 'SAMPLE BANGLADESHI PASSENGER', birthDate: '1992-04-18' },
  { passport: 'TEST230001', name: 'SAMPLE PASSENGER TWO', birthDate: '1988-11-10' },
  { passport: 'TEST230002', name: 'SAMPLE PASSENGER THREE', birthDate: '1995-07-22' },
  { passport: 'TEST230003', name: 'SAMPLE PASSENGER FOUR', birthDate: '2000-03-15' },
  { passport: 'TEST230004', name: 'SAMPLE PASSENGER FIVE', birthDate: '1979-09-04' },
  { passport: 'TEST230005', name: 'SAMPLE PASSENGER SIX', birthDate: '2017-08-10' },
  { passport: 'TEST230006', name: 'SAMPLE PASSENGER SEVEN', birthDate: '2022-01-09' },
  { passport: 'TEST230007', name: 'SAMPLE PASSENGER EIGHT', birthDate: '1990-12-25' },
  { passport: 'TEST230008', name: 'SAMPLE PASSENGER NINE', birthDate: '2004-06-01' },
  { passport: 'TEST230009', name: 'SAMPLE PASSENGER TEN', birthDate: '2014-10-30' },
] as const;

export function makeTravelPassenger(id: string, nationality: TravellerNationality = 'FOREIGN'): TravelPassenger {
  return {
    id, nationality, passport: '', name: '', birthDate: '', country: nationality === 'BD' ? 'Bangladesh' : '',
    ageBand: 'ADULT', identitySource: nationality === 'BD' ? 'PENDING' : 'MANUAL', medicalPortReferral: false,
  };
}

/** Age is measured on the selected travel date, not on today's date. */
export function travelPassengerAge(birthDate: string, travelDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || !/^\d{4}-\d{2}-\d{2}$/.test(travelDate)) return null;
  const birth = new Date(birthDate + 'T00:00:00Z');
  const travel = new Date(travelDate + 'T00:00:00Z');
  if (!Number.isFinite(birth.getTime()) || !Number.isFinite(travel.getTime()) ||
      birth.toISOString().slice(0, 10) !== birthDate ||
      travel.toISOString().slice(0, 10) !== travelDate || birth > travel) return null;
  let age = travel.getUTCFullYear() - birth.getUTCFullYear();
  if (travel.getUTCMonth() < birth.getUTCMonth() ||
      (travel.getUTCMonth() === birth.getUTCMonth() && travel.getUTCDate() < birth.getUTCDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

export function travelAgeBand(age: number): TravelAgeBand {
  // Illustrative bands from the existing preview; statutory thresholds remain unverified.
  return age <= 5 ? 'UNDER5' : age <= 12 ? 'CHILD' : 'ADULT';
}

export function assessTravelPassenger(passenger: TravelPassenger, unitRate: number, travelDate: string) {
  if (!passenger.passport.trim() || !passenger.name.trim() ||
      (passenger.nationality === 'BD' && passenger.identitySource !== 'PASSPORT_SAMPLE') ||
      (passenger.nationality === 'FOREIGN' && !passenger.country.trim())) return null;
  const age = travelPassengerAge(passenger.birthDate, travelDate);
  if (age === null) return null;
  const ageBand = travelAgeBand(age);
  return { age, ageBand, amount: travelPassengerAmount(unitRate, ageBand) };
}

export function travelPassengerAmount(unitRate: number, ageBand: TravelAgeBand): number {
  if (ageBand === 'UNDER5') return 0;
  if (ageBand === 'CHILD') return unitRate / 2;
  return unitRate;
}

export function travelPartyTotal(passengers: TravelPassenger[], unitRate: number, travelDate?: string): number {
  if (travelDate !== undefined) {
    return passengers.reduce((total, passenger) => total + (assessTravelPassenger(passenger, unitRate, travelDate)?.amount ?? 0), 0);
  }
  return passengers.reduce((total, passenger) => total + travelPassengerAmount(unitRate, passenger.ageBand), 0);
}

export function validateTravelParty(passengers: TravelPassenger[], travelDate?: string): string | null {
  if (!passengers.length) return 'At least one passenger is required.';
  const passports = new Set<string>();
  for (let i = 0; i < passengers.length; i++) {
    const passenger = passengers[i];
    if (!passenger.passport.trim() || passenger.passport.trim().length < 6) return 'Passenger ' + (i + 1) + ': enter a valid passport number.';
    if (passports.has(passenger.passport.toUpperCase().trim())) return 'The same passport cannot be added twice.';
    passports.add(passenger.passport.toUpperCase().trim());
    if (passenger.name.trim().length < 2) return 'Passenger ' + (i + 1) + ': passenger identity is required.';
    if (passenger.nationality === 'BD' && passenger.identitySource !== 'PASSPORT_SAMPLE') {
      return 'Bangladeshi passenger details require passport verification; the government lookup is not connected.';
    }
    if (travelDate !== undefined) {
      if (travelPassengerAge(passenger.birthDate, travelDate) === null) return 'Passenger ' + (i + 1) + ': enter a valid date of birth before the travel date.';
      if (passenger.nationality === 'FOREIGN' && !passenger.country.trim()) return 'Passenger ' + (i + 1) + ': enter the country of nationality.';
    }
    if (passenger.medicalPortReferral) return 'Medical exemption requests require manual documentation at the port.';
  }
  return null;
}
