# Functional Scenario Audit - 2026-06-29

## Environment

- Target: SaaS staging container `dojo-saas-staging` on the VPS.
- Browser target: `http://127.0.0.1:3002` via SSH tunnel.
- Test account: temporary staging-only audit admin.
- Dataset: staging-only `audit-ux-*` records for sport, coach, group, plan, members, subscriptions, payments, sessions, attendance, and offer.
- Production data: not mutated.

## Scenario Results

| Area | Scenario | Result |
| --- | --- | --- |
| Auth | Audit admin can log in | Pass |
| Auth | Staff without payments permission cannot open payments API | Pass, `403` |
| Auth | Disabled staff cookie loses API access immediately | Pass, `401` |
| Auth | Demoted admin cookie loses admin API access immediately | Pass, `403` |
| Tenant | Cross-tenant member lookup by guessed id | Pass, `404` |
| Tenant | Unknown host with `X-Forwarded-Host` | Pass, `404` |
| Tenant | Unknown host with only `Host` inside container | Risk: returned `200` because the app saw internal forwarded host |
| Payments | Overpay blocked on fully paid subscription | Pass, `409` |
| Payments | Correction requires reason | Pass, `400` |
| Payments | Reversal requires reason | Pass, `400` |
| Subscriptions | Amount below already-paid total blocked | Pass, `409` |
| Attendance | Archived member cannot be checked in | Pass, `403` |
| Attendance | Unpaid member cannot be checked in as present | Pass, `403` |
| Attendance | Override requires reason | Pass, `400` |
| Attendance | Finalized session blocks new check-in | Pass, `409` |

## Real-World Flow Notes

- Daily reception flow is coherent with the audit dataset: dashboard points to the correct session and debt actions.
- Payment collection correctly lists unpaid and partial subscriptions.
- Subscription and payment protections behaved correctly for the tested edge cases.
- Auth freshness hardening behaved correctly for disabled and demoted users.
- Tenant isolation behaved correctly for guessed record IDs.

## Release Gate

Before SaaS cutover, Nginx must pass the original browser host as `X-Forwarded-Host` or the app resolver must be hardened to ignore internal proxy hosts. Current enabled Nginx site sets `Host`, `X-Real-IP`, `X-Forwarded-For`, and `X-Forwarded-Proto`, but not `X-Forwarded-Host`.

Recommended Nginx addition before SaaS cutover:

```nginx
proxy_set_header X-Forwarded-Host $host;
```

Then repeat the unknown-tenant browser/API smoke test.
