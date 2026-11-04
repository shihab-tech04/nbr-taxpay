# Korbritto Travel Tax — current UX/UI developer-handoff contract

**Source precedence:** Latest client instruction (03 Nov 2026) supersedes conflicting 02 Nov meeting-minute UI rules. Preserve other confirmed rules, approved Korbritto design system, and existing TaxPay journeys.

**Phase:** Production-published *UX preview* only. No real passport verification, official A-Challan, or statutory-fee assertion is implemented.

## Approved user flow (4 stages, existing shared progressive modal)

1. **Passenger and travel details:** Two exclusive tabs, *Bangladeshi Passenger* and *Foreign Passenger*. First choose passenger type; the form mounts only that type's fields. Bangladeshi: passport number -> lookup -> read-only government-returned identity and birth date -> mode -> departure port -> destination -> travel date. Foreign: manually enter passport number, passport name, birth date, country of nationality; then choose mode, port, destination, travel date. **By Land is selected by default; By Water is secondary.** No Air. No fixed amount displayed beside either mode.
2. **Passengers and receipt details:** Show the first passenger in a concise read-only summary with Edit, allow adding family/friends with the same distinct BD/Foreign tab behaviors and independent validation. Collect one receipt mobile number.
3. **Review & payment:** Show travel mode, **port name only**, destination/date, passenger-wise ages and auto-calculated illustrative amounts, one total, the existing payment-method control and acknowledgement. A-Challan is the intended future government handoff, not a live API in this UX phase.
4. **Combined challan:** One receipt and passenger-wise breakdown, with masked passport, age, per-passenger amount, total, print/download and all existing safety labels. Never represent a synthetic receipt as government Treasury settlement.

## Fields and removals

- **Delete from Travel Tax entry and review:** Port number / reference number, Tax Zone, Organizational Code. Do not make them mandatory or infer a tax-zone assignment from a historical port.
- Departure Land port: historical reference list from BLPA FY2024–25 (not proof of 2026 passenger operations).
- Departure Water port: proposal/free-text until the client approves a current port catalogue.
- Destination and travel date remain required. Port name remains required.
- Economic code 1144102 remains internal accounting metadata where already supported; it is not a passenger-entered form field.
- **Passport lookup:** In the preview, only **TEST123456** returns an overtly synthetic Bangladeshi identity and DOB; any other value reports that the real government API is not connected. Never invent an identity. Real API credentials and mapping are developer-phase work.
- **Foreign personal data:** Passport number, full passport name, birth date and country of nationality are required UX fields; final authoritative identity-field mapping remains pending client/API owner approval.

## Automatic age-based preview calculation

- Derive age *on the selected travel date* from passport-supplied DOB (BD sample) or manually entered DOB (foreign).
- **Do not show a tax amount until** passenger identity information, DOB and travel date are available. New unfilled group members also prevent the combined total being presented as final.
- Show the amount and a plain-language age reason **on the desktop right-side Payment calculation rail** and in the mobile expandable fixed footer. When a new passenger is added, show their own age reason and amount, then combined total.
- Current app preview uses **illustrative, legally unverified** Land/Water rate and age bands (age ≤ 5 -> 0, ages 6–12 -> half, age > 12 -> full). These must be replaced by signed-off, date-effective statutory rules, including exemptions and mode-specific schedule, before any real payment integration.
- Changing passport number, passenger type, DOB, travel date, or mode invalidates/recomputes the previous estimate. Duplicate passport numbers are rejected.
- Medical-exemption documentation is reviewed manually at the departure port, never auto-approved online. Post-payment date/port amendment policy remains a client decision.

## Preserved design and integration boundaries

- Frozen Korbritto shared modal, shared receipt, typography/color tokens, EN/BN, responsive payment footer, focus/keyboard and accessible tab states remain authoritative.
- Prior TaxPay/Office source contracts are not authorization to invent live passport lookup or A-Challan settlement.
- Preserve existing receipt storage compatibility: historical portNumber/organizationalCode fields can be read if present, but new Travel Tax records do not collect them; new UI and challan do not display them. Preserve transaction records and masked passport privacy.
- Dev phase API requirements: passport lookups with DOB/identity source, current port eligibility, authoritative versioned rules/fee schedule, one-to-many application allocations, A-Challan initialization/reconciliation, and Office read-only mirror. These are not claimed live.
- Regression acceptance: BD/Foreign tabs, keyboard arrows, sample versus unavailable lookup, Land default/Water, no fixed card amount, port name only, no Tax Zone/Org field, age threshold math, party totals, receipt, responsive mobile, EN/BN, auth/RLS and existing non-Travel Tax journeys.

## Open client decisions (do not invent)

Actual statutory amounts and effective dates; exact legal age bands and medical exemptions; up-to-date land/water passenger-port catalogue; government passport response fields; whether travel date/port can change after payment; official A-Challan API contract.

**Release gate:** verified off-GitHub restorable backup -> required CI and focused UX tests -> protected merge -> successful production Pages deployment and live readback. PR/build alone is not LIVE.
