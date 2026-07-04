# Enrollment Apply/Revert Smoke - 2026-07-01

## Scope

- Target: live SaaS app at `https://we-discipline.com`.
- Commit deployed before run: `37b4014` (`fix: auto-generate import member references`).
- Temporary dataset: `audit-ux-*`, seeded through `scripts/seed-audit-ux-data.mjs`.
- Account: `audit-ux-20260701@we-discipline.test`.
- Runner: `scripts/audit-enrollment-smoke.mjs`.
- Raw result: `enrollment-smoke-results-37b4014.json`.
- Mode: mutating workflow test on temporary audit records only.

## Result

| Total | Passed | Failed |
| ---: | ---: | ---: |
| 8 | 8 | 0 |

Server cleanup after the run returned zero remaining `audit-ux-*` members, sessions, attendances, payments, offers, and users. The runner also verified the temporary `audit-enroll-*` member phone was absent after revert.

## Covered Workflow

1. Tenant and seed readiness
   - Tenant `we-discipline` exists.
   - Audit admin, group, and plan exist in the same tenant.
   - Audit group and plan are active and share the same sport.

2. Auth and quote
   - Audit admin login succeeds with a `gym_auth` cookie.
   - Enrollment quote accepts a new member line.
   - Quote is not blocked and returns the expected audit plan amount.

3. Apply
   - Enrollment apply returns `201`.
   - The response includes an `undoSnapshot`.
   - One member, subscription, payment, and group assignment are created.
   - Database proof confirms the member, active subscription, payment amount, active group assignment, and `ENROLLMENT_APPLIED` audit log exist before revert.

4. Revert
   - Enrollment revert returns `200` with `data.reverted=true`.
   - Database proof confirms the created member, subscription, payment, and group assignment are removed.
   - Database proof confirms an `ENROLLMENT_REVERTED` audit log exists.
   - The smoke member phone has no remaining member row after revert.

## Notes

- This is an API/database smoke, not a full browser form-fill test.
- Browser visual, mobile, keyboard, and Lighthouse evidence for `/enrollment` is covered elsewhere in the July 1 sweep.
- The runner intentionally uses temporary audit records and cleans them at the end; no current client member, payment, subscription, or attendance data is modified.

## Commands Used

```powershell
ssh root@178.105.144.196 "cd /opt/we-discipline-saas-staging && docker compose -f docker-compose.saas-staging.yml exec -T -e AUDIT_ADMIN_PASSWORD='AuditUx20260701!' -e AUDIT_ADMIN_EMAIL='audit-ux-20260701@we-discipline.test' -e AUDIT_PREFIX='audit-ux' dojo-saas-staging node scripts/seed-audit-ux-data.mjs apply"
```

```powershell
ssh root@178.105.144.196 "cd /opt/we-discipline-saas-staging && docker compose -f docker-compose.saas-staging.yml exec -T -e AUDIT_ADMIN_PASSWORD='AuditUx20260701!' -e AUDIT_ADMIN_EMAIL='audit-ux-20260701@we-discipline.test' -e AUDIT_PREFIX='audit-ux' -e AUDIT_ENROLL_PREFIX='audit-enroll' dojo-saas-staging node scripts/audit-enrollment-smoke.mjs"
```

```powershell
ssh root@178.105.144.196 "cd /opt/we-discipline-saas-staging && docker compose -f docker-compose.saas-staging.yml exec -T -e AUDIT_PREFIX='audit-ux' dojo-saas-staging node scripts/seed-audit-ux-data.mjs cleanup && docker compose -f docker-compose.saas-staging.yml exec -T -e AUDIT_PREFIX='audit-ux' dojo-saas-staging node scripts/seed-audit-ux-data.mjs status"
```
