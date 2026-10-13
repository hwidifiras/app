# We Discipline — offline desktop

Windows x64 Electron application for daily club operations. The existing Next.js screens and business services run locally, backed by a bundled MongoDB Community document database. No SQLite, PostgreSQL installation, internet connection, hosted API, SaaS subscription or synchronization is required after installation.

## Install and use

Run `We-Discipline-1.1.0-x64.exe` from `release/`. The client build includes an encrypted original-data archive. On a new computer, restore it using the supplied local password, then sign in with the provisioned account. Subsequent original-data restores use the Windows-protected local access cache. Generic builds without a client archive retain the administrator setup flow. The app provides members, class/gym/mixed enrollment, subscriptions and renewals, attendance, gym cards and check-in, payments and corrections, receipts and printing, planning, coaches, groups, offers, reporting, imports and club settings.

Use **We Discipline → Données et récupération**, or **Réglages → Sauvegarde et récupération**, to restore the original data, save a `.gymbackup`, or restore a chosen backup. Restoring an existing profile requires an administrator, a replacement confirmation and a safety snapshot. Version 2 backups include the logo, card signing key and account-creation policy; version 1 backups remain readable. A late failure rolls the database, logo and local secrets back to the safety snapshot. Automatic backups retain the last 14 clean closes. Backups include personal club data and password hashes; keep them in a protected location.

Local data is stored in the Windows user profile under `%APPDATA%/All in Gym`. Uninstalling or updating the app retains this directory. `GYM_DATA_DIR` can explicitly select another local data directory. Never delete or copy a running database directory; use the backup menu.

An administrator can provision a local account while the app is closed using `offline:provision-account`, with `GYM_DATA_DIR` set explicitly and JSON credentials supplied on standard input. Provisioning takes a safety backup, stores a password hash, and permanently disables account creation through setup and user-management APIs for that profile. Client recovery builds also enforce this policy on first launch. Existing accounts are preserved; a restore keeps the local administrator password for matching email addresses. No plaintext password or archive-decryption key is shipped in source code or the installer.

## Excel student imports

Open **Réglages → Import ancien fichier**. Choose arts martiaux/cours, salle, or mixte; choose an optional default plan and one compatible group per discipline. Download the generated Excel template: its first sheet has the import columns, its second lists the current plans/groups and capacities, and its third explains the rules. A file may instead specify a different plan and groups on each row within the selected activity. Mixed plans support independent balances for every discipline plus an unlimited gym right or a visit quota. Fixed-date, pending first-use and already-activated first-use passes retain the corresponding dates and balances.

Activate the temporary administrator import session, upload `.xlsx` or UTF-8 `.csv`, verify the preview, then apply it. Imports create new students and preserve historical balances; they never merge into existing members. Children may share their parent's contact without a personal phone. Insurance already paid can be included explicitly in the total and coverage dates; no automatic extra charge is added during historical import. Dates, money, quotas, demographic compatibility, duplicate contacts and group capacity are checked. A changed file, option, plan or group invalidates the preview. The whole batch commits atomically, and replaying the same confirmed request cannot duplicate records. Maximum 200 students and 5 MB per file.

Original module settings are preserved during recovery. If a local administrator deliberately enables another module from the import screen, its plan types become available on that computer. This changes no online data or recovery archive.

The client archive stays outside Git at `desktop/recovery/original.gymrecovery`. To package an authorized version 2 snapshot, run `node scripts/make-offline-recovery.mjs` with `{ "backup": "private-snapshot.gymbackup", "output": "desktop/recovery/original.gymrecovery", "password": "<supplied securely>" }` on stdin. The encrypted archive uses AES-256-GCM and scrypt; never commit or publish client-specific installer/recovery artifacts to a public repository.

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
node --test tests/offline-recovery.node.mjs tests/offline-import.node.mjs
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

Browser tests cover first setup, login rejection/success, logout, locked account creation, request protections, eleven offline screens, paid member enrollment with receipt/ledger checks, persistence after restarting both local services, and real Excel uploads for class, unlimited/quota gym, first-use and mixed plans. Each worker creates and deletes its own database under `artifacts/playwright/profiles`; your actual club profile and credentials are never used. Browser contexts block external network requests while exercising the compiled application.

HTML/JSON reports, failure screenshots and retained failure traces are written under `artifacts/playwright/`. CI runs these checks after packaging and uploads diagnostic reports even when a test fails. Vitest runs the separate business/unit suite.

To use an existing Chrome installation, set `GYM_E2E_CHANNEL=chrome` before running `pnpm test:e2e`; this is the browser used for local validation. These tests exercise the production UI and local server independently of the Electron executable. Native Electron launch and its network/window controls remain covered by the separate `test:desktop` check, which is blocked by Windows App Control on this machine.

## Import an existing club

The offline app starts with a fresh local database. It does not automatically access or change live customer data.

1. Set `OFFLINE_EXPORT_DATABASE_URL` to an explicitly selected source PostgreSQL database and run `node scripts/export-offline-data.mjs <club-slug> <export.json>`. This uses a read-only transaction and exports one club.
2. Close the desktop app. Set `GYM_DATA_DIR` to its data directory and run `pnpm offline:import <export.json>`.
3. The importer keeps a safety backup, preserves record IDs, money, receipt snapshots, member relationships, attendance and entitlement history, and remaps the exported club to the local workspace. Original enabled/disabled module settings remain intact; cloud onboarding and subscription controls are omitted.
4. If this profile already has a provisioned administrator and account-creation lock, its configured password remains valid. A matching imported administrator keeps the original user ID so historical references stay intact. Otherwise the independently provisioned administrator is retained alongside imported users. For an unprovisioned profile, sign in using the exported administrator’s account. Verify balances and receipts against the original export before beginning daily work.
5. Reprint imported gym cards in the local app: their offline codes use a local signing key. Historical visits and credential records remain available.

The source URL belongs in an environment variable, not in a command line or repository file. Customer exports, logo copies, credentials and migration reports must remain outside Git. Imported and uploaded branding belongs in the local profile's `branding` directory and is served by the protected local application. It survives updates without modifying installed resources. Keep the private migration recovery files together with your backup.

## Architecture

See [offline architecture](docs/offline-architecture.md) for local process lifecycle, transaction and tenancy protections, data compatibility, backup behavior and release limitations. The existing cloud SQL migrations remain historical reference files and are never executed by this edition.

See [local validation results](docs/offline-validation.md) for completed checks, release artifacts and the history of Windows launch validation.
