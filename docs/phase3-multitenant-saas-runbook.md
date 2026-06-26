# Phase 3 Multi-Tenant SaaS Runbook

## Current Safety State

- Feature branch: `codex/phase3-multitenant-saas`.
- Live backup created before schema work: `/root/we-discipline-backups/phase3-20260624T200741Z`.
- Backup contents include live git status, live uncommitted patch, untracked files archive, `.env.production`, Docker/Nginx config, branding, and `/app/data/prod.db`.
- Do not deploy this branch over `/opt/we-discipline` until the live dirty worktree is reconciled or intentionally discarded by the owner.

## Staging Cutover Flow

1. Push `codex/phase3-multitenant-saas` to Git.
2. On the VPS, create a clean staging checkout separate from `/opt/we-discipline`.
3. Copy production env values into a staging env and set:
   - `HOST_PORT=3002`
   - `SAAS_ROOT_DOMAIN=we-discipline.com`
   - `DEFAULT_TENANT_SLUG=we-discipline`
   - `DEFAULT_TENANT_ID=tenant_we_discipline`
   - `DEFAULT_TENANT_ROOT_ALIAS=we-discipline.com`
4. Start the parallel stack:
   ```bash
   docker compose -f docker-compose.saas-staging.yml up -d --build
   ```
5. Import the backed-up SQLite DB into the staging Postgres DB:
   ```bash
   SQLITE_SOURCE_PATH=/path/to/prod.db \
   DEFAULT_TENANT_SLUG=we-discipline \
   DEFAULT_TENANT_ID=tenant_we_discipline \
   DEFAULT_TENANT_ROOT_ALIAS=we-discipline.com \
   npm run saas:migrate:sqlite
   ```
6. Verify the import:
   ```bash
   SQLITE_SOURCE_PATH=/path/to/prod.db \
   DEFAULT_TENANT_SLUG=we-discipline \
   npm run saas:verify:migration
   ```
7. Smoke test staging through `127.0.0.1:3002` or a temporary Nginx host before changing production traffic.

## Cutover And Rollback

- Cutover is only an Nginx `proxy_pass` switch from the current app port to the SaaS staging port after import verification and browser smoke tests pass.
- Keep the old SQLite app container, Docker volume, backup DB, and old Nginx file until the SaaS app has survived a real operating window.
- Rollback is the reverse Nginx `proxy_pass` switch to the old app port.

## Verification Already Performed

- `npx prisma validate`
- `npm run lint`
- `npm run build`
- Isolated Postgres migration reset through the new baseline
- SQLite backup import from `/root/we-discipline-backups/phase3-20260624T200741Z/prod.db`
- `npm run saas:verify:migration` matched counts and business totals for the copied live DB
- Fast/medium Vitest suite plus tenant isolation tests passed against isolated Postgres
- Full `tests/dojo-scenarios.test.ts` is too slow over the SSH tunnel; a representative payment scenario was run and fixed/passed.

## Continuation Check - 2026-06-26

- Local branch `codex/phase3-multitenant-saas` was already chunked and pushed in four commits.
- Local ignored `.env.development` was corrected from SQLite to the Postgres dev URL so plain Prisma commands validate this branch correctly.
- `npx prisma validate` passed after the ignored local env correction.
- `npm run lint` passed.
- `npm run build` passed.
- `npm audit --omit=dev` still reports the moderate PostCSS advisory through `next`; the suggested `--force` fix would install a breaking `next` version and was not applied.
- `npm test` is currently blocked on this Windows machine because no local Postgres server, Docker, WSL, or Podman runtime is available on `localhost:5432`.
- VPS access to `178.105.144.196` timed out on SSH and connectivity checks, so live dirty-state reconciliation and parallel staging deploy could not be completed in this continuation window.

## Known Follow-Up Before Production

- Reconcile live dirty files in `/opt/we-discipline` with this branch before staging deploy.
- Run the full scenario suite in an environment with local Postgres, not through the SSH tunnel.
- Review `npm audit --omit=dev`: current advisory is a moderate PostCSS issue through `next`; npm only suggests a breaking forced change, so no automatic fix was applied.
