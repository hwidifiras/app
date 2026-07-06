# UI/UX Change Register - 2026-07-07

## Audit Target

- Target: SaaS staging copy.
- Evidence folder: `screenshots/product-readiness-staging-2026-07-06/`.
- Captures: 24 screenshots total.
- Viewports: desktop `1440x900`, mobile `390x844`.
- Pages covered: dashboard, members, subscriptions, planning, new payment,
  enrollment, settings hub, club settings, schedule settings, users, import,
  logs.

## Shipped Or Verified Since The Earlier Audits

### Daily Reception

- Dashboard is a reception command center: today, caisse, debt/finalization
  priorities, graph, and member summary.
- Dashboard uses the SaaS palette: light workspace, white surfaces, navy text,
  blue primary actions, green/amber/red only for business status.
- Dashboard money display is TND-oriented and avoids the previous euro wording
  in the audited private surfaces.
- Planning uses compact weekly cards, selected-session detail, short collapsed
  cards, refresh action, and working-day-aware display.
- Planning no longer treats closed empty days as useful space, while days with
  real sessions remain visible.

### Navigation And Shell

- Sidebar was simplified into operational groups: today/reception, sales,
  students, club, settings.
- Mobile bottom navigation is shorter and focused on high-frequency actions.
- Configuration moved behind a settings hub instead of making every admin page
  compete in the primary sidebar.
- Admin-only surfaces remain role-aware.
- Refresh action was added in the app shell for quicker manual revalidation.

### Money, Receipts, And Trust

- Payment display uses shared money formatting toward `TND`.
- Payment correction/reversal language is traceable rather than destructive.
- Receipt model exists with numbering, verification code, public verification,
  print page, QR/copy actions, email sending, voiding on correction/reversal,
  and club receipt settings.
- Payment history and payment detail show receipt delivery and trust states.

### Enrollment, Members, And Subscriptions

- Enrollment has clearer quote/payment guidance, adult/kid/gender rules, parent
  phone requirement for kids, and traceable recovery after success.
- Member detail has health/next-action framing and recoverable enrollment
  entry points.
- Subscriptions use debt/renewal operational tabs and a simpler scan pattern.
- Group/member compatibility is enforced through age and gender policies.

### Configuration And Planning

- Settings hub exists and is the reference pattern for configuration quality.
- Club settings are grouped by business impact: identity, working days, pointage,
  conflict rules, receipts.
- Schedule settings have reusable templates, selected-target preview, impact
  warning, and safer generate-from-horaires framing.
- Discipline creation includes common martial-arts suggestions.
- Coaches show specialty/load/assignment context more clearly than before.

### Code Organization

- Large UI surfaces have started moving into named components:
  dashboard panels, today panel, planning UI pieces, session generation preview,
  enrollment line editor, enrollment completion panel, data import preview/status
  UI, schedule template UI, receipt settings UI.
- Shared policy helpers are now the direction for attendance, scheduling,
  recovery, money, receipts, and demographic compatibility.

## Needs Verification Or Follow-Up

| Area | Status | Next Proof Needed |
| --- | --- | --- |
| Planning conflicts | Improved | Manual QA with real overlapping coach/room cases and both preference toggles. |
| Coach assignment clarity | Better, not excellent | Browser QA on group create/edit and coaches with realistic specialty data. |
| Working-day settings | Implemented direction | Confirm blocked uncheck behavior when a closed day contains sessions. |
| Receipt delivery | Strong foundation | Real email delivery smoke with a safe test member email. |
| Enrollment recovery | Implemented | Browser QA from member detail after leaving success screen. |
| Settings mobile | Usable | Trim top metrics where action is pushed too far below fold. |
| Accessibility | Automated signals only in earlier pass | Optional manual NVDA/VoiceOver traversal before a public claim. |

## Intentionally Deferred

- Self-serve tenant onboarding and SaaS billing.
- Full append-only attendance event ledger.
- New gym-management add-on.
- Group level/custom age-range schema.
- Coach pools or multi-coach group assignment.
- Public marketing/pricing redesign.
- Production cutover from the current first-client deployment.

## Product Fingerprint To Keep

- Operational first viewport, not marketing hero inside the app.
- One primary next action per page.
- Blue for action/navigation, green/amber/red for business status.
- Short staff-facing French labels.
- Mobile card/agenda views instead of squeezed tables.
- Risky actions use recovery vocabulary: correct, reverse, void, archive, close,
  deactivate.
