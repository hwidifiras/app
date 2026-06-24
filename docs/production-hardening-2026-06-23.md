# Production hardening - 2026-06-23

This note documents the live production audit and remediation performed on the Gym Day / We Discipline server repo at `/opt/we-discipline`.

## Scope

- Server: `root@178.105.144.196`
- Production repo: `/opt/we-discipline`
- Public domain: `https://we-discipline.com`
- Previous live commit: `2fcd4418c3c57465476ea96e16720f296f1e70a0`
- Updated base commit: `06e55c0d07f164b8b69a6f3b095a6f60ac7e3429`
- DB backup created before rebuild: `/opt/we-discipline-backups/prod-db-before-hardening-20260623-085354.db`
- Nginx site backup created before header change: `/etc/nginx/backups/we-discipline.before-hide-powered-by-20260623`

## Issues found

1. The live server was one commit behind GitHub and missed the attendance/session lifecycle fixes from `06e55c0`.
2. `next@16.2.4` had production security advisories with a same-major patched release available.
3. The app container published port `3001` on all interfaces, allowing direct HTTP access around Nginx.
4. Login and forgot-password rate limits trusted the first `X-Forwarded-For` value.
5. Production responses lacked common browser security headers.
6. The prerendered `/login` response exposed `X-Powered-By: Next.js`.
7. The repo did not pass `npm run lint`.

## Changes applied

- Fast-forwarded the server repo to `06e55c0`, adding:
  - explicit session finalization/reopen flow
  - blocked attendance edits on finalized sessions
  - blocked check-ins on cancelled sessions
  - historical subscription resolution for late attendance
  - overdue session/finalization notifications
- Updated `next` and `eslint-config-next` to `16.2.9`.
- Ran the non-breaking production audit fixer. Runtime audit was reduced from 10 findings to 2 moderate findings:
  - `next` via its bundled `postcss`
  - `postcss <8.5.10` inside `node_modules/next`
  The live production image reports `fixAvailable: false` for both findings, so this is documented as residual vendor risk pending a patched Next/PostCSS bundle.
- Changed Docker port publishing to bind only to localhost:
  - before: `${HOST_PORT:-3000}:3000`
  - after: `127.0.0.1:${HOST_PORT:-3000}:3000`
- Hardened client IP resolution for rate limiting:
  - prefer Nginx-controlled `X-Real-IP`
  - fall back to the last `X-Forwarded-For` hop instead of the spoofable first hop
- Added production security headers through `next.config.ts`:
  - `Content-Security-Policy`
  - `Strict-Transport-Security`
  - `X-Frame-Options`
  - `X-Content-Type-Options`
  - `Referrer-Policy`
  - `Permissions-Policy`
- Set `poweredByHeader: false` in `next.config.ts`.
- Added `proxy_hide_header X-Powered-By;` to the active Nginx site because the prerendered `/login` response still exposed the upstream header after rebuild.
- Fixed the current lint failures without changing production data.

## Verification commands

Run from `/opt/we-discipline`:

```bash
npm run lint
npm test
npm run build
npm audit --omit=dev
docker compose up -d --build
nginx -t
systemctl reload nginx
```

Post-deploy checks:

```bash
docker ps --filter name=dojo-saas-app
curl -Ik https://we-discipline.com/login
curl -I --max-time 5 http://178.105.144.196:3001/login
curl -I --max-time 5 http://127.0.0.1:3001/login
```

Expected result:

- HTTPS route returns `200` for `/login`.
- Direct public `178.105.144.196:3001` is not reachable.
- Local `127.0.0.1:3001` remains reachable for Nginx.
- Response headers include the security headers above.
- Public responses do not include `X-Powered-By`.
- The app container maps `127.0.0.1:3001->3000/tcp`, not `0.0.0.0:3001`.
- `npm audit --omit=dev` still exits non-zero until Next ships a fix for the bundled PostCSS advisory; expected final state is 2 moderate findings and 0 high/critical findings.

## Rollback

If the new container fails after deploy:

```bash
cd /opt/we-discipline
git reset --hard 2fcd4418c3c57465476ea96e16720f296f1e70a0
docker compose up -d --build
```

If database rollback is required, stop the container before restoring the backup:

```bash
docker compose down
cp -a /opt/we-discipline-backups/prod-db-before-hardening-20260623-085354.db /var/lib/docker/volumes/we-discipline_dojo_data/_data/prod.db
docker compose up -d
```

Use DB rollback only if the application data itself is confirmed bad; the remediation was intended to be code/config only.

If the Nginx header change must be rolled back:

```bash
cp -a /etc/nginx/backups/we-discipline.before-hide-powered-by-20260623 /etc/nginx/sites-enabled/we-discipline
nginx -t
systemctl reload nginx
```
