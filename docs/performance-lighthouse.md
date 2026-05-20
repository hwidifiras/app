# Performance & Lighthouse

Automated checks for **mobile** and **desktop** using [Lighthouse](https://developer.chrome.com/docs/lighthouse/) against a **production** Next.js build.

## Why `/login` by default?

Most app routes require authentication. Lighthouse runs without a session, so audits target the public login page. Scores reflect first-load UX for staff signing in.

To audit authenticated pages, set a session cookie (advanced) or use Chrome DevTools Lighthouse while logged in.

## Quick run

Stop `npm run dev` first — Lighthouse needs port 3000 free for **production** `next start` (dev mode skews scores).

```bash
# Terminal A
npm run build
npm run start

# Terminal B
npm run lighthouse
```

Reports are written under `reports/lighthouse/<timestamp>/` (JSON + terminal summary table).

## One-shot (CI / local)

Starts the server, runs tests + build + Lighthouse, then stops the server:

```bash
npm run perf:check:local
```

## Scripts

| Command | What it does |
|---------|----------------|
| `npm run lighthouse` | Mobile + desktop Lighthouse on configured paths |
| `npm run perf:check` | `npm test` + `npm run build` + Lighthouse (server must already run) |
| `npm run perf:check:local` | Same + auto-start/stop `next start` |

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `LIGHTHOUSE_BASE_URL` | `http://127.0.0.1:3000` | Server URL |
| `LIGHTHOUSE_PATHS` | `/login` | Comma-separated paths |
| `LIGHTHOUSE_MIN_PERF` | `0` | Fail if performance score below (0 = off) |
| `LIGHTHOUSE_MIN_A11Y` | `0` | Fail if accessibility score below (0 = off) |

Example stricter gate:

```bash
LIGHTHOUSE_MIN_PERF=70 LIGHTHOUSE_MIN_A11Y=90 npm run lighthouse
```

## Mobile vs desktop

Each path is audited twice:

- **Mobile** — `--form-factor=mobile` (typical phone viewport & throttling)
- **Desktop** — `--preset=desktop`

Metrics in the summary: **Performance**, **Accessibility**, **Best practices**, **SEO**, plus **LCP**, **INP**, **CLS**.

## Manual QA (recommended)

Lighthouse does not replace reception workflows. After automated checks, verify on real devices (see `first-client-handoff.md` §5):

- iPhone Safari — bottom nav, drawers, enrollment scroll
- Android Chrome — same
- Desktop Chrome — sidebar, user menu, tables

## Chrome DevTools (adhoc)

1. Open the deployed or local URL in Chrome.
2. DevTools → **Lighthouse** tab.
3. Mode: **Navigation**; Device: **Mobile** or **Desktop**.
4. Run on `/login` (logged out) or any page while logged in.

## Improving scores

Common wins for this stack:

- Keep using production build for measurements (`next start`, not `next dev`).
- Optimize images (WebP, explicit width/height, avoid huge club logos).
- Avoid loading heavy client bundles on public pages.
- Prefer server components where pages are mostly static.

Authenticated dashboard scores depend on API latency and client hydration — profile with Network throttling in DevTools.

## Baseline (local, `/login`)

Example scores when the production server is running (your machine may differ):

| Profile | Performance | Accessibility | Best practices | SEO | LCP |
|---------|-------------|---------------|----------------|-----|-----|
| Mobile | ~90+ | 100 | ~95+ | ~90+ | ~2–3 s |
| Desktop | ~95+ | 100 | ~95+ | ~90+ | &lt; 1 s |

Optional CI gate: `LIGHTHOUSE_MIN_PERF=85 LIGHTHOUSE_MIN_A11Y=95 npm run lighthouse`
