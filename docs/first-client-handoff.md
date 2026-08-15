# GymDay first-client handoff

Use this checklist to move one tenant from configuration to reception-ready operation on the PostgreSQL multi-tenant stack.

## 1. Production environment

Copy `.env.production.example` to `.env.production` and configure:

| Variable | Required | Notes |
| --- | --- | --- |
| `POSTGRES_USER` | Compose | Database role; default `gymday` is acceptable. |
| `POSTGRES_PASSWORD` | Compose | Generate a unique hexadecimal value with `openssl rand -hex 32`. |
| `POSTGRES_DB` | Compose | Production database name. |
| `DATABASE_URL` | Non-Compose | Required for a managed/external PostgreSQL deployment. |
| `AUTH_SECRET` | Yes | Unique random value of at least 32 characters. |
| `APP_URL` | Yes | Public `https://` URL. |
| `SAAS_ROOT_DOMAIN` | Yes | Root domain used to resolve tenants. |
| `DEFAULT_TENANT_SLUG` | Yes | DNS-safe slug for the first tenant. |
| `APP_TIMEZONE` | Yes | Club reporting timezone, for example `Africa/Tunis`. |
| `ALLOW_PUBLIC_REGISTER` | No | Keep `false`; admins create staff users. |
| `RATE_LIMIT_REDIS_REST_URL` | Yes | HTTPS REST Redis endpoint shared by all replicas. |
| `RATE_LIMIT_REDIS_REST_TOKEN` | Yes | Secret token for the shared rate-limit backend. |
| `TRUSTED_PROXY_HOPS` | Yes | `1` for direct Nginx-to-app; change only for a reviewed proxy chain. |
| `RESEND_API_KEY` | Optional | Configure together with `PASSWORD_RESET_FROM`. |
| `PASSWORD_RESET_FROM` | Optional | Verified sender used for reset email. |

Run `npm run config:validate:production` in an environment where these values are loaded. Production startup fails closed when a required value is missing or still uses a default/placeholder.

## 2. Database and first admin

For Docker Compose, `dojo-migrate` applies committed PostgreSQL migrations and the permission backfill before the app starts:

```bash
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production ps --all
docker compose --env-file .env.production logs --tail=150 dojo-migrate dojo-app
```

Create the first administrator in the default tenant:

```bash
docker compose --env-file .env.production exec \
  -e ADMIN_EMAIL=admin@example.com \
  -e ADMIN_NAME="Admin" \
  -e ADMIN_PASSWORD="replace-with-a-strong-password" \
  dojo-app npm run admin:create
```

For a non-Compose deployment, run `npm run db:preflight:tenant-guardrails` and then `npx prisma migrate deploy` once as a release job before starting the new app version. The preflight reports legacy rows with a missing `tenantId` or cross-tenant child reference before the enforcing migration can fail. Do not run development migrations against production.

Schedule `npm run db:prune:idempotency` hourly as a low-traffic maintenance job. Each run removes expired retry records in bounded batches; tune `IDEMPOTENCY_PRUNE_BATCH_SIZE` and `IDEMPOTENCY_PRUNE_MAX_BATCHES` only after observing database load.

## 3. Tenant configuration

1. Open Settings and configure club identity, contact details, timezone, legal receipt details, attendance rules, and debt threshold.
2. Confirm the enabled tenant modules before adding module-specific data.
3. Complete the onboarding order: discipline, coach, course/group, plan, then member.
4. Create reception staff in Settings > Users and grant only the permissions needed for their role.
5. Configure email and send a password-reset test if the client will use reset delivery.

## 4. Automated release verification

CI must pass install, Prisma validation/generation, typecheck, lint, disposable PostgreSQL tests, and the production build. Locally, run:

```bash
npm run typecheck
npm run lint -- --no-cache
npm test
npm run build
```

`npm test` intentionally resets the configured test database. Use only `TEST_DATABASE_URL` pointing at a disposable database whose name contains `test`.

After deployment, verify:

```bash
curl --fail https://app.example.com/api/health
curl --fail https://app.example.com/api/ready
```

## 5. Manual QA

Test iPhone Safari, Android Chrome, and desktop Chrome.

### Authentication and tenant isolation

- [ ] Login, logout, forgot password, and reset password work.
- [ ] Public registration is disabled unless explicitly approved.
- [ ] A limited staff user cannot open or mutate restricted settings.
- [ ] Requests on the tenant hostname show only that tenant's data.

### Daily reception

- [ ] Dashboard loads current operational data.
- [ ] Today's attendance can mark present, absent, and exception states.
- [ ] A complete adult and child enrollment produces the expected quote and records.
- [ ] A payment updates the balance and receipt state once.
- [ ] Member, subscription, group, and payment correction paths work.

### Branding, theme, and responsive behavior

- [ ] Tenant name and logo appear consistently in the authenticated shell.
- [ ] Light, dark, and system theme persist after reload.
- [ ] Drawers, dialogs, tables/cards, and bottom navigation remain usable on mobile.
- [ ] No primary screen has horizontal overflow.

## 6. Operational handoff

- Schedule PostgreSQL `pg_dump` backups and test a restore into a disposable database.
- Document the repository commit, environment owner, tenant slug/domain, backup location, and support contact.
- Monitor `/api/ready`, container restart counts, PostgreSQL storage, and application error logs.
- Follow `docs/vps-deployment.md` for deployment and `docs/production-server-handoff.md` for every update.

Platform billing, fully self-service tenant provisioning, and cross-region high availability remain separate product/operations projects; they are not reasons to weaken tenant isolation or share one tenant's credentials with another.
