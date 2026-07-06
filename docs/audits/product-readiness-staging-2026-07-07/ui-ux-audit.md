# UI/UX Audit - 2026-07-07

## Scope

Evidence source: authenticated SaaS staging screenshot sweep from
`screenshots/product-readiness-staging-2026-07-06/`.

The sweep covered 12 private routes at desktop `1440x900` and mobile
`390x844`. Automated screenshot metadata reported no horizontal overflow and no
application-error screens.

## Overall Assessment

The product is no longer a confusing internal tool in its core reception flows.
The strongest pages now feel like a sellable dojo operations app: dashboard,
member detail, subscriptions, payment flow, enrollment, planning, settings hub,
and receipt surfaces all share a recognizable product language.

The remaining weakness is not the daily reception path. It is the admin/setup
mental model: horaires, working days, coach specialties, room/coach conflict
preferences, group validity, and session generation still need guided language
and a few stronger previews before the app can feel self-serve.

## Strengths

- Dashboard answers the correct first question: what needs action today?
- Member detail and subscriptions are now action-oriented instead of record-only.
- Payment and receipt flows preserve money trust through traceable corrections
  and official receipt snapshots.
- Enrollment handles real dojo constraints: kid/adult, gender, parent phone,
  group compatibility, quote, payment, and recovery.
- Planning cards are more modern and readable than the earlier table/list view.
- Settings hub makes configuration discoverable without flooding the sidebar.
- Mobile layouts are broadly usable and avoid horizontal overflow in the latest
  captured sweep.

## P0 Findings

No current screenshot or server-test evidence shows a P0 blocker for guided
first-client handoff.

Important caveat: this does not mean self-serve SaaS is complete. It means the
current guided/manual sales path has no known visual blocker in the captured
routes.

## P1 Findings

### 1. Planning Still Has The Highest Cognitive Load

Planning now looks better, but it combines several concepts in one surface:
weekly sessions, fixed horaires, working days, conflict preferences, selected
session details, generation, cancellation, and pointage state.

Recommended next fix:

- Keep compact collapsed cards.
- Show conflict reason only in the selected/expanded panel.
- Keep a direct link from planning to the relevant group horaires.
- Use `Generer depuis horaires` consistently instead of any wording that sounds
  like creating arbitrary manual sessions.
- In settings, block unchecking a working day that already has sessions and show
  a clear list of affected sessions.

### 2. Coach Assignment Needs To Be More Obvious

The data model supports specialty/qualification and conflict checks, but a club
admin still needs a clearer answer to: who can train this group, when, and why
does conflict appear?

Recommended next fix:

- On group create/edit, show coach eligibility beside the coach selector.
- On coaches, show specialties, active groups, weekly load, and conflict posture.
- In planning selected-session detail, explain whether conflict comes from coach,
  room, or disabled/allowed preferences.

### 3. Settings Pages Are Improving But Not Yet Excellent

The settings hub is strong, but some configuration pages still feel like forms
with explanations around them. For a sold SaaS, settings should feel like guided
club rules.

Recommended next fix:

- Standardize `SettingsRuleCard`, `SettingsImpactPreview`, and
  `SettingsDangerZone` patterns.
- Put business effect before fields.
- Keep only 2-3 top metrics on mobile; move secondary data into details.
- Keep broad actions behind preview/confirmation.

### 4. Some Recovery Paths Need More Surface-Level Discovery

Recovery exists for enrollment/payment/receipt/subscription/attendance in the
code, but staff should not need to know logs to find the right correction path.

Recommended next fix:

- Add context correction panels in payment detail, subscription detail/edit,
  member detail, and attendance session detail.
- Keep vocabulary consistent: `Corriger`, `Annuler avec trace`, `Archiver`,
  `Fermer`, `Desactiver`.

## P2 Findings

### Desktop Tables Still Feel Administrative In A Few Places

Payments, logs, groups, formulas, and some configuration pages are readable but
less emotionally polished than dashboard/member/subscriptions.

Direction:

- Keep tables for density.
- Add operational summary rows above tables.
- Move secondary fields into row expansion or detail panels.
- Reduce repeated destructive buttons in main rows.

### Mobile Configuration Can Push Action Too Low

Metrics and explanatory cards are good, but on mobile they can delay the first
actual action.

Direction:

- Top mobile rule: one summary, one primary action, then details.
- Collapse secondary metrics by default.

### Compact/Large Mode Competes Slightly With Operational Actions

The mode switch is useful for power users, but it should not visually compete
with daily work.

Direction:

- Keep it in the shell.
- Avoid adding more page-level controls near it.

## Accessibility Notes

This checkpoint is screenshot-based plus earlier automated accessibility work.
Manual screen-reader traversal was not performed in this checkpoint.

Visible risks to watch:

- very small uppercase overlines;
- muted text on pale panels;
- icon buttons that need accessible names/tooltips;
- sticky mobile actions and bottom navigation requiring enough bottom padding.

## Product Judgment

Current status: good enough for guided manual sales and first-client handoff.

Not yet good enough for unsupervised self-serve SaaS onboarding. The app still
needs guided setup patterns around club rules, planning, conflicts, and coach
assignment before a new martial-arts club can configure everything without help.
