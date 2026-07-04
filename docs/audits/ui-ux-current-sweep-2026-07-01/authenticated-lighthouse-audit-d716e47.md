# Authenticated Lighthouse Audit - 2026-07-01

## Scope

- Target: live SaaS app at `https://we-discipline.com`.
- Commit deployed before run: `d716e47` (`fix: improve private app accessibility checks`).
- Temporary dataset: `audit-ux-*`, seeded only for authenticated private-page access.
- Account: `audit-ux-20260701@we-discipline.test`.
- Command: `npm run lighthouse` with `LIGHTHOUSE_LOGIN_EMAIL`, `LIGHTHOUSE_LOGIN_PASSWORD`, and `LIGHTHOUSE_MIN_A11Y=90`.
- Local raw reports: `reports/lighthouse/2026-07-01T03-16-58/` (ignored by Git).

## Result

All audited private pages met or exceeded the accessibility threshold of `90`.

| Page | Profile | Performance | Accessibility | Best practices | SEO | LCP | CLS |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `/` | Mobile | 97 | 96 | 100 | 91 | 2116 ms | 0 |
| `/` | Desktop | 100 | 96 | 100 | 91 | 566 ms | 0 |
| `/attendance/today` | Mobile | 98 | 90 | 100 | 91 | 1835 ms | 0 |
| `/attendance/today` | Desktop | 100 | 90 | 100 | 91 | 509 ms | 0 |
| `/enrollment` | Mobile | 94 | 96 | 96 | 91 | 1806 ms | 0 |
| `/enrollment` | Desktop | 100 | 96 | 96 | 91 | 668 ms | 0 |
| `/payments/new` | Mobile | 98 | 94 | 100 | 91 | 1963 ms | 0 |
| `/payments/new` | Desktop | 100 | 94 | 100 | 91 | 691 ms | 0 |
| `/members` | Mobile | 98 | 96 | 96 | 91 | 1959 ms | 0 |
| `/members` | Desktop | 100 | 96 | 100 | 91 | 510 ms | 0 |
| `/settings/data-import` | Mobile | 78 | 100 | 100 | 91 | 4851 ms | 0 |
| `/settings/data-import` | Desktop | 100 | 100 | 100 | 91 | 530 ms | 0 |

## Fixes Verified

- Member desktop accessibility improved from `88` to `96`.
- Sidebar section labels now use full muted contrast instead of opacity-reduced text.
- Account menu trigger accessible name now includes its visible text, and the avatar contrast is stronger.
- Shared status badge surfaces now have explicit accessible background tokens.
- Members table filters and row-selection checkboxes now have explicit accessible labels.
- Members table mobile detail column now has a real screen-reader header.

## Cleanup

After the run, `scripts/seed-audit-ux-data.mjs cleanup` returned zero remaining `audit-ux-*` members, sessions, attendances, payments, offers, and users.

## Limit

Lighthouse is a useful automated accessibility gate, but it does not fully replace manual keyboard traversal and screen-reader testing.
