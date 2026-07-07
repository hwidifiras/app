# Functional Scenarios - 2026-07-07

## Scope

This matrix summarizes the current real-world workflow evidence for product
readiness. It combines current staging screenshot proof, server-side disposable
PostgreSQL test proof, browser-click staging smoke, and the final remaining
browser QA run completed on the SaaS staging copy.

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
| Enrollment | Staff can create a member/subscription/payment with dojo constraints. | Desktop/mobile screenshots for `/enrollment`; server tests cover enrollment apply with payment/group assignment, family-bundle pricing, recovery, and blocked unsafe revert cases; browser-click staging smoke created a temporary inscription and reached the success/recovery panel. | Proven |
| Enrollment recovery | Safe recent inscription can be reversed with audit when no later activity consumed it. | Server tests passed after recovery rule alignment; browser-click staging smoke reversed a temporary inscription from the success recovery panel. | Proven |
| New payment | Staff can take full/partial payment and issue receipt. | Desktop/mobile screenshots for `/payments/new`; server tests cover overpayment rejection, exact remaining payment, ledger rows, receipt issuance, verification, and voiding; browser-click staging smoke paid a temporary subscription and reached receipt success. | Proven |
| Payment correction/reversal | Original payment remains; correction/reversal rows require reason and audit. | Server tests passed payment ledger/correction/reversal coverage. | Proven |
| Receipt verification | Receipt number/code/hash snapshot support print, copy, email, and public verification. | Server regression test proves issued receipts can be looked up by number/code, preserve legal/payment snapshot data, and become voided after correction or reversal. Browser-click staging smoke loaded the printable receipt; public verification initially exposed a tenant-context bug, fixed in `180f0f5`, then returned `HTTP 200` with the expected receipt/status. Final staging QA verified print state, verification-link copy, ready-message copy, email send API `200 delivered:true` to a synthetic test address, and public verification. Clipboard was verified with a browser stub because the private staging host is HTTP. | Proven |
| Subscriptions command view | Debt/renewal/active views help staff prioritize. | Desktop/mobile screenshots for `/subscriptions` passed. | Visual |
| Subscription edits | Amount below paid is rejected; sensitive changes require admin reason. | Server tests and implementation progress indicate coverage. | Proven |
| Pointage rules | Unpaid/partial/exception/finalization rules are consistent. | Server regression tests cover partial-payment permission, session consumption for present/absent, override reason/limit, finalized-session reopen requirement, and PATCH using the same safety rules as creation. Final browser QA passed paid present, paid absent update, unpaid normal block copy, exception modal, required reason, exception with reason, finalization, and reopen. This browser run found `TENANT_CONTEXT_REQUIRED` in attendance mutations; it was fixed in `985973d` and retested successfully. | Proven |
| Attendance correction/undo | Correction writes before/after and balance delta in same transaction. | Server tests and progress doc indicate coverage. | Proven |
| Planning weekly view | Staff can read sessions by week/day and select details. | Desktop/mobile screenshots for `/sessions` passed. | Visual |
| Planning conflicts | Coach/room conflicts honor room-sharing, same-room qualified-coach sharing, and coach specialty limits. | Server regression tests on disposable PostgreSQL databases cover default blocks plus both preference modes. Final browser QA opened a temporary conflict session, confirmed the conflict label on expanded detail, and verified the staff-facing solution copy. | Proven |
| Working days | Closed empty days hide; days with sessions stay visible; closing a day with future sessions or active horaires is blocked. | Screenshot proof plus server regression tests on disposable PostgreSQL databases. Final browser QA tried to close a day with affected temporary sessions, confirmed the blocking message, affected day detail, and checkbox restoration. | Proven |
| Groups and horaires | Groups use age/gender policies and weekly schedules. | Desktop/mobile screenshots for `/groups`, `/groups/[id]/edit`, and `/groups/[id]/schedules` passed no-overflow/error checks; schedule and compatibility rules have server coverage. | Visual |
| Coach specialties | Specialty qualification informs planning conflict/eligibility. | Desktop/mobile screenshots for `/coaches`; server tests cover coach qualification, planning conflict, and same-room qualified-coach cases. | Proven |
| Club settings | Working days, pointage, conflicts, receipts are configurable. | Desktop/mobile screenshots for `/settings/club` passed; final browser walkthrough confirmed the planning/conflict section loads. | Proven |
| Schedule settings | Templates and impact preview guide broad changes. | Desktop/mobile screenshots for `/settings/schedules` passed; final browser walkthrough confirmed the horaires/saison page, model summary, and apply area load. | Proven |
| Users and roles | Admin/Reception/Coach role intent is clear and admin-only. | Desktop/mobile screenshots for `/settings/users`; auth tests cover access freshness and admin-only boundaries; final browser walkthrough confirmed users/admin copy. | Proven |
| Data import | French template, validation, and safe rollback states are present. | Desktop/mobile screenshots for `/settings/data-import`; server tests cover import fixtures and rollback boundaries; final browser walkthrough confirmed import page access. | Proven |
| Logs | Business actions can be filtered and internal noise de-emphasized. | Desktop/mobile screenshots for `/logs` passed; final browser walkthrough confirmed journal/payment filters load. | Proven |
| Tenant isolation | Tenant host/auth scoping prevents cross-tenant leakage. | Server tests passed current isolation regressions; production cutover remains separate. | Proven |

## Final Browser QA Completed

The remaining manual-browser checklist was completed on SaaS staging with
temporary data:

1. Receipt print, copy link, copy ready message, email send, and public
   verification passed. Clipboard/print state was verified with browser stubs
   because the private staging host is HTTP.
2. Pointage passed for paid present, paid absent update, unpaid normal block,
   unpaid exception requiring a reason, finalization, and reopen.
3. Planning conflict detail passed with conflict label and solution copy.
4. Working-day closure blocking passed with affected-day detail and restored
   checkbox.
5. Settings walkthrough passed for overview, club, horaires/saisons, users,
   import, and logs.
6. Temporary `auditqa-*` staging records were counted and cleaned to zero after
   verification.

## What Not To Test On Live Client Data

- destructive-looking recovery or reversal flows;
- disabling active working days;
- broad schedule generation over real groups;
- import rollback edge cases;
- cross-tenant guessing or host tests against production traffic.

Use temporary audit data or staging copies for those.
