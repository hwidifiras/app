# Deployment checklist

The supported deployment is the PostgreSQL multi-tenant stack in `docs/vps-deployment.md`. Do not create a new production deployment on a file database.

## Before the maintenance window

- [ ] CI is green: Prisma validate/generate, typecheck, lint, PostgreSQL scenarios, and build.
- [ ] The target commit SHA and migration list are recorded.
- [ ] `.env.production` passes `docker compose --env-file .env.production config --quiet`.
- [ ] `POSTGRES_PASSWORD` and `AUTH_SECRET` are unique, non-default secrets.
- [ ] `APP_URL`, `SAAS_ROOT_DOMAIN`, and `DEFAULT_TENANT_SLUG` match the intended tenant routing.
- [ ] Shared REST Redis rate limiting is configured and reachable, and `TRUSTED_PROXY_HOPS` matches the real proxy chain.
- [ ] A compressed PostgreSQL backup exists, is non-empty, and has a checksum.
- [ ] The previous application image/tag and rollback owner are known.

## Deploy

```bash
git pull --ff-only origin main
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production ps --all
docker compose --env-file .env.production logs --tail=150 dojo-migrate dojo-app
```

Accept the deployment only when `dojo-migrate` exited `0`, `dojo-app` is healthy, and both probes succeed:

```bash
curl --fail http://127.0.0.1:3000/api/health
curl --fail http://127.0.0.1:3000/api/ready
```

Then smoke-test login, tenant isolation, one read, and one reversible write through the public TLS hostname.

## Stop conditions

Stop the promotion if configuration validation fails, the migration service exits non-zero, readiness returns `503`, tenant resolution is wrong, or a write smoke test crosses tenant boundaries. Do not repeatedly restart the web service to retry a failed schema migration; diagnose the one-shot migration logs first.

Database rollback is migration-specific. A previous app image does not reverse PostgreSQL schema or data changes. If compatibility is uncertain, stop writes and use the reviewed restoration/forward-fix plan.
