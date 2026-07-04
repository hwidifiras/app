# Next/PostCSS Advisory Resolution - 2026-07-01

## Scope

- Commit: `c845dd8` (`fix: override next postcss advisory`).
- Issue: `npm audit --omit=dev` reported 2 moderate production advisories because `next@16.2.9` bundled `postcss@8.4.31`.
- Advisory: `GHSA-qx2v-qp2m-jg93`, fixed by `postcss >= 8.5.10`.
- Chosen fix: npm override for `next -> postcss@8.5.16`.

## Why This Path

- `next@16.2.9` was the latest stable version available from npm during the check.
- npm audit's automatic fix suggested a breaking install path instead of a safe stable Next upgrade.
- The override changes only the nested PostCSS package used by Next and leaves Next itself on `16.2.9`.

## Verification

Local workstation:

```text
npm audit --omit=dev
found 0 vulnerabilities
```

```text
npm ls next postcss --omit=dev
next@16.2.9
└── postcss@8.5.16 overridden
```

```text
npm run lint
passed
```

```text
npm run build
passed
```

VPS rebuilt container:

```text
docker exec dojo-saas-staging npm audit --omit=dev
found 0 vulnerabilities
```

```text
docker exec dojo-saas-staging npm ls next postcss --omit=dev
next@16.2.9 overridden
└── postcss@8.5.16 overridden
```

VPS isolated full test after rebuilding the image:

```text
Datasource "db": PostgreSQL database "gymday_test_codex_c845dd8", schema "public" at "postgres-saas-staging:5432"
Database reset successful
Test Files  16 passed (16)
Tests       155 passed (155)
```

## Cleanup

- The disposable database `gymday_test_codex_c845dd8` was removed after the test run.
- The staging app container restarted successfully from the rebuilt image.

## Remaining Risk

- Full `npm audit` without `--omit=dev` still reports dev-tooling advisories. The production release gate is clean; dev dependency cleanup can be handled as a separate maintenance pass.
