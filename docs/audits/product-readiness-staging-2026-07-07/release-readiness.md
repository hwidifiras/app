# Release Readiness - 2026-07-07

## Verdict

Ready to continue as a guided first-client / manually sold dojo SaaS candidate.

Not ready to claim fully self-serve SaaS maturity. The daily reception and money
trust paths are strong enough for guided handoff, but setup/planning/coach
configuration still need guided product polish before a new club can onboard
alone without help.

## Ready

- Staging auth and tenant-scope blockers were fixed before this checkpoint.
- Dashboard and shell APIs load authenticated staging without degraded tenant
  context errors.
- Current staging screenshot sweep captured 24 desktop/mobile screens across 12
  high-value private routes with no detected horizontal overflow or app-error
  flags.
- Additional remaining-gap browser proof captured 20 desktop/mobile screens
  across member detail, enrollment, payment, groups, group schedules, group edit,
  coaches, users, and data import with no detected horizontal overflow or
  app-error flags.
- Server-side disposable PostgreSQL test run passed 16 test files and 163 tests
  after adding the working-day closure, planning conflict preference, and receipt
  verification/voiding regressions.
- Browser-click staging smoke passed basic enrollment, enrollment recovery from
  the success panel, payment creation, printable receipt load, and public receipt
  verification. The public verification smoke found a tenant-context bug, which
  was fixed before this checkpoint.
- Money, payment correction/reversal, receipts, enrollment recovery,
  subscription guards, attendance policy, and tenant isolation have meaningful
  automated coverage.
- UI/UX fingerprint is coherent across daily reception flows: dashboard,
  members, subscriptions, payments, enrollment, planning, settings, import, logs.
- Documentation now contains a current change register, UI/UX audit,
  functional-scenario matrix, and readiness position.

## Not Yet Ready For Unassisted SaaS

- Planning remains the hardest concept: fixed horaires, generated sessions,
  working days, conflict preferences, coach specialty, room conflicts, and
  selected-session detail still need stronger guided explanation.
- Coach assignment is implemented but should become more obvious during group
  creation/editing and planning conflict review.
- Settings pages are functional and much improved, but not all share one
  excellent guided configuration pattern yet.
- Receipt email delivery plus print/copy button state still need a focused safe
  browser smoke before being advertised as a polished tenant feature.
- Accessibility has earlier automated proof, but no current manual screen-reader
  traversal.
- SaaS billing, self-serve onboarding, production cutover, and final tenant
  operations are outside this checkpoint.

## Verification Notes

- Local DB tests remain unsuitable because the local PostgreSQL test database is
  not reachable.
- Server-side disposable PostgreSQL testing is the valid test path for this
  branch.
- Latest deployed/tested staging checkpoint: commit `180f0f5`.
- Latest server run: disposable `gymday_test_codex_*`, 7 migrations applied, 16
  test files passed, 163 tests passed. The temporary test database was dropped
  after the run.
- Temporary browser-QA records matching `auditclick-*` and `auditpay-*` were
  removed from staging after smoke verification.
- Raw screenshots are intentionally ignored by Git because they may contain
  client data.
- No production data mutation is required for the remaining QA; use temporary
  audit data or staging copies.

## Go / No-Go

| Target | Decision | Reason |
| --- | --- | --- |
| First-client guided handoff | Go | Core flows are coherent and tested enough, with known caveats. |
| Manual demo to another dojo owner | Go with prepared data | Daily flows look sellable; setup should be guided live. |
| Paid SaaS pilot with manual onboarding | Conditional go | Server proof is strong and basic enrollment/payment/receipt browser smoke passed; still needs final browser-click smoke on receipt delivery buttons, pointage drawer, and planning conflict UX. |
| Self-serve SaaS launch | No-go | Needs onboarding, billing, stronger setup guidance, and operations playbook. |
| Production cutover to multitenant stack | No-go in this checkpoint | Cutover is separate and requires backup, migration verification, staging smoke, and rollback plan. |

## Next Optimal Fix Order

1. Finish manual browser-click QA for receipt delivery buttons, planning conflict
   UX, working-day blocking UX, and the pointage drawer.
2. Make coach assignment and group eligibility obvious in group create/edit,
   coaches, and selected-session details.
3. Standardize settings pages with shared rule/impact/danger patterns.
4. Add more recovery entry points where staff naturally search: payment detail,
   subscription detail, member detail, attendance detail.
5. Continue component/service extraction around planning, attendance routes,
   schedule template routes, payment form, and data import.

## Deployment Rule

Before production changes, create a server checkpoint/backup, deploy by Git,
build, run server-side tests or targeted smoke checks, verify `/login`, `/`,
`/members`, `/subscriptions`, `/sessions`, `/payments/new`, `/enrollment`, and
keep rollback ready.
