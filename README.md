# GymDay

Reception interface for gym/dojo management: members, subscriptions, attendance, payments, enrollment, and club settings.

## Quick start (development)

```bash
npm ci
cp .env.development.example .env.development   # or use .env.example
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). First admin: `npm run admin:create:dev`.

If migrations fail on an existing DB: `npm run prisma:repair:dev`.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server (runs migrations via `predev`) |
| `npm test` | API & business rules (39 scenarios) |
| `npm run build` | Production build |
| `npm run handoff:check` | Tests + build before client handoff |
| `npm run lighthouse` | Lighthouse mobile + desktop (server must be running) |
| `npm run perf:check:local` | Tests + build + Lighthouse one-shot |
| `npm run admin:create:dev` | Create admin user (dev DB) |

## Documentation

- **[First client handoff](docs/first-client-handoff.md)** — deploy, config, manual QA (Safari/Chrome)
- [Performance & Lighthouse](docs/performance-lighthouse.md) — mobile + desktop audits
- [Dev mode](docs/dev-mode.md)
- [VPS deployment](docs/vps-deployment.md)
- [Current production server handoff](docs/production-server-handoff.md)
- [Scenario audit (code ↔ tests ↔ rules)](docs/scenario-audit.md)
- [Deployment tonight](docs/deployment-tonight.md)
- [Database architecture](docs/DATABASE-ARCHITECTURE.md)

## Stack

Next.js 16 · React 19 · Prisma · SQLite (dev) / Postgres (production recommended) · Tailwind 4
