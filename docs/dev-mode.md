# Development environments

PostgreSQL is required for local development, tests, staging, and production. Keep each environment on a separate database and never point reset scripts at production.

| Environment | Database | App port | Environment file |
| --- | --- | --- | --- |
| Local hot reload | `gymday_dev` on local PostgreSQL | 3000 | `.env.development` |
| Docker development | `gymday_dev` in `dojo_postgres_dev` | 3001 | `.env.development` |
| Tests | disposable database containing `test` in its name | none | `TEST_DATABASE_URL` |
| Production | `gymday_prod` in `dojo_postgres` or managed PostgreSQL | 3000 by default | `.env.production` |

## Local hot reload

Start PostgreSQL 16 on `localhost:5432`, then:

```powershell
Copy-Item .env.development.example .env.development
npm run dev:setup
npm run dev
```

`dev:setup` applies migrations and generates the Prisma client using `.env.development`. Open `http://localhost:3000`.

Create a development admin with:

```powershell
npm run admin:create:dev
```

## Docker development stack

The Docker stack uses a separate PostgreSQL volume and the production image shape:

```powershell
Copy-Item .env.development.example .env.development
npm run docker:dev:up
docker compose -f docker-compose.dev.yml ps --all
```

Open `http://localhost:3001`. `dojo-dev-migrate` exits `0` after applying migrations; `dojo-dev` then starts and becomes healthy through `/api/ready`.

Stop it without deleting data:

```powershell
npm run docker:dev:down
```

## Tests

Start a disposable PostgreSQL database, then set `TEST_DATABASE_URL` if it is not available at the default local URL:

```powershell
$env:TEST_DATABASE_URL = "postgresql://gymday:gymday@localhost:5432/gymday_test?schema=public"
npm test
```

The pretest guard refuses a non-local or non-test-looking database unless an explicit override is set. Do not use that override in routine development or CI.

## Reset development data

Local reset and seed:

```powershell
npm run dev:reset
```

Docker-only reset:

```powershell
docker compose -f docker-compose.dev.yml down -v
npm run docker:dev:up
```

Both commands are destructive to development data. They do not target the production Compose volume.

## Promote a change

1. Run `npm run typecheck`, `npm run lint -- --no-cache`, `npm test`, and `npm run build`.
2. Review migrations and confirm they are backward compatible with the intended rollout.
3. Back up production PostgreSQL.
4. Follow `docs/vps-deployment.md`; the one-shot migration service must exit `0` before the app becomes ready.
