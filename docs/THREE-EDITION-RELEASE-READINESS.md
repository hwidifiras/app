# Three-Edition Release Readiness

Date: 2026-08-15  
Release commit: `f0c9760`  
Git author: `hwidifiras <hwidifiras@gmail.com>`

## Release Result

The shared platform now resolves each tenant from effective module grants:

- `CLASS_ONLY`: `CLASS_MANAGEMENT`
- `GYM_ONLY`: `GYM_ACCESS`
- `HYBRID`: both modules

The existing `we-discipline` tenant remains `CLASS_ONLY`. Its gym module is disabled and no SaaS subscription row was forced onto the tenant. Gym activation remains an explicit later operation.

## Verification

- Prisma schema validation: passed.
- Fresh PostgreSQL migration chain: 20/20 migrations passed.
- ESLint: passed.
- TypeScript: passed.
- Production build: passed in immutable Docker image `gymday-app-staging:f0c9760`.
- Automated tests: 44 files, 275 tests passed.
- Runtime dependency audit: 0 vulnerabilities with `--omit=dev`.
- Class-only browser QA: 18/18 desktop/mobile checks passed on the restored production copy.
- Gym-only browser QA: 22/22 desktop/mobile checks passed on a disposable tenant.
- Hybrid browser QA: 22/22 desktop/mobile checks passed on a disposable tenant.
- Live read-only browser smoke: 16/16 desktop/mobile checks passed.
- Camera scanner: first-party camera policy, granted permission, video element and manual fallback verified. A final real-phone camera scan remains a device-level acceptance check.
- Commercial states: `PAST_DUE` and `GRACE` warned without blocking; `SUSPENDED` blocked private operations; `ACTIVE` restored them.
- Isolation: unknown hosts exposed no private markers, JWT tenant mismatch returned 401, cross-tenant member lookup returned 404, and disabled module APIs returned 404.

## Data Safety

The live migration ran from a quiesced, verified PostgreSQL dump. Before/after comparison confirmed:

- 26 existing business tables retained their exact record IDs and counts, excluding the intentional permission backfill.
- Payment and subscription totals were unchanged.
- Attendance and session totals/statuses were unchanged.
- The permission backfill added the expected 16 canonical grants.
- Five migrations were added, bringing production to 20.
- All existing tenants received `CLASS_MANAGEMENT`.
- `GYM_ACCESS` is disabled for `tenant_we_discipline`.
- New lifecycle, credential and SaaS-control tables were created empty.

The verified rollout backup is stored on the server at:

`/opt/backups/we-discipline-20260815T143241Z`

It contains the live and quiesced database dumps, environment and Nginx copies, branding archive, Git bundle, before/after fingerprints, migration logs and checksums. No backup secrets are committed to Git.

## Live Topology

- Nginx routes `we-discipline.com` to `127.0.0.1:3003`.
- Active container: `dojo-saas-release-f0c9760` using `gymday-app-staging:f0c9760`.
- PostgreSQL container: `dojo-saas-postgres-staging`.
- Previous app container: `dojo-saas-staging`, stopped and preserved for rollback.
- Previous immutable image and pre-migration database dumps remain preserved.

Rollback requires restoring the quiesced database dump before restarting the old application, because the module enum migration is intentionally not backward-compatible with the old Prisma client.

## Remaining Manual Gate

Before enabling `GYM_ACCESS` for the first paying tenant, perform one real-phone QR scan and one printed-card scan on that tenant's approved staging copy. No first-client gym activation was performed during this release.
