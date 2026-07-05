# Product Readiness Browser QA - 2026-07-05

## Scope

Read-only browser QA against the currently reachable live app at `https://we-discipline.com`.

Captured desktop `1440x900` and mobile `390x844` screenshots for:

- `/settings`
- `/settings/users`
- `/settings/club`
- `/settings/schedules`
- `/settings/data-import`
- `/logs`

Screenshots and raw capture metadata are stored locally and intentionally ignored by Git:

- `docs/audits/product-readiness-browser-2026-07-05/screenshots/`
- `docs/audits/product-readiness-browser-2026-07-05/capture-results.json`

## Important Environment Finding

The live app is not running the current branch state.

Evidence:

- `https://we-discipline.com/settings` returns `404` in both desktop and mobile captures.
- Current code contains `src/app/settings/page.tsx`.
- Live `/settings/users` still opens directly on the old create form instead of the newly committed role-summary and role-card layout.
- Live `/settings/schedules` still opens with the old always-visible template creation form instead of the newly committed collapsed creation flow and summary metrics.

Conclusion:

- These screenshots are useful as production gap evidence.
- They do not prove the latest committed UI changes are visually correct.
- Browser QA for the new branch still requires either deployment to staging/live or a local Postgres-backed dev runtime.

## Current Live Visual Findings

### `/settings`

Severity: High

Finding: route returns `404`.

Impact: the sidebar/settings hub can feel broken if a user reaches the generic settings route.

Current branch status: fixed in code, not live.

### `/settings/users`

Severity: Medium

Finding: the page is functional but starts directly with a long create-user form. It does not show access posture first.

Impact: a club admin has to infer the difference between Admin, Reception, and Coach from form controls.

Current branch status: improved in code with summary metrics and role-first creation, not live.

### `/settings/club`

Severity: Medium

Finding: mobile starts with a dense rules card and then jumps into the form. It is usable, but it reads more like internal configuration than guided club preferences.

Impact: pointage, receipt, and planning preferences are important enough to deserve a clearer summary before the long form.

Current branch status: improved in code with summary metrics and operational framing, not live.

### `/settings/schedules`

Severity: Medium

Finding: the old live page mixes template creation and application in the first viewport. Template creation is shown even when the admin likely wants to apply or review existing templates.

Impact: this makes the season/horaire workflow look more complex than it is.

Current branch status: improved in code with collapsed creation, summary metrics, selected-template preview, and stale-preview reset, not live.

### `/settings/data-import`

Severity: Medium

Finding: the live page is functional, but the first viewport does not clearly explain when reprise mode should be used or when rollback is no longer safe.

Impact: data import is a high-risk admin flow; unclear framing can cause misuse.

Current branch status: improved in code with migration readiness metrics and safety guidance, not live.

### `/logs`

Severity: Low

Finding: filters are present and the table/card layout works on mobile, but the page still feels like a raw audit list before explaining volume or category mix.

Impact: admin users may not immediately understand which entries are business actions versus system noise.

Current branch status: improved in code with summary metrics, not live.

## Responsive Evidence

No page-level horizontal overflow was detected in the captured live pages:

- Desktop captures reported `scrollWidth <= clientWidth`.
- Mobile captures reported `scrollWidth <= clientWidth`.

Limit:

- This only applies to the currently deployed live pages.
- The latest branch needs a second screenshot pass after deploy or local runtime.

## Runtime Blockers For Current-Branch Browser QA

- Local port `3000` is not serving the app.
- `.env.development` points to `postgresql://gymday:gymday@localhost:5432/gymday_dev`.
- Local PostgreSQL is not reachable on `localhost:5432`.
- Docker is not available in this Windows environment, so the isolated `docker-compose.dev.yml` stack cannot be started here.

## Recommended Next Step

Deploy the current branch to staging/live, or provide a reachable disposable local Postgres database, then repeat screenshots for:

- `/settings`
- `/settings/users`
- `/settings/club`
- `/settings/schedules`
- `/settings/data-import`
- `/logs`

Only after that pass should the latest UI changes be marked browser-QA complete.
