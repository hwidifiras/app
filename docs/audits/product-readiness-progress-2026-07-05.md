# Product Readiness Progress - 2026-07-05

## Goal

Make the dojo / martial-arts SaaS safe to sell and hand over:

- every sensitive human action must be recoverable;
- money and receipts must be trustworthy;
- configuration must feel guided, not technical;
- UI patterns must stay consistent across desktop and mobile;
- code must be easier to extend for future modules such as gym management.

## Implemented Checkpoints

### Recovery And Trust

- Payments use an append-only ledger for normal payments, corrections, and reversals.
- Payment correction/reversal requires admin and a reason.
- Enrollment recovery now reverses payments, voids receipts, cancels subscriptions, closes assignments, and archives newly created members where applicable.
- Catalog records for disciplines, coaches, and formulas are deactivated instead of physically deleted in normal flows.
- Receipts are created for original payment entries and voided when the original payment is corrected or reversed.
- Group schedules are closed with an end date and audit trail instead of being physically deleted.
- Session cancellation keeps the session row and now writes an actor-linked audit entry.
- Session edits now write actor-linked audit entries: exception edits include before/after snapshots, and permanent edits include affected future session IDs plus requested values.
- Subscription edits now require admin + reason for formula/status/value changes, block amount below paid total, and write before/after audit snapshots.
- Subscription cancellation now preserves before/after audit details.
- Offers remain create/deactivate only; active offer cards now show usage count so used discounts are treated as historical templates, not editable meanings.
- Attendance corrections now write before/after snapshots and balance delta inside the same transaction; session finalize/reopen logs include staff-facing reasons.
- Attendance undo keeps its balance adjustment and audit entry inside the same transaction.

### Receipts

- Receipt model, numbering, verification code, snapshot, and content hash exist.
- Printable receipt page exists at `/receipts/[id]`.
- Public verification exists at `/receipts/verify`.
- Receipt actions now support print, public verification, and manual email send.
- Printed/verified receipts now include a QR code pointing to public verification.
- Receipt actions now support copying the public verification link for manual sending.
- Payment history now shows compact receipt actions for each issued receipt: open receipt, resend email when a member email exists, and copy verification link.
- Payment correction/detail now shows the linked receipt, resend/copy actions, and the latest receipt email delivery attempts from audit logs.
- Receipt email sending uses the existing Resend email infrastructure and writes audit logs.
- Club settings now control receipt prefix, next sequence, footer, default print, and default email behavior.
- Payment creation honors `receiptEmailDefault`: if enabled and the member has an email, the receipt is sent automatically after the payment transaction commits.

### Martial-Arts Product Fit

- Discipline creation includes common martial-arts suggestions.
- Members now have gender.
- Groups now support kids, adults, mixed age, male-only, female-only, and mixed gender policies.
- Group create/edit now uses a guided `Public du cours` picker instead of raw age/gender selects.
- Enrollment and group assignment enforce group/member compatibility.
- Parent phone is required for kids during new enrollment.

### UI/UX Consistency

- Dashboard, planning, payments, enrollment, subscriptions, and receipt flows use the current SaaS visual fingerprint.
- A settings configuration hub now exists at `/settings`.
- Admin users see the configuration hub, club rules, schedules, formulas, offers, import, users, and logs.
- Non-admin users see only account settings in the configuration drawer, reducing sidebar confusion.
- `/settings/users` now shows Admin / Reception / Coach access posture, role-first account creation, clearer permission labels, and safer deactivation copy.
- `/settings/club` now starts with an operational summary for club identity, working days, pointage, and receipts, with reception rules separated from the long preferences form.
- `/settings/schedules` now starts with schedule summary metrics, keeps template creation collapsed by default, shows the selected template before applying, and clears stale previews when targets or dates change.
- `/settings/data-import` now opens with migration readiness metrics and explicit guidance about when to use reprise mode and when rollback remains safe.
- `/logs` now starts with summary metrics for useful actions, payments, presences, and system noise before the detailed audit table.
- `schedule-templates-manager.tsx` now delegates reusable schedule template cards and apply-preview UI to `schedule-template-ui.tsx`, reducing page-manager file pressure without changing behavior.
- `data-import-wizard.tsx` now delegates the bulk preview metrics/table UI to `data-import-bulk-ui.tsx`, reducing duplicated embedded table markup without changing behavior.
- `data-import-wizard.tsx` now delegates the import mode and recent rollback list UI to `data-import-status-ui.tsx`, keeping import actions in the wizard while reducing presentation markup.
- `sessions-planner.tsx` now delegates session tiles, selected-session detail panel, legend, and session display helpers to `session-planner-ui.tsx`; a dead hidden legacy session-list block was removed.
- `club-settings-form.tsx` now delegates receipt settings and receipt preview UI to `club-receipt-settings.tsx`, and shared settings toggles to `settings-toggle-row.tsx`.
- Planning session generation now uses a dry-run preview before creating sessions, shows the target/date range/active horaires/existing sessions, and writes `SESSIONS_GENERATED` audit logs after confirmed generation.
- Enrollment success now keeps staff on the confirmation screen, shows a direct member-profile link, and exposes the safe traced `Annuler cette inscription` recovery action with a required reason.
- A broader product-readiness roadmap now exists at `docs/audits/product-readiness-roadmap-2026-07-05.md`, covering recoverability, receipts, UI/UX consistency, settings polish, group/coach/enrollment rules, and code organization.
- A master SaaS execution map now exists at `docs/audits/saas-product-execution-map-2026-07-05.md`, covering recoverability, page-by-page UX audit scope, settings redesign, receipts, group rules, planning/working days, code organization, and future gym-module strategy.
- A mutation recoverability audit now exists at `docs/audits/mutation-recoverability-audit-2026-07-05.md`, mapping payment, enrollment, attendance, sessions, schedules, group assignments, data import, and catalog mutations to the recovery vocabulary.
- `src/lib/recovery-policy.ts` now maps the main emitted audit actions to the shared recovery vocabulary so future risky-action UI copy can use one source of truth.
- Audit-log presentation now uses the recovery-policy fallback and labels newer business actions such as data import, schedule templates, group closures, catalog deactivation, and payment reminders.
- Attendance undo/cancellation now records a richer audit snapshot and is presented as `Pointage annulé` instead of `Présence supprimée`.

## Current Product Fingerprint To Reuse

- Light workspace background with white operational surfaces.
- Compact 8px-style cards/panels.
- Blue for primary actions and navigation.
- Green/amber/red only for business status.
- Short French labels that match reception work: `Pointer`, `Encaisser`, `Inscrire`, `Finaliser`, `Archiver`.
- First viewport should answer: what needs action now, and what button should staff press next.
- Tables should collapse into readable mobile cards instead of horizontal scrolling.
- Dangerous actions should be visually separate and require reason when they affect money, history, or official documents.

## Remaining Priority List

### P0 - Complete Recoverability Audit

Audit every mutation route under `src/app/api` and classify it:

- edit: safe profile/config field update;
- correct: creates before/after audit with reason;
- reverse: money ledger reversal;
- void: official action/document invalidated without deletion;
- archive: hidden from active work but preserved;
- close: assignment/schedule ended with date;
- draft delete: physical delete only if no business history exists.

Highest-risk routes to re-check next:

- attendance append-only row preservation remains a future schema decision; reopen-before-correction is implemented and now better audited;
- attendance delete is guarded and now records a detailed previous-state audit snapshot, but still physically removes the attendance row; decide whether to preserve a voided/corrected row in a future schema pass;
- session edit reason UX for broad permanent changes is implemented;
- group schedule generation preview and future-session effects;
- subscription browser QA and copy polish after the latest edit/cancel audit pass;
- offer browser QA after the usage-count/deactivation clarity pass;
- data import rollback boundaries.

### P1 - Settings And Configuration Polish

The new `/settings` hub is the entry point. Next UI pass should make these pages match it:

- `/settings/club`: summary, guidance, DB-backed admin guard, and tenant-scoped settings are implemented; remaining improvement is browser QA and any form-section copy tightening found there.
- `/settings/schedules`: template/apply clarity, DB-backed admin guard, and tenant-scoped reads are implemented; remaining improvement is browser QA with real groups and mobile layout.
- `/sessions`: working-day-aware display hides closed empty days, keeps closed days with sessions visible, and now explains this rule near the filters.
- `/sports`: discipline creation keeps free text while offering a grouped martial-arts starter catalog for common club disciplines.
- `/settings/users`: role intent, tenant-scoped reads, permission clarity, and deactivation warning are implemented; browser QA still needed on desktop and mobile.
- `/settings/data-import`: page-level guidance, safety framing, and per-import rollback state are implemented; deeper wizard component split remains a code-organization follow-up.
- `/settings`: hub and admin settings pages now use DB-backed auth/tenant context instead of header-only admin checks.
- `/members/[id]`: top health strip and action row exist; a correction guide now points staff to the right edit, payment, attendance, subscription, and assignment surfaces.
- `/logs`: summary/category filters, tenant-scoped reads, and readable traceability details are implemented; remaining improvement is browser QA.

### P1 - Code Organization

Large files to split carefully:

- `src/components/sessions/sessions-planner.tsx` (started: cards/detail panel/legend extracted and dead hidden list removed)
- `src/app/page.tsx`
- `src/components/enrollment/enrollment-wizard.tsx`
- `src/components/settings/data-import-wizard.tsx` (started: bulk import preview and status/rollback UI extracted)
- `src/components/groups/group-schedules-manager.tsx`
- `src/components/settings/schedule-templates-manager.tsx` (started: template cards, selected-template summary, and apply preview extracted)

Refactor rule:

- extract view models and presentational components first;
- keep API behavior unchanged;
- do not split purely for file size if the split hides business logic;
- prefer shared policy helpers for rules and small UI primitives for repeated layout.

Suggested component targets:

- `ReceiptDeliveryStatus`
- `SettingsTile`
- `SettingsMetric`
- `ScheduleTemplateBuilder`
- `ScheduleTemplateApplyPanel`
- `EnrollmentMemberStep`
- `EnrollmentSubscriptionStep`
- `EnrollmentPaymentStep`
- `SessionWeekColumn`
- `SessionCompactCard`

### P2 - Receipt Enhancements

Current receipt system is functional. Excellent version should add:

- optional company/tax fields in club settings;
- receipt delivery history visible from payment detail;
- email template settings;
- resend button in payment history, not only receipt page.

### P2 - Module Readiness

Future gym-management add-on should not fork the whole app. Prepare by:

- keeping member/subscription/payment/receipt primitives generic;
- keeping martial-arts-specific concepts in catalog/group policy helpers;
- adding module flags later only after the core is stable;
- avoiding route duplication such as separate "gym members" versus "dojo members" unless the domain truly differs.

## Known Verification Blocker

`npm.cmd test` currently fails before tests execute because no local PostgreSQL server is listening at `localhost:5432`.

The reset script now fails fast with:

```text
Cannot reach local test database at localhost:5432.
Start PostgreSQL for tests or set TEST_DATABASE_URL to a reachable disposable test database.
Refused to run Prisma reset for gymday_test because the database server is unavailable.
```

Recent checkpoints still passed:

- `npx.cmd prisma validate`
- `npm.cmd run lint`
- `npm.cmd run build`

Latest UI settings checkpoint:

- `/settings/users` role-intent polish passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`.
- `/settings/club` hierarchy polish passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`.
- `/settings/schedules` clarity and stale-preview safety pass passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`.
- `/settings/data-import` guidance pass passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`.
- `/logs` summary pass passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`.
- `schedule-templates-manager.tsx` UI extraction passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`.
- `data-import-wizard.tsx` bulk preview UI extraction passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`.
- `data-import-wizard.tsx` status/rollback UI extraction passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`.
- Attendance undo audit enrichment passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`.
- Receipt QR/copy-link pass passed `npm.cmd run lint`, `npm.cmd run build`, `npx.cmd prisma validate`, and `npm.cmd audit --omit=dev`.
- Payment history receipt actions pass passed `npm.cmd run lint`, `npm.cmd run build`, `npx.cmd prisma validate`, and `npm.cmd audit --omit=dev`.
- Payment receipt delivery history pass passed `npm.cmd run lint`, `npm.cmd run build`, `npx.cmd prisma validate`, and `npm.cmd audit --omit=dev`.
- Session edit audit pass passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`.
- Subscription edit audit pass passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`.
- Offer historical-meaning pass passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`.
- Attendance correction audit pass passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`.
- SaaS execution map and recovery-policy expansion passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`.
- Club receipt settings extraction passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`.
- Audit-log business label pass passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`.
- Planning generation preview pass passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`.
- Enrollment recovery visibility pass passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`.
- Data-import rollback clarity pass passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`.
- Member recovery guide pass passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`.
- Audit-log readability and tenant-scope pass passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`.
- Planning working-day hint pass passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`.
- Discipline suggestion catalog pass passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`.
- Users deactivation safety pass passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`.
- Settings tenant-scope guard pass passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`.
- Permanent session edit reason pass passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`.
- Enrollment group compatibility clarity pass passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Group setup summary pass passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Receipt settings preview pass passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Coach display helper extraction passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Member demographic safety pass passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Group policy picker pass passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`.
- Planning UI extraction passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`.
- `npm.cmd test` remains blocked by the same missing local PostgreSQL test database.

Start a disposable local PostgreSQL test database, or set `TEST_DATABASE_URL`, before relying on `npm.cmd test`.

## Browser QA Checkpoint

A read-only browser QA pass was started against the currently reachable live app and documented here:

- `docs/audits/product-readiness-browser-2026-07-05/ui-qa-notes.md`

Key result:

- Live `https://we-discipline.com/settings` returns `404`, while the current branch contains `/settings`.
- Live settings subpages still show older layouts, so the live app is behind the current branch.
- No horizontal overflow was detected in the captured live settings/admin pages at desktop `1440x900` or mobile `390x844`.
- Raw screenshots are stored locally under an ignored `screenshots/` folder to avoid committing client data.

Current-branch screenshot QA remains pending until the branch is deployed to staging/live or a local Postgres-backed runtime is available.
