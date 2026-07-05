# Product Hardening Roadmap - 2026-07-04

## Scope

This roadmap turns the current product direction into an execution plan for a sellable dojo / martial-arts SaaS.

It covers:

- Reversible/recoverable actions.
- Receipt and proof-of-payment system.
- UI/UX consistency across desktop and mobile.
- Settings and configuration redesign.
- Code organization and component refactor strategy.
- Martial-arts catalog defaults.
- Better member/group demographic rules for kids, adults, gender, and mixed classes.
- Future module readiness, including gym management add-ons.

This is based on the current codebase scan on branch `codex/phase3-multitenant-saas`, existing audit docs, and recent deployed work. It is not a replacement for a screenshot audit; the UI findings below must be verified with desktop and mobile captures before final judgement.

## Product Principle

The product should behave like an operations system, not a fragile admin panel.

Core rule:

> A human mistake must be correctable, but business history must remain traceable.

That means:

- Normal users should rarely see destructive actions.
- Money, attendance, enrollment, group assignment, and planning changes need a correction/cancel/void flow with a required reason.
- Audit logs should answer: who did it, when, what changed, why, and what the previous state was.
- Immediate "oops" undo can exist, but it should not silently erase trusted financial or attendance history once the action is part of the official record.

## Current Code Findings

### Already Strong

- Payments are no longer simple edit/delete rows. `src/app/api/payments/route.ts` creates `PAYMENT`, `CORRECTION`, and `REVERSAL` ledger entries.
- Member deletion is mostly archive-oriented in the UI and detail actions.
- Group deletion is now group deactivation, preserving history.
- Member subscriptions are cancelled instead of physically deleted in the main route.
- Group schedules and reusable schedule templates exist, with preview/apply behavior instead of direct blind mutation.
- Club working days exist in `ClubSettings.workingDays`, and planning can hide closed empty days while still showing exceptional sessions.
- Enrollment, attendance, payment, offers, and schedules already have meaningful domain logic and tests/history from previous passes.

### Red Flags

- `src/lib/enrollment-undo.ts` still physically deletes created payments, subscriptions, group memberships, offer applications, and members in the undo snapshot when no attendance exists. This is useful for immediate rollback, but it conflicts with the long-term "no hidden deletion" product principle.
- Catalog entities still have hard-delete paths when unlinked:
  - `src/app/api/subscription-plans/route.ts`
  - `src/app/api/sports/route.ts`
  - `src/app/api/coaches/route.ts`
- There is no receipt model, receipt number, verification page, printable PDF/HTML receipt, or email receipt flow.
- The current group/member demographic model is too small for a martial-arts SaaS:
  - `Member.memberType`: `ADULT`, `KID`, `NOT_SPECIFIED`
  - `Group.groupType`: `KIDS`, `ADULTS`
  - no gender field
  - no group gender policy
  - no true mixed/adult-kid mode
- Some large UI files are becoming "god files":
  - `src/components/sessions/sessions-planner.tsx` (~80 KB)
  - `src/app/page.tsx` (~41 KB)
  - `src/components/enrollment/enrollment-wizard.tsx` (~37 KB)
  - `src/components/settings/data-import-wizard.tsx` (~32 KB)
  - `src/components/groups/group-schedules-manager.tsx` (~28 KB)
  - `src/components/settings/schedule-templates-manager.tsx` (~23 KB)
- Settings/config pages are functional, but several still feel like raw forms instead of guided SaaS workflows.

## Priority Plan

### P0 - Recovery And Trust Matrix

Goal: define exactly how each action is edited, corrected, cancelled, or recovered.

Tasks:

1. Create a recovery policy matrix in code/docs.
2. Audit every `POST`, `PATCH`, `DELETE` route under `src/app/api`.
3. Classify each mutation:
   - editable field change
   - correction entry
   - cancellation/archive
   - void/revert
   - hard delete allowed only for unused configuration draft
4. Add required reasons for sensitive corrections:
   - money
   - attendance after finalization
   - enrollment void
   - subscription amount/session adjustment
   - group schedule regeneration
5. Ensure every sensitive action writes `AuditLog` with:
   - `tenantId`
   - `userId`
   - before values
   - after values
   - reason
   - affected IDs

Recommended product decisions:

- Payments: keep current ledger. Add receipts. Do not physically delete.
- Enrollment: add "Annuler inscription" as a void flow with ledger reversal, subscription cancellation, group assignment closure, and member archive if newly created. Keep the old immediate undo only as a short-lived draft/session safety net.
- Attendance: allow correction with reason after finalization, but preserve before/after.
- Group membership: close assignment with `endDate`, do not delete once used.
- Catalog items: prefer deactivate/archive over delete, even if unused, unless it is clearly a draft created seconds ago.

### P0 - Receipt System

Goal: every accepted payment can produce a trustworthy receipt that can be printed, emailed, and verified.

Recommended model:

- `Receipt`
  - `id`
  - `tenantId`
  - `paymentId`
  - `receiptNumber`
  - `verificationCode`
  - `status`: `ISSUED`, `VOIDED`
  - `issuedAt`
  - `issuedById`
  - `voidedAt`
  - `voidReason`
  - `snapshotJson`
  - `contentHash`

Receipt behavior:

- Receipt is created for a `PAYMENT` ledger entry when payment is saved.
- A reversal does not delete the receipt. It creates a void/cancellation note or marks receipt as voided with reason.
- Receipt number should be tenant-scoped and sequential enough for business use, for example `WD-2026-000123`.
- Verification should use a public route such as `/receipts/verify` with `receiptNumber + verificationCode`.
- Verification should reveal only safe details:
  - club name
  - receipt status
  - amount
  - date
  - member initials or masked name
  - subscription/formula label
- Printable receipt should be simple and professional:
  - club logo/name/address/phone
  - member
  - formula / discipline
  - amount paid
  - remaining balance if any
  - payment method
  - issued by
  - QR code or code pair
- Email sending should reuse current mail infrastructure and be optional per payment.

Settings needed:

- receipt prefix
- next receipt sequence
- receipt footer text
- whether to show club tax/company fields
- default send by email on/off
- default print after payment on/off

### P1 - Settings And Configuration Redesign

Goal: make configuration feel like a professional SaaS control center, not a collection of technical forms.

Current target pages:

- `src/app/settings/club/page.tsx`
- `src/components/settings/club-settings-form.tsx`
- `src/app/settings/schedules/page.tsx`
- `src/components/settings/schedule-templates-manager.tsx`
- `src/app/settings/data-import/page.tsx`
- `src/components/settings/data-import-wizard.tsx`
- `src/app/settings/users/page.tsx`
- `src/components/settings/users-list-client.tsx`

Recommended structure:

- `Club`
  - identity
  - logo
  - contact
  - working days
- `Regles`
  - pointage policy
  - conflict policy
  - payment/debt policy
- `Horaires & saisons`
  - reusable schedule templates
  - apply to groups
  - generation preview
- `Utilisateurs`
  - roles and access
  - reset links
- `Reprise`
  - old file import
  - import history
  - rollback limits
- `Documents`
  - receipt settings
  - email templates

UX rules:

- Each settings page starts with a compact summary row.
- One clear primary action per page.
- Dangerous actions are placed in a separate danger area.
- Every bulk/apply action has a preview step.
- Use the already-established card/panel fingerprint from dashboard/planning:
  - light `#F6F9FF` workspace
  - white surfaces
  - compact 8px radius
  - primary blue actions
  - green/amber/red only for status
  - short French labels

### P1 - Member And Group Demographic Rules

Goal: make kids/adults/mixed/gender logic natural for martial arts clubs.

Recommended schema direction:

- Add `Member.gender`: `MALE`, `FEMALE`, `NOT_SPECIFIED`.
- Replace or extend `Group.groupType` with:
  - `agePolicy`: `KIDS`, `ADULTS`, `MIXED`
  - optional `minAge`
  - optional `maxAge`
  - `genderPolicy`: `MALE`, `FEMALE`, `MIXED`
- Keep existing `Group.groupType` during migration if needed for compatibility, but make the new fields the source of truth in validation.

UX changes:

- In member/enrollment forms, use radio/segmented controls for:
  - gender
  - adult/kid
- For kids:
  - parent phone remains required
  - parent name remains required
- In group creation:
  - choose public label/name separately from rules
  - choose age policy
  - choose gender policy
  - optionally set min/max age
- In enrollment:
  - show clear eligibility messages:
    - "Ce groupe accepte enfants uniquement"
    - "Ce groupe est reserve aux filles"
    - "Age hors plage du groupe"

### P1 - Discipline Catalog Defaults

Goal: creating a discipline should be fast and dojo-specific.

Recommended approach:

- Add a curated static catalog first, no external dependency:
  - Boxing
  - Kickboxing
  - Muay Thai
  - Karate
  - Taekwondo
  - Judo
  - Brazilian Jiu-Jitsu
  - Jiu-Jitsu
  - MMA
  - Wrestling
  - Aikido
  - Kung Fu
  - Self Defense
  - Fitness / Conditioning
- In discipline creation, add suggestions/autocomplete.
- Allow custom discipline names.
- Optionally seed common default disciplines for new tenants later.

This avoids network dependency and works well for Tunisia / France / international clubs.

### P1 - UI/UX Evidence Audit

Goal: verify every core page on desktop and mobile, using screenshots saved in the repo audit folder.

Required evidence folder:

`docs/audits/sales-ready-ui-audit-2026-07-04/`

Capture desktop `1440x900` and mobile `390x844` for:

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
- `/groups/[id]/schedules`
- `/coaches`
- `/sports`
- `/subscription-plans`
- `/offers`
- `/settings/club`
- `/settings/schedules`
- `/settings/users`
- `/settings/data-import`
- `/logs`

Audit each page for:

- first viewport clarity
- one obvious next action
- mobile overflow
- table/card readability
- destructive button placement
- empty states
- labels that sound staff-facing, not developer-facing
- consistency with the best pages

Current best UI fingerprint to preserve:

- Dashboard command-center layout.
- Planning cards with expandable details.
- Money displays in TND.
- Preview-before-apply pattern on schedules.
- Sidebar grouped by daily work / sales / students / club / settings.
- Data tables that become cards on mobile.

Pages most likely needing polish:

- settings/club
- settings/users
- settings/data-import
- offers
- subscription plans
- sports
- coaches
- group creation/edit
- member add/edit

### P2 - Code Organization And Refactor Strategy

Goal: keep velocity while preventing future modules from becoming fragile.

Do not do a huge blind refactor. Refactor along product seams.

Recommended boundaries:

- `src/features/payments`
  - payment forms
  - payment ledger helpers
  - receipt components
  - receipt service
- `src/features/enrollment`
  - wizard steps
  - quote summary
  - void/revert flow
- `src/features/planning`
  - timetable
  - session cards
  - conflict display
  - schedule template application
- `src/features/settings`
  - settings shell
  - settings cards
  - rule sections
- `src/features/members`
  - member demographics
  - member action bar
  - member history panels

Immediate split targets:

- Split `sessions-planner.tsx` into:
  - `PlanningToolbar`
  - `PlanningSummaryCards`
  - `WeekDayTabs`
  - `SessionCompactCard`
  - `SessionDetailPanel`
  - `SessionActionsMenu`
  - `useSessionsPlanner`
- Split `enrollment-wizard.tsx` into:
  - `MemberLineEditor`
  - `EnrollmentGroupPicker`
  - `EnrollmentQuotePanel`
  - `EnrollmentPaymentStep`
  - `EnrollmentReviewStep`
- Split `schedule-templates-manager.tsx` into:
  - `ScheduleTemplateList`
  - `ScheduleTemplateEditor`
  - `ScheduleApplyTargetPicker`
  - `ScheduleApplyPreview`
  - `ScheduleSlotEditor`
- Split `club-settings-form.tsx` into:
  - `ClubIdentitySettings`
  - `WorkingDaysSettings`
  - `PointagePolicySettings`
  - `ConflictPolicySettings`
  - `ReceiptSettings`

Keep:

- existing routes
- existing business helpers
- shared `ui` primitives
- audit log presentation helpers
- ledger logic
- tenant context helpers

Get rid of over time:

- repeated member/group compatibility checks spread across UI and APIs
- hard-coded enum labels in many components
- DELETE endpoints that physically delete business configuration
- large embedded helper components inside page files
- settings forms that mix unrelated policies in one long screen

### P2 - Module/Add-On Readiness

Goal: prepare for future add-ons like gym management without mixing domains.

Recommended direction:

- Add module metadata, not a complex plugin system yet.
- Use feature flags per tenant later:
  - `dojo`
  - `gym`
  - `retail`
  - `advancedReceipts`
  - `emailAutomation`
- Navigation should read from module-aware route metadata.
- Shared primitives:
  - members
  - payments
  - receipts
  - settings
  - audit logs
- Domain-specific modules:
  - dojo planning/attendance/groups/sports
  - gym memberships/access

## Action Editability Matrix

| Area | Current state | Target behavior | Priority |
| --- | --- | --- | --- |
| Payment | Ledger correction/reversal exists | Add receipt, verification, email/print, reason-first correction UX | P0 |
| Partial payment | Supported by ledger totals | Receipt must show paid and remaining balance | P0 |
| Enrollment | Apply + immediate undo snapshot exists | Void enrollment with reversible ledger/subscription/group changes | P0 |
| Member details | Editable + archive | Add gender; preserve parent phone rule; audit before/after edits | P1 |
| Attendance | Create/PATCH/DELETE guarded by rules | Correction flow with reason after finalization; no silent deletion | P1 |
| Subscription | Edit/cancel exists | Better reason UX for sensitive edits; receipt links from payments | P1 |
| Group assignment | Close/inactive behavior exists in many flows | Make all UI use close assignment language | P1 |
| Group schedules | Template preview/apply exists | Move to clearer settings experience and split code | P1 |
| Sports/coaches/plans | Some hard delete when unused | Prefer archive/deactivate for SaaS trust | P1 |
| Import | Preview/rollback exists | Make rollback limits clearer and visually safer | P2 |

## Mutation Scan Snapshot

Routes that deserve priority review before the product is considered fully trust-safe:

| Route area | Current concern | Recommended direction |
| --- | --- | --- |
| `payments` | Correction/reversal exists, but no receipt/proof layer | Add receipts and verification before wider sales |
| `enrollment/revert` | Uses physical delete for immediate undo snapshot | Replace with official void flow for saved enrollments |
| `subscription-plans` | Can physically delete unused plans | Prefer deactivate/archive and hide from new sales |
| `sports` | Can physically delete unused disciplines | Prefer deactivate/archive; keep old audit context |
| `coaches` | Can physically delete unassigned coaches | Prefer inactive/archive; keep coaching history |
| `groups/[id]/schedules` | Schedule delete can be legitimate, but language is destructive | Use "close schedule from date" when history/future sessions exist |
| `attendances` | Delete can be valid before finalization, risky after business use | Move toward correction with reason after lock/finalization |
| `club-settings/logo` | Deleting logo is fine but should be clear as branding removal | Keep as non-business destructive action |

This does not mean all `DELETE` handlers are bad. It means each one needs an explicit lifecycle rule and UI copy that matches reality: archive, cancel, close, void, correct, or remove draft.

## Confusing Buttons / UI Controls To Review

These controls should be checked in the screenshot audit and either clarified, moved, or redesigned:

- `Creer seances` on planning: useful only when staff understands it generates sessions from schedules. It should either become `Generer la semaine` with preview, or move closer to `Horaires & saisons`.
- `Supprimer` on schedules/templates/offers/plans: often means archive/deactivate/close, so the label should match the actual behavior.
- `Annuler inscription`: should distinguish immediate undo from official saved enrollment void.
- `Reprise`: should usually read `Import ancien fichier` in first-level UI.
- `Compact / Large`: useful for admin power users, but should stay visually secondary and never compete with primary page actions.
- Settings pages with multiple blue buttons: each page should have one main action and secondary actions as quiet buttons/menus.
- Planning conflict badges: collapsed cards can hide detail, but selected detail panel must explain why the conflict exists and how to fix it.
- Enrollment/member type selectors: `Adulte`, `Enfant`, and future `Mixte` rules should be radio/segmented controls, not buried dropdowns.
- Payment correction/annulation: should always show "original conserved" and "reason required" near the action, not only after error.

## Recommended First Implementation Slice

The safest first slice is:

1. Write the recovery policy matrix into a small internal helper/doc.
2. Add receipt schema and receipt settings.
3. Generate receipts for new payments only.
4. Add receipt print/view page.
5. Add public verification by receipt number + code.
6. Add receipt link/buttons in payment history and member detail.
7. Keep old payments working without receipts, with a "Generer recu" admin action later.

Why this first:

- It directly improves trust for client handoff.
- It does not require changing attendance or planning behavior.
- It creates a reusable base for email, PDF, and SaaS proof.
- It forces clean boundaries around payments without redesigning the whole app.

Second slice:

1. Redesign settings shell/pages.
2. Split settings components while touching them.
3. Add receipt settings UI.
4. Add discipline suggestions.

Third slice:

1. Add member gender and group age/gender policies.
2. Migrate existing groups safely:
   - `KIDS` -> `agePolicy=KIDS`, `genderPolicy=MIXED`
   - `ADULTS` -> `agePolicy=ADULTS`, `genderPolicy=MIXED`
3. Update enrollment/group assignment compatibility helpers.
4. Update import template.

Fourth slice:

1. Full screenshot UI audit.
2. Page-by-page consistency fixes.
3. Remove or relocate unnecessary buttons.
4. Mobile QA.

## Decisions Needed Before Coding

1. Receipt numbering format:
   - recommended: `{tenantPrefix}-{year}-{sequence}`, example `WD-2026-000123`.
2. Receipt verification:
   - recommended: `receiptNumber + verificationCode`, plus optional QR code later.
3. Enrollment recovery:
   - should "Annuler inscription" archive/cancel/reverse everything with a reason, even if the member was newly created? Recommended: yes.
4. Group demographic policy:
   - recommended: `agePolicy + genderPolicy + optional min/max age`.
5. Settings redesign order:
   - recommended: Club/settings shell first, then receipt settings, then schedules, then users/import.

## Verification Plan

For each implementation slice:

- `npm.cmd run lint`
- `npm.cmd run build`
- `npx.cmd prisma validate`
- `npm.cmd test` if local Postgres test DB is reachable; otherwise record the known local DB blocker.
- Browser QA desktop `1440x900` and mobile `390x844`.
- No production deploy without server backup/checkpoint.

For receipt slice:

- Create full payment receipt.
- Create partial payment receipt.
- Reverse a payment and verify original receipt is not deleted.
- Verify public receipt lookup does not expose private data.
- Verify tenant A cannot view tenant B receipt by guessing IDs.

For demographic slice:

- Adult cannot join kids-only group.
- Kid cannot join adults-only group.
- Mixed group accepts both.
- Female-only group rejects male member.
- Parent phone is required for kids in member, enrollment, and import flows.
