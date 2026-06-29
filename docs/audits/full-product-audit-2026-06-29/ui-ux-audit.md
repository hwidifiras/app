# UI/UX Audit - 2026-06-29

## Scope

Screens audited from fresh captures: login, dashboard, attendance today/detail/history/groups, enrollment, payment collection, members, subscriptions, payments, sessions, groups, coaches, sports, plans, offers, club settings, users, account, data import, and logs.

Evidence lives locally in `screenshots/`; raw capture metrics are in ignored JSON files beside this report.

## Strengths

- Dashboard now reads like a daily command center, not a reporting wall. With realistic data, the next actions are clear: `Pointer`, `Encaisser`, `Voir`.
- Mobile navigation is stable and avoids horizontal overflow across all captured pages.
- Empty states are calm and useful on payments, subscriptions, sessions, attendance, and dashboard.
- Tables degrade into readable mobile card/list layouts on high-frequency pages.
- Status color usage is mostly disciplined: blue for actions, green for healthy/completed, red for debt/urgent money.
- Login page is polished on desktop and mobile, with strong hierarchy and good first impression.

## UX Risks

1. Payment collection on mobile needs one more step of hierarchy.
   - Evidence: `53-scenario-payment-new-mobile.png`.
   - The selected member/debt summary is good, but the amount input sits below the first viewport while the disabled submit button is already visible. Receptionists may think the form is blocked.
   - Recommendation: move the amount field higher or add a compact sticky summary only after the amount field is visible.

2. Attendance detail can expose stale/archived members.
   - Evidence: `52-scenario-attendance-session-mobile.png`.
   - The controlled dataset included an archived assignment and the member appeared in the course list. This is useful audit evidence, but it would confuse real staff.
   - Recommendation: hide inactive assignments by default, or show a clear `Ancien membre` state with no active pointage action.

3. Setup guide competes with daily work on mobile.
   - Evidence: `50-scenario-dashboard-mobile.png`, `02-dashboard-mobile.png`.
   - The guide badge is useful but visually loud while the receptionist is trying to work.
   - Recommendation: collapse it into a quieter icon/badge after first use, or show it only to admins.

4. Offers form still needs decision help.
   - Evidence: `14-offers-mobile.png`, `59-scenario-offers-mobile.png`.
   - The technical wording was fixed in code, but the form still asks the user to choose a discount type without enough practical examples.
   - Recommendation: add one-line examples under each type, such as family bundle, second discipline, and fixed discount.

5. Some degraded states were too technical.
   - Evidence: source audit and search results.
   - Staff-facing fallback messages mentioned Prisma/npm commands.
   - Status: fixed in `6af348b`.

## Accessibility Risks From Screenshots

- Icon-only controls in dense tables rely on hover/title behavior on desktop; mobile card actions are clearer.
- Some compact blue badges and small uppercase overlines may need contrast/focus verification in a keyboard pass.
- Screenshot review cannot prove screen-reader labels, tab order, or focus states; those require keyboard and accessibility-tree testing.

## Recommendation

The UI direction is sellable enough to continue, with no broad redesign needed right now. The next UX pass should be targeted: mobile payment hierarchy, inactive attendance rows, offer decision help, and a quieter setup guide.
