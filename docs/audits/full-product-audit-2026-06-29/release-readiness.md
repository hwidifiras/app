# Release Readiness - 2026-06-29

## Verdict

Not ready for SaaS cutover yet, but the private app UI is moving in the right direction for a sellable reception/admin product.

## Ready

- Dashboard, navigation, login, page rhythm, cards, and responsive lists are coherent.
- Core pages load at desktop and mobile sizes with no detected horizontal overflow.
- High-risk auth/payment/attendance/subscription checks mostly passed on staging.
- Staff-facing technical copy found in this pass was fixed and linted.
- Targeted UI blockers from the June 29 audit have follow-up fixes deployed:
  - mobile payment submit hierarchy: `74b9b86`
  - inactive attendance history clarity: `ca26d4a`
  - staff/admin setup-guide visibility: `e2a8a4d`
  - simpler French import template and auto-generated member codes: `0e5e07c`

## Not Ready

- SaaS host forwarding must be corrected or hardened before unknown tenant/subdomain testing can be trusted.
- Staging needs a maintained demo tenant with realistic operational data.
- Fresh screenshot proof is still needed for the fixed payment, attendance-detail, setup-guide, offers, and import-template flows.
- Full `npm test` remains dependent on an available local/Postgres test database.

## Verification Run

- `npm.cmd run lint`: passed after UI-copy patch.
- `npm.cmd run build`: passed. Later targeted UI fixes also passed lint/build before deployment.
- `npm.cmd test`: blocked during `pretest` because local PostgreSQL `gymday_test` was not reachable at `localhost:5432`.
- `npm.cmd audit --omit=dev`: reported 2 moderate PostCSS advisories through `next`; the suggested `--force` fix would install a breaking Next version and was not applied.
- Browser capture: passed for 62 screenshots.
- Horizontal overflow check: passed for captured routes at `1440x900` and `390x844`.
- Staging functional scenario script: passed key auth, permission, payment, subscription, attendance, and cross-tenant record checks; flagged proxy header risk.
- Temporary audit accounts were disabled after the staging checks.

## Next Recommended Pass

1. Add `X-Forwarded-Host` to staging Nginx/cutover config and retest tenant resolution.
2. Recapture the fixed UI flows on live/staging: payment creation, attendance session detail, staff dashboard, offers creation, and reprise/import template.
3. Add a reusable demo tenant seed script for future audits and sales demos.
4. Run the full functional scenario audit with a writable test tenant.
5. Run full test/build/audit before production cutover once the local/Postgres test database is available.
