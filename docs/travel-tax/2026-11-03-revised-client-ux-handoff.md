# Korbritto Travel Tax — Nov 2026 UX/UI and developer-handoff contract

**Status:** UX/payment simulation preview; NOT a government passport lookup, official A-Challan, or actual Treasury settlement.

## Governing sources
1. Revised *Meeting Minutes — Arif Sir, 02 November 2026 (1)* (pp. 1–2): current Travel Tax product requirements.
2. Original 02 November meeting minutes: port number field and unresolved post-payment amendment policy.
3. *Tax Zones: Organizational and Economic Codes*, 2026–27: 9 organizational codes and economic code 1144102.
4. Customs SRO 297/2024: goods-related customs stations; a customs station is not automatically an active passenger crossing.
5. BLPA passenger report, FY2024–25: historical port names and activity, not verified 2026 operations.
6. Approved Korbritto UI: Poppins, shared modal/stepper/footer, shared receipt, component tokens, EN/BN, mobile.
7. WhatsApp voice audio could not be reliably transcribed and has not been used to introduce rules.

## Client-confirmed scope
- Travel modes: Land (first and default) and Water only; exclude Air.
- Departure port and destination selection; port number/reference from earlier minutes.
- Bangladeshi passengers: enter passport, automatic identity lookup through future government API; no duplicate manual data after successful lookup.
- Foreign passengers: manual entry of required personal details.
- Add New Member: family and friends, many passengers in one application.
- One A-Challan for all passengers, one passenger-wise table, grand total.
- Medical exemption: may apply for qualifying conditions; documentary process completed manually at port; never automatically approve online.
- Post-payment changes to travel date or port remain an explicit unresolved CLIENT DECISION.

## Proposed four-stage flow, built into existing approved modal

### 1. Travel details
- Land default, Water second; route search shows only these two modes.
- Land port: historical reference select; show warning that current immigration operation is not established. Water port: editable selection proposal pending an authoritative list.
- Port number/reference required; destination required; travel date required.
- Tax zone: choose from 9 provided values, since no approved port→zone mapping exists. Show corresponding read-only organizational code and economic code 1144102, year 2026–27.

### 2. Passengers
- One initial passenger. Add, edit or remove family/friend member; remove targets only that passenger.
- Per passenger: nationality, passport, full name, age band, medical-port referral.
- Foreign: manually enter name/passport. Bangladeshi: name read-only until lookup. As a **UX-only sample**, passport TEST123456 may return visibly synthetic name SAMPLE BANGLADESHI PASSENGER; all other passports show the government API is not connected, never fabricate an identity.
- Application receipt mobile collected once.
- Duplicate passports rejected case-insensitively. Medical referral cannot silently be treated as a granted exemption.
- Age bands and land/water amounts are from previous illustrative application configuration, not legally verified.

### 3. Review and payment
- Single table with passenger name, masked passport, age band, illustrative amount; one combined total.
- Show travel mode, port/number, destination/date, tax zone, accounting codes.
- Reuse approved online/bank payment method selector, acknowledgement and failure/retry feedback.
- Payment is **simulated preview**. A-Challan is a future developer integration; synthetic transaction reference must never be described as government challan.

### 4. Combined challan
- One simulated reference per application, all passenger rows and combined grand total.
- Reuse existing shared receipt, Download/Print controls, and mobile full-width receipt.
- Snapshot travel details, zone, codes and passenger allocations for consistent history.
- Bank-slip preview is not paid until simulated settlement, never actual Treasury confirmation.

## Product acceptance and future developer integration
UI acceptance must cover single foreign, BD sample and unavailable lookup, Land default/Water, invalid and duplicate passport, family/friends, age calculations with illustrative rates, manual medical referral, one receipt, EN/BN mobile and desktop, safe failure/retry, protected read-only identity, and unaffected other tax journeys.

Future APIs are **outside this UX phase**: verified passport lookup, authoritative dated ports/rates/zone mapping, createTravelApplication (one-to-many passenger allocations), genuine A-Challan initialization/acknowledgement/reconciliation, Treasury transaction status, and Office Management secured 1:1 transaction projection. Do not represent placeholders as verified integrations.

Remaining decisions:
- After payment, may date/port be amended, or is a new application mandatory?
- Port-to-zone rules, up-to-date passenger port catalog, water port list, actual applicable rates and exemption parameters.
- Required government identity fields returned by passport lookup.
- A-Challan payload and reconciliation rules, to be provided for developer phase.

**Release discipline:** No feature is COMPLETE until relevant CI and UX regressions pass. No feature is LIVE until PR is authorized/merged, Pages deploys, and deployed URL/version are verified. A demo UI release is not genuine government payment.
