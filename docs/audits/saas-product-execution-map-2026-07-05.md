# SaaS Product Execution Map - 2026-07-05

## Purpose

This document converts the latest product concerns into a clear implementation map for a sellable dojo / martial-arts SaaS.

The direction is not "add every idea immediately." The direction is:

- protect the client from human mistakes;
- make every money, inscription, pointage, planning, and settings action recoverable or traceable;
- keep the UI consistent on desktop and mobile;
- make settings feel professional, not raw technical forms;
- keep the codebase modular enough for future add-ons such as gym management.

## 1. Recoverable Actions

### Principle

No important business action should be a dead end.

That does not mean every row should be freely editable. It means each domain needs the right recovery behavior:

| Business area | Best recovery model | Why |
| --- | --- | --- |
| Payment | correction or reversal ledger row | Money history must never be rewritten silently. |
| Receipt | void old receipt and issue/verify official snapshot | A receipt is an official document. |
| Inscription | void/recover enrollment, reverse payment, cancel subscription, close group assignment | One user mistake can create several linked records. |
| Member profile | edit safe fields, archive instead of delete | Profile details can be corrected, history should remain. |
| Subscription | admin correction with reason, cancellation instead of delete | Affects payments, pointage eligibility, and debt. |
| Pointage | correction with before/after and balance delta | Session count is business-sensitive. |
| Session/planning | cancel/postpone/correct with audit; block changes after pointage unless reopened | Planning affects attendance and coach/room conflicts. |
| Import | rollback only while rows have no later business activity | Bulk mistakes should be reversible but not after real use. |
| Catalog/config | deactivate/archive, not physical delete after use | Keeps historical meaning stable. |

### Current Codebase Status

Strong foundation already exists:

- payment ledger entries for payment/correction/reversal;
- receipt numbering, verification code, content hash, print page, QR, email send, voiding;
- enrollment recovery flow;
- member archive;
- subscription edit/cancel safeguards;
- group assignment close;
- group schedule close;
- session cancel/postpone/edit audit;
- attendance correction audit;
- data import rollback guards;
- working-day closure blocking when sessions/schedules exist.

Remaining risk:

- attendance delete still physically removes the attendance row, even though audit now preserves the previous state. Excellent version needs append-only attendance state or a voided/corrected row model.
- session permanent edits should ask for a staff reason when they affect future sessions.
- enrollment recovery should be more visible from member/subscription/payment context.
- import rollback UI should show which imported rows are still reversible and which are locked by business history.

## 2. UI/UX Audit Coverage

### Best UI Fingerprint Already Established

Use these pages as the visual reference:

- dashboard command center;
- compact planning cards;
- payments/new trust wording;
- enrollment quote/payment guidance;
- subscriptions operational tabs;
- receipt actions;
- settings hub.

Fingerprint:

- light SaaS workspace background;
- white operational surfaces;
- compact 8px-style radius;
- restrained shadows;
- blue for navigation and main actions;
- green/amber/red only for business status;
- short French operational labels: `Pointer`, `Encaisser`, `Inscrire`, `Finaliser`, `Archiver`;
- first viewport answers "what needs action now?";
- mobile pages use cards/agenda layouts, not tiny desktop tables.

### Pages To Audit Desktop And Mobile

Capture `1440x900` and `390x844` before deeper UI changes:

| Page | Audit goal | Current priority |
| --- | --- | --- |
| `/` | command center, money, today, priorities | P1 |
| `/attendance/today` | pointage clarity, unpaid/exception copy, undo | P0 |
| `/enrollment` | kid/adult/gender/group clarity, quote, payment | P0 |
| `/payments/new` | amount visibility, receipt trust, partial/advance payment | P0 |
| `/payments` | ledger readability, corrections/reversals, receipts | P1 |
| `/members` | search/list mobile cards, primary action | P1 |
| `/members/[id]` | health strip, next action, edit/recover entry points | P1 |
| `/subscriptions` | debt/renewal command view, no overflow | P1 |
| `/sessions` | weekly planning, working days, conflict drill-down | P0 |
| `/groups` | group policy clarity, coach/salle/schedule overview | P0 |
| `/coaches` | specialties, availability, conflict expectations | P1 |
| `/sports` | common martial arts suggestions, active/inactive clarity | P1 |
| `/subscription-plans` | formula creation guidance, schedule availability warning | P1 |
| `/offers` | active offers first, used offer meaning, templates | P1 |
| `/settings` | admin command hub | P0 |
| `/settings/club` | working days, pointage, receipts, conflicts | P0 |
| `/settings/schedules` | templates, apply preview, target groups | P0 |
| `/settings/data-import` | rollback boundaries, template help | P1 |
| `/settings/users` | role intent and deactivation safety | P1 |
| `/logs` | useful actions first, system noise lower | P1 |

### Known UI Risks To Hunt

- broad buttons that do not explain impact, especially `Creer seances`;
- empty non-working days wasting planning space;
- conflict badges causing anxiety before the user opens the details;
- duplicated buttons for the same intent;
- disabled submit buttons appearing before the required mobile field;
- settings pages that begin with fields instead of operational summary;
- data tables still requiring horizontal scroll on desktop.

## 3. Settings And Configuration Redesign

Settings must teach the admin what the rule means.

Every settings/config page should have:

- one-sentence operational purpose;
- summary metrics/cards;
- business impact copy;
- one clear primary action;
- preview before bulk/broad changes;
- danger zone separated from normal fields;
- audit trail for business-changing settings.

### Settings Targets

| Page | Target |
| --- | --- |
| Club | identity, working days, conflicts, pointage, receipts, fiscal info, receipt preview |
| Schedules | reusable templates, apply to selected groups/all groups, preview future sessions, conflict report |
| Users | role intent: Admin, Reception, Coach; deactivation warning; reset password clarity |
| Data import | import templates, validation preview, rollback state, locked row explanation |
| Logs | business actions first, filters by payment/pointage/inscription/settings/system |

## 4. Receipt System

### Product Goal

The receipt should be hard to imitate and easy to verify.

It cannot be mathematically impossible to fake a PDF screenshot, but it can be operationally trustworthy:

- unique receipt number;
- verification code;
- public verification page;
- QR link to verification;
- immutable snapshot;
- content hash;
- voided receipts clearly invalid;
- email/print delivery logged.

### Next Enhancements

P1:

- receipt preview inside club settings;
- visible delivery status from payment and receipt screens;
- WhatsApp-friendly copy verification link;
- receipt footer/company fields.

P2:

- configurable receipt template blocks;
- per-tenant receipt branding once SaaS tenant settings are fully active;
- export receipt register for accountant use.

## 5. Martial-Arts Product Fit

### Disciplines

Creating disciplines should support:

- suggested common martial arts;
- free text;
- no forced first-client list;
- active/inactive state;
- future template seed by tenant type.

### Members And Inscription

Rules to make the product feel correct:

- every member has gender selected during inscription;
- `kid` requires parent phone;
- member type/gender should be visible in group compatibility;
- selected group must explain why a member is not compatible;
- parent/household should become the natural place for family offers.

### Groups

Group creation should not encode business rules only in the group name.

The form should ask:

- discipline;
- public: kids, adults, mixed, or custom age range;
- gender policy: male, female, mixed;
- level: beginner, intermediate, advanced, competition, open;
- room;
- capacity;
- default coach or coach pool;
- default schedule template.

Current code already has `groupType` and `genderPolicy`. Age range, level, and coach pool are future schema/features.

### Coach Assignment

Coach assignment must be obvious:

- coach specialties come from qualifications;
- a group has a default coach today;
- concurrent coach conflicts can be relaxed by settings only when same room and specialties match;
- conflict details should appear in drill-down/selected session, not scare the user on every collapsed card.

## 6. Planning And Working Days

### Target Model

Planning should be driven by:

1. club working days;
2. schedule templates;
3. group-specific active schedules;
4. generated sessions;
5. exceptions/cancellations/postponements.

### Important Safety Rule

If an admin unchecks a working day that still has future sessions or active schedules, the app must block and list the blockers. The current API already does this.

### Next UX

- hide non-working empty days from planning;
- show a compact "closed days hidden" hint;
- never hide a day with existing sessions;
- make `Creer seances` explain the date range and number of sessions before generation;
- move conflict reasons to the selected/expanded state;
- make weekly cards shorter and expandable by default.

## 7. Code Organization Strategy

### What To Keep

- existing routes and domain flows;
- shared policy helpers for attendance, assignment, session conflicts, billing, receipts, offers, demographics;
- central money formatter;
- append-only payment ledger;
- audit-first mutation style;
- current UI primitives: page header, card, table, badges, forms.

### What To Avoid

- more logic inside already-large client components;
- page-local money/date/status formatters;
- embedded duplicated tables/cards inside managers;
- broad destructive buttons without preview;
- adding a gym module by copying the whole dojo module.

### Files Under Pressure

| File | Why it matters | Refactor direction |
| --- | --- | --- |
| `src/components/sessions/sessions-planner.tsx` | planning manager is still the largest operational component | split week/day sections, filters, generation panel, and view models |
| `src/app/page.tsx` | dashboard mixes data shaping and UI | extract dashboard view model and server sections |
| `src/components/enrollment/enrollment-wizard.tsx` | many steps, quote rules, and payment logic | split member, group, quote, and payment step components |
| `src/components/groups/group-schedules-manager.tsx` | schedule form, preview, generation, and list in one file | split rows, editor, preview, safe-generation copy |
| `src/components/sports/sport-manager.tsx` | discipline catalog suggestions and admin UI in one file | split suggestions, active list, inactive list, form |
| `src/components/coaches/coach-manager.tsx` | specialties and CRUD mixed together | split coach form, specialties editor, coach cards |
| `src/components/settings/club-settings-form.tsx` | club identity, rules, receipts, working days in one file | split identity, planning rules, pointage rules, receipt settings |

### Refactor Rule

Extract presentation and view-model helpers first. Do not move business behavior casually.

Good split:

- same props in, same UI out;
- tests/lint/build still pass;
- file gets easier to read;
- no route/API/schema change.

Bad split:

- hides business logic behind generic components;
- breaks form state across too many files;
- creates abstractions before a second page needs them.

## 8. Future Gym Module Strategy

Do not create a separate copied app.

Build future modules on shared primitives:

- member;
- household;
- subscription;
- payment;
- receipt;
- attendance/check-in;
- schedule/session;
- notification;
- audit log.

Martial-arts-specific concepts should stay in domain helpers:

- discipline catalog;
- group level/public/gender policy;
- coach sport qualifications;
- pointage/session consumption rules.

Gym add-on can later introduce:

- equipment/machine reservations;
- personal training sessions;
- body measurements/progress;
- membership access scans;
- gym-specific plans.

But it should reuse payments, receipts, members, attendance, and audit.

## 9. Priority Execution List

### P0 - Safety And Clarity Before More Features

1. Finish recoverability map against all mutation routes.
2. Make payment, subscription, pointage, session, and enrollment correction paths visible in UI.
3. Keep receipt verification/print/send reliable and configurable.
4. Improve planning generation and working-day UX.
5. Audit `/attendance/today`, `/enrollment`, `/payments/new`, `/sessions`, `/groups`, and `/settings/club` desktop/mobile.

### P1 - Make The App Feel Consistent And Sellable

1. Full desktop/mobile screenshot audit for all private pages.
2. Settings/config redesign pass.
3. Group creation language pass: public, gender, level, room, coach, schedule.
4. Member detail next-action pass.
5. Subscriptions renewal/debt command pass.
6. Logs detail readability.

### P2 - Code Health For Upcoming Modules

1. Split the largest manager files.
2. Move repeated display logic into shared components/helpers.
3. Build a page pattern guide in code from the strongest pages.
4. Add tests around policy helpers once local PostgreSQL test DB is available.

### P3 - New Product Modules

1. Receipt template customization.
2. More household/family offer automation.
3. Gym module prototype using shared primitives.
4. Tenant-level module flags.

## 10. Commit And Verification Standard

Each implementation chunk should:

1. stay small enough to review;
2. preserve existing routes and business behavior unless the task is explicitly a behavior fix;
3. run `npm.cmd run lint`;
4. run `npm.cmd run build`;
5. run `npx.cmd prisma validate`;
6. run `npm.cmd test` when local PostgreSQL is reachable;
7. commit with `hwidifiras <hwidifiras@gmail.com>`;
8. push the current branch.

Current known blocker:

- local `npm.cmd test` is blocked until PostgreSQL is reachable at `localhost:5432` or `TEST_DATABASE_URL` is set.
