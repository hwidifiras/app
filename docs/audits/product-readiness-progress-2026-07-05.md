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
- Attendance undo keeps its balance adjustment and audit entry inside the same transaction.

### Receipts

- Receipt model, numbering, verification code, snapshot, and content hash exist.
- Printable receipt page exists at `/receipts/[id]`.
- Public verification exists at `/receipts/verify`.
- Receipt actions now support print, public verification, and manual email send.
- Receipt email sending uses the existing Resend email infrastructure and writes audit logs.
- Club settings now control receipt prefix, next sequence, footer, default print, and default email behavior.
- Payment creation honors `receiptEmailDefault`: if enabled and the member has an email, the receipt is sent automatically after the payment transaction commits.

### Martial-Arts Product Fit

- Discipline creation includes common martial-arts suggestions.
- Members now have gender.
- Groups now support kids, adults, mixed age, male-only, female-only, and mixed gender policies.
- Enrollment and group assignment enforce group/member compatibility.
- Parent phone is required for kids during new enrollment.

### UI/UX Consistency

- Dashboard, planning, payments, enrollment, subscriptions, and receipt flows use the current SaaS visual fingerprint.
- A settings configuration hub now exists at `/settings`.
- Admin users see the configuration hub, club rules, schedules, formulas, offers, import, users, and logs.
- Non-admin users see only account settings in the configuration drawer, reducing sidebar confusion.

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

- attendance corrections after finalization;
- session edit audit coverage beyond cancellation;
- group schedule generation preview and future-session effects;
- subscription edit/cancel with existing payments and assignments;
- offer edits after use;
- data import rollback boundaries.

### P1 - Settings And Configuration Polish

The new `/settings` hub is the entry point. Next UI pass should make these pages match it:

- `/settings/club`: split long form into clearer cards for identity, pointage, planning conflicts, receipts, and alerts.
- `/settings/schedules`: improve templates with stronger preview, selected target summary, and safer apply confirmation.
- `/settings/users`: show role intent first, with clearer permission groups.
- `/settings/data-import`: make import steps more visual and make rollback limits explicit.
- `/logs`: keep business actions first and system noise visually secondary.

### P1 - Code Organization

Large files to split carefully:

- `src/components/sessions/sessions-planner.tsx`
- `src/app/page.tsx`
- `src/components/enrollment/enrollment-wizard.tsx`
- `src/components/settings/data-import-wizard.tsx`
- `src/components/groups/group-schedules-manager.tsx`
- `src/components/settings/schedule-templates-manager.tsx`

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

- QR code pointing to public verification;
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

Start a disposable local PostgreSQL test database, or set `TEST_DATABASE_URL`, before relying on `npm.cmd test`.
