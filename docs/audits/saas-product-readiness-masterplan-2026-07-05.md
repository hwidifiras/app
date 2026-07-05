# SaaS Product Readiness Masterplan - 2026-07-05

## Purpose

This document turns the product-owner review into a staged implementation plan for a sellable martial-arts SaaS.

The goal is not to make every record freely editable. The goal is safer: every important human action must be either editable, correctable, reversible, voidable, archivable, or recoverable with a visible audit trail.

## Product Principles

1. Money is never rewritten silently.
2. Receipts are official snapshots: void, verify, and reissue through traceable actions.
3. Inscription mistakes must be recoverable while the linked rows have not been used by later real activity.
4. Members, groups, coaches, plans, offers, and schedules should disappear from daily work by archive/deactivate/close, not by history loss.
5. Settings must explain business impact before broad changes.
6. The app should teach martial-arts admins the right model: discipline, age policy, gender policy, coach specialty, room, schedule, formula, payment, pointage.
7. Future modules such as gym management must reuse shared policies/components instead of copying one giant martial-arts flow.

## Current Code Evidence

### Strong Foundations Already Present

| Area | Evidence | Status |
| --- | --- | --- |
| Payment safety | `src/app/api/payments/route.ts`, `Payment.entryType`, `correctsPaymentId`, `correctionReason` | Append-only payment ledger exists. |
| Receipt trust | `Receipt` model, `src/lib/receipts.ts`, `/receipts/[id]`, `/receipts/verify`, QR generation, email delivery | Strong foundation exists. |
| Enrollment recovery | `src/lib/enrollment-undo.ts`, `/api/enrollment/revert`, member recovery panels | Good, needs more entry points. |
| Pointage policy | `src/lib/attendance-policy.ts`, `check-in-drawer.tsx` | Good, attendance delete still needs future append-only model. |
| Group/person policy | `Group.groupType`, `Group.genderPolicy`, `Member.memberType`, `Member.gender`, `src/lib/demographics.ts` | Implemented, needs clearer UX language. |
| Parent phone for kids | `memberSchema`, `member-add-form.tsx`, `member-edit-card.tsx`, data import wizard | Implemented. |
| Coach specialty | `CoachSportQualification`, `coach-qualification-policy.ts`, planning conflict helpers | Implemented, needs clearer assignment UX. |
| Common disciplines | `src/lib/martial-arts-catalog.ts`, `SportSuggestionPicker` | Implemented. |
| Settings structure | `/settings`, `/settings/club`, `/settings/schedules`, `/settings/data-import`, `/settings/users` | Functional and improving, needs polish. |
| Code cleanup | Recent extractions for dashboard, offers, payments, enrollment, group members, planning, settings | Progressing in safe chunks. |

### Remaining Product Risks

| Risk | Why It Matters | Direction |
| --- | --- | --- |
| Some actions still feel like "delete/update" to staff | Users fear irreversible mistakes. | Use recovery vocabulary in every action label and confirmation. |
| Attendance delete physically removes a row | Audit preserves state, but perfect history needs append-only attendance events. | Later schema pass: `ATTENDANCE_VOIDED` or attendance event ledger. |
| Enrollment recovery is not visible enough after leaving success state | Staff may discover a mistake from member/subscription/payment screens. | Add recovery entry points from member/subscription/payment contexts when safe. |
| Settings can still feel like raw admin forms | Sellability depends on confidence, not only functionality. | Redesign configuration pages around summary, explanation, preview, action, audit. |
| Large route/client files remain | Future features become risky when logic is too concentrated. | Continue vertical component/service extractions. |
| Group naming can hide rules | "Kids/adult/male/female/mixed" should be policy, not only text inside a name. | Make policy chips and filters prominent on group, enrollment, planning. |
| Receipt UX can be stronger | The technical trust model exists, but staff needs clear delivery/verification workflow. | Improve receipt delivery status, WhatsApp copy, and settings preview. |

## Editability And Recovery Matrix

| Action | Direct edit? | Recovery model | Required UX copy |
| --- | --- | --- | --- |
| Payment total or partial payment | No silent edit | Correction or reversal ledger row with reason; original preserved. | `Correction avec motif`, `Annulation traçable`, `Paiement original conservé`. |
| Receipt | No | Void old receipt, preserve snapshot/hash/code, optionally issue a new receipt from corrected payment. | `Reçu annulé`, `Vérifiable par numéro + code`. |
| Inscription | Not by rewriting all linked rows | Enrollment recovery while safe: reverse payments, void receipts, cancel subscription, close assignment, archive new member. | `Annuler cette inscription avec motif`. |
| Member profile | Yes for safe fields | Edit with before/after audit; archive instead of delete. | `Modifier la fiche`, `Archiver`. |
| Subscription | Yes, guarded | Admin correction with reason; amount cannot go below paid total. | `Corriger l'abonnement`, `Motif obligatoire`. |
| Pointage | Yes, guarded | Correct status/reason/balance with audit; future append-only attendance events. | `Corriger le pointage`, `Passage exceptionnel`. |
| Session/planning | Yes before business activity | Cancel/postpone/exception/permanent edit with conflict checks and audit. | `Modifier cette séance`, `Appliquer aux futures séances`. |
| Group assignment | No hard delete | Close assignment with end date. | `Fermer l'affectation`. |
| Data import | Temporary rollback only | Physical rollback allowed only before later real activity. | `Annulable`, `Bloqué par activité`. |
| Catalog/config | Edit/deactivate | Preserve old history; used offers/plans/sports stay meaningful. | `Désactiver`, `Historique conservé`. |

## UI/UX Fingerprint To Preserve

The best current pages define the visual direction:

- dashboard command center;
- compact planning cards;
- enrollment quote/payment guidance;
- payment receipt trust wording;
- subscriptions operational tabs;
- settings hub tiles;
- receipt print/verify page.

Design rules:

- white operational panels on a light SaaS background;
- compact radii and restrained shadows;
- blue for primary navigation/action;
- green/amber/red only for business state;
- short French labels for staff;
- first viewport shows the next action;
- mobile uses cards, drawers, and day-by-day agendas instead of squeezed desktop tables;
- no page should begin with a raw wall of fields when a short summary can orient the user.

## Page Audit Backlog

Run desktop `1440x900` and mobile `390x844` screenshot QA before deep visual changes.

| Priority | Page | Audit Focus |
| --- | --- | --- |
| P0 | `/attendance/today` | unpaid/partial rules, exception copy, finalization, correction path |
| P0 | `/enrollment` | adult/kid, gender, parent phone, group compatibility, quote, payment, recovery |
| P0 | `/payments/new` | amount field visibility, partial/advance clarity, receipt confirmation |
| P0 | `/sessions` | working days, conflicts, selected-session detail, generate-from-horaires clarity |
| P0 | `/settings/club` | pointage rules, working days, conflicts, receipt settings, business impact copy |
| P0 | `/settings/schedules` | reusable horaires/templates, selected/all groups, preview and conflict report |
| P1 | `/` | dashboard first fold, caisse graph, member overview, gap removal |
| P1 | `/members` and `/members/[id]` | search, health strip, next action, recovery entry points |
| P1 | `/subscriptions` | debt/renewal command view, readable status, no desktop overflow |
| P1 | `/payments` | ledger rows, corrections/reversals, receipt delivery state |
| P1 | `/groups` | group policy chips, coach/salle/schedule at a glance |
| P1 | `/coaches` | specialties, load, conflict expectations |
| P1 | `/sports` | common martial arts suggestions, active/inactive clarity |
| P1 | `/subscription-plans` | quota/validity explanation and schedule dependency |
| P1 | `/offers` | active offers first, templates, used-offer history |
| P1 | `/settings/users` | Admin/Reception/Coach role intent |
| P1 | `/settings/data-import` | template guidance, validation, rollback states |
| P1 | `/logs` | business actions first, system noise lower |

## Settings Redesign Strategy

Settings and configuration should follow one template:

1. Summary metrics.
2. Plain-language rule explanation.
3. Current state.
4. Primary action.
5. Preview before broad changes.
6. Separate danger/recovery zone.
7. Audit trail or confirmation for business-changing settings.

### Near-Term Settings Work

| Page | Fix |
| --- | --- |
| Club | Group identity, pointage, planning conflicts, working days, receipts into clearer sections with examples. |
| Horaires & saisons | Make it the generic template center for all/selected groups with preview before generation. |
| Users | Use clear role cards: Admin, Réception, Coach; explain deactivation impact. |
| Reprise/import | Show reversible vs locked imports visually and explain rollback limits. |
| Logs | Add better business filters and object links where possible. |

## Receipt System Roadmap

### Keep

- receipt number;
- verification code;
- public verification page;
- QR code;
- immutable snapshot JSON;
- content hash;
- voiding on payment correction/reversal;
- email send log;
- print page.

### Improve Next

| Priority | Improvement | Acceptance |
| --- | --- | --- |
| P1 | Show receipt delivery status on payment rows/details | Staff sees printed/sent/failed/manual state. |
| P1 | WhatsApp-friendly copy action | Staff can copy a short verification message without opening email. |
| P1 | Receipt settings preview QA | Settings preview matches actual receipt fields. |
| P2 | Receipt template blocks | Tenant can configure footer/legal/payment wording. |
| P2 | Receipt register export | Accountant can export a monthly list. |

## Martial-Arts Domain Model Roadmap

### Already Implemented

- common discipline suggestions;
- free-text disciplines;
- adult/kid/member type;
- gender selection;
- kid parent phone requirement;
- group age policy: kids, adults, mixed;
- group gender policy: male-only, female-only, mixed;
- coach specialties/qualifications;
- conflict rules for coach/room.

### Next Domain Improvements

| Feature | Why | Scope |
| --- | --- | --- |
| Group level | Beginner/intermediate/advanced/competition/open is common in dojos. | Schema + UI later. |
| Custom age range | Some clubs use age brackets, not only kids/adults. | Schema + compatibility helper later. |
| Coach pool | A group may accept several qualified coaches. | Schema + planning assignment later. |
| Household-first family flow | Family offers and parent contacts become natural. | UX + possible schema later. |
| Tenant template seeds | New martial-arts client can start with common sports/plans/schedules. | Onboarding/admin script later. |

## Code Organization Strategy

### Maintain

- route URLs;
- Prisma model names for this phase;
- shared policy helpers;
- shared money/date/status helpers;
- receipt and ledger model;
- responsive UI primitives;
- recent component extractions.

### Continue Splitting

| Target | Reason | Direction |
| --- | --- | --- |
| `sessions-planner.tsx` | Still large and central. | Move state/view models and selected-session panel out. |
| `attendance route` | Policy-heavy mutation route. | Extract service functions for create/update/delete/finalize. |
| `schedule-template route` | Large template/apply route. | Extract apply/preview service. |
| `members route` and member detail pages | Many profile, archive, and subscription responsibilities. | Extract member services and detail panels. |
| `payment-add-form.tsx` | Still mixes selection, amount, receipt, submit states. | Split member/subscription selector and amount panel. |
| `data-import-wizard.tsx` | Import mode, manual import, Excel import, rollback in one file. | Split manual import and recent rollback panels. |
| settings pages | Good structure but page copy/components can be centralized. | Reusable settings page sections and metrics. |

### Get Rid Of

- page-local duplicate labels for recovery actions;
- hardcoded money or receipt phrasing outside shared helpers;
- action buttons whose business effect is not obvious;
- hidden business rules encoded only in names;
- huge embedded JSX blocks where a named component would communicate intent.

## Unnecessary Or Confusing UI To Audit

| Surface | Possible Problem | Direction |
| --- | --- | --- |
| Planning generation | User may not know why/when to generate sessions. | Keep as `Générer depuis horaires`; show preview count and targets first. |
| Session conflict badge | Can scare staff before detail. | Keep severe blockers visible; put detailed reason in expanded/selected panel. |
| Empty closed days | Waste space and make planning look sparse. | Hide closed empty days; never hide days that contain real sessions. |
| Offers create form | Can look advanced. | Keep active offers first and templates first. |
| Data import rollback | User may think rollback is always available. | Show `Annulable`, `Bloqué`, `Déjà annulé`. |
| Payment correction/delete | Can sound destructive. | Always say correction/reversal and require reason. |
| Settings toggles | Some toggles have broad consequences. | Add examples and impact warnings. |

## Implementation Batches

### Batch 1 - Trust And Recoverability Visibility

- Add recovery entry points from member/subscription/payment detail contexts where the enrollment undo snapshot is still safe.
- Make payment, subscription, receipt, and pointage correction labels consistent.
- Add receipt delivery status to payment surfaces.
- Keep schema unchanged.

### Batch 2 - Settings Sellability

- Redesign `/settings/club` sections around identity, pointage, planning, receipts, and risk copy.
- Redesign `/settings/schedules` around reusable horaires for all/selected groups with preview.
- Improve `/settings/users`, `/settings/data-import`, and `/logs`.

### Batch 3 - Page Audit And UI Consistency

- Capture desktop/mobile screenshots for every page in the backlog.
- Record page-level issues and apply only high-impact fixes.
- Keep the established SaaS fingerprint.

### Batch 4 - Code Health

- Continue extracting large components/services in safe chunks.
- Keep each chunk verified by Prisma validate, lint, build, and test attempt.
- Commit each verified chunk.

### Batch 5 - Domain Enhancements

- Group level/custom age range/coach pool.
- Household-first enrollment enhancements.
- Tenant seed templates for common martial-arts clubs.

### Batch 6 - Future Add-On Readiness

- Define module boundaries for martial arts vs gym management.
- Keep shared primitives in `src/components/ui`, shared policies in `src/lib`, and module-specific flows under domain folders.
- Avoid cloning screens for the gym module until shared member/subscription/payment/receipt services are clean.

## Immediate Next Work

1. Keep committing code-health chunks while behavior is stable.
2. Run fresh screenshot audit on current branch/staging when reachable.
3. Start Batch 1 with visible recovery entry points and receipt delivery status.
4. Start Batch 2 for settings polish after screenshot evidence.
