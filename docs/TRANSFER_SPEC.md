# NBR Office Management → TaxPay design transfer / controlled phase 1

Source (verified recovered bytes): `NBR_OfficeManagement_20261010_PHASE3_8a952327_verified.zip` → nested `NBR_OfficeManagement_MAIN_8a9523277e99_source.zip` at commit `8a9523277e99f01a8af31294119d8e337f2edf74`.

## Exact source extraction
- `src/app/pages/auth/LoginPage.tsx`, `src/app/components/auth/LoginForm.tsx`, `LoginBrandPanel.tsx`, `LoginSlider.tsx` and `src/styles/globals.css` lines ~624–820: split desktop login (max 1280px, 48px column gap, 560px form), mobile single column, brand/slide panel, label/input controls and login card.
- `src/app/data/themes.ts` → `src/components/office-ui/themes.ts`: six theme definitions copied exactly (except provenance header).
- `src/app/data/fonts.ts`, `src/app/store/settingsSlice.ts`: default `indigo-blue` and `Inter`; font alternatives Inter/Poppins/Noto Sans/DM Sans; compact/standard/large 90/100/110%.
- `src/styles/tokens.css`: spacing, radii, shadows, z-index and motion tokens.
- `src/styles/buttons.css`, `tables.css`, `forms.css`, `modals.css`, `drawers.css`, `tabs.css` and `src/app/components/{forms,tables,buttons,modals,drawers}`: component patterns adapted into dependency-light React 19 / TypeScript components.

## Design components supplied to TaxPay
`OfficeThemeProvider`, `useOfficeTheme`, `OfficeButton`, `OfficeInput`, `OfficePasswordField`, `OfficeSelect`, `OfficeTextArea`, `OfficeCheckbox`, `OfficeSwitch`, `OfficeSearchField`, `OfficeCard`, `OfficeBadge`, `OfficeAlert`, `OfficeModal`, `OfficeDrawer`, `OfficeTabs`, `OfficeTable`, `OfficePagination`, `OfficeLoading`, `OfficeAppShell`, `OfficePageHeader`, `OfficeBreadcrumb`, `OfficeFormSection`, `OfficeDateField`, `OfficeRadioGroup`, `OfficeFileField`, `OfficeStepper`, `OfficeEmptyState`, `OfficeToast`; `OfficeLoginPage` uses verified-source composition.

## Decisions and boundaries
- Existing TaxPay screens retain their working CSS and logic; components become available for page-by-page adoption without broad, unreviewed visual changes.
- Login design is transferred but source prototype authentication (`dispatch(login({userId}))` after timeout) is **not** transferred. Real login requires authorization, a verified backend, server-side session and role checks. Login UI is intentionally non-interactive for credentials.
- **Do not** transfer the source NBR crest/seal or government claims to the independent TaxPay public preview. No government-branded impersonation, password collection or simulated acceptance.
- No payment state, ledger logic, database, tax rate, tax-law source or frozen NBR 366-rule registry is touched.
- Existing source had default-indigo plus five theme alternatives; the former `#085587` brand reference is NOT the recovered source default.
- Shared components are staged here for subsequent page-by-page adoption; a site-wide perfect visual match has **not** been claimed.

## Integration
Run `python apply_to_taxpay.py /path/to/checked-out/nbr-taxpay` from the bundle root. The script refuses unrecognized anchor text, will not overwrite pre-existing Office design files, and only edits `src/App.tsx`, `src/index.css`, and `src/components/screens/PublicLanding.tsx`. Then execute `npm ci`, `npm run lint`, `npm run test:domain`, `npm run build` and the browser regression suite. Review the diff and publish through normal PR/CI gates. A live publish has NOT occurred in this package.

## Source component audit
95 source TSX UI components from 25 source folders are inventoried in `docs/OFFICE_SOURCE_COMPONENT_INDEX.csv`, with hashes and two classifications. This phase provides a dependency-light shared visual/behavioral layer; it does NOT certify feature parity with every Office Management component. Other feature-specific forms and role/service modules remain untouched pending a page-level migration.
