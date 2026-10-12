# Local architecture and operational boundaries

The Electron main process supervises two child processes: a bundled MongoDB 8.0.32 Community server, and the compiled Next.js standalone server. Both listen exclusively on `127.0.0.1`. The MongoDB server runs an authenticated single-node replica set, enabling atomic multi-document transactions without an external server. Its data files, replica key, per-installation credentials, session secret and stable local ports live outside the installation directory in the Windows user profile.

The database’s WiredTiger journal provides crash recovery. The app stops its web process before backups/restores and clean shutdown, takes an atomic logical snapshot using a MongoDB transaction, then shuts down the database. Updating application files does not replace the user’s data directory. Single-instance locking prevents two Electron processes from opening the same profile. A startup failure retains existing files and presents an actionable error.

## Business and document compatibility

The Prisma MongoDB connector preserves the existing domain model and generated TypeScript types. IDs remain strings and map to MongoDB `_id`; existing club exports keep their original IDs. No SQL engine or SQL query runs in the packaged app. Historical PostgreSQL and SQLite migrations remain reference material only.

Nullable scalar fields are explicitly populated on document creation because MongoDB distinguishes a missing field from `null`. Partial unique indexes preserve the original multiple-NULL behavior for child phones, coach links and predecessor IDs. Required unique fields and tenant-scoped composites remain unique. Collection/index metadata comes from the checked-in model inventory, and collections exist before the first business transaction.

All application writes run under one process-wide document fence and a MongoDB transaction. Callback transactions include their validation reads, deletes and writes in one snapshot. A failed transaction rolls back all documents. Transaction conflicts retry complete callbacks. Legacy transaction arrays have been replaced by callbacks; PostgreSQL advisory locks and isolation settings have been removed.

The shared data layer enforces tenant scoping, prevents tenant mutation, validates referenced documents and tenant relationships, preserves restrictive/cascading/nulling delete behavior, and keeps platform audit logs append-only. Prisma relation emulation is configured without cyclic cascading actions; application guards apply the original actions within the same transaction. These protections are exercised by the original business and isolation tests. The local product is permanently operational and does not depend on an online SaaS subscription.

Dashboard finance, sales, payment trends and member payment filters use document-compatible reads and existing financial computations. Money stays in integer cents. Receipt entitlement lines use their original plan order rather than timestamp ties.

## Desktop and request isolation

Renderer windows use sandboxing, context isolation, disabled Node integration and enabled web security. There is no renderer filesystem, database or shell bridge. The main process accepts only the exact local application origin, denies external requests and navigation, and limits permissions to the existing camera workflow. It injects a random per-launch access header; the local proxy rejects other requests and cross-origin mutations. Browser cookies retain normal server-side authentication and staff permissions. Local HTTP cookies are appropriate to the loopback-only transport.

The first-run setup endpoint is local-only, permits creation only when the club has no users, and atomically creates an administrator, club identity and audit entry. Passwords use the existing password hashing service. No shared/default administrator password is shipped. An explicit local recovery utility is available while the application is closed.

Fonts and images are packaged locally. Signup, demo, remote billing, account handoffs and email delivery do not participate in offline startup or daily operations. Receipts, camera QR scanning, keyboard scanners, file imports and exports, and normal print dialogs retain the existing application behavior. Public cloud receipt verification and email cannot operate without an online service; use the local receipt verifier and printing.

## Backup, restore and imports

Backups use canonical BSON Extended JSON to retain document dates and values, wrapped with a SHA-256 integrity digest. Restore verifies format, required collections/fields, dates, identities and references before replacing records in one transaction. A corrupt or incompatible file does not alter the database. Unique index conflicts also roll back the restore. The desktop menu requires a current administrator session, pauses the web server and creates a safety snapshot before restore. Restoring clears browser authentication cookies before sign-in.

Automatic snapshots are written on clean close and retain 14 copies. They complement journaling; they do not replace backups to another drive. Snapshot files contain personal data, password hashes and the local access-card signing key, which preserves printed local cards when restoring on another computer. They are not automatically uploaded.

Import is opt-in and runs with the desktop app closed. A separately supplied source database URL enables a read-only PostgreSQL export of exactly one club. The importer never connects to the source, preserves IDs and transactional histories, remaps tenancy to the local club and omits cloud signup/onboarding/subscription control. Source export and a pre-import snapshot remain available for recovery. Imported online gym cards must be reprinted because the local workspace uses a different tenant/signing context; their records and visit history remain intact. No production customer data was accessed during implementation.

## Release scope

Windows x64 is the target. The database/runtime and Electron are bundled, so installation and subsequent startup require no Node, PostgreSQL, SQLite, MongoDB installation or network access. Downloads occur only on a developer/CI machine while building. The runtime is pinned by SHA-256 and verified against the official ZIP entries; licensing notices ship with it.

The installer is unsigned. Certificate-based installer signing is a release-system configuration. Printer/scanner hardware acceptance remains device-specific, while application-level printing, camera permissions and keyboard scanner behavior reuse the original workflows. There is no cloud synchronization or multi-computer shared database in this edition.
