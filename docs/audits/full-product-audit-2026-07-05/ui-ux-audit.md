# Full Product UI/UX Audit - 2026-07-05

## Scope

Evidence source: live production at `https://we-discipline.com`, read-only navigation only.

Local branch screenshot audit was attempted first, but the local app could not start because dev/test PostgreSQL is not reachable at `localhost:5432`. The local code still passed build/lint in the implementation checkpoints.

Evidence saved:

- Desktop contact sheet: `contact-sheet-desktop-1440x900.jpg`
- Mobile contact sheet: `contact-sheet-mobile-390x844.jpg`
- Screenshot manifest: `screenshot-manifest.json`
- Screenshots folder: `screenshots/`

## Captured Steps

| Step | Page | Desktop health | Mobile health | Notes |
| --- | --- | --- | --- | --- |
| 1 | Dashboard | Good | Good | Strong first impression. Clear daily work, caisse, graph, and member overview. |
| 2 | Pointage today | Medium | Good empty state | Empty day is understandable, but real pointage edge states still need workflow QA. |
| 3 | Enrollment | Good | Medium-good | Mobile stepper works; quote/summary is useful. Still dense for a first-time receptionist. |
| 4 | New payment | Good empty state | Good empty state | Empty state is safe. Needs QA with a selected member/subscription state. |
| 5 | Payment history | Good | Good | Mobile cards are strong. Desktop table is readable but still finance-table heavy. |
| 6 | Members | Good | Good | Search/action flow is clear. Mobile cards fit the app fingerprint. |
| 7 | Subscriptions | Good | Good | Operational tabs make sense. Mobile cards are sellable and practical. |
| 8 | Planning | Medium-good | Medium | Useful command center, but "Créer séances" and conflict/action concepts remain cognitively heavy. |
| 9 | Groups & schedules | Medium | Medium | Desktop is still table/admin-like. Mobile cards are usable, but actions are repetitive. |
| 10 | Disciplines | Good | Good | One of the better configuration pages: metrics, catalog, and cards are coherent. |
| 11 | Formulas | Medium | Medium-good | List is clean; creation flow is better than before. Still needs stronger "what this formula changes" guidance. |
| 12 | Offers | Good | Medium-good | Active-first direction is correct. Mobile has duplicate create entry points. |
| 13 | Settings hub | Good | Good | This should be the reference for configuration pages. Clear tiles and metrics. |
| 14 | Club settings | Medium | Medium | Important settings are present, but hierarchy is dense and business impact needs more visual grouping. |
| 15 | Schedule settings | Medium | Medium | Good safety intent, but mobile stacks many metric cards before the work area. |
| 16 | Data import | Good | Good | Clearer than most admin pages. Reprise risk is explained well. |
| 17 | Users | Good | Good | Role intent is clear. Mobile metric stack works. |
| 18 | Logs | Good | Good | Useful filters and metrics. Still visually administrative, but acceptable. |
| 19 | Member detail | Excellent | Good | Health strip and next actions are strong. Mobile first viewport is very usable. |
| 20 | Coaches | Medium | Medium | Needs the most product clarity: specialty, availability, and assignment meaning are not yet obvious enough. |
| 21 | Account settings | Good | Good | Simple and coherent. |
| 22 | New group | Good | Good | Better than older group flows. Public du cours is a strong pattern to reuse. |
| 23 | New formula | Good | Good | Guided tabs and templates help. Schedule dependency copy is useful. |

## Strong Fingerprint To Reuse

These pages define the current best SaaS style:

- Dashboard: compact command center, blue/green status language, real work first.
- Member detail: health strip plus action row is the strongest "what should I do next?" pattern.
- Subscriptions mobile: operational tabs plus card rows are easy to understand.
- Payment history mobile: financial state is visible without feeling like accounting software.
- Settings hub: good configuration entry point.
- New group / new formula: guided form sections are much better than raw admin forms.
- Disciplines: metrics + catalog + cards is a good model for club configuration pages.

Keep this fingerprint:

- light workspace background;
- white operational surfaces;
- compact 8px-style radius;
- blue only for navigation/primary action;
- green/amber/red only for business status;
- first viewport answers "what matters now?";
- mobile uses cards and agendas, not squeezed tables;
- risky actions say what they do and keep a trace.

## UX Risks

### P1 - Configuration Still Feels Like Admin Work In Places

Evidence: steps 14, 15, 20.

Club settings, schedule settings, and coaches are functional but still feel like system configuration rather than guided club setup. A paying dojo owner should not have to infer which setting affects pointage, conflicts, receipts, or planning.

Fix direction:

- create shared `SettingsPageShell`, `SettingsRuleCard`, `SettingsImpactPreview`, and `SettingsDangerZone` patterns;
- put the business rule first, fields second;
- show "applies to next receipts/sessions only" style impact copy directly beside settings;
- keep broad actions behind preview panels.

### P1 - Coach Assignment Is Still Not Product-Obvious Enough

Evidence: steps 8, 20, 22.

The code has coach and specialty concepts, but the UI still does not fully answer: "Which coach can train this group, when, in which room, and why is there a conflict?"

Fix direction:

- in group creation/edit, show coach eligibility near the coach selector;
- in coaches, show specialty chips, active groups, weekly load, and conflict permissions;
- in planning conflict details, explain whether conflict is coach-time, room-time, or disabled by preference.

### P1 - Planning Has Improved, But It Still Carries The Most Cognitive Load

Evidence: steps 8, 9, 15.

Planning now looks more modern, but it combines generated sessions, fixed horaires, conflicts, working days, and selected-session details. "Créer séances" can still sound like manual creation rather than generation from horaires.

Fix direction:

- keep the weekly board, but rename action copy everywhere to `Générer depuis horaires`;
- put fixed horaires/templates one click away from planning;
- use selected-session detail for conflict explanation, not noisy collapsed cards;
- hide closed empty days, but block disabling working days that already have sessions.

### P1 - Some Mobile Pages Put Metrics Before Action For Too Long

Evidence: steps 13-18, especially 15.

The mobile configuration pages are valid, but several stack summary cards before the active task. This is good for confidence, but can delay action.

Fix direction:

- keep 2-3 key metrics max at the top on mobile;
- move secondary metrics into collapsible `Détails`;
- keep one primary action visible in the first viewport.

### P2 - Tables Are Cleaner, But Some Desktop Pages Still Read Like Back Office

Evidence: steps 5, 6, 7, 9, 11, 18.

Tables are readable and consistent, but the product becomes less emotionally "sellable" on groups, formulas, logs, and payments desktop. This is not a blocker, but it is where the app still feels more internal than polished SaaS.

Fix direction:

- keep tables for dense admin review;
- add an operational summary row above tables;
- reduce repeated action columns;
- use row expansion for secondary fields;
- keep mobile cards as the design reference.

### P2 - Duplicate Or Low-Value Buttons To Simplify

Evidence: steps 8, 10, 12, 20.

Candidates:

- `Créer séances` on planning: clarify generation source.
- repeated `Créer une offre` on offers mobile: keep one primary action, make the second contextual.
- repeated red `Désactiver` buttons on coach/catalog pages: use more restrained danger placement or row menu.
- `Infos` pill/dropdown on many mobile cards: useful, but should contain predictable secondary details only.
- `Compact/Large`: useful for power users, but probably not important for first-client handoff; keep, but do not let it compete with business actions.

## Accessibility Risks

Screenshot-only limits: keyboard navigation, focus order, screen reader labels, form error announcement, and live region behavior were not tested.

Visible risks:

- several labels use very small text around `0.65rem`; this may be hard for older reception users;
- muted text on pale backgrounds can become low contrast on mobile;
- bottom mobile nav plus sticky actions may hide final form actions unless pages include enough bottom padding;
- icon-heavy controls need tooltips/labels consistently;
- dense tables need clear row focus states for keyboard users.

## Product Fit Assessment

The product now solves a real dojo/martial-arts operations problem. It is not "too complicated" in the daily reception path anymore:

- dashboard;
- pointage;
- inscription;
- encaissement;
- members;
- subscriptions;
- receipts;
- logs.

The remaining complexity is mostly in setup and planning:

- coach assignment;
- group policy;
- horaires/templates;
- conflict preferences;
- formula schedule dependency;
- import/reprise.

That is acceptable for an admin product, but it needs guided language and reusable settings patterns before being sold broadly.

## Optimal Fix Path

### Phase A - Finish Trust And Recoverability

1. Keep payment correction/reversal and receipt voiding as the model for money.
2. Keep member-page inscription recovery and expand it only after browser QA on real recent enrollments.
3. Add recovery entry points where staff expect them: member detail, payment detail, subscription edit, attendance session, import history.
4. Make every risky action use the same vocabulary: `Corriger`, `Annuler avec trace`, `Archiver`, `Fermer`, `Désactiver`.

### Phase B - Configuration Quality Pass

1. Standardize settings pages with shared rule/impact components.
2. Redesign coaches around specialties, availability, active groups, and assignment safety.
3. Redesign schedules around reusable horaires templates and visible impact preview.
4. Keep data import as the reference for explaining risk.

### Phase C - Planning/Product Model Clarity

1. Make working days club-level and visually connected to planning.
2. Make group horaires templates visible from both settings and group pages.
3. Make coach conflict rules explainable in selected-session details.
4. Keep collapsed session cards short; show conflict reason only after selecting/expanding.

### Phase D - Component And Code Cleanup

1. Extract repeated settings primitives.
2. Continue splitting large managers by product boundary, not by arbitrary file size.
3. Move repeated recovery/danger copy into shared helpers.
4. Avoid future gym module duplication by keeping members, subscriptions, payments, receipts, attendance, schedules, and audit logs generic.

## Go / No-Go

Current UI/UX status for selling manually: **Go with guided setup support**.

Not yet ideal for self-serve SaaS onboarding: configuration and planning still need a guided admin pass.

No visual red flag blocks first-client handoff from the captured pages, but coach/group/planning concepts should be explained during onboarding until the next settings/planning pass lands.
