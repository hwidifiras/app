# Gym Module QA - 2026-07-12

## Safety

- Production app and production database were not changed during implementation QA.
- SaaS staging backup: `/opt/we-discipline-backups/gym-staging-20260712T190316Z`.
- Fresh migration and copy-migration tests used disposable databases `gymday_gym_verify` and `gymday_gym_test`.
- The existing `we-discipline` staging tenant retained no `TenantModule` row, so GYM stayed disabled.
- Opt-in browser QA used disposable tenant `gym-qa`; it must be deleted after QA.

## Migration Evidence

- Fresh PostgreSQL database: all 12 migrations applied successfully.
- Copied staging database: only the two new migrations were applied.
- Legacy formula count / class plan entitlements: `6 / 6`.
- Legacy subscription count / subscription entitlements: `2 / 2`.
- Legacy remaining-session total / entitlement remaining-unit total: `8 / 8`.
- Tenant module rows created by migration: `0`.
- Legacy offers changed away from `ALL`: `0`.

## Automated Verification

- `npx prisma validate`: passed.
- `npm run lint`: passed.
- `npm run build`: passed locally and in Docker.
- Final PostgreSQL suite: `19 / 19` files and `180 / 180` tests passed.
- Gym-focused tests: `11 / 11` passed, including database policy and cross-tenant cases.
- New-member source and atomic enrollment checks: passed.
- Import template tests: `4 / 4` passed after refreshing the stale reprise workbook.
- `npm audit --omit=dev`: `0 vulnerabilities`.

## Browser QA

Chrome was run through an SSH tunnel against SaaS staging.

- Disabled module: login passed, gym navigation hidden, direct route returned the safe unavailable state.
- Enabled disposable tenant: gym navigation visible.
- Atomic new member + quota pass + full payment + receipt: passed.
- Authorized pass lookup: passed.
- First check-in: HTTP `201`.
- Duplicate check-in: rejected with `DUPLICATE_SCAN`.
- Reversal: HTTP `200`; correction visible in history.
- Desktop `1440x900`: no horizontal overflow.
- Mobile `390x844`: no horizontal overflow on check-in or visit history.

Screenshots:

- `module-disabled-desktop.png`
- `check-in-authorized-desktop.png`
- `check-in-authorized-mobile.png`
- `visits-mobile.png`

## Release State

SaaS staging runs the branch with GYM disabled for the existing tenant. The current live `dojo-saas-app` still uses SQLite (`file:/app/data/prod.db`) from the older production repository, so this PostgreSQL module must not be deployed into that container in isolation. Production promotion belongs to the controlled SQLite-to-PostgreSQL cutover. After cutover, the first client remains module-disabled because no `TenantModule` row is created; activation still requires explicit approval.
