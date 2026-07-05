# Product Readiness Roadmap - 2026-07-05

## Purpose

This document turns the latest product concerns into an implementation map for a sellable dojo / martial-arts SaaS. The north star is simple:

- staff must recover from human mistakes without losing history;
- money, receipts, enrollments, pointage, schedules, and settings must be traceable;
- the app must feel consistent on desktop and mobile;
- configuration pages must feel guided, not like raw admin screens;
- the codebase must stay modular enough for future add-ons such as gym management.

This roadmap is based on the current codebase, the existing product-readiness progress document, and the live browser QA screenshots captured under:

`docs/audits/product-readiness-browser-2026-07-05/`

The broader execution map for the latest product-readiness prompt lives at:

`docs/audits/saas-product-execution-map-2026-07-05.md`

## Current Evidence Limits

- The current branch contains newer settings and product-readiness work than the live app.
- Live `https://we-discipline.com/settings` returns `404`, so current-branch settings UX still needs QA after deploy or a local Postgres-backed runtime.
- Local `npm.cmd test` is blocked by the missing PostgreSQL test database at `localhost:5432`.
- Browser screenshots from live settings pages are useful for layout risk, but they do not fully represent the current branch.

## Product Principles

### 1. Every Important Action Must Be Recoverable

The app should not accept business actions that cannot be corrected, reversed, archived, voided, or explained in the logs.

Use this action vocabulary everywhere:

- `edit`: safe profile/config correction with before/after audit;
- `correct`: admin correction with required reason;
- `reverse`: money ledger reversal, original kept;
- `void`: official document/action invalidated without deletion;
- `archive`: record hidden from daily work but preserved;
- `close`: schedule/assignment ended with an end date;
- `draft delete`: physical delete only before business history exists.

### 2. UI Must Follow One Operational Fingerprint

Best pages already established the direction:

- light SaaS workspace background;
- white panels with compact radius;
- blue for navigation and primary actions;
- green, amber, red only for business state;
- short French labels tied to reception work;
- first viewport answers what needs action now;
- mobile lists become cards, not tiny desktop tables.

This fingerprint should be reused before inventing new designs.

### 3. Configuration Must Teach The Admin

Settings should not look like raw database fields. Each configuration page needs:

- a short operational summary;
- plain-language explanation of the rule;
- one primary action;
- clear danger zones;
- preview before applying broad changes;
- audit trail when settings affect business behavior.

### 4. Code Must Support More Modules Later

Future add-ons such as gym management should reuse core primitives:

- member;
- household;
- subscription;
- payment;
- receipt;
- attendance;
- schedule;
- notification;
- audit log.

Domain-specific logic should live in small policy/helper modules, not scattered inside page components.

## Workstream A - Recovery And Editability

### Already Strong

- Payments use append-only ledger entries for normal payments, corrections, and reversals.
- Enrollment recovery reverses payments, voids receipts, cancels subscriptions, closes assignments, and archives newly created members where applicable.
- Catalog deletes for disciplines, coaches, and formulas are soft deactivation.
- Group schedules are closed instead of physically deleted.
- Session cancellation writes an actor-linked audit entry.
- Attendance undo keeps balance adjustment and audit entry in one transaction.

### Still Needs Audit Or Improvement

| Area | Current Risk | Target Behavior | Priority |
| --- | --- | --- | --- |
| Enrollment details after apply | Some details can be edited from member/subscription pages, but the original enrollment action needs clear recovery language. | Keep enrollment recovery visible and make the correction path obvious from member/subscription/payment views. | P0 |
| Attendance after finalization | Staff may need to correct a real mistake after finalization. Current flow requires reopening first, then correction; logs now include reopen/finalize reasons and attendance before/after snapshots. | Future schema pass can preserve deleted attendance rows instead of physical delete. | P1 |
| Session edit | Schedule/session edits can affect pointage and conflict history. Completed/pointed sessions are blocked, and edits now write audit snapshots. | Add staff-entered reason UX for broad permanent edits, not only cancellations/exceptions. | P1 |
| Subscription edit | Amount/date/plan/status edits can affect payments and active assignments. Current guard blocks unsafe edits, shows already-paid amount, requires reason for formula/status/value changes, and writes before/after audit. | Browser QA and copy polish on the edit page. | P1 |
| Offers after use | Editing an offer after it was used can rewrite business meaning. Current product has create/deactivate only and now shows usage count before deactivation. | Browser QA and copy polish on offer cards. | P1 |
| Import rollback | Bulk import needs very clear rollback boundary. | Show which imported rows are still reversible and which now have business history. | P1 |

## Workstream B - Receipt System

### Implemented Foundation

- Receipt numbering, verification code, snapshot, and content hash exist.
- Printable receipt page exists at `/receipts/[id]`.
- Public verification exists at `/receipts/verify`.
- Receipt can be sent by email.
- Printed/verified receipts include a QR code pointing to public verification.
- Staff can copy the public verification link for manual sending.
- Payment history exposes receipt actions directly: open, resend email, and copy verification link.
- Payment correction/detail exposes the linked receipt and latest email delivery attempts from audit logs.
- Club settings control receipt prefix, sequence, footer, print default, and email default.
- Payment reversals/corrections void related original receipts.

### Next To Make It Sales-Grade

- Add optional fiscal/company fields in club settings.
- Add receipt template preview inside settings.
- Add "copy verification link" where staff can send by WhatsApp if email is missing.

Definition of done:

- a client can print or send a receipt;
- a student/parent can verify it by code/link;
- a fake receipt is hard to imitate because the public code/hash check fails;
- every receipt change is logged.

## Workstream C - Full UI/UX Audit And Consistency

### Pages Already Close To The Fingerprint

- Dashboard: strong command-center direction, but still needs branch QA after the latest layout changes.
- Planning: improved compact week view; still needs working-day-aware layout and selected-session details polish.
- Payments/new: clearer TND money display and traceable payment wording.
- Enrollment: strong enough flow, but quote/steps need more mobile clarity.
- Settings hub: good direction, but not deployed/live yet.

### Pages That Need Fresh Desktop + Mobile Audit

Audit each at `1440x900` and `390x844`:

- `/`
- `/attendance/today`
- `/enrollment`
- `/payments/new`
- `/payments`
- `/members`
- `/members/[id]`
- `/subscriptions`
- `/sessions`
- `/groups`
- `/coaches`
- `/sports`
- `/subscription-plans`
- `/offers`
- `/settings`
- `/settings/club`
- `/settings/schedules`
- `/settings/data-import`
- `/settings/users`
- `/logs`

### UI Red Flags To Keep Hunting

- Buttons whose purpose is unclear, especially broad actions like `Créer séances`.
- Empty day cards that waste space when the club is closed.
- Conflict badges that create anxiety before the user opens details.
- Tables that still need horizontal scrolling on desktop.
- Forms where the disabled submit appears before the required field on mobile.
- Configuration forms that start with fields instead of an explanation and summary.
- Duplicate action buttons on the same page with different labels for the same intent.

## Workstream D - Settings And Configuration Upgrade

### Highest-Impact Settings Pages

| Page | Current Direction | Next Improvement |
| --- | --- | --- |
| `/settings/club` | Summary and preferences exist. | Add receipt preview, fiscal fields, and clearer working-days impact. |
| `/settings/schedules` | Template/apply clarity exists. | Add conflict-safe working-day management and selected group template assignment. |
| `/settings/users` | Role intent is clearer. | Add role examples and warning before deactivation. |
| `/settings/data-import` | Reprise framing is clearer. | Split wizard UI further and show rollback state more visually. |
| `/logs` | Summary filters exist. | Improve detail readability and link business objects when possible. |

### Working Days And Schedules

The planning view should not simply hide empty days. The safer model is:

1. Club settings define working days.
2. Planning hides non-working days only when they truly have no sessions.
3. If an admin disables a working day that already has sessions, the app must block and show which sessions need cancellation/rescheduling first.
4. Schedule templates can apply to selected groups or all groups, with preview and conflict results before generation.
5. Group-specific schedule validity belongs to the schedule/template period, not as a vague group validity concept.

## Workstream E - Group, Discipline, Coach, And Enrollment Logic

### Discipline Creation

Common martial arts suggestions are useful and should remain. Next improvement:

- allow a quick suggested discipline pick;
- allow free text;
- keep suggestions generic for any martial-arts club;
- avoid forcing the first client’s discipline list on every tenant.

### Group Creation

The group form should express real club language:

- age policy: kids, adults, mixed, or custom age range;
- gender policy: male, female, mixed;
- level: beginner, intermediate, advanced, competition, open;
- room/salle;
- default capacity;
- default coach or coach pool;
- default schedule template.

This avoids names like `Self Def Kids` carrying hidden business rules.

Implemented in this pass:

- group create/edit now has a guided `Public du cours` picker for age and gender policy;
- member selections are still cleared/filtered when a policy change makes selected members incompatible.

### Enrollment

Current target:

- gender must be specified with a clear radio/segmented control;
- kids require parent phone;
- selected group must validate age/gender compatibility;
- if incompatible, the UI explains the exact reason and suggests a valid group.

### Coach Assignment

Coach conflict logic must be understandable:

- a coach can train only sports inside their specialties unless explicitly allowed;
- settings can allow a coach to handle two groups at the same time only when same room and specialty rules pass;
- the session card should avoid alarming "Conflit" on collapsed cards unless staff opens details or the conflict blocks action.

## Workstream F - Code Organization

### Files That Need Controlled Splitting

| File | Risk | Refactor Direction |
| --- | --- | --- |
| `src/components/sessions/sessions-planner.tsx` | Large manager file mixing filters, summaries, mobile layout, cards, detail panel. | Started: session tiles, selected-session panel, legend, and display helpers extracted to `session-planner-ui.tsx`; remaining target is week/day sections and view-model helpers. |
| `src/app/page.tsx` | Dashboard data shaping and layout can become hard to reason about. | Extract dashboard view models and keep server page orchestration thin. |
| `src/components/enrollment/enrollment-wizard.tsx` | Many steps and rules in one component. | Extract step components and quote summary. |
| `src/components/settings/data-import-wizard.tsx` | Manual import and bulk import live together. | Continue extracting bulk preview, manual form sections, rollback panel. |
| `src/components/groups/group-schedules-manager.tsx` | Schedule generation, form state, and preview logic are tightly coupled. | Extract schedule rows, editor, preview, and policy copy. |

### What To Maintain

- Current policy/helper modules for attendance, billing, receipts, demographics, and schedule templates.
- Existing route URLs and app flows.
- Central money formatter.
- Append-only payment/receipt model.
- Audit-log-first thinking for sensitive actions.

### What To Get Rid Of

- Repeated embedded table/card markup inside long client components.
- Page-local money/date/status formatters when shared helpers exist.
- Hard-coded operational copy duplicated across pages.
- Physical delete behavior for records that can have business history.
- Unclear broad buttons without preview, like schedule generation actions that do not explain what will happen.

## Priority Plan

### P0 - Safety Before More Features

1. Finish mutation-route audit and document every irreversible action.
2. Add missing reason/audit guards where history can change.
3. Verify enrollment recovery, attendance correction, session edit/cancel, subscription edit/cancel, and import rollback.
4. Add receipt QR/verification usability improvements.

### P1 - UX Consistency And Settings Trust

1. Run screenshot QA on current branch after deploy or local Postgres runtime.
2. Fix settings pages first: club, schedules, users, data import, logs.
3. Make planning working-day-aware with safe blocking when hidden days still contain sessions.
4. Simplify group creation language and coach assignment clarity.
5. Keep mobile first: no hidden critical controls below disabled submit buttons.

### P2 - Architecture For Scale

1. Split the biggest manager files into view models and presentational pieces.
2. Standardize page shell, page headers, operational metric cards, empty states, and action bars.
3. Prepare module boundaries for future gym management without duplicating core member/payment logic.
4. Add stricter tests for policies after local PostgreSQL is available.

## Current Implementation Checkpoint

Already started in this pass:

- `schedule-templates-manager.tsx` now delegates reusable template UI to `schedule-template-ui.tsx`.
- `data-import-wizard.tsx` now delegates bulk preview UI to `data-import-bulk-ui.tsx`.

These are intentionally small refactors: behavior stays unchanged while reducing component pressure.

## Next Implementation Queue

1. Commit the data-import bulk UI extraction after verification.
2. Extract the data-import rollback/status panel.
3. Extract session planning card/detail components.
4. Add working-day-aware planning display and safe settings validation.
5. Add receipt QR code and payment-history resend entry point.
6. Run current-branch browser QA when deploy/local DB allows it.
