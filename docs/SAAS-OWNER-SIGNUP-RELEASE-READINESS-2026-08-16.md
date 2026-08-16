# SaaS Owner Signup Release Readiness - 2026-08-16

## Decision

**GO for a backed-up deployment with `SAAS_SIGNUP_MODE=DISABLED`.**

**NO-GO for public signup.** Invite-only activation also remains gated by the
cloud infrastructure and acceptance checks below. Deploying the migrations and
code while disabled does not expose signup and does not alter the existing
tenant's product modules or manually managed SaaS lifecycle.

## Delivered

- Dedicated platform-host routing and reserved workspace slug protection.
- Owner identity, email verification, edition selection, atomic tenant
  provisioning, and one-time workspace handoff.
- Class-only, gym-only, and hybrid module selection without a conflicting
  stored profile field.
- Dojo, yoga/wellness, dance, group-fitness, gym, hybrid, and custom activity
  templates.
- Edition-aware onboarding that creates no fake members, plans, groups,
  payments, or sessions.
- Trial warning, grace, blocked-state recovery, and preserved tenant data.
- Invite-only operator commands with one-time plaintext tokens and append-only
  platform audit logs.
- Signup metadata retention tooling with dry-run and explicit operator identity.
- Completed-signup data minimization: duplicate password hash and request
  fingerprint are cleared atomically after provisioning.
- Future-compatible access credential model for QR, barcode, NFC, RFID cards,
  and RFID wristbands.
- Turnstile/reCAPTCHA adapter and production validation rules for public mode.

## Verification Evidence

| Check | Result |
| --- | --- |
| Prisma schema validation | Pass |
| Fresh PostgreSQL migration chain (24 migrations) | Pass |
| Atomic owner provisioning and rollback | 2/2 pass |
| Class/gym/hybrid onboarding integration | 2/2 pass on clean DB |
| Signup security contracts | 10/10 pass |
| Platform-host/signup configuration contracts | 12/12 pass |
| Trial and SaaS access contracts | 13/13 pass |
| Invite create dry-run/create/list/inspect/revoke | Pass |
| Invite audit contains no raw token field | Pass |
| Retention dry-run and deletion | Pass; tenant and user preserved |
| ESLint | Pass |
| TypeScript | Pass |
| Production build | Pass |
| Production configuration validation (disabled mode) | Pass |
| `npm audit --omit=dev` | Pass; 0 vulnerabilities |
| Desktop/mobile signup and lifecycle browser QA | Pass; no overflow or browser errors |

The complete test suite was also attempted through an SSH tunnel to the
disposable PostgreSQL database. It reported 234 passing and 82 failing tests.
Most failures were fixed 5-second timeouts because individual database tests
took 6-13 seconds over the tunnel. Concurrent files then interfered through
shared cleanup, producing deadlock and foreign-key noise. The onboarding test
affected by that interference passed when rerun alone on a clean database.

This full-suite run is **not counted as green**. Before public activation, run
the complete suite against a local or CI PostgreSQL instance with low latency
and isolated test workers/databases. Do not solve the signal by merely hiding
timeouts.

## Invite-Only Activation Gate

All items must be complete before changing from `DISABLED` to `INVITE_ONLY`:

- `app.we-discipline.com` DNS and TLS are live.
- Wildcard `*.we-discipline.com` DNS and TLS work for newly created tenants.
- Nginx forwards the original host headers correctly.
- A verified transactional email sender passes a real inbox test.
- Terms and Privacy URLs contain reviewed content.
- Production secrets are independent and stored outside Git.
- PostgreSQL, environment, Nginx, uploads, and the current image are backed up.
- One invitation for each edition completes signup, handoff, and onboarding on
  the real cloud hosts.
- Existing first-tenant login, dashboard, enrollment, payment, receipt,
  pointage, planning, and logout smoke checks pass after migration.
- Trial warning, grace, and blocked states are verified on disposable tenants.

## Public Activation Gate

Public mode additionally requires:

- Shared Redis rate limiting.
- Turnstile or reCAPTCHA with production keys and server-side verification.
- A fully green low-latency database test run.
- Monitoring for signup, email, provisioning, rate-limit, and database errors.
- An operating support and trial-to-paid conversion process.
- Legal approval of the public signup wording and data retention policy.

## Safe Current Configuration

```env
SAAS_SIGNUP_MODE="DISABLED"
```

Keep that value during the first deployment. The rollback kill switch is the
same setting followed by an application restart; it stops new owner signup
without deleting any workspace or client data.
