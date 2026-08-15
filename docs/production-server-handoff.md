# Production server handoff

Updated: July 13, 2026.

This document describes the production shape of the current repository. It is not proof that a legacy server has already completed its PostgreSQL cutover; verify the live host, branch, database, and backup before promoting this stack.

## Supported production topology

- Runtime: Node.js 22 and Next.js 16 in `dojo-app`.
- Database: PostgreSQL 16 in `postgres` or a managed PostgreSQL service.
- Schema changes: one-shot `dojo-migrate` service, which must exit `0` before `dojo-app` starts.
- Tenant routing: `SAAS_ROOT_DOMAIN` plus `DEFAULT_TENANT_SLUG`; tenant-scoped records use `tenantId`.
- Persistence: `dojo_postgres` for PostgreSQL data and `dojo_branding` for uploaded branding.
- Network: the app listens on container port `3000` and is bound to `127.0.0.1:${HOST_PORT:-3000}`.
- Probes: `/api/health` for liveness and `/api/ready` for database-backed readiness.

## Required handoff evidence

Record these values for each production promotion:

- VPS hostname and application directory.
- Git branch and exact commit SHA.
- Compose version and rendered configuration validation result.
- PostgreSQL server/version and database name.
- Timestamp, path, size, and checksum of the verified pre-deployment `pg_dump`.
- Migration service exit code and logs.
- App readiness response through localhost and the public TLS endpoint.
- Login and one tenant-scoped read/write smoke test.

Never copy a development environment file onto the server. Keep `.env.production` mode `0600`, outside source control, and use real values for `POSTGRES_PASSWORD`, `AUTH_SECRET`, `APP_URL`, `SAAS_ROOT_DOMAIN`, `DEFAULT_TENANT_SLUG`, `RATE_LIMIT_REDIS_REST_URL`, and `RATE_LIMIT_REDIS_REST_TOKEN`. Set `TRUSTED_PROXY_HOPS=1` for the documented direct Nginx-to-app topology; any other value requires a reviewed proxy chain.

## Safe update sequence

```bash
cd /opt/gymday
git status --short
git fetch origin
git log --oneline HEAD..origin/main

mkdir -p /opt/gymday-backups
docker compose --env-file .env.production exec -T postgres \
  sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "/opt/gymday-backups/gymday-$(date -u +%Y%m%dT%H%M%SZ).dump"

git pull --ff-only origin main
docker compose --env-file .env.production config --quiet
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production ps --all
docker compose --env-file .env.production logs --tail=150 dojo-migrate dojo-app
curl --fail http://127.0.0.1:${HOST_PORT:-3000}/api/health
curl --fail http://127.0.0.1:${HOST_PORT:-3000}/api/ready
```

`dojo-migrate` being stopped with exit code `0` is expected. The web container must be healthy before Nginx sends it traffic.

## First production bootstrap

After the migration succeeds, create the initial tenant administrator:

```bash
docker compose --env-file .env.production exec \
  -e ADMIN_EMAIL=admin@example.com \
  -e ADMIN_NAME="Admin" \
  -e ADMIN_PASSWORD="replace-with-a-strong-password" \
  dojo-app npm run admin:create
```

If a previous single-tenant deployment must be imported, follow `docs/phase3-multitenant-saas-runbook.md` and verify the migration before changing Nginx. Do not improvise a database conversion during the normal update sequence.

## Rollback boundary

Application rollback and database rollback are separate decisions. Preserve the previous image/tag and the pre-deployment PostgreSQL dump. If a migration is backward compatible, roll back the app image and keep the database. If it is not, stop writes and follow the migration-specific restoration plan. Never delete the PostgreSQL or branding volumes as part of an app rollback.
