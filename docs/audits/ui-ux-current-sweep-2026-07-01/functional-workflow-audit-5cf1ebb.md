# Functional Workflow Audit - 2026-07-01

## Scope

- Target: live SaaS app at `https://we-discipline.com`.
- Commit deployed before run: `5cf1ebb` (`test: stabilize functional UX audit scenarios`).
- Temporary dataset: `audit-ux-*`, seeded through `scripts/seed-audit-ux-data.mjs`.
- Account: `audit-ux-20260701@we-discipline.test`.
- Runner: `scripts/audit-functional-workflows.mjs`.
- Raw result: `functional-workflow-results-5cf1ebb.json`.
- Mode: mutating workflow test on temporary audit records only.

## Result

| Total | Passed | Failed |
| ---: | ---: | ---: |
| 23 | 23 | 0 |

Server cleanup after the run returned zero remaining `audit-ux-*` members, sessions, attendances, payments, offers, and users.

## Covered Workflows

1. Auth/session UX
   - Anonymous `/api/auth/me` returns `data=null`.
   - Audit admin login succeeds and sets the `gym_auth` cookie.
   - `/api/auth/me` returns the current database-backed audit admin.
   - Logout clears auth and the next `/api/auth/me` returns `data=null`.

2. Payment ledger and audit trail
   - Overpayment is rejected before mutation.
   - Partial payment creates a positive `PAYMENT` ledger row.
   - Payment correction requires a reason.
   - Payment correction creates a signed `CORRECTION` row linked to the original payment.
   - Payment reversal requires a reason.
   - Payment reversal creates a signed `REVERSAL` row linked to the created payment.
   - Admin log search finds payment audit entries, and detail pages show correction/reversal reasons plus the actor email.

3. Pointage and finalization
   - Normal pointage for an unpaid member is rejected with `SUBSCRIPTION_UNPAID`.
   - Exceptional pointage requires a reason.
   - A past session cannot be finalized while expected active members remain unmarked.
   - Paid member attendance can be recorded.
   - Partial-paid member attendance is allowed when the club setting permits partial payments.
   - Unpaid member can be recorded only as exceptional attendance with a reason.
   - The complete past session finalizes to `COMPLETED`.
   - Editing finalized attendance is blocked until reopening.

4. Reprise/import UX logic
   - Bulk import preview is blocked until temporary reprise mode is activated.
   - Temporary reprise mode activation sets the expected mode cookie.
   - CSV preview accepts French headers, leaves code blank, and auto-generates a member code like `M001-auditimport-*`.
   - Temporary reprise mode deactivates cleanly.

## Notes

- The runner intentionally did not apply a bulk import; it validated preview and auto-code generation without creating imported members.
- The finalization seed includes a past audit session so the check is deterministic and does not depend on the current clock.
- This proof validates live route behavior and user-visible admin log pages. It does not replace a full accessibility audit for keyboard order, screen-reader output, or focus recovery.

## Commands Used

```powershell
ssh root@178.105.144.196 "cd /opt/we-discipline-saas-staging && docker compose -f docker-compose.saas-staging.yml exec -T -e AUDIT_ADMIN_PASSWORD='AuditUx20260701!' -e AUDIT_ADMIN_EMAIL='audit-ux-20260701@we-discipline.test' -e AUDIT_PREFIX='audit-ux' dojo-saas-staging node scripts/seed-audit-ux-data.mjs apply"
```

```powershell
$env:AUDIT_BASE_URL='https://we-discipline.com'
$env:AUDIT_ADMIN_EMAIL='audit-ux-20260701@we-discipline.test'
$env:AUDIT_ADMIN_PASSWORD='AuditUx20260701!'
$env:AUDIT_PREFIX='audit-ux'
$env:AUDIT_OUTPUT='docs/audits/ui-ux-current-sweep-2026-07-01/functional-workflow-results-5cf1ebb.json'
node scripts/audit-functional-workflows.mjs
```

```powershell
ssh root@178.105.144.196 "cd /opt/we-discipline-saas-staging && docker compose -f docker-compose.saas-staging.yml exec -T -e AUDIT_PREFIX='audit-ux' dojo-saas-staging node scripts/seed-audit-ux-data.mjs cleanup && docker compose -f docker-compose.saas-staging.yml exec -T -e AUDIT_PREFIX='audit-ux' dojo-saas-staging node scripts/seed-audit-ux-data.mjs status"
```
