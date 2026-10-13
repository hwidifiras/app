# All in Gym — offline desktop

Windows x64 Electron application for daily club operations. The existing Next.js screens and business services run locally, backed by a bundled MongoDB Community document database. No SQLite, PostgreSQL installation, internet connection, hosted API, SaaS subscription or synchronization is required after installation.

## Install and use

Run `All-in-Gym-1.0.0-x64.exe` from `release/`. On first launch, create the club administrator with your own password. The app provides members, class/gym/mixed enrollment, subscriptions and renewals, attendance, gym cards and check-in, payments and corrections, receipts and printing, planning, coaches, groups, offers, reporting, imports and club settings.

Use **All in Gym → Sauvegarder…** to save a `.gymbackup` file to another drive. **Restaurer…** requires an administrator and creates a safety snapshot before replacing local data. Automatic backups retain the last 14 clean closes. Backups include personal club data and password hashes; keep them in a protected location.

Local data is stored in the Windows user profile under `%APPDATA%/All in Gym`. Uninstalling or updating the app retains this directory. `GYM_DATA_DIR` can explicitly select another local data directory. Never delete or copy a running database directory; use the backup menu.

An administrator can provision a local account while the app is closed using `offline:provision-account`, with `GYM_DATA_DIR` set explicitly and JSON credentials supplied on standard input. Provisioning takes a safety backup, stores a password hash, and permanently disables account creation through setup and user-management APIs for that profile. The creation form is hidden and subsequent launches use the normal login screen. Existing accounts and business records are preserved. No account password is shipped in the source code or installer.

Email delivery, cloud signup, hosted billing, public web receipt verification and cloud synchronization are unavailable offline. Receipts still print and can be verified in the local application with their number and code. Printer selection and PDF output use the normal print dialog. Camera QR scanning and keyboard scanners retain the existing workflows.

## Build

Use Node.js 22.16+ or 24 and pnpm 11 on Windows x64:

```text
pnpm install --frozen-lockfile
pnpm exec prisma generate
pnpm --dir desktop --ignore-workspace install --frozen-lockfile --ignore-scripts --config.node-linker=hoisted
node desktop/node_modules/electron/install.js
pnpm desktop:installer
```

`desktop:package` produces the unpacked application, and `desktop:dev` builds and launches the same local shell. Runtime acquisition occurs only at build time. The MongoDB executable is pinned to version 8.0.32 and its SHA-256; official archive entries are verified before extraction. MongoDB’s license and third-party notices are included in the installed resources. Electron and both lockfiles are pinned.

The installer is currently unsigned. Signing is a release-system configuration; no signing secrets are embedded in the application.

## Verify

```text
pnpm exec tsc --noEmit
pnpm lint
pnpm test
node --test tests/offline-runtime.node.mjs
pnpm desktop:package
pnpm test:server
node scripts/offline-desktop-smoke.mjs
```

Tests start their own authenticated, single-node replica set in a disposable directory. They do not use an existing database URL or reset a production database. The scenario suite exercises payments, corrections, receipt numbering, attendance, family enrollment, renewal, quotas, permissions and concurrent requests. Runtime tests cover rollback, backup integrity, restore, multiple missing child phones and restart persistence. Desktop smoke tests exercise first setup, login, application pages, network isolation and relaunch with a separate local profile.

## Playwright browser tests

Build the production resources first with `pnpm desktop:package`, then run:

```text
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:e2e:report
```

The 23 browser tests cover first setup, login rejection/success, logout, locked account creation, request protections, eleven offline screens, paid member enrollment with receipt/ledger checks, and persistence after restarting both local services. Each worker creates and deletes its own database under `artifacts/playwright/profiles`; your actual club profile and credentials are never used. Browser contexts block external network requests while exercising the compiled application.

HTML/JSON reports, failure screenshots and retained failure traces are written under `artifacts/playwright/`. CI runs these checks after packaging and uploads diagnostic reports even when a test fails. Vitest runs the separate business/unit suite.

To use an existing Chrome installation, set `GYM_E2E_CHANNEL=chrome` before running `pnpm test:e2e`; this is the browser used for local validation. These tests exercise the production UI and local server independently of the Electron executable. Native Electron launch and its network/window controls remain covered by the separate `test:desktop` check, which is blocked by Windows App Control on this machine.

## Import an existing club

The offline app starts with a fresh local database. It does not automatically access or change live customer data.

1. Set `OFFLINE_EXPORT_DATABASE_URL` to an explicitly selected source PostgreSQL database and run `node scripts/export-offline-data.mjs <club-slug> <export.json>`. This uses a read-only transaction and exports one club.
2. Close the desktop app. Set `GYM_DATA_DIR` to its data directory and run `pnpm offline:import <export.json>`.
3. The importer keeps a safety backup, preserves record IDs, money, receipt snapshots, member relationships, attendance and entitlement history, and remaps the exported club to the local workspace. Cloud onboarding and subscription controls are omitted.
4. Launch and sign in using the exported administrator’s account. Verify balances and receipts against the original export before beginning daily work.
5. Reprint imported gym cards in the local app: their offline codes use a local signing key. Historical visits and credential records remain available.

The source URL belongs in an environment variable, not in a command line or repository file. Existing live data has not been exported as part of this code conversion.

## Architecture

See [offline architecture](docs/offline-architecture.md) for local process lifecycle, transaction and tenancy protections, data compatibility, backup behavior and release limitations. The existing cloud SQL migrations remain historical reference files and are never executed by this edition.

See [local validation results](docs/offline-validation.md) for the checks completed and the Windows App Control launch limitation on the development machine.
