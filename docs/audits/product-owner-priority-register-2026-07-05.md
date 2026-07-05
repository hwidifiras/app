# Product Owner Priority Register - 2026-07-05

## Purpose

This register turns the latest product-owner review into an implementation backlog for a sellable dojo / martial-arts SaaS.

The main rule is simple: the product must feel safe for daily staff, recoverable after human mistakes, consistent across pages, and clean enough in code to support future modules such as gym management.

## Product Decisions

### 1. Editability Does Not Mean Rewriting History

Every sensitive action should have a recovery model, but not every action should be directly editable.

| Area | Current code evidence | Decision | Priority |
| --- | --- | --- | --- |
| Payments | `src/app/api/payments/route.ts`, `src/lib/payment-ledger.ts` | Keep append-only ledger. Edit means correction/reversal with reason, original preserved. | P0 keep |
| Receipts | `src/lib/receipts.ts`, `/receipts/[id]`, `/receipts/verify` | Keep official receipt snapshots. Mistakes void the old receipt and preserve verification history. | P0 keep |
| Enrollment | `src/lib/enrollment-undo.ts`, `/api/enrollment/revert` | Keep traceable void flow. Make the recovery entry point visible beyond the success screen when safe. | P1 improve |
| Subscriptions | `/api/member-subscriptions`, `subscription-edit-form.tsx` | Keep reason-required correction for value/formula/status changes. | P0 keep |
| Pointage | `/api/attendances`, `check-in-drawer.tsx` | Keep guarded correction/reopen rules. Future excellent version should preserve voided attendance rows instead of physical delete. | P1 schema later |
| Sessions/planning | `/api/sessions/[id]`, `sessions-planner.tsx` | Keep cancel/postpone/correct with audit; broad generation must preview before create. | P0 keep |
| Imports | `src/lib/data-import-service.ts`, data import routes | Rollback only while imported rows have no later business activity. | P1 clarify |
| Settings | `/settings/*`, club settings schema | Business-changing settings need clear impact copy and audit trail. | P1 improve |

## UI/UX Consistency Audit

### Best Pages To Treat As The SaaS Fingerprint

Reuse these pages as the style reference:

- Dashboard command center.
- Compact planning cards.
- Payments/new trust wording.
- Enrollment quote and group compatibility.
- Subscriptions operational view.
- Receipt print/send/verify flow.
- Settings hub direction.

Fingerprint:

- light SaaS workspace background;
- white operational panels;
- compact radius and restrained shadows;
- blue for primary action/navigation;
- green/amber/red only for business status;
- short French staff labels;
- first viewport shows the next action;
- mobile uses cards/agenda layouts, not squeezed tables.

### Pages That Need Desktop + Mobile Screenshot Audit

Audit at `1440x900` and `390x844`:

| Page | What to judge |
| --- | --- |
| `/` | Does reception instantly see today, caisse, actions, and blockers? |
| `/attendance/today` | Are unpaid/exception rules clear without fear or ambiguity? |
| `/enrollment` | Is the member type, gender, kid parent phone, group compatibility, quote, and payment flow obvious? |
| `/payments/new` | Is partial/advance payment understandable and receipt trust visible? |
| `/payments` | Are ledger corrections, reversals, and receipt actions readable? |
| `/members` | Can staff search and act quickly on desktop/mobile? |
| `/members/[id]` | Does it show health and next action before long history? |
| `/subscriptions` | Does it default to debt/renewal work and avoid table overload? |
| `/sessions` | Are working days, conflicts, generation, selected session, and coach/room rules obvious? |
| `/groups` | Is group policy visible without relying on the group name? |
| `/coaches` | Are specialties and assignment meaning clear? |
| `/sports` | Are discipline suggestions generic and useful? |
| `/subscription-plans` | Does formula creation explain quota, validity, and schedule dependency? |
| `/offers` | Is offer creation simple and historical meaning protected? |
| `/settings` | Does it feel like an admin command center? |
| `/settings/club` | Are working days, conflicts, receipts, and pointage rules understandable? |
| `/settings/schedules` | Can templates be applied safely to all/selected groups with preview? |
| `/settings/data-import` | Are import template, validation, rollback, and locked rows clear? |
| `/settings/users` | Are Admin, Reception, and Coach roles clear? |
| `/logs` | Does it show useful business actions before system noise? |

## Settings And Configuration Upgrade

Settings are currently functional and improving, but they must become guided.

Target pattern for each configuration page:

1. Operational summary.
2. Plain-language rule explanation.
3. Current state metrics.
4. Primary action.
5. Preview before broad changes.
6. Danger zone separated from normal fields.
7. Audit trail when a setting changes business behavior.

Immediate targets:

| Page | Fix |
| --- | --- |
| `/settings/club` | Strengthen receipt/company fields, working-day impact, conflict rule explanation, and receipt preview. |
| `/settings/schedules` | Make it the reusable horaires/template center for selected groups or all groups. |
| `/settings/users` | Role examples and safer deactivation explanation. |
| `/settings/data-import` | More visual rollback status and blocked-row explanation. |
| `/logs` | Better detail reading, links to business objects, and less system noise by default. |

## Code Organization Strategy

### What To Maintain

- Current routes and core flows.
- Central money formatting.
- Append-only payment ledger.
- Receipt verification model.
- Policy helpers: attendance, assignment, billing, offers, demographics, coach qualification, planning conflicts.
- UI primitives: page header, panels/cards, badges, list controls, responsive table/card patterns.

### What To Split

| File | Why | Safe split direction |
| --- | --- | --- |
| `src/components/sessions/sessions-planner.tsx` | Largest operational manager. | Week/day columns, filters, generation panel, view models. |
| `src/app/page.tsx` | Dashboard data shaping mixed with UI. | Dashboard view models and section components. |
| `src/components/enrollment/enrollment-wizard.tsx` | Many rules and steps in one client component. | Member step, group step, quote step, payment step. |
| `src/components/settings/data-import-wizard.tsx` | Import state, preview, rollback, and forms. | Manual import sections, rollback panel, validation results. |
| `src/components/groups/group-schedules-manager.tsx` | Schedule list, editor, generation, and preview. | Schedule rows, editor, generation preview, policy copy. |
| `src/components/sports/sport-manager.tsx` | Suggestions and CRUD mixed. | Suggestion picker, active/inactive lists, form. |
| `src/components/coaches/coach-manager.tsx` | Coach details and specialties mixed. | Coach form, specialty editor, coach cards. |
| `src/components/settings/club-settings-form.tsx` | Identity, working days, pointage, receipts. | Identity panel, planning rules, pointage rules, receipt settings. |

### What To Avoid

- More business rules hidden directly inside long React components.
- Repeated table/card markup instead of shared patterns.
- Page-local money/date/status formatting.
- Broad buttons without preview.
- Future gym module implemented by copying the martial-arts app.

## Receipt System Direction

Current receipt foundation is strong:

- unique receipt number;
- verification code;
- public verification page;
- QR code;
- immutable snapshot;
- content hash;
- print and email delivery;
- voiding when payment is corrected/reversed.

Next improvements:

| Feature | Why | Priority |
| --- | --- | --- |
| Company/fiscal fields in club settings | Implemented for next receipts through optional legal name and fiscal/admin identifier fields. Browser QA remains. | P1 verify |
| WhatsApp-friendly verification link copy | Useful in Tunisia where email may not be the main channel. | P1 |
| Receipt delivery status on payment rows/details | Staff can know whether it was printed/sent. | P1 |
| Receipt template settings | Needed for different martial-arts clients. | P2 |
| Accountant receipt register export | Sales-grade finance follow-up. | P2 |

## Martial-Arts Product Fit

### Disciplines

Keep the generic martial-arts suggestion catalog and free text. Do not hard-code the first client’s disciplines as the SaaS default.

### Group Creation

The group name should not carry hidden rules. The form should directly express:

- discipline;
- public: kids, adults, mixed, or custom age range;
- gender policy: male, female, mixed;
- level: beginner, intermediate, advanced, competition, open;
- room;
- capacity;
- default coach or coach pool;
- default schedule/template.

Current code already covers age/gender policies and compatibility. Level/custom age range/coach pool are future schema/product work.

### Enrollment

Current direction is correct:

- member type must be adult or kid;
- gender must be selected;
- parent phone is required for kids;
- group compatibility must be explained before saving.

Next improvement:

- make parent/household the natural place for family offers and multiple kids.

## Unnecessary Or Confusing Buttons To Hunt

Current known examples:

| Surface | Risk | Direction |
| --- | --- | --- |
| Planning generation | Looked like arbitrary manual creation. | Renamed to `Générer depuis horaires` with preview copy. |
| Session card conflicts | Conflict badge can scare staff before detail. | Keep conflict details in expanded/selected state unless blocking. |
| Empty closed days | Empty non-working days waste space. | Hide only closed empty days; block disabling a day with real sessions. |
| Settings broad actions | Applying horaires/templates can affect many sessions. | Always preview target/date/count/conflicts before apply. |
| Data import rollback | User may think rollback is always possible. | Show reversible vs locked rows. |
| Payment delete/edit | Staff may expect destructive edit. | Keep correction/reversal language everywhere. |

## Priority List

### P0 - Must Stay Safe

1. Keep payment ledger correction/reversal model intact.
2. Keep receipt verification and voiding intact.
3. Keep enrollment recovery reason-required and visible after save.
4. Keep kid parent phone and gender requirements.
5. Keep planning generation preview before creating sessions.

### P1 - Make It Sellable

1. Full desktop/mobile screenshot QA across private pages.
2. Settings/configuration redesign pass.
3. Surface recoverability from member/subscription/payment contexts.
4. Better import rollback visual state.
5. Improve group scheduling/templates as a generic martial-arts workflow.

### P2 - Make It Scalable

1. Split large managers by product boundary.
2. Add receipt company/fiscal/template settings.
3. Add level/custom age range/coach pool for groups.
4. Prepare future gym module boundaries with shared primitives.

### P3 - Later Modules

1. Gym management add-on.
2. Tenant module flags.
3. Advanced household/family billing.
4. Accountant exports.

## Verification Standard

Every chunk should run:

- `npm.cmd run lint -- --no-cache`;
- `npx.cmd prisma validate`;
- `npm.cmd run build`;
- `npm.cmd test` when local PostgreSQL is reachable.

Current known blocker:

- local tests cannot run until PostgreSQL is reachable at `localhost:5432` or `TEST_DATABASE_URL` is set.
