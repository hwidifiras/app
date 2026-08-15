# SaaS UX Excellence Implementation Plan

Date: 2026-07-11
Product: We Discipline / All in Gym
Goal: make the app feel simple, trustworthy, and attractive for martial arts club owners, reception staff, and coaches without overbuilding modules too early.

## Current Judgement

The product is usable and close to first-client handoff quality, but it is not yet at the "obvious and effortless SaaS" level.

Current strengths:

- Strong operational foundation: members, groups, schedules, pointage, subscriptions, payments, receipts, settings.
- Visual system is much more coherent than earlier versions.
- Dashboard is now closer to a daily command center.
- Payment ledger and receipt trust foundations already exist.
- SaaS tenant architecture exists on the current Postgres stack.

Current UX risk:

- The app can still feel like a powerful back-office tool instead of a calm guided SaaS.
- Settings and setup still expose too much admin complexity.
- New clients may not understand the correct setup order without help.
- Some modules are technically strong but not yet presented in the clearest business language.

Product direction:

- Do not add many new modules immediately.
- First make the existing core feel safer, guided, and easier.
- Then add only the modules that help sell to martial arts clubs: onboarding/import, receipt trust, coach attendance, family/household flow, and later grades/belts.

## Product Principles

1. The first screen should answer "What do I do now?"
2. A new club should never feel lost during setup.
3. Money, receipts, pointage, and member history must feel recoverable and traceable.
4. Configuration should explain business impact before changing rules.
5. Reception users need fewer choices than owners/admins.
6. Coaches need a different, simpler daily view.
7. Future modules must reuse shared UI/policy components, not create parallel apps inside the app.

## Phase 0 - Already Started

Status: partially implemented and deployed.

Completed direction:

- Dashboard reordered toward daily work.
- `Séances du jour` and `Caisse aujourd'hui` moved up.
- Commercial analytics moved lower.
- All-zero commercial state simplified.
- `Données à vérifier` warning introduced for suspicious dashboard data.
- Mobile setup guide reduced in the top bar on narrow phones.

Remaining checks:

- Browser QA after deploy at desktop and mobile.
- Confirm whether real client data triggers helpful warnings without feeling alarming.
- Confirm dashboard still feels balanced when real payments, members, debts, and sessions exist.

## Phase 1 - Dashboard Modes And Preferences

Goal: make the dashboard excellent for different users without duplicating pages.

### 1. Reception Mode

Default for reception accounts.

First fold:

- Today's sessions.
- Pointage/finalization actions.
- Cash today.
- Urgent unpaid subscriptions.
- Data warnings only when actionable.

Hide or lower:

- 7-day revenue trend.
- sales vs collected.
- offers/discount analytics.
- receipt traceability.

### 2. Owner Mode

Default for admin/owner accounts or selectable by admin.

First fold:

- Cash today.
- week/month revenue.
- debt and collection rate.
- active members and new members.
- operational alerts.

Second fold:

- 7-day trend.
- sales vs collected.
- top formulas.
- offers/discounts.
- receipts traceability.

### 3. Coach Mode

Later, for coach accounts.

First fold:

- My sessions today.
- Open pointage.
- Absent/present status.
- group members expected.

No finance except if explicitly permitted.

### 4. Widget Preferences

Admin settings should allow show/hide for dashboard widgets:

- `Caisse aujourd'hui`
- `Encaissements 7 jours`
- `Membres`
- `Suivi commercial`
- `Impayés détaillés`
- `Reçus`
- `Offres`
- `Données à vérifier`

Implementation notes:

- Use existing `ClubSettings` direction.
- Prefer simple boolean settings first.
- Do not create a complex drag-and-drop dashboard yet.

Acceptance:

- Reception user sees fewer widgets than admin.
- Admin can hide commercial sections without losing data.
- Empty dashboard states do not produce large blank areas.
- Mobile first fold shows useful work, not analytics noise.

## Phase 2 - Guided Club Setup And Data Confidence

Goal: make a new SaaS client understand exactly what must be configured before using the app.

### 1. Setup Checklist

Replace the generic "Premiers pas" feeling with a clear club setup checklist:

1. Club identity and logo.
2. Working days.
3. Disciplines.
4. Coaches and specialties.
5. Groups.
6. Weekly schedules.
7. Formulas.
8. Receipt settings.
9. Import or create first members.
10. First payment/pointage smoke check.

Each step should show:

- status: done, missing, needs review;
- why it matters;
- one primary action.

### 2. Data Confidence Center

Add a small diagnostics surface for admins.

Detect:

- sessions with no expected students;
- groups with schedules but no active assignments;
- groups without coach;
- coaches assigned outside specialties;
- no receipt configuration;
- no active formulas;
- members without phone or parent phone when kid;
- subscriptions with impossible balances;
- unpaid members allowed/not allowed based on settings.

Dashboard should show only the top urgent warnings. Settings can show the full diagnostic list.

Acceptance:

- A new club knows why the dashboard says `0 active members`.
- Hidden test data or incomplete setup does not silently distort business numbers.
- Warnings link to the exact place to fix the issue.

## Phase 3 - Settings UX Rebuild

Goal: turn settings from admin forms into a guided configuration hub.

### Recommended Settings Groups

`Club`

- identity;
- logo;
- contact;
- rooms;
- working days.

`Planning`

- seasons;
- weekly schedule templates;
- group schedules;
- conflict rules;
- session generation.

`Ventes`

- formulas;
- offers;
- receipt numbering;
- receipt text/logo/legal info;
- debt alert threshold.

`Pointage`

- unpaid/partial rules;
- exceptional passage;
- absence and recovery wording;
- finalization rules.

`Données`

- import old file;
- duplicate detection;
- test-data cleanup tools;
- export.

`Accès`

- users;
- roles;
- permissions;
- action logs.

### Page Pattern

Every settings page should follow:

1. plain-language summary;
2. current state cards;
3. primary action;
4. business impact explanation;
5. preview before broad changes;
6. danger/technical zone lower on the page;
7. audit/log reference where relevant.

Acceptance:

- A non-technical club owner can configure settings without developer help.
- Technical cleanup tools are not mixed with normal club settings.
- Dangerous settings explain what will change before saving.

## Phase 4 - Receipt And Payment Trust Polish

Goal: make receipts a selling feature.

Current foundation:

- receipt number;
- code;
- QR verification;
- public verification page;
- email send route;
- print page;
- payment ledger corrections/reversals.

Needed UX improvements:

1. Receipt status on payment rows:
   - `Reçu émis`
   - `Email envoyé`
   - `À envoyer`
   - `Annulé`

2. Receipt delivery actions:
   - print;
   - send email;
   - copy verification link;
   - copy WhatsApp message.

3. Receipt settings preview:
   - club logo;
   - legal name;
   - tax identifier;
   - footer text;
   - next number;
   - QR preview.

4. Public verification polish:
   - clear success page;
   - show receipt number, club, member, payment amount, issued date;
   - never expose private internal IDs.

5. Monthly receipt register:
   - export list for accountant;
   - show voided receipts clearly.

Acceptance:

- Staff can give a receipt immediately after payment.
- Client can verify receipt by QR/code.
- Corrections never silently replace old receipts.
- Receipt settings feel official, not technical.

## Phase 5 - Import And First Client Data Entry

Goal: make onboarding old club members painless and safe.

### Import Formats

Provide French Excel templates:

- members;
- parents/households;
- subscriptions;
- old balances/debts;
- groups;
- optional attendance history later.

Column style:

- French labels.
- No confusing `externalId` visible by default.
- If an internal matching key is needed, generate it from row number + normalized name/phone during preview.

### Import Flow

1. Download template.
2. Upload file.
3. Preview detected rows.
4. Highlight duplicates and missing fields.
5. Let admin choose:
   - create;
   - update existing;
   - skip;
   - mark as old debt.
6. Import with rollback window.
7. Lock rollback once real activity starts.

Acceptance:

- Client can import old members without knowing exact historic group start dates.
- Mid-month and debt cases can be represented simply.
- Test imports can be cleaned if they have not touched real business history.

## Phase 6 - Enrollment And Payment Simplicity

Goal: make the sales flow feel obvious.

### Enrollment

Improve:

- mobile active form before summary;
- clearer group compatibility:
  - discipline;
  - age policy;
  - gender policy;
  - schedule;
  - capacity;
- kid flow:
  - parent phone required;
  - parent contact visibly tied to child;
- quote summary:
  - catalog price;
  - offer;
  - pay now;
  - remaining balance;
  - receipt behavior.

### Payment

Improve:

- allow obvious partial payment;
- show what subscription is being paid;
- show remaining amount before submit;
- show receipt action after submit;
- show correction/reversal wording only when needed, not during normal payment.

Acceptance:

- Reception can enroll one member in under two minutes.
- The user understands whether payment is total or partial.
- Receipt action is immediate after payment.

## Phase 7 - Planning And Coach Clarity

Goal: make schedules and conflicts understandable.

### Planning UX

Improve:

- compact mobile week navigation;
- hide closed empty days;
- never hide a day with sessions;
- selected session details remain useful but less visually heavy;
- conflict details appear in expanded/selected panel.

### Coach Assignment UX

Make clear where a coach is assigned:

- group default coach;
- session override coach;
- coach specialty compatibility;
- conflict rules from settings.

Add visual chips:

- qualified;
- outside specialty;
- same-room exception;
- conflict.

Acceptance:

- Admin understands why a conflict appears.
- Admin understands when two groups in same room/coach can be allowed.
- Planning page is useful on desktop and mobile.

## Phase 8 - Role-Based Navigation

Goal: make the app feel smaller for each user type.

### Reception

Visible:

- Accueil;
- Pointage;
- Planning;
- Inscrire;
- Encaisser;
- Abonnements;
- Membres.

Lower/hidden:

- advanced settings;
- logs;
- technical tools.

### Owner/Admin

Visible:

- all reception items;
- finance/history;
- settings;
- users;
- logs.

### Coach

Visible:

- my sessions;
- pointage;
- member list only if permitted.

Acceptance:

- A user sees only what they need for their role.
- Admin-only pages remain protected server-side.
- Sidebar feels calmer without removing power.

## Phase 9 - Future Sellable Modules

Do not start these before Phases 1-6 feel excellent.

### Best Next Martial Arts Modules

1. Grades/belts:
   - belt level;
   - exam date;
   - next grade eligibility;
   - certificate/print later.

2. Family/household portal:
   - parent contact;
   - siblings;
   - family discount;
   - family payment summary.

3. Coach mobile workspace:
   - today's sessions;
   - attendance;
   - member notes;
   - no finance unless allowed.

4. Gym management add-on:
   - memberships without fixed class attendance;
   - access/check-in;
   - optional equipment/locker;
   - should reuse members, payments, receipts, settings.

5. WhatsApp/SMS reminders:
   - payment reminder;
   - attendance reminder;
   - renewal reminder.

## Code Strategy

### Keep

- existing routes;
- current tenant model;
- current payment ledger;
- current receipt models;
- current policy helpers;
- dashboard component boundaries.

### Refactor Gradually

Targets:

- dashboard widgets into smaller configurable components;
- setup guide into a proper onboarding module;
- settings sections into shared cards/patterns;
- payment form into selector, amount summary, receipt result;
- enrollment mobile layout into responsive step components;
- planning session cards and selected panel into smaller pieces.

Rules:

- One feature pass at a time.
- No broad schema change unless the UX cannot be solved safely without it.
- Every money/receipt/attendance change must have regression tests.
- Deploy only after lint/build and smoke checks.

## Recommended Execution Order

### Sprint 1 - Dashboard Modes And Widget Preferences

Why first:

- Highest visible impact.
- Low business-logic risk.
- Builds on the dashboard work already deployed.

Deliverables:

- reception/admin dashboard mode;
- widget visibility settings;
- better dashboard empty states;
- mobile dashboard first fold QA.

### Sprint 2 - Guided Setup And Data Confidence

Why second:

- Reduces client onboarding confusion.
- Prevents bad data from looking like broken app behavior.

Deliverables:

- setup checklist;
- diagnostics panel;
- dashboard warning links;
- settings progress state.

### Sprint 3 - Settings UX Rebuild

Why third:

- Settings are the main place where SaaS buyers judge maturity.

Deliverables:

- grouped settings hub;
- business-impact copy;
- safer technical/danger zones;
- receipt/planning settings previews.

### Sprint 4 - Receipt Trust Polish

Why fourth:

- Strong selling point and real-world trust feature.

Deliverables:

- receipt status in payment history;
- print/email/copy actions;
- public verification polish;
- monthly receipt register export.

### Sprint 5 - Import And Enrollment Polish

Why fifth:

- Helps onboard real clubs quickly.

Deliverables:

- French import templates;
- preview/matching improvements;
- enrollment mobile flow fix;
- quote/payment/receipt clarity.

### Sprint 6 - Planning And Coach UX

Why sixth:

- Important, but less urgent once pointage works and current planning is usable.

Deliverables:

- compact mobile planning controls;
- conflict explanation panel;
- coach assignment clarity;
- closed-day behavior refinement.

## Test Plan For Every Sprint

Run locally or on staging:

- `npm.cmd run lint`
- `npm.cmd run build`
- `npx.cmd prisma validate`
- `npm.cmd test` when a local/disposable Postgres test DB is reachable

Browser QA:

- desktop `1440x900`;
- mobile `390x844`;
- `/`;
- `/attendance/today`;
- `/sessions`;
- `/enrollment`;
- `/payments/new`;
- `/payments`;
- `/members`;
- `/subscriptions`;
- `/settings`;
- related setting page for that sprint.

Smoke checks after deploy:

- login;
- dashboard load;
- pointage open;
- payment page open;
- enrollment page open;
- settings page open;
- logs show no runtime errors.

## Go/No-Go Rules

Ready for first client:

- dashboard is understandable;
- pointage and payment flows are trained;
- receipt print/verification works;
- settings are configured by you before handoff;
- test data is cleaned or hidden from real stats.

Ready for broader SaaS selling:

- setup guide is strong;
- data confidence catches incomplete setup;
- settings are guided;
- receipt workflow is polished;
- import flow is safe;
- role-based UI is calmer.

Not required before broader SaaS selling:

- grades/belts;
- gym add-on;
- self-serve signup;
- tenant billing;
- full mobile coach app.

## First Implementation Recommendation

Start with Sprint 1:

Dashboard modes and widget preferences.

This gives the fastest visible improvement, makes the app feel less complicated, and creates the foundation for role-based SaaS UX without touching money logic, attendance logic, or schema-heavy modules.
