# GymDay — First client handoff

Checklist to go from dev to reception-ready for one club.

## 1. Environment (production)

Copy `.env.production.example` → `.env` (or host secrets) and set:

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | Yes | Postgres recommended for production (Neon, etc.). SQLite OK for single-VPS demo. |
| `AUTH_SECRET` | Yes | Long random string (not dev default). |
| `APP_URL` | Yes | Public URL, no trailing slash. |
| `APP_NAME` | No | Product name (default GymDay). Shown when club name is empty. |
| `APP_TIMEZONE` | No | Default `Africa/Tunis`. |
| `ALLOW_PUBLIC_REGISTER` | No | Keep `false`; staff created in Paramètres → Utilisateurs. |
| `RESEND_API_KEY` | For reset email | Password reset + admin “send reset”. |
| `PASSWORD_RESET_FROM` | With Resend | Verified sender domain. |

## 2. Database & first admin

```bash
npm ci
npx prisma generate
npm run prisma:migrate:dev   # or: npx prisma migrate deploy (production)
npm run admin:create:dev     # interactive first admin (dev)
# production: npm run admin:create
```

If migrations fail on an existing DB: `npm run prisma:repair:dev` then retry.

## 3. Club configuration (admin)

1. **Paramètres → Règles du club** — club name, logo, address, phone, pointage rules, debt threshold, staff discount cap.
2. **Premiers pas** (guide in top bar) — complete: discipline → coach → cours → formule → élève.
3. **Paramètres → Utilisateurs** — create reception staff (limited permissions if needed).

## 4. Automated verification

```bash
npm run handoff:check
```

Runs: Prisma generate hint, tests (28 scenarios), production build.

## 5. Manual QA — phones & browsers

Test on **iPhone Safari** and **Android Chrome** (minimum). Desktop **Chrome** for sidebar/settings.

### Auth
- [ ] Login / logout
- [ ] Forgot password (with Resend configured)
- [ ] Staff with limited permissions cannot open Règles du club

### Daily reception
- [ ] Dashboard loads, debt list respects threshold
- [ ] **Pointer du jour** — open session drawer, scroll list, présent / absent / exception
- [ ] **Inscrire** — full wizard (adult or child), quote + apply
- [ ] **Encaisser** — payment on subscription
- [ ] Bottom nav does not hide last form field (enrollment, payment)

### Branding & theme
- [ ] Club name + logo in mobile header and desktop sidebar
- [ ] Light / dark / system theme persists after reload

### Configuration
- [ ] Create sport, coach, group, plan, member
- [ ] Offers page (if used)
- [ ] Journal actions (admin)

### Safari-specific
- [ ] Check-in drawer height (no content under home indicator)
- [ ] Logo upload from Photos
- [ ] No horizontal scroll on main pages

## 6. Deploy paths

| Path | Doc |
|------|-----|
| VPS + Docker + SQLite (quick demo) | `docs/vps-deployment.md` |
| Tonight checklist | `docs/deployment-tonight.md` |
| Dev machine | `docs/dev-mode.md` |
| DB model | `docs/DATABASE-ARCHITECTURE.md` |

## 7. Out of scope (v1)

- Multi-club / multi-tenant SaaS
- Public self-registration UI
- Per-user onboarding (guide is per club data)
- Native app / offline
- Automated browser E2E (manual matrix above)

## 8. Support after handoff

- Backups: schedule SQLite file or Postgres dumps.
- Updates: `git pull`, `npm ci`, `npx prisma migrate deploy`, rebuild Docker or redeploy Vercel.
- Logs: server stdout + **Paramètres → Journal actions**.
