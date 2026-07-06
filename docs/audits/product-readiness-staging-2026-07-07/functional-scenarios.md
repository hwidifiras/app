# Functional Scenarios - 2026-07-07

## Scope

This matrix summarizes the current real-world workflow evidence for product
readiness. It combines current staging screenshot proof, server-side disposable
PostgreSQL test proof, and known areas that still require manual browser QA.

## Evidence Levels

- `Proven`: covered by current automated/server evidence.
- `Visual`: covered by current screenshot QA only.
- `Partial`: implementation exists, but manual scenario proof is still needed.
- `Deferred`: intentionally outside this pass.

## Core Matrix

| Scenario | Expected Outcome | Current Evidence | Status |
| --- | --- | --- | --- |
| Login and authenticated shell | User reaches private app, shell APIs load without tenant errors. | Staging auth probes returned 200 for account, notifications, setup guide, navigation badges, club settings. | Proven |
| Disabled/demoted user access | Current DB user state blocks stale cookies. | Covered by existing auth hardening and regression tests in server run. | Proven |
| Dashboard daily overview | Staff sees today, caisse, priorities, and next actions. | Desktop/mobile screenshots for `/` passed no-overflow/error checks. | Visual |
| Members list | Staff can search and access member records. | Desktop/mobile screenshots for `/members` passed. | Visual |
| Member detail next action | Staff sees balance/subscription/session health and correction entry points. | Desktop/mobile screenshots for a real `/members/[id]` page passed no-overflow/error checks. | Visual |
| Enrollment | Staff can create a member/subscription/payment with dojo constraints. | Desktop/mobile screenshots for `/enrollment`; server tests cover enrollment apply with payment/group assignment, family-bundle pricing, recovery, and blocked unsafe revert cases. | Proven |
| Enrollment recovery | Safe recent inscription can be reversed with audit when no later activity consumed it. | Server tests passed after recovery rule alignment. | Proven |
| New payment | Staff can take full/partial payment and issue receipt. | Desktop/mobile screenshots for `/payments/new`; server tests cover overpayment rejection, exact remaining payment, ledger rows, receipt issuance, verification, and voiding. | Proven |
| Payment correction/reversal | Original payment remains; correction/reversal rows require reason and audit. | Server tests passed payment ledger/correction/reversal coverage. | Proven |
| Receipt verification | Receipt number/code/hash snapshot support print and public verification. | Server regression test on `gymday_saas_test` proves issued receipts can be looked up by number/code, preserve legal/payment snapshot data, and become voided after correction or reversal. | Proven |
| Subscriptions command view | Debt/renewal/active views help staff prioritize. | Desktop/mobile screenshots for `/subscriptions` passed. | Visual |
| Subscription edits | Amount below paid is rejected; sensitive changes require admin reason. | Server tests and implementation progress indicate coverage. | Proven |
| Pointage rules | Unpaid/partial/exception/finalization rules are consistent. | Server regression tests cover partial-payment permission, session consumption for present/absent, override reason/limit, finalized-session reopen requirement, and PATCH using the same safety rules as creation. | Proven |
| Attendance correction/undo | Correction writes before/after and balance delta in same transaction. | Server tests and progress doc indicate coverage. | Proven |
| Planning weekly view | Staff can read sessions by week/day and select details. | Desktop/mobile screenshots for `/sessions` passed. | Visual |
| Planning conflicts | Coach/room conflicts honor room-sharing, same-room qualified-coach sharing, and coach specialty limits. | Server regression tests on `gymday_saas_test` cover default blocks plus both preference modes. | Proven |
| Working days | Closed empty days hide; days with sessions stay visible; closing a day with future sessions or active horaires is blocked. | Screenshot proof plus server regression test on `gymday_saas_test`. | Proven |
| Groups and horaires | Groups use age/gender policies and weekly schedules. | Desktop/mobile screenshots for `/groups`, `/groups/[id]/edit`, and `/groups/[id]/schedules` passed no-overflow/error checks; schedule and compatibility rules have server coverage. | Visual |
| Coach specialties | Specialty qualification informs planning conflict/eligibility. | Desktop/mobile screenshots for `/coaches`; server tests cover coach qualification, planning conflict, and same-room qualified-coach cases. | Proven |
| Club settings | Working days, pointage, conflicts, receipts are configurable. | Desktop/mobile screenshots for `/settings/club` passed. | Visual |
| Schedule settings | Templates and impact preview guide broad changes. | Desktop/mobile screenshots for `/settings/schedules` passed. | Visual |
| Users and roles | Admin/Reception/Coach role intent is clear and admin-only. | Desktop/mobile screenshots for `/settings/users`; auth tests cover access freshness and admin-only boundaries. | Visual |
| Data import | French template, validation, and safe rollback states are present. | Desktop/mobile screenshots for `/settings/data-import`; server tests cover import fixtures and rollback boundaries. | Visual |
| Logs | Business actions can be filtered and internal noise de-emphasized. | Desktop/mobile screenshots for `/logs` passed. | Visual |
| Tenant isolation | Tenant host/auth scoping prevents cross-tenant leakage. | Server tests passed current isolation regressions; production cutover remains separate. | Proven |

## Required Manual QA Before Any Broad SaaS Claim

1. Create temporary overlapping room/coach sessions and verify conflict labels and
   preference toggles.
2. Try to disable a working day that contains existing sessions and confirm the
   app blocks hiding it with an affected-session message.
3. Browser-click enrollment through success, leave the page, then recover it
   from member detail where safe.
4. Browser-click a safe test payment and smoke the print/copy receipt actions.
5. Send a receipt email to a safe test address and confirm delivery status.
6. Browser-smoke the pointage drawer in a temporary group: unpaid, partial,
   exception with reason, absent, finalized, reopen/correct.
7. Walk a new admin through settings: club rules, horaires, users, import, logs.

## What Not To Test On Live Client Data

- destructive-looking recovery or reversal flows;
- disabling active working days;
- broad schedule generation over real groups;
- import rollback edge cases;
- cross-tenant guessing or host tests against production traffic.

Use temporary audit data or staging copies for those.
