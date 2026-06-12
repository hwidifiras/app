# Production server handoff

Last verified: June 12, 2026.

## Current deployment

- Single-client production VPS running Ubuntu 26.04 LTS.
- Repository: `/opt/we-discipline`, branch `master`.
- Deployed commit: `beb88dc` (`Fix Docker postinstall script availability`).
- Docker Compose service: `dojo-app`; container: `dojo-saas-app`.
- Host mapping: port `3001` to container port `3000`.
- Runtime: Node.js `22.22.3`, Next.js `16.2.4`.
- Database: SQLite at `/app/data/prod.db`.
- Persistent volume: `we-discipline_dojo_data`.
- Prisma status: 21 migrations applied, no pending migrations.
- Branding volume: `we-discipline_dojo_branding`.

The current SQLite and environment configuration is working. Do not migrate to
PostgreSQL or replace production environment files without first inspecting the
server, taking a verified backup, and agreeing on a rollback procedure.

## Last deployment

The responsive UI and reception workflow release was deployed successfully:

1. A stopped-container backup was created at
   `/opt/we-discipline-backups/dojo-data-20260612-101706.tar.gz`.
2. The archive contains `prod.db`; its SHA-256 starts with `ce43da73`.
3. Commits `aaaf647` and `beb88dc` were pulled with `git pull --ff-only`.
4. `docker compose build dojo-app` completed successfully.
5. `docker compose up -d dojo-app` replaced the container while retaining the
   existing volumes.
6. `/login` returned HTTP 200 and application logs reported Next.js ready.

## Safe update sequence

```bash
cd /opt/we-discipline
git status -sb
git fetch origin
git log --oneline HEAD..origin/master
git pull --ff-only origin master
docker compose build dojo-app
docker compose up -d dojo-app
docker compose ps
docker compose logs --tail=120 dojo-app
curl -I http://127.0.0.1:3001/login
```

Build the new image before replacing the running container. Never delete
`we-discipline_dojo_data` during deployment.

