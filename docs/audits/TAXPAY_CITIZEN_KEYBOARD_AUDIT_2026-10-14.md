# NBR TaxPay — Citizen Keyboard & Section-Copy Audit (14 October 2026)

## Source checkpoint
- PR #71 merge: `f3b323b8a80eda8e75f2c049bab77c3d189528a2`.
- Continued from the newer dense taxpayer dashboard on main `2becc2de3da61dbe5091ffe71cb666d6b2edef03`, incorporating subsequent upstream CI-test corrections through `f4df74c99118aa3b9dc3aa8738783d9529f6ca18`.
- This document is a traceable static code review plus proposed browser regression coverage, not a complete WCAG or assistive-technology certification.

## UX rule / scope
Each section introduction should show heading and supporting subheading. No redundant small eyebrow/category text above the heading. Financial status, missing-evidence warnings, labels for form controls, and legally required content are not deleted merely to satisfy typography.
A normal Tab sequence contains interactive elements—links, buttons, inputs, selects, textareas, and disclosure summaries. `tabindex="0"` on all HTML tags would create unrelated Tab stops on every paragraph, heading, and container; it is not an appropriate accessibility implementation. Main content retains `tabIndex={-1}` for programmatic focus after navigation.

## Inspected sources
Read-only static pattern inspection covered 32 citizen-facing TSX screen/layout/control modules, the main router, and 16 Officer/Office modules. It screened for mouse-only `onClick` on nonsemantic `div/section/article/span/li/tr/td/label` elements and no-href `a` elements, followed by targeted manual source checks. This pattern-based audit cannot detect every custom widget or prove runtime focus correctness.

Citizen: PaymentHistory, TaxLedger, TaxJourney, ReceiptLookup, AccountCenter, GuestPayment, PublicUserGuide, PublicServiceModal, CorrectionRequests, PaymentWizard, TaxpayerDashboard, PublicLanding, CertificatesView, ConnectedServices, NotificationsView, SecureWorkspace, DemoPaymentActivity, PaymentDetailView, TravelTax, GuidanceAssistant, HeadCatalogue, PublicReport, ArchitectureView, PublicHomeHeader, CitizenNavigation, TaxpayerReferenceRail, CitizenFooter, PublicHelpChat, Header, TaxPayModal, Controls, TaxpayerHome. MainRouter/App was additionally inspected.

Officer/Office (read-only): OfficerHome, Taxpayer360, PaymentSearch, CorrectionQueue, CaseManagement, IncidentInvestigation, OfflineEvidence, AuditTrail, IntelligenceScreen, MonitoringScreen, OntologyView, SourceChangeProposals, SharedReviewRequests, OfficeLoginPage, OfficeLayout, OfficeControls.

## Source findings

| ID | Screen/component | Finding | Decision/status |
| --- | --- | --- | --- |
| C-01 | PublicLanding | Hero/sections use heading and supporting text; extra eyebrow removal from PR #71 verified in source. | SOURCE-VERIFIED (not independent visual certification) |
| C-02 | TaxpayerDashboard | Redundant eyebrow above the main heading and assessment-year heading; metric cards repeated a third explanation line; repeated chart/footer disclaimers. | FIXED ON BRANCH; test pending |
| C-03 | CitizenNavigation | Compact mode visually hides the main header but left its buttons focusable in the DOM. | FIXED ON BRANCH via `inert`; test pending |
| C-04 | PublicHomeHeader | Mobile dropdown Escape closed menu without explicitly returning focus to the trigger. | FIXED ON BRANCH; test pending |
| C-05 | Citizen styling | Citizen focus ring did not explicitly cover `input`, `textarea` and `summary` in its base focus selector. | FIXED ON BRANCH; test pending |
| C-06 | Examined citizen TSX files | No obvious mouse-only click on the screened noninteractive tag set and no bare `<a>` without href were detected. | LIMITED STATIC CHECK ONLY; runtime routes pending |
| O-01 | OfficerHome | Clickable `div` route cards have no visible Tab/Enter/Space alternative in inspected markup. | OPEN — Officer lock prevents modification |
| O-02 | Taxpayer360 | Clickable `div` receipt rows have no visible Tab/Enter/Space alternative in inspected markup. | OPEN — Officer lock prevents modification |
| O-03 | OntologyView | Clickable `div` node choices have no visible Tab/Enter/Space alternative in inspected markup. | OPEN — Officer lock prevents modification |
| O-04 | OfficeControls | Table rows with `onRowClick` conditionally get `tabIndex={0}` and Enter/Space handler; mobile cards expose View details button. | SOURCE-VERIFIED; browser/AT testing pending |

## Tests added
`tests/e2e/citizen-keyboard-comprehensive.spec.ts`: keyboard skip-to-content, FAQ Enter/Space, mobile menu focus restoration, modal focus/escape/return, native taxpayer filter keys, seven citizen route structures, and compact-header inert check. Existing Playwright/axe suites remain unmodified except for independently landed upstream regressions carried by merge.

## Certification and release gates
1. Re-run current branch TypeScript/domain, browser matrix, isolated Auth/RLS, responsive EN/BN, and axe assertions; attach actual GitHub Actions evidence.
2. Resolve true failures without disabling or weakening safety assertions. Reconcile stale tests after the dashboard route was upgraded.
3. Test Tab and Shift+Tab order, visible focus, Escape, Enter and Space across all active Public/Taxpayer routes, mobile and desktop.
4. Manual screen-reader journeys (NVDA, VoiceOver/TalkBack where available), 200%/400% zoom and keyboard-only complete workflows remain **UNVERIFIED**; automated checks alone do not certify WCAG 2.2 AA.
5. No merge or live deployment until current branch release workflow passes and published Pages read-back proves the target commit.
6. Officer findings O-01–O-03 are audit-only; no modification of locked Admin/Officer code or production data is authorized by this branch.

**Disposition: PARTIAL; code changes proposed, runtime and assistive-technology certification pending.**
