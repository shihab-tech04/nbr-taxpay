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

export function makeTravelPassenger(id: string): TravelPassenger {
  return {
    id, nationality: 'FOREIGN', passport: '', name: '',
    ageBand: 'ADULT', identitySource: 'MANUAL', medicalPortReferral: false,
  };
}

export function travelPassengerAmount(unitRate: number, ageBand: TravelAgeBand): number {
  if (ageBand === 'UNDER5') return 0;
  if (ageBand === 'CHILD') return unitRate / 2;
  return unitRate;
}

export function travelPartyTotal(passengers: TravelPassenger[], unitRate: number): number {
  return passengers.reduce((total, passenger) => total + travelPassengerAmount(unitRate, passenger.ageBand), 0);
}

export function validateTravelParty(passengers: TravelPassenger[]): string | null {
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
    if (passenger.medicalPortReferral) return 'Medical exemption requests require manual documentation at the port.';
  }
  return null;
}
