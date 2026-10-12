# Electron baseline verification

Baseline checked on 12 October 2026: deployed source commit `3bd00f0`, before Electron implementation. The application is not yet desktop-release ready.

## Results

| Check | Result |
| --- | --- |
| Repository inventory | 54 page files, 72 API route files, 174 component files, 45 Prisma models, 29 migrations and 60 test files. |
| Clean PostgreSQL migration | All 29 migrations applied successfully to a new disposable PostgreSQL 16 database. |
| Full existing Vitest suite | 365 tests: **361 passed, 4 failed, 0 pending**, across 60 files. |
| Diff whitespace | `git diff --check` passed. |
| Electron executable, installer and native tests | Not implemented or run in this planning branch. |
| Clean dependency installation, full build, lint and typecheck | Deferred to implementation milestone 0 and clean CI. |

The test database was a separately created local container with synthetic fixtures. No production database URL or production mutation was used. Tests used the existing dependency installation from the sibling checkout through an ignored `node_modules` symlink; both checkouts have identical Prisma schema hashes. Node was v22.22.1 and Vitest was v3.2.7. Because this was not a fresh install from this branch's lockfile, repeat the baseline under a clean locked installation before interpreting every failure as a production defect.

An initial subset run used the no-database configuration and therefore failed six database-dependent lifecycle tests for missing `DATABASE_URL`. The complete disposable-database run supersedes that attempt; only the four failures below remain in the reported full-suite result.

## Failures to resolve before release

| File and case | Observed failure | Investigation or repair |
| --- | --- | --- |
| `tests/dojo-scenarios.test.ts` — child enrollment without own phone | Validation returned false instead of true. | The fixture omits `birthDate`, which the enrollment schema requires. Correct the fixture and retain a meaningful parent-phone/optional-child-phone test; confirm the form's actual validation. |
| `tests/gym-report.test.ts` — tenant isolation and reversed visits | Snapshot differs from expected report fields. | Reproduce under clean dependencies; inspect sale totals and fixture dates/created timestamps against the requested August reporting range. Confirm calculations as well as fixture consistency. |
| `tests/subscription-lifecycle.test.ts` — replacement preserving payment and receipt | `SUBSCRIPTION_NOT_REPLACEABLE`. | The fixture uses August dates while replacement checks the current clock. Introduce deterministic time/fixtures, then verify both eligible replacement and expired-pass rejection. |
| `tests/ui-system-contract.test.ts` — compact shell and navigation | Source regex expects `visibleNavSections = navSections...`. | The October release delegates this to `getPrimaryNavigationSections(account)`. Replace the stale implementation-text assumption with meaningful navigation behavior coverage. |

These are baseline findings, not regressions introduced by Electron. This branch preserves the current application code and records the required follow-up work rather than changing business rules to force green tests.

## Reproduction

Use an isolated checkout, install its locked dependencies, generate its Prisma client, and explicitly set `DATABASE_URL` and `TEST_DATABASE_URL` to a disposable PostgreSQL database. Then run:

```bash
npx prisma migrate deploy
npx vitest run --reporter=json --outputFile=/tmp/electron-baseline.json
```

The direct Vitest command above follows migrations and avoids the `npm test` pretest reset. Normal CI may use the existing reset workflow, but only against its disposable database. Keep source, dependency versions, clock and fixtures in the recorded evidence.

The compact machine-readable result is [electron-baseline-results.json](electron-baseline-results.json). The original run also produced temporary full JSON and console reports outside the repository.

## Existing browser coverage to retain

The sibling checkout `/root/we-discipline-annual-insurance` contains uncommitted `playwright.config.ts`, `tests/e2e/` and `docs/playwright-session-testing.md`, with corresponding package changes. They cover live read-only workspace behavior and isolated session workflows. They were inspected but not copied, modified or executed in this branch. Review and integrate them deliberately, change mutation defaults to disposable targets, and extend the shared scenarios to Electron.

Desktop acceptance must additionally cover the owner/client split, real installers and updates, printing, file dialogs, camera/readers, failure recovery and visual parity. Passing the existing web suite alone will not certify the desktop application.
