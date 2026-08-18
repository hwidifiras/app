# Public product demo

The public demo uses the normal tenant application. It does not maintain a second dashboard implementation.

## Safety model

- The marketing route `/demo` redirects to the configured demo workspace.
- `/api/auth/demo` creates a host-only session only for a tenant listed in `SAAS_DEMO_TENANT_SLUGS`.
- Demo tenants are read-only at the proxy boundary. All non-safe requests are rejected except login, demo login, and logout.
- Demo data uses the `public-demo-` ID prefix and the seed command refuses tenant slugs that do not contain `demo`.
- The production club and demo pilot should use separate databases and application containers.

## Environment

```dotenv
SAAS_DEMO_TENANT_SLUGS="martial-demo"
SAAS_DEMO_ACCOUNT_EMAIL="demo@we-discipline.test"
SAAS_DEMO_WORKSPACE_URL="https://martial-demo.example.com"
```

Leaving `SAAS_DEMO_TENANT_SLUGS` and `SAAS_DEMO_WORKSPACE_URL` empty disables one-click demo access.

## Seed commands

Inspect the current demo records:

```bash
DEMO_TENANT_SLUG=martial-demo npm run demo:status
```

Replace only `public-demo-` records inside the demo tenant:

```bash
DEMO_TENANT_SLUG=martial-demo npm run demo:seed
```

Create and checksum a PostgreSQL backup before reseeding a cloud demo database. The seed is idempotent and prints the resulting member, session, subscription, payment, receipt, attendance, and debt totals.

## Release checks

1. Open `/demo` from the marketing hostname.
2. Confirm the browser lands on the real tenant dashboard and displays the demo banner.
3. Open members, subscriptions, payments, pointage, planning, groups, coaches, disciplines, formulas, offers, settings, and logs.
4. Attempt one harmless write and confirm the server returns `DEMO_READ_ONLY` without changing counts.
5. Log out, then reopen `/demo` and confirm one-click access still works.
