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
- Initial payments created while adding a subscription now emit `PAYMENT_CREATED`, not only receipt/subscription logs.
- Payments created inside enrollment now emit `PAYMENT_CREATED` before receipt issuance for both new and reused subscriptions.
- Historical payments created during manual or Excel reprise now emit `PAYMENT_CREATED` inside the import transaction.
- Activating or deactivating temporary reprise mode now writes an admin audit entry.
- Enrollment recovery now reverses payments, voids receipts, cancels subscriptions, closes assignments, and archives newly created members where applicable.
- New enrollments now persist a recovery key and undo snapshot in the enrollment audit log. Member detail can surface recent recoverable inscriptions and void them later with a required reason when no attendance has consumed the affected rows.
- Direct member inscription now logs the created student and group assignment, not only the subscription/payment side effects.
- Catalog records for disciplines, coaches, and formulas are deactivated instead of physically deleted in normal flows.
- Group creation and group setup edits now write actor-linked audit entries with before/after snapshots for public policy, discipline, coach, room, capacity, and active state.
- Receipts are created for original payment entries and voided when the original payment is corrected or reversed.
- Group schedules are created, updated, and closed with audit trail; closing uses an end date instead of physical deletion.
- Session cancellation keeps the session row and now writes an actor-linked audit entry.
- Session edits now write actor-linked audit entries: exception edits include before/after snapshots, and permanent edits include affected future session IDs plus requested values.
- Subscription edits now require admin + reason for formula/status/value changes, block amount below paid total, and write before/after audit snapshots.
- Subscription cancellation now preserves before/after audit details.
- Offers remain create/deactivate only; active offer cards now show usage count so used discounts are treated as historical templates, not editable meanings.
- Attendance corrections now write before/after snapshots and balance delta inside the same transaction; session finalize/reopen logs include staff-facing reasons.
- Attendance undo keeps its balance adjustment and audit entry inside the same transaction.
- Member list edits now write actor-linked before/after audit snapshots, so profile corrections made outside the member detail page remain traceable.

### Receipts

- Receipt model, numbering, verification code, snapshot, and content hash exist.
- Printable receipt page exists at `/receipts/[id]`.
- Public verification exists at `/receipts/verify`.
- Receipt actions now support print, public verification, and manual email send.
- Printed/verified receipts now include a QR code pointing to public verification.
- Receipt actions now support copying the public verification link for manual sending.
- Receipt actions now support copying a ready-to-send verification message with receipt number, code, and public verification link for WhatsApp/SMS-style handoff.
- Payment history now shows compact receipt actions for each issued receipt: open receipt, resend email when a member email exists, and copy verification link.
- Payment history now shows a compact receipt delivery badge: email sent, failed, not sent, missing email, or blocked for voided receipts. Payment detail remains the full delivery trail.
- Payment correction/detail now shows the linked receipt, resend/copy actions, and the latest receipt email delivery attempts from audit logs.
- Receipt email sending uses the existing Resend email infrastructure and writes audit logs.
- Club settings now control receipt prefix, next sequence, footer, default print, and default email behavior.
- Payment creation honors `receiptEmailDefault`: if enabled and the member has an email, the receipt is sent automatically after the payment transaction commits.
- Club settings now support optional legal receipt identity fields: official receipt name and fiscal/admin identifier. New receipt snapshots preserve and render these fields, while existing receipts keep their original snapshots.

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
- `/settings/users` now includes a role guide that explains when to create Admin, Réception, or Coach accounts before touching detailed permissions.
- `/settings/club` now starts with an operational summary for club identity, working days, pointage, and receipts, with reception rules separated from the long preferences form.
- `/settings/schedules` now starts with schedule summary metrics, keeps template creation collapsed by default, shows the selected template before applying, and clears stale previews when targets or dates change.
- `/settings/schedules` now shows an `Impact prévu` safety card before applying horaires: target scope, close-vs-add behavior, session generation behavior, broad-action warning, and closed-day warning.
- `/settings/data-import` now opens with migration readiness metrics and explicit guidance about when to use reprise mode and when rollback remains safe.
- `/logs` now starts with summary metrics for useful actions, payments, presences, and system noise before the detailed audit table.
- `schedule-templates-manager.tsx` now delegates reusable schedule template cards and apply-preview UI to `schedule-template-ui.tsx`, reducing page-manager file pressure without changing behavior.
- `data-import-wizard.tsx` now delegates the bulk preview metrics/table UI to `data-import-bulk-ui.tsx`, reducing duplicated embedded table markup without changing behavior.
- `data-import-wizard.tsx` now delegates the import mode and recent rollback list UI to `data-import-status-ui.tsx`, keeping import actions in the wizard while reducing presentation markup.
- `enrollment-wizard.tsx` now delegates the post-inscription recovery panel to `enrollment-completion-panel.tsx`, keeping the traceable cancellation UI isolated from the step state machine.
- `enrollment-wizard.tsx` now delegates the student/group/formula line editor to `enrollment-line-editor.tsx`, with shared line types and compatibility helpers in `enrollment-types.ts`.
- `sessions-planner.tsx` now delegates session tiles, selected-session detail panel, legend, and session display helpers to `session-planner-ui.tsx`; a dead hidden legacy session-list block was removed.
- `src/app/page.tsx` now delegates shared dashboard panel, section header, and tone primitives to `dashboard-ui.tsx`, giving future dashboard section extractions a stable local UI module.
- `src/app/page.tsx` now delegates the today sessions and priority queue UI to `dashboard-today-panel.tsx`, keeping reception-work presentation outside the server page.
- `sessions-planner.tsx` now delegates the horaires-based session generation preview to `session-generation-panel.tsx`, continuing the controlled split of the largest planning component.
- `club-settings-form.tsx` now delegates receipt settings and receipt preview UI to `club-receipt-settings.tsx`, and shared settings toggles to `settings-toggle-row.tsx`.
- Planning session generation now uses a dry-run preview before creating sessions, shows the target/date range/active horaires/existing sessions, and writes `SESSIONS_GENERATED` audit logs after confirmed generation.
- The planning generation action is now labelled as generation from active weekly schedules, not generic manual creation, and the preview states that only missing sessions are created while existing sessions are ignored.
- Enrollment success now keeps staff on the confirmation screen, shows a direct member-profile link, and exposes the safe traced `Annuler cette inscription` recovery action with a required reason.
- Member detail now extends inscription recovery beyond the success screen: recent recoverable inscriptions are shown in `Corriger une erreur`, blocked cases explain why, and safe voids reuse the same traceable recovery endpoint.
- A broader product-readiness roadmap now exists at `docs/audits/product-readiness-roadmap-2026-07-05.md`, covering recoverability, receipts, UI/UX consistency, settings polish, group/coach/enrollment rules, and code organization.
- A master SaaS execution map now exists at `docs/audits/saas-product-execution-map-2026-07-05.md`, covering recoverability, page-by-page UX audit scope, settings redesign, receipts, group rules, planning/working days, code organization, and future gym-module strategy.
- A product-owner priority register now exists at `docs/audits/product-owner-priority-register-2026-07-05.md`, mapping the latest concerns to current code evidence, decisions, priorities, and implementation order.
- A mutation recoverability audit now exists at `docs/audits/mutation-recoverability-audit-2026-07-05.md`, mapping payment, enrollment, attendance, sessions, schedules, group assignments, data import, and catalog mutations to the recovery vocabulary.
- The mutation recoverability audit now includes a static route coverage scan that classifies the remaining no-direct-audit mutation routes as preview-only, cookie/session-only, read-state-only, or delegated to audited services.
- A screenshot-based full product UI/UX audit now exists at `docs/audits/full-product-audit-2026-07-05/ui-ux-audit.md`, with desktop/mobile evidence for dashboard, pointage, enrollment, payments, members, subscriptions, planning, groups, disciplines, formulas, offers, settings, users, logs, member detail, coaches, account, group creation, and formula creation.
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

## Latest Staging Checkpoint - 2026-07-07

- Current handoff pack: `docs/audits/product-readiness-staging-2026-07-07/`.
- Screenshot evidence remains local/ignored at `screenshots/product-readiness-staging-2026-07-06/`.
- Raw screenshot QA: 24 desktop/mobile captures, 0 detected horizontal-overflow screens, 0 application-error screens.
- Additional remaining-gap screenshot QA is stored locally/ignored at `screenshots/product-readiness-staging-2026-07-07-remaining-partials/`: 20 desktop/mobile captures across member detail, enrollment, payment, groups, group schedules, group edit, coaches, users, and data import, with 0 detected horizontal-overflow screens and 0 application-error screens.
- Server test evidence: commit `0618588`, disposable PostgreSQL database `gymday_saas_test`, 7 migrations applied, 16 test files passed, 163 tests passed.
- Additional coverage confirmed in this checkpoint: closing a club working day is rejected when future sessions or active horaires still exist on that day; planning conflict preferences prove shared-room and same-room qualified-coach cases; receipt verification proves issued receipts can be looked up by number/code, preserve legal/payment snapshot data, and become voided after payment correction or reversal; pointage policy tests prove partial-payment permission, present/absent consumption, override reason/limit, finalized-session reopen, and PATCH/create rule parity; enrollment/payment route tests prove enrollment apply with payment/group assignment, unsafe-revert blocking, overpayment rejection, exact remaining payment, ledger rows, and receipt issuance.

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
- `/settings/data-import` rollback follow-up now summarizes total/annulable/locked/already-annulled imports and links locked imports to the member profile for safe correction.
- `/settings`: hub and admin settings pages now use DB-backed auth/tenant context instead of header-only admin checks.
- `/members/[id]`: top health strip and action row exist; a correction guide now points staff to the right edit, payment, attendance, subscription, and assignment surfaces.
- `/subscriptions/[id]/edit` now shows a correction summary before the fields: already paid, proposed amount, session impact, changed-sensitive values, reason-required state, and amount-below-paid warning.
- `/logs`: summary/category filters, tenant-scoped reads, and readable traceability details are implemented; remaining improvement is browser QA.

### P1 - Code Organization

Large files to split carefully:

- `src/components/sessions/sessions-planner.tsx` (started: cards/detail panel/legend/generation preview extracted and dead hidden list removed)
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

### P1 - Current Product-Owner Focus

The latest product-owner concerns should be treated as one connected execution stream, not scattered feature requests:

- recoverability: payment, inscription, subscription, pointage, planning, import, and settings changes must either be editable safely, corrected with reason, reversed, voided, archived, or closed with audit;
- consistency: every private page needs desktop/mobile QA against the strongest existing fingerprint: dashboard, planning, payments/new, enrollment, subscriptions, receipts, and the settings hub;
- settings quality: configuration pages must explain the business effect before showing fields, especially club rules, working days, conflicts, receipts, users, schedules, imports, and logs;
- code health: split oversized managers only by stable product boundaries, and keep rules in policy helpers instead of hiding them in UI components;
- martial-arts fit: discipline suggestions stay generic, group creation should express public/gender/level/room/coach/schedule policies directly, and kids must keep parent phone as a required safety field;
- future modules: a gym-management add-on should reuse members, subscriptions, payments, receipts, attendance/check-in, schedules, notifications, and audit logs instead of duplicating the dojo app.

### P2 - Receipt Enhancements

Current receipt system is functional. Excellent version should add:

- browser QA for optional company/tax fields in club settings and printed receipt output;
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
- `/coaches` clarity pass now shows specialty rules, active groups, weekly schedule load, assignment meaning, and safer deactivation copy so coach assignment is easier to understand before planning conflicts appear.
- Receipt legal/fiscal identity field pass added DB fields and receipt snapshot/rendering support; it passed `npx.cmd prisma generate`, `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`. `npm.cmd test` remains blocked by the missing local PostgreSQL server at `localhost:5432`.
- Payment receipt delivery badge pass passed `npm.cmd run lint -- --no-cache` and `npm.cmd run build`. `npm.cmd test` remains blocked by the missing local PostgreSQL server at `localhost:5432`.
- Member-page enrollment recovery pass passed `npm.cmd run lint -- --no-cache` and `npm.cmd run build`. `npm.cmd test` remains blocked by the missing local PostgreSQL server at `localhost:5432`.
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
- Planning generation wording pass passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Owner priority register and recoverability-doc correction passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Schedule application safety-card pass passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Receipt verification message pass passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Subscription correction summary pass passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Data-import rollback visibility pass passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Users role guide pass passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Session generation panel extraction passed `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Enrollment completion panel extraction passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Enrollment line editor extraction reduced `enrollment-wizard.tsx` from 1,147 to 709 lines and passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Dashboard UI primitive extraction reduced `src/app/page.tsx` from 1,070 to 980 lines and passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Dashboard today-section extraction reduced `src/app/page.tsx` from 980 to 796 lines and passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Coach assignment clarity pass passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Group coach eligibility panel pass passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Planning conflict explanation pass passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Club settings logo tenant-safety pass fixed generated settings-row updates, tenant-specific logo filenames, and logo audit logs; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Formula create/update audit pass now logs before/after formula price, quota, validity, discipline, and active-state changes; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Discipline create/update audit pass now logs before/after discipline details and explicit tenant-linked deactivation entries; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Coach create/update audit pass now logs before/after specialties, active groups, weekly load, and active-state changes transactionally; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Direct group assignment audit pass now logs created, updated, and closed assignments with before/after details and generated subscription linkage; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Bulk group assignment audit pass now logs created/reactivated assignment IDs, requested members, skip counts, and tenant-linked close summaries; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Household audit pass now logs foyer creation and member additions to foyers with readable audit labels; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Member list edit audit pass now logs before/after profile snapshots for `MEMBER_UPDATED`; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Group create/update audit pass now logs `GROUP_CREATED` and `GROUP_UPDATED` with before/after course setup snapshots and readable log labels; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Group schedule creation audit pass now logs `GROUP_SCHEDULE_CREATED` and optional auto-generated sessions with actor-linked details; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Direct member inscription audit pass now logs `MEMBER_CREATED` and `GROUP_MEMBER_CREATED` in the legacy member-create route; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Subscription initial-payment audit pass now logs `PAYMENT_CREATED` before issuing receipts in `/api/member-subscriptions`; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Enrollment payment audit pass now logs `PAYMENT_CREATED` before receipt issuance for new subscriptions and reused active subscriptions; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Data import payment audit pass now logs `PAYMENT_CREATED` for historical payments created by manual and Excel reprise; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Data import mode audit pass now logs `DATA_IMPORT_MODE_ACTIVATED` and `DATA_IMPORT_MODE_DEACTIVATED`; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Planning hidden-duplicate cleanup removed an invisible duplicate week board and its unused grouping work from `sessions-planner.tsx`; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Planning week-board extraction moved the desktop/mobile weekly timetable layout into `session-planner-board.tsx`, keeping policy and data selection in `sessions-planner.tsx`; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Planning command-area extraction moved the week navigation, generation action, weekly summary cards, conflict alert, and view switcher into `session-planner-command.tsx`; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Planning filter-toolbar extraction moved search, group/day/status filters, reset, mobile-filter trigger, and closed-day hint into `session-planner-filters.tsx`; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Discipline manager card extraction moved repeated discipline-card UI into `sport-card.tsx` and shared readiness helpers into `sport-manager-model.ts`, reducing `sport-manager.tsx` from 660 to 471 lines while preserving the existing martial-arts suggestion catalog; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Group schedule model extraction moved day labels, date conversion, schedule status, period formatting, and empty day-selection helpers into `group-schedule-model.ts`, reducing `group-schedules-manager.tsx` from 744 to 660 lines and preparing schedule templates/group validity UI for safer reuse; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Group schedule periods extraction moved the current/future/past schedule-period display into `group-schedule-periods.tsx`, reducing `group-schedules-manager.tsx` to 566 lines while keeping active-period actions and validity display unchanged; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Payment summary panel extraction moved the sticky receipt-confirmation panel from `payment-add-form.tsx` into `payment-summary-panel.tsx`, reducing the payment form from 591 to 536 lines while keeping payment creation, undo/reversal, and receipt links unchanged; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Coach manager card extraction moved repeated coach display/edit UI into `coach-card.tsx` and specialty helper functions into `coach-manager-model.ts`, reducing `coach-manager.tsx` from 601 to 462 lines while preserving specialty selection, planning-load display, and deactivation blocking; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Member list row extraction moved repeated member-row UI into `member-row.tsx` and shared list helpers/types into `member-list-model.ts`, reducing `member-list-client.tsx` from 615 to 504 lines while preserving filters, pagination, selection, archive flow, grouped view, and mobile details; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Club settings section extraction moved identity/logo fields into `club-identity-section.tsx` and working-day/conflict rules into `club-planning-rules-section.tsx`, reducing `club-settings-form.tsx` from 526 to 395 lines while preserving settings save, blocked-day recovery, logo upload/removal, receipt settings, and pointage rules; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Payments table primitive extraction moved ledger labels/types into `payment-table-model.ts` and payment progress/status/amount UI into `payment-table-parts.tsx`, reducing `payments-table.tsx` from 543 to 406 lines while preserving filters, pagination, mobile expansion, correction/reversal wording, receipt actions, and add-payment routing; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Data import wizard extraction moved Excel bulk import UI into `data-import-bulk-section.tsx`, prevalidation summary into `data-import-preview-summary.tsx`, and shared import types/date/money helpers into `data-import-model.ts`, reducing `data-import-wizard.tsx` from 607 to 517 lines while preserving mode activation, manual reprise, Excel preview/apply, rollback, and member redirect behavior; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Schedule template create-form extraction moved reusable horaires model creation UI into `schedule-template-create-form.tsx`, reducing `schedule-templates-manager.tsx` from 550 to 512 lines while preserving template creation, slot editing, archive, target preview, future-session confirmation, and apply/generate behavior; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Enrollment quote panel extraction moved the price reasoning/payment confirmation UI into `enrollment-quote-panel.tsx` and shared `QuoteData` through `enrollment-types.ts`, reducing `enrollment-wizard.tsx` from 751 to 632 lines while preserving quote fetch, prefilled payments, warning/block display, partial-payment input, submit, and recovery flow; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Group member affectation panel extraction moved available-member and assigned-member list UI into `group-member-available-panel.tsx` and `group-member-assigned-panel.tsx`, reducing `group-members-manager.tsx` from 507 to 386 lines while preserving compatibility filtering, bulk assign, bulk close/removal, status toggle, confirmations, and searches; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Planning edit modal extraction moved session edit/reason/coach-override UI into `session-edit-modal.tsx`, reducing `sessions-planner.tsx` from 1106 to 911 lines while preserving edit payload building, permanent/exception behavior, attendance locks, undo history, conflict guards, and save routing; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Dashboard cash/model extraction moved caisse panels into `dashboard-cash-panels.tsx` and shared payment/member trend helpers into `dashboard-model.ts`, reducing `src/app/page.tsx` from 850 to 575 lines while preserving dashboard queries, cash totals, trend chart, method breakdown, priority items, member overview, and debt section; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Active offers list extraction moved the searchable/paginated active-offer list into `offers-active-list.tsx`, reducing `offers-manager.tsx` from 497 to 435 lines while preserving offer search, pagination, creation shortcut, deactivate confirmation, and usage-history copy; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Product readiness masterplan and receipt visibility pass documented the full product-owner backlog in `saas-product-readiness-masterplan-2026-07-05.md` and surfaced latest receipt delivery state on payment history overview rows/cards without changing data or APIs; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Subscription correction visibility pass renamed subscription edit entry points from generic modify/view language to correction language, clarified the edit-page header, and changed cancellation/submit copy to `Préparer résiliation` and `Enregistrer la correction` without changing subscription rules or APIs; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Users settings filter pass added search plus Admin/Réception/Coach and active/deactivated filters to the users list so admin settings scale beyond a raw account stack while preserving existing user create/edit/deactivation behavior; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Catalog configuration tenant-read pass added explicit tenant-scoped reads for disciplines, coachs, groupes, formules, and the shared discipline overview helper/API so core configuration pages are safer for SaaS/module reuse even though the Prisma tenant extension already guards them; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Payment correction detail tenant-read pass added explicit tenant-scoped lookup for the payment being corrected, receipt delivery logs, and log actor names so money correction/reversal views stay bounded to the current tenant even when reused outside the app layout context; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Payment history/setup tenant-read pass added explicit tenant scoping to the ledger history, receipt delivery status lookup, active subscription options for new payments, and nested payment sums used to calculate payable balances; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Subscription sales tenant-read pass added explicit tenant-scoped reads for subscription list rows, renewal member/plan options, subscription correction details, and nested payment sums used to enforce paid-total correction limits; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Dashboard tenant-read pass added explicit tenant scoping to member counts, session counts, cash trends, active subscription finance/debt calculations, today/finalization session reads, nested group-member/attendance reads, and recent-member previews; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Member hub tenant-read pass added explicit tenant scoping to the member list, member detail dossier, active group/subscription/payment/attendance nested reads, enrollment recovery lookup, and add-to-group member/group/plan options; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Attendance pointage tenant-read pass added explicit tenant scoping to today's pointage session reads, expected member filters, attendance rows, subscription/payment eligibility reads, and the session attendance detail/operator lookup; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Attendance reports tenant-read pass added explicit tenant scoping to attendance history rows, operator lookups, group report filters, report session reads, expected member filters, and report attendance summaries; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Planning tenant-read pass added explicit tenant scoping to weekly session reads, expected-member/attendance rows, group and coach filter options, coach qualifications, and the postpone redirect lookup; it also counts attendance from tenant-filtered rows; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Group setup tenant-read pass added explicit tenant scoping to group creation options, group edit details/options, active member lists, coach qualifications, and group schedule pages so course policy/setup data stays tenant-bounded before planning conflicts are evaluated; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Formula/offer setup tenant-read pass added private-page guards and explicit tenant scoping to formula edit lookup and offer discipline options while keeping create/edit behavior and API calls unchanged; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Private receipt tenant-read pass added an authenticated tenant-scoped lookup for printable receipt detail pages while leaving public number+code receipt verification intentionally code-based; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Receipt email tenant-boundary pass made receipt email delivery require the actor tenant id, scope receipt lookup by that tenant, and record the tenant context in delivery audit details; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Attendance API tenant-boundary pass made pointage list/create/correction/delete reads explicitly tenant-scoped, scoped override counts and balance decrements to the actor tenant, and added tenant context to attendance audit logs; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Attendance finalization tenant-boundary pass made session finalize/reopen lookup and completion-log lookup explicitly tenant-scoped, and added tenant context to completion/reopen audit logs; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Group assignment API tenant-boundary pass made direct and bulk affectation list/create/reactivate/close paths explicitly tenant-scoped, including candidate members, active subscription checks, created subscriptions, created assignments, and close audit details; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Member subscription API tenant-boundary pass made subscription list/create/correction/cancel reads explicitly tenant-scoped, carried tenant id through the shared subscription creation helper, and added tenant context to initial payment, receipt, subscription update, and cancellation audit logs; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Payments API tenant-boundary pass made payment history, payment creation, correction, reversal, receipt issuance logs, and void logs explicitly tenant-scoped, including created ledger rows and audit detail payloads; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Receipt issuance helper tenant-boundary pass made receipt issue/void helpers accept tenant id, scope receipt/payment/settings lookups and receipt creation by tenant, and passed tenant context from payments, subscriptions, enrollment, enrollment rollback, and direct member inscription callers; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Enrollment API tenant-boundary pass made enrollment apply member/plan/group/subscription/offer reads explicitly tenant-scoped, added tenant context to enrollment payment/log details, and scoped enrollment recovery blocked checks plus rollback updates/reversals to the current tenant; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Session edit/postpone tenant-boundary pass made session detail, edit, cancel, recurring-edit, postpone, and attendance-lock reads explicitly tenant-scoped, added tenant context to session audit rows, and made shared session attendance guards accept tenant id; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Session generation tenant-boundary pass made `/api/sessions` list and generation reads explicitly tenant-scoped, carried tenant id into generated session candidates/createMany rows, and added tenant context to generation audit logs; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Group schedules API tenant-boundary pass made group schedule list/create/update/close reads and auto-generated sessions explicitly tenant-scoped, added tenant id to new schedules and generated sessions, and added tenant context to schedule/generation audit logs; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Schedule template API tenant-boundary pass made reusable horaires template list/edit/archive/apply reads explicitly tenant-scoped, scoped slot replacement and target-group/future-session counts, and added tenant context to template audit logs; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Catalog API relation-safety pass made offers, disciplines, and formulas explicitly tenant-scoped, added tenant context to offer audit logs, and blocked formula/offer creation from linking to another tenant's discipline by guessed ID; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Coach/group API relation-safety pass made coach and group lists explicitly tenant-scoped, blocked group/coach specialty links to another tenant's disciplines/coaches, scoped future-session propagation, and added tenant context to group audit logs; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Member detail API tenant-boundary pass made member detail/archive/edit, member memberships, and applicable-offer context reads explicitly tenant-scoped, scoped related membership/archive updates, and carried tenant context through member offer suggestions and member audit logs; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Direct member API tenant-boundary pass made member list/search, legacy direct inscription, profile correction, and archive flows explicitly tenant-scoped, blocked direct inscription from linking to another tenant's group/formula, scoped capacity/payment/subscription reads, and added tenant context to direct-inscription/member audit logs; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Household/user API tenant-boundary pass made family household lookups/create/add-member and admin user listing explicitly tenant-scoped, verifies members/households before family linking, and adds tenant context to household/user audit details; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Audit log enrichment tenant-boundary pass made log detail/list enrichment resolve members, subscriptions, payments, attendance, sessions, offers, and users inside the current tenant, and passes tenant context from both log pages; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Data import rollback tenant-boundary pass made reprise inspection, capacity checks, rollback eligibility, and rollback cleanup explicitly tenant-scoped, including group/formula/session reads and attendance/payment/assignment/subscription/member deletion filters; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Bulk data import tenant-boundary pass made Excel/CSV group and formula name resolution explicitly tenant-scoped before preview/apply validation, preventing a future SaaS workspace from matching another club's catalogue by name; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Enrollment and assignment policy tenant-boundary pass made shared schedule, capacity, conflict, subscription, quote, offer, and household helpers explicitly tenant-scoped so future routes/modules cannot reuse them against another club's data by guessed IDs; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Attendance, planning conflict, and reminder helper tenant-boundary pass made coach qualification, session conflict, weekly-standard, attendance balance, recovery/rattrapage candidate, active-member, debt reminder, and reminder-audit helpers explicitly tenant-scoped; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- App-shell/settings tenant-boundary pass made notifications, navigation badges, setup guide progress, working-day closure blockers, and club-settings update/audit paths explicitly tenant-scoped, including nested group-member reads for attendance badge counts; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Auth/account write-safety tenant-boundary pass made password reset token creation/invalidation/completion, self-account updates, and admin user updates bind writes to the current tenant before refetching tenant-scoped response data; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Money foundation helper tenant-boundary pass made subscription carry-over expiry writes, ledger totals/effective-payment calculations, receipt sequence increments, receipt final snapshot updates, receipt voiding, payment correction/reversal totals, and enrollment undo reversals bind to tenant context where available; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Member/group nested-count tenant-boundary pass made active group memberships and group active-member counts explicitly tenant-scoped in member detail and group APIs, keeping profile compatibility checks and capacity displays bounded to the current club; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Planning grouped-section extraction moved the non-week planning section cards into `session-planner-grouped-sections.tsx`, reducing `sessions-planner.tsx` to 801 lines while preserving grouped coach/room/day layouts, conflict badges, and session actions; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Attendance audit-detail extraction moved pointage created/updated/deleted log-detail builders into `attendance-audit-details.ts`, keeping attendance route policy and mutation behavior unchanged while making recovery/audit payloads easier to review and extend; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Payment subscription selector extraction moved the debt/member/abonnement selection UI from `payment-add-form.tsx` into `payment-subscription-selector.tsx`, reducing the payment form to 474 lines while preserving mobile amount guidance, billing summary, submit, undo, and receipt behavior; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Payment amount section extraction moved amount entry, quick amount buttons, maximum-balance validation copy, and balance-after feedback into `payment-amount-section.tsx`, reducing `payment-add-form.tsx` to 421 lines while preserving payment submit, undo, receipt, method, and summary behavior; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Planning week-model extraction moved working-day visibility, hidden closed-day detection, day session grouping, day stats, and active mobile-day selection into `session-planner-week-model.ts`, keeping the visible planning UI behavior unchanged while making the configurable working-days logic easier to test and reuse; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Club settings section extraction moved pointage/payment rules into `club-checkin-rules-section.tsx` and debt/discount controls into `club-alerts-section.tsx`, reducing `club-settings-form.tsx` to 335 lines while preserving the existing settings save payload and validation behavior; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Data import attendance extraction moved reprise paper-attendance selection into `data-import-attendance-section.tsx`, reducing `data-import-wizard.tsx` to 491 lines while preserving manual import preview/apply, rollback, bulk import, and attendance status payload behavior; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Data import member identity extraction moved the manual reprise member identity/adult-kid/gender/parent-phone section into `data-import-member-section.tsx`, reducing `data-import-wizard.tsx` to 453 lines while preserving the existing payload, preview invalidation, and kid parent-phone requirement; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Data import current-state extraction moved group/formula/date/money/note reprise fields into `data-import-current-state-section.tsx`, reducing `data-import-wizard.tsx` to 443 lines while preserving group/plan selection side effects, preview invalidation, and manual import payload behavior; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Schedule template library extraction moved horaires-template creation/list/selection/archive display into `schedule-template-library-panel.tsx`, reducing `schedule-templates-manager.tsx` to 483 lines while preserving template creation, selection preview reset, and archive behavior; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Schedule template apply-panel extraction moved the seasonal application target/preview/confirmation UI into `schedule-template-apply-panel.tsx`, reducing `schedule-templates-manager.tsx` to 305 lines while preserving target selection, safety preview, generation options, and apply behavior; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Planning derived-model extraction moved session filtering, week summary counts, recommended-session selection, grouped planning sections, and shared date helpers into `session-planner-derived-model.ts`, reducing `sessions-planner.tsx` to 729 lines while preserving planning cards, generation preview, selected-session panel, and conflict behavior; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Group schedule panel extraction moved per-horaire editing and new-period form presentation into `group-schedule-edit-panel.tsx` and `group-schedule-new-period-form.tsx`, reducing `group-schedules-manager.tsx` to 356 lines while preserving add/update/close/delete API behavior, auto-generation choices, and recovery wording; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Enrollment chrome extraction moved the three-step indicator and sticky inscription summary into `enrollment-stepper.tsx` and `enrollment-summary-sidebar.tsx`, reducing `enrollment-wizard.tsx` to 526 lines while preserving adult/kid/gender/parent-phone validation, quote calculation, payment prefill, and recovery behavior; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Attendance route-helper extraction moved override counting, attendance-id payload parsing, policy failure responses, and Prisma error-code checks into `attendance-route-helpers.ts`, reducing `src/app/api/attendances/route.ts` to 701 lines while preserving pointage create/update/delete rules, balance adjustments, and audit behavior; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Member list view-model extraction moved member filtering, grouping, pagination, and active-filter counting into `member-list-model.ts`, reducing `member-list-client.tsx` to 458 lines while preserving search, desktop/mobile filters, grouped view, bulk archive, selection, and pagination behavior; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Member route-helper extraction moved member audit select/snapshot helpers plus member-id payload parsing and Prisma error-code checks into `member-audit.ts` and `member-route-helpers.ts`, reducing `src/app/api/members/route.ts` to 609 lines while preserving list/search, direct inscription, profile update, archive/cancel behavior, receipt issuance, and audit logs; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Session route-helper extraction moved session time calculation, response payload shaping, audit snapshots/changed-field detection, and Prisma error-code checks into `session-route-helpers.ts`, reducing `src/app/api/sessions/[id]/route.ts` to 610 lines while preserving one-off edits, permanent recurring edits, conflict checks, coach-specialty overrides, cancellations, and audit logs; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Group route-helper extraction moved group DTO shaping, audit snapshots, weekday DTO typing, and shared `groupId` request parsing into `group-route-helpers.ts`, reducing `src/app/api/groups/route.ts` to 518 lines while preserving create/update/deactivate behavior, demographic compatibility checks, coach-specialty overrides, future-session coach propagation, and audit logs; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Session time-helper consolidation reused `addMinutesToTime` from `session-route-helpers.ts` in session generation and postponement routes, removing duplicate time math while preserving generated session end times and postponed-session duration behavior; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Schedule-template apply extraction moved target-group filtering, closed-working-day warnings, and apply-preview summary construction into `schedule-template-apply.ts`, reducing `src/app/api/schedule-templates/[id]/apply/route.ts` to 184 lines while preserving dry-run, future-session confirmation, schedule closing/creation, generation suggestion, and audit behavior; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Planning mobile-filter extraction moved the mobile planning filter sheet into `session-planner-filters.tsx`, reducing `sessions-planner.tsx` to 791 lines while preserving group/day/status filters, reset behavior, result counts, and mobile filter actions; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; `npm.cmd test` remains blocked by missing local PostgreSQL before test execution.
- Enrollment recovery entry-point pass added subscription-based recovery candidate lookup and surfaced the existing traceable inscription cancellation panel on subscription correction and payment correction pages, so staff can recover a full recent unused inscription from member, subscription, or payment contexts without adding a new undo path; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; local `npm.cmd test` was skipped per delivery instruction because the known local PostgreSQL test database is unavailable and server/staging remains the target for runtime testing.
- Receipt settings trust-copy pass improved `/settings/club` receipt wording and added an explicit trust/impact block explaining immutable receipt snapshots, future-only setting effects, manual sequence changes, and email delivery trace behavior; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; local `npm.cmd test` was skipped per delivery instruction because server/staging is the runtime test target.
- Receipt verification/voiding regression pass added server proof that a receipt is issued with the configured prefix/sequence, public number/code lookup finds the receipt, legal identity and payment snapshot details are preserved, and correction/reversal voids the affected receipt with actor-linked audit logs; it passed `npm.cmd run lint -- --no-cache`, `npx.cmd prisma validate`, and the VPS disposable PostgreSQL suite at commit `0618588` with 16 test files and 163 tests passing.
- Recovery label audit pass changed the enrollment draft-line action from `Supprimer cette ligne` to `Retirer cette ligne`, keeping destructive/recovery vocabulary focused on saved business records while preserving draft editing behavior; it passed `npx.cmd prisma validate`, `npm.cmd run lint -- --no-cache`, and `npm.cmd run build`; local `npm.cmd test` was skipped per delivery instruction.
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

## Staging Runtime Checkpoint

The SaaS staging stack at `/opt/we-discipline-saas-staging` is now on `codex/phase3-multitenant-saas` commit `dc786b4`.

- `dojo-saas-postgres-staging` is healthy.
- `dojo-saas-staging` is running on `127.0.0.1:3002`.
- Prisma migration `20260705130000_receipt_legal_fields` applied successfully on staging.
- The app started with `next start`.
- Smoke checks: `/login` returns `200`; unauthenticated `/settings/club`, `/payments`, and `/subscriptions` redirect to `/login`.

Authenticated browser QA on staging is still pending.

## Authenticated Staging QA Checkpoint

The staging stack was updated to commit `51f2692` and authenticated QA was run through the local tunnel at `http://127.0.0.1:3002`.

- Added `AUTH_COOKIE_SECURE=false` support for the private staging compose stack so production-mode staging can be tested over the internal HTTP tunnel. Production remains secure by default unless this env var is explicitly overridden.
- Fixed `/api/setup-guide` by passing the authenticated tenant id into setup progress calculations; authenticated shell probes now return `200` for `/api/account`, `/api/notifications`, `/api/setup-guide`, `/api/navigation-badges`, and `/api/club-settings`.
- Fixed dashboard degraded mode by passing the authenticated tenant id into dashboard settings and payment-reminder enrichment helpers.
- Verified authenticated `/` returns `200` without degraded-mode copy or `TENANT_CONTEXT_REQUIRED`.
- Fresh staging logs after the final deploy show app start/migration output only; no tenant-context runtime error was reproduced.
- Captured current-branch screenshots at desktop `1440x900` and mobile `390x844` for: `/`, `/members`, `/subscriptions`, `/sessions`, `/payments/new`, `/enrollment`, `/settings`, `/settings/club`, `/settings/schedules`, `/settings/users`, `/settings/data-import`, and `/logs`.
- Screenshot automation recorded `0` horizontal-overflow or application-error flags across 24 captures.

Raw screenshots and `qa-results.json` are stored locally under ignored folder `screenshots/product-readiness-staging-2026-07-06/` to avoid committing client data.

## Server Test Checkpoint

The local PostgreSQL blocker was bypassed safely by running tests on the VPS against the separate disposable database `gymday_saas_test`, not the staging data database.

- Reset `gymday_saas_test` with `prisma migrate reset --force --skip-seed` from a throwaway container.
- Applied all seven PostgreSQL migrations successfully.
- Fixed stale test cleanup/fixtures after the receipt, demographic, soft-deactivation, and enrollment-recovery changes:
  - scenario cleanup deletes receipts before payments;
  - tests force `NODE_ENV=test` even when run from the production-like staging image;
  - import fixtures include gender and kid/adult-compatible groups;
  - catalog delete expectations assert soft deactivation;
  - enrollment recovery tests provide a reason and expect assignments to close instead of disappear.
- Latest result: `16` test files passed, `163` tests passed at commit `0618588`.

This test run did not reset or mutate `gymday_saas_staging`.
