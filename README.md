# GymDay

Multi-tenant SaaS for gym and dojo operations: members, subscriptions, attendance, payments, enrollment, planning, reporting, and club settings.

## Quick start

PostgreSQL is required in every environment. Start a local PostgreSQL 16 instance, then:

```bash
npm ci
cp .env.development.example .env.development
npm run dev:setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Create the first development admin with `npm run admin:create:dev`.

For an isolated container stack instead, run `npm run docker:dev:up` and open [http://localhost:3001](http://localhost:3001).

## Release checks

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | Validate TypeScript without emitting files |
| `npm run lint` | Run ESLint |
| `npm test` | Reset a disposable PostgreSQL test database and run scenarios |
| `npm run build` | Create the production Next.js build |
| `npm run config:validate:production` | Fail on missing, default, or unsafe production configuration |
| `npm run handoff:check` | Run the scenario suite and production build |

The GitHub Actions workflow runs install, Prisma validation and generation, typecheck, lint, PostgreSQL-backed tests, and the production build.

## Operations

- `GET /api/health` is the liveness check and does not query PostgreSQL.
- `GET /api/ready` is the readiness check and returns `503` until PostgreSQL is reachable.
- Docker Compose runs migrations and permission backfills in a one-shot migration service before starting the web service.
- The migration service first runs `npm run db:preflight:tenant-guardrails` and stops before schema changes if legacy rows have missing tenant assignments or cross-tenant references.
- Schedule `npm run db:prune:idempotency` as a low-traffic maintenance job (for example hourly); it removes expired retry records in bounded, lock-skipping batches.
- PostgreSQL data is stored in the `dojo_postgres` volume in the production Compose stack.

## Documentation

- [VPS deployment](docs/vps-deployment.md)
- [Production handoff](docs/production-server-handoff.md)
- [First client handoff](docs/first-client-handoff.md)
- [Development environments](docs/dev-mode.md)
- [PostgreSQL migration and tenant cutover](docs/phase3-multitenant-saas-runbook.md)
- [Performance and Lighthouse](docs/performance-lighthouse.md)
- [Scenario audit](docs/scenario-audit.md)
- [Database architecture](docs/DATABASE-ARCHITECTURE.md)

## Stack

Next.js 16 · React 19 · Prisma 6 · PostgreSQL 16 · Tailwind CSS 4
