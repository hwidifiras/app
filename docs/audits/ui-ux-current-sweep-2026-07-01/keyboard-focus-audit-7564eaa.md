# Keyboard Focus Audit - 7564eaa

## Scope

- Target: live SaaS app at `https://we-discipline.com`.
- Commit deployed during audit: `7564eaa`.
- Runner: `scripts/audit-keyboard-focus.mjs`.
- Account: temporary audit admin `audit-ux-20260701@we-discipline.test`.
- Dataset: tenant-scoped `audit-ux-*` records.
- Viewports: mobile `390x844`, desktop `1440x900`.
- Routes:
  - `/`
  - `/attendance/today`
  - `/enrollment`
  - `/payments/new`
  - `/members`
  - `/settings/data-import`

## Result

| Check | Result |
| --- | ---: |
| Route/profile checks | 12 |
| Passed | 12 |
| Failed | 0 |
| Invisible focused controls | 0 |
| Unnamed focused controls | 0 |
| Skip-link checks | 12/12 |

## What Changed Before The Passing Run

- The mobile side drawer is now `aria-hidden` and `inert` while closed, so hidden off-canvas navigation links are not reachable by keyboard.
- The keyboard audit now treats off-viewport focus targets as not visible and records actual link/button roles instead of losing them to nullable accessibility snapshot values.
- Chrome temporary-profile cleanup warnings are non-fatal after the audit has already written valid results.

## Evidence

- Raw result: `keyboard-focus-results-7564eaa.json`.
- Screenshot folder: `screenshots/keyboard-focus-7564eaa/` (ignored by Git).
- Accepted sample screenshots inspected:
  - `mobile-root-02-tab-sequence.png`
  - `mobile-settings-data-import-02-tab-sequence.png`
  - `desktop-root-01-skip-focus.png`

## Confirmed Strengths

- First `Tab` exposes `Aller au contenu` with visible focus on every audited route/profile.
- `Enter` on the skip link moves focus to `#main-content` on every audited route/profile.
- Mobile closed-drawer links no longer appear in the tab sequence.
- Focus indicators are visible on operational links, buttons, bottom navigation, top navigation, and page actions.
- Every focused interactive control in the sampled sequence has an accessible name.

## Evidence Limits

- This is automated keyboard/focus proof, not a full manual screen-reader audit.
- The run samples the first 18 tab stops on representative routes rather than every possible control in the product.
- A few mobile routes cycle through `body` after all available controls in the sampled viewport; this was not treated as a failure because no hidden or unnamed control is exposed and the next tab returns to the normal sequence.

## Recommendation

Keyboard/focus risk is now materially lower for the private app shell and high-frequency reception flows. The remaining release evidence should move to enrollment apply/revert smoke checks and final release-readiness documentation.
