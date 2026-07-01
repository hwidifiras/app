# UI/UX Current Sweep - 2026-07-01

## Scope

- Target: live SaaS app at `https://we-discipline.com`.
- Account: temporary audit admin `audit-ui-20260701@we-discipline.test`.
- Destination: local repo folder `docs/audits/ui-ux-current-sweep-2026-07-01/`.
- Viewports:
  - Desktop: `1440x900`.
  - Mobile: `390x844`.
- Capture mode: read-only direct navigation. No create, edit, import, payment, delete, finalization, or form submission actions were performed.
- Cleanup: the temporary audit admin was disabled after capture. The existing browser cookie then returned `{"data":null}` from `/api/auth/me`.

## Evidence

- Screenshots: `screenshots/`.
- Metrics: `summary.json`.
- Full capture data: `capture-results.json`.
- Git note: raw screenshot PNGs and full capture JSON are local-only because the repo ignores `docs/audits/**/screenshots/` and `capture-results.json`; `audit.md` and `summary.json` are committed.
- Accepted screenshots: `64`.
- Rejected screenshots: `4` invalid session-detail/postpone captures were rejected and removed because the current tenant copy has no valid tenant-scoped sessions for those routes.

## Route Coverage

### Top-Level Screens

Captured at desktop and mobile:

1. Dashboard `/` - healthy.
2. Pointage `/attendance/today` - healthy.
3. Inscription `/enrollment` - healthy.
4. Encaissement `/payments/new` - healthy.
5. Membres `/members` - healthy.
6. Abonnements `/subscriptions` - healthy.
7. Paiements `/payments` - healthy.
8. Planning `/sessions` - healthy.
9. Cours `/groups` - healthy.
10. Coachs `/coaches` - healthy.
11. Disciplines `/sports` - healthy.
12. Formules `/subscription-plans` - healthy.
13. Offres `/offers` - healthy.
14. Présences `/attendance` - healthy.
15. Rapports groupes `/attendance/groups` - healthy.
16. Club `/settings/club` - healthy.
17. Reprise `/settings/data-import` - healthy.
18. Utilisateurs `/settings/users` - healthy.
19. Mon compte `/settings/account` - healthy.
20. Journal actions `/logs` - healthy.

### Deep Screens

Captured at desktop and mobile:

1. Member detail `/members/[id]` - healthy.
2. New member `/members/new` - healthy.
3. Assign member to group `/members/[id]/add-to-group` - healthy.
4. New subscription `/subscriptions/new` - healthy.
5. Edit subscription `/subscriptions/[id]/edit` - healthy.
6. Payment correction `/payments/[id]/edit` - healthy.
7. New group `/groups/new` - healthy.
8. Edit group `/groups/[id]/edit` - healthy.
9. Group schedules `/groups/[id]/schedules` - healthy.
10. New formula `/subscription-plans/new` - healthy.
11. Edit formula `/subscription-plans/[id]/edit` - healthy.
12. Log detail `/logs/[id]` - healthy.

## Metrics Summary

| Set | Screens | Horizontal overflow | Login walls | Error pages |
| --- | ---: | ---: | ---: | ---: |
| Desktop top-level | 20 | 0 | 0 | 0 |
| Mobile top-level | 20 | 0 | 0 | 0 |
| Desktop deep | 12 | 0 | 0 | 0 |
| Mobile deep | 12 | 0 | 0 | 0 |

## Findings

### Strengths

- The private app now behaves consistently as a responsive SaaS workspace across the audited screens.
- Mobile table-to-card behavior is stable on high-frequency screens: members, subscriptions, payments, groups, formulas, and logs.
- Primary reception actions are visible early on mobile: pointage, inscription, caisse, member search, and member detail actions.
- Deep forms expose section chips, which makes long operational forms easier to scan on mobile.
- The latest manual card fixes are visible in the accepted captures: formula and schedule cards now use the same `Infos` / `Réduire` pattern as shared cards.

### Remaining Limits

- The current tenant copy has no valid tenant-scoped sessions, so attendance session detail and postpone screens could not be accepted in this sweep.
- This pass does not prove full accessibility compliance. Screenshots and DOM metrics cannot fully verify keyboard order, screen-reader output, or focus recovery.
- This pass was read-only and did not validate mutation flows such as saving a member, applying an import, correcting a payment, or finalizing attendance.

## Follow-Up Fixes After This Sweep

- Payment creation mobile helper/submit state was clarified in `74b9b86`.
- Staff users no longer see the setup guide in daily chrome after `e2a8a4d`.
- Attendance detail inactive-history rows are clarified after `ca26d4a`.
- Reprise/import now downloads a simpler French workbook with app-generated member codes after `0e5e07c`.
- Keyboard access was improved with a private-app skip link, a stronger shared focus ring for links/buttons/fields, and an explicit sidebar configuration disclosure state.
- Member archive actions now use `Résilier` copy instead of implying hard deletion; member history remains explicitly preserved in the confirmation text.
- Group assignment actions now use `Retirer` copy and `closedCount` feedback, matching the non-destructive assignment-close behavior.
- Offer, payment, subscription, and group fallback copy now says deactivation, cancellation, reversal, or `résiliation` instead of implying physical deletion where history is preserved.

## Repeatable Audit Data

- `npm run audit:ux:seed` creates a tenant-scoped `audit-ux-*` dataset for screenshots: paid/partial/unpaid members, a valid group/session, inactive attendance history, payment debt, and an offer.
- `npm run audit:ux:status` checks how many `audit-ux-*` records exist.
- `npm run audit:ux:cleanup` removes only the `audit-ux-*` records.
- Live tenant cleanup check after adding the helper: `audit-ux-*` members, sessions, attendances, payments, offers, and users all returned `0`.

## Recommendation

The app is visually ready for the next functional audit pass. The remaining proof should focus on real workflow behavior rather than broad UI layout:

- Login/logout and role freshness.
- Pointage and finalization when valid tenant-scoped sessions exist.
- Enrollment, payment, and partial-payment edge cases, including the updated mobile payment state.
- Import prevalidation and rollback in a non-client test tenant, including the updated French workbook.
- Payment correction/reversal audit logs.
