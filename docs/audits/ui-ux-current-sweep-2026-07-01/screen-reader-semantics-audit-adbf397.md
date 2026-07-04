# Screen-Reader Semantics Audit - adbf397

## Scope

- Target: live SaaS app at `https://we-discipline.com`.
- App commit deployed during the run: `adbf397`.
- Temporary data prefix: `audit-ux-*`.
- Audit account: `audit-ux-20260701@we-discipline.test`.
- Runner: `npm.cmd run audit:screen-reader`.
- Raw result: `screen-reader-semantics-results-adbf397.json`.
- Screenshot folder: `screenshots/screen-reader-semantics-adbf397/` (ignored by Git).

## Routes

Audited at mobile `390x844` and desktop `1440x900`:

1. `/`
2. `/attendance/today`
3. `/enrollment`
4. `/payments/new`
5. `/members`
6. `/subscriptions`
7. `/payments`
8. `/sessions`
9. `/groups`
10. `/coaches`
11. `/sports`
12. `/subscription-plans`
13. `/offers`
14. `/settings/club`
15. `/settings/data-import`
16. `/settings/users`
17. `/logs`

## Checks

The runner logged in, opened each route/profile, captured a viewport screenshot, inspected the DOM and accessibility tree, and checked:

- document `lang`
- exactly one `main` landmark
- skip link and `#main-content` target connected to the main content
- at least one navigation landmark
- no login wall on private pages
- visible heading order with one visible `h1`
- no duplicate IDs
- no visible unnamed interactive controls
- no visible controls inside `aria-hidden`
- visible image alt/name handling

## Result

- Total checks: 34.
- Passed: 34.
- Failed: 0.
- Visible unnamed interactive controls: 0 on every audited route/profile.
- Main landmarks: 1 on every audited route/profile.
- Skip links: 1 on every audited route/profile.

## Fixes Verified

- Shared `FormSection` headings now render as `h2`, preventing form pages from jumping from page `h1` to `h3`.
- Today pointage session cards now use `h2`, so repeated session cards sit directly below the page heading.
- The audit runner now treats a visually hidden skip link as valid when the link exists and points to `#main-content`; this matches standard skip-link behavior because the link becomes visible on focus.

## Cleanup

After the run, `npm run audit:ux:cleanup` was executed on the VPS. The follow-up status returned `0` for `audit-ux-*` members, sessions, attendances, payments, offers, and users.

## Limits

This is automated semantics evidence, not a manual NVDA, JAWS, TalkBack, or VoiceOver traversal. It does not claim full WCAG compliance, but it closes the previous automated screen-reader semantics gap for the audited private screens.
