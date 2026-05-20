# Dev fork (parallel environment)

Use a **separate dev environment** while you ship many changes. Production (client VPS or `docker compose` on port **3000**) stays untouched.

## What is isolated

| | Production | Dev fork |
|---|------------|----------|
| Database | `prod.db` (Docker volume) or your prod file | `prisma/dev.db` or Docker volume `dojo_data_dev` |
| Port (Docker) | 3000 | **3001** |
| Env file | `.env.production` | `.env.development` |
| Hot reload | No (`next start`) | Yes (`npm run dev`) |

## Option A — Local dev (recommended for UI work)

Best when you change screens often (tables, forms, mobile layout).

```powershell
cd app
npm run dev:setup
npm run dev
```

Open http://localhost:3000

- Uses `.env.development` (create it with `dev:setup` from the example).
- SQLite file: `prisma/dev.db` (not your production DB).
- Edit code → browser refreshes automatically.

Create a dev admin (once):

```powershell
npm run admin:create
```

## Option B — Docker dev sandbox (port 3001)

Same production image as the VPS, but **another database** and port. Good to test migrations/build before deploying.

```powershell
cd app
copy .env.development.example .env.development
# Edit AUTH_SECRET and APP_URL=http://localhost:3001 in .env.development

npm run docker:dev:up
```

Open http://localhost:3001

Stop dev container (prod on 3000 unaffected):

```powershell
npm run docker:dev:down
```

## Option C — Git branch for a dev period

```powershell
git checkout -b dev/sprint-may
# work, commit often
git push -u origin dev/sprint-may
```

When stable, merge into `main` and redeploy production only when ready.

## Running prod + dev at the same time

| Stack | Command | URL |
|-------|---------|-----|
| Production Docker | `docker compose up -d` | http://localhost:3000 |
| Dev Docker | `docker compose -f docker-compose.dev.yml up -d` | http://localhost:3001 |
| Local hot reload | `npm run dev` | http://localhost:3000 |

Do not run **local `npm run dev`** and **production Docker on 3000** together — same port. Use dev Docker on **3001** or stop prod first.

## Reset dev data only

```powershell
# Local SQLite
Remove-Item prisma\dev.db -ErrorAction SilentlyContinue
npm run dev:setup

# Docker dev volume
docker compose -f docker-compose.dev.yml down -v
npm run docker:dev:up
```

Production `dojo_data` volume is **not** removed by the commands above.

## Promote dev → production

1. Run tests: `npm test`
2. Build: `npm run build`
3. On VPS: pull code, `docker compose up -d --build` (see `docs/vps-deployment.md`)

Never copy `prisma/dev.db` over production `prod.db`.
