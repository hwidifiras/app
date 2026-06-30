# Pointage Production Handoff Audit - 2026-06-30

## Scope

Urgent live production check before client handoff. Tests were run against an isolated audit tenant, not the real client tenant, except for read-only setting/count checks and cleanup of clearly generated `audit-ux-*` test records in the real tenant.

## Current Real Tenant Settings

Tenant: `tenant_we_discipline`

- `allowCheckInWithPartialPayment`: `true`
- `allowCheckInWithoutSubscription`: `true`
- `absentConsumesSession`: `true`

Effective business behavior:

- Fully paid active subscription: normal `PRESENT` / `ABSENT` pointage allowed.
- Partially paid active subscription: normal pointage allowed when at least one payment exists.
- Zero-paid active subscription: normal pointage blocked with `SUBSCRIPTION_UNPAID`; exceptional `OVERRIDE` with reason is allowed.
- No active subscription: normal pointage blocked; exceptional `OVERRIDE` with reason is allowed because the real tenant setting allows no-subscription override.
- Archived member: pointage blocked.
- Cancelled session: pointage blocked.
- Completed session: attendance edit/delete blocked until session is reopened.

## Live API Evidence From Isolated Audit Tenant

Audit tenant used: `tenant_audit_prod_20260630` (`audit-prod-20260630`)

- Partial paid subscription `6000 / 12000`: `POST /api/attendances` with `PRESENT` returned `201` and decremented remaining sessions from `4` to `3`.
- Zero-paid active subscription: normal `PRESENT` returned `403 SUBSCRIPTION_UNPAID` and created no attendance.
- Zero-paid active subscription: `OVERRIDE` with reason returned `201` and did not consume sessions.
- `OVERRIDE` without reason returned `400`.
- Duplicate pointage returned `409`.
- Patch unpaid `OVERRIDE` to `PRESENT` returned `403 SUBSCRIPTION_UNPAID`; attendance stayed `OVERRIDE`.
- Finalize session returned `200 COMPLETED`.
- Patch/delete after finalization returned `409 SESSION_REOPEN_REQUIRED`.
- Reopen session returned `200 PLANNED`.
- Delete non-finalized `PRESENT` returned `200` and restored remaining sessions from `3` to `4`.
- Cancelled session pointage returned `409 SESSION_CANCELLED`.
- Assigned member with no subscription returned `403 SUBSCRIPTION_INACTIVE` for normal pointage.
- Archived member returned `403`.

## Real Tenant Cleanup Before Handoff

Backup created before cleanup:

`/root/we-discipline-backups/pre-client-handoff-20260630/pre-client-handoff-20260630-193859.dump`

Removed only generated `audit-ux-*` rows from `tenant_we_discipline`:

- 4 test members
- 4 test subscriptions
- 2 test payments
- 3 test attendances
- 4 test group assignments
- 3 test sessions
- 1 test schedule
- 1 test group
- 1 test sport
- 1 test coach
- 1 test plan
- 3 related audit logs

Post-cleanup read-only counts for the real tenant:

- Members: `0`
- Active subscriptions: `0`
- Payments: `0`
- Attendances: `0`
- Audit catalog rows: `0`
- Remaining catalog setup: 9 sports, 9 coaches, 9 groups

## Audit Tenant Cleanup

The isolated audit tenant was suspended after testing:

- Tenant `tenant_audit_prod_20260630`: `SUSPENDED`
- Audit admin user: `isActive=false`

## Handoff Risk Notes

- Current production intentionally allows partially paid students to be checked in normally because `allowCheckInWithPartialPayment=true`.
- Current production allows exceptional pointage without subscription when a reason is entered because `allowCheckInWithoutSubscription=true`.
- If the client wants stricter behavior, change the club setting before handoff:
  - set `allowCheckInWithPartialPayment=false` to block partially paid normal pointage;
  - set `allowCheckInWithoutSubscription=false` to block no-subscription override.

