# Full Test Gate - 2026-07-01

## Scope

- Target repo: `/opt/we-discipline-saas-staging` on the VPS.
- Commit under test: `2c928fa` (`docs: add current ui ux release readiness`).
- Database: disposable PostgreSQL database `gymday_test_codex_20260701`.
- Runtime: one-off Docker test runner from image `we-discipline-saas-staging-dojo-saas-staging:latest`.
- Safety: tests ran against `TEST_DATABASE_URL`/`DATABASE_URL` pointing to the disposable database, not `gymday_saas_staging`.

## Result

| Gate | Result |
| --- | --- |
| Prisma migrate reset | Passed |
| Vitest files | 16 passed |
| Vitest tests | 155 passed |
| Temporary DB cleanup | Passed |
| Server repo cleanup | Passed |

## Evidence Summary

The test runner reset and migrated only `gymday_test_codex_20260701`:

```text
Datasource "db": PostgreSQL database "gymday_test_codex_20260701", schema "public" at "postgres-saas-staging:5432"
Applying migration `20260624000000_postgres_multitenant_baseline`
Database reset successful
```

Vitest completed successfully:

```text
Test Files  16 passed (16)
Tests       155 passed (155)
Duration    22.16s
```

Cleanup verification:

- `dropdb -U gymday --if-exists gymday_test_codex_20260701` completed successfully.
- Listing databases after cleanup returned no `gymday_test_codex_20260701` row.
- `/opt/we-discipline-saas-staging` had no leftover `node_modules` symlink after the mounted test run.
- The server repo remained clean on `codex/phase3-multitenant-saas`.

## Notes

- The run emitted expected Prisma error logs inside tests that intentionally assert duplicate/tenant-guard failures; Vitest still passed the scenarios.
- Local Windows Docker is unavailable, so the full test gate was closed on the VPS with an isolated database instead of the local workstation.
