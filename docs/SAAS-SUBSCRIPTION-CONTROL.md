# Manual SaaS Subscription Control

This runbook covers the first manual commercial-control release. It does not
enable public signup, online checkout, billing webhooks, or automatic limit
enforcement.

## Safety Model

- Existing tenants with no `TenantSaasSubscription` remain `LEGACY_ACTIVE`.
- `Tenant.status = SUSPENDED` remains the emergency platform-level host block.
- SaaS subscription status controls business operations without deleting data.
- `TRIAL`, `ACTIVE`, `PAST_DUE`, and `GRACE` can operate.
- `PAST_DUE` and `GRACE` show an admin warning in the private app shell.
- `SUSPENDED` and `CANCELLED` block staff operations and preserve all data.
- Date-driven lifecycle is opt-in through `automaticLifecycle`. Existing and
  manually assigned subscriptions default to `false`; self-serve trials use
  `true`.
- An automatic trial operates until `trialEndsAt`, then uses `graceEndsAt` when
  configured, and finally blocks operations without deleting tenant data.
- Automatic active/past-due subscriptions respect `currentPeriodEnd` and
  `graceEndsAt`. A missing grace deadline never causes an unexpected hard block.
- A blocked user can still open `/subscription-status`, manage their account,
  and log out.
- `userLimit` and `memberLimit` are stored on the SaaS plan but are not enforced
  in this release.
- `TenantModule` remains the effective module grant. SaaS-controlled rows carry
  `grantSource = SAAS_SUBSCRIPTION` and the originating subscription ID.
- Existing grants are migrated as `MANUAL`, so applying the migration alone
  cannot change a tenant's edition.

## Commands

Every command requires an explicit operator identity. Run a dry-run before each
mutation.

```bash
npm run saas:control -- seed-plans --operator hwidifiras --dry-run
npm run saas:control -- seed-plans --operator hwidifiras
```

The seed creates `CLASS`, `GYM`, and `HYBRID` plans with no commercial price.
Re-running it does not overwrite configured prices or limits.

Inspect a tenant:

```bash
npm run saas:control -- inspect \
  --tenant we-discipline \
  --operator hwidifiras
```

Assign a plan:

```bash
npm run saas:control -- assign \
  --tenant example-club \
  --plan HYBRID \
  --status TRIAL \
  --starts-at 2026-08-15T00:00:00Z \
  --trial-ends-at 2026-08-29T23:59:59Z \
  --period-end 2026-08-29T23:59:59Z \
  --automatic-lifecycle true \
  --operator hwidifiras \
  --dry-run
```

Repeat without `--dry-run` only after checking the `before` and `desired`
states. Repeating the exact command is a no-op.

Change commercial status:

```bash
npm run saas:control -- status \
  --tenant example-club \
  --status GRACE \
  --grace-ends-at 2026-09-07T23:59:59Z \
  --operator hwidifiras \
  --dry-run
```

Supported states are `TRIAL`, `ACTIVE`, `PAST_DUE`, `GRACE`, `SUSPENDED`, and
`CANCELLED`.

Use `--automatic-lifecycle false` for subscriptions that must remain under
manual operator control. Always provide coherent trial, period and grace dates
before enabling automatic lifecycle.

Rollback an assignment or status change using the audit ID returned by the
mutation:

```bash
npm run saas:control -- rollback \
  --audit-id <platform-audit-id> \
  --operator hwidifiras \
  --dry-run
```

Rollback refuses to run if the tenant state has changed after the target audit.
Restore the newest action first. A completed rollback creates a new immutable
`PlatformAuditLog`; it never edits the original audit record.

## Deployment Gate

1. Back up PostgreSQL and the deployed environment/configuration.
2. Run the migration against a copied database first.
3. Compare tenant, module, member, subscription, payment, receipt, attendance,
   and gym-visit counts before and after migration.
4. Deploy with no SaaS subscription row for the existing first tenant.
5. Verify that the first tenant reports `LEGACY_ACTIVE` and retains its existing
   module grants.
6. Seed the global plans only after migration.
7. Assign a commercial plan to a test tenant with `--dry-run` first.
8. Keep `GYM_ACCESS` disabled for `we-discipline` until hybrid acceptance is
   explicitly approved.

The legacy `tenant:module` command refuses to modify a grant controlled by a
SaaS subscription. Use `saas:control` for commercial tenants.
