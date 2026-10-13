# We Discipline 1.1.0 release validation

The branded Windows executable and NSIS installer were built locally. The executable embeds the supplied We Discipline logo in all seven Windows icon sizes; its 256px resource exactly matches the selected PNG. Product metadata is We Discipline 1.1.0. The client-specific encrypted recovery payload and installer remain local and excluded from Git.

- The full business suite passed 376 tests, including the first 11 new import checks. The expanded import suite then passed all 14 checks, covering siblings with Arabic names, independent balances for two disciplines, activated/pending first-use passes, receipts, replay protection, stale previews and complete rollback after a late payment failure.
- All 33 Playwright checks passed against the final compiled resources in Chrome. They include real Excel uploads for class, gym unlimited/quota, first-use and mixed variations; templates; invalid-row rejection; preview invalidation; account restrictions; local request protection; existing workflows; uploaded-logo persistence; and complete service/database restart.
- Native Electron recovery passed in a disposable profile: every collection's restored record hashes matched the private original snapshot, the logo and card key matched, the configured login worked, wrong passwords and unauthenticated restoration were rejected, and the Windows-protected cache enabled a subsequent one-click restore.
- Runtime/recovery checks passed for persistence, corruption rejection, transactions, logo/account policy/card key restoration and rollback after a simulated late failure. Source export/import guards also passed all five focused tests.
- The final production build, TypeScript check, ESLint and package build passed. No production data was mutated during these checks.

Stress checks exposed and corrected two lifecycle issues: an existing database now waits for its authenticated replica primary instead of retrying first-time bootstrap after three seconds; delayed exits from a replaced local server no longer mark its successor as failed. Maintenance locks are released on failed recovery/service restart so the application remains closable.

The installer builder uses the pinned electron-builder SDK's existing pure Node uninstaller extractor. It compiles the standard NSIS install/uninstall logic without executing a generated extraction helper. The SDK version is guarded for review on upgrade. Windows security policies were not changed. The app and installer are unsigned; these local results do not claim universal Windows approval or physical camera/scanner/printer acceptance.

The sections below retain the earlier conversion and release history.

# Local validation — 2026-10-12

Base: `codex/electron-client-maintenance`, commit `0bc70d7749bb68ac76b1d60fd87ef4cc49a96fbb`. Implementation branch: `codex/offline-nosql`.

Completed on Windows x64 with disposable test profiles, without accessing live club data:

- TypeScript checking and ESLint passed.
- 60 Vitest files, 365 tests passed, including business scenarios, concurrent payments, ledger corrections, permissions and tenant isolation.
- Local MongoDB runtime test passed: transactions/rollback, backup integrity, restore, nullable unique phones and persistence after database restart.
- Production Next.js standalone build passed. Packaged resources include the complete runtime dependency graph, Prisma Windows query engine, local fonts and MongoDB runtime.
- Windows NSIS installer build passed after using a hoisted desktop dependency layout to keep NSIS include paths within Windows limits. Local artifact: `release/All-in-Gym-1.0.0-x64.exe`, 282,189,037 bytes. SHA-256: `6FCBFC1AA0665D7490B77C7329E852CF3465E301C1720D7552A3B1EF5DF522DB`. Authenticode status: `NotSigned`. This is a build result, not an installation or launch acceptance result.
- Production local-server integration passed using those packaged resources under Node: first administrator setup, duplicate-setup rejection, login, sport/coach/group/plan creation, paid member enrollment, eleven authenticated pages, access-header enforcement, cross-origin rejection, backup/restore including the card-signing key, and persistence after restarting both database and server.

The unsigned packaged desktop executable could not launch on this machine. Windows App Control returned “Une stratégie de contrôle d’application a bloqué ce fichier.” No Windows policy was changed or bypassed. Full native desktop smoke verification remains incomplete until the app is signed or explicitly approved through the machine’s normal Windows administration process. The independent production-server test does not validate the Electron window, camera, printer hardware or installer installation.

The desktop smoke test and Windows CI workflow are checked in for execution in an environment where the application is permitted. No passing native result is claimed here. The installer is unsigned, and no signing credentials are configured.

The offline edition starts with a fresh local database. Export/import tools are provided, but existing cloud customer records have not been exported or migrated as part of implementation.

## Provisioned-account follow-up — 2026-10-13

Added local administrator provisioning and a persistent per-profile account-creation lock. Passwords are supplied over standard input, hashed locally and excluded from source and build resources. Setup and user-creation APIs return 403 when the policy is active, and the user-creation form is absent. Existing accounts and business data are preserved with a safety backup before provisioning.

TypeScript, targeted ESLint and production desktop packaging passed. The production-server integration test passed the existing workflows plus provisioning an existing account, verifying no duplicate user, logging in with its supplied password, blocking both creation APIs, redirecting setup to login, hiding the creation form and retaining the lock after a complete restart. The actual local profile’s administrator hash and persisted lock were verified separately without exporting credentials.

The updated packaged executable was rejected by Windows App Control on normal launch. Automated native launch also failed, so no passing native follow-up result is claimed. No Windows security policy was changed or bypassed; the local account remains stored for use once the updated application is permitted.

The updated NSIS installer build passed with the hoisted desktop layout persisted in workspace configuration. The current `release/All-in-Gym-1.0.0-x64.exe` is 282,189,496 bytes; SHA-256: `BE49744BC3D6363187642957BC7942C31360A34CAEDC1D85763ED332FFA5DBBA`. It supersedes the earlier local artifact recorded above. Authenticode status remains `NotSigned`; installation and native launch acceptance remain pending.

## Playwright browser suite — 2026-10-13

Added a pinned Playwright test runner, production-server fixtures, independent browser contexts, and 23 end-to-end checks. All 23 passed in installed Chrome with dummy credentials and disposable local databases. Coverage includes first-run setup and duplicate rejection, protected navigation, invalid/valid login, logout, UI/API account-creation restrictions, origin/access-header guards, eleven offline screens, paid enrollment visible in member search and details, the corresponding 5,000-cent ledger entry and receipt, and persistence/restrictions after restarting both services.

External network requests were unavailable inside the tested browser contexts. This verifies offline UI operation, not Electron's native request interception. The suite never uses the real club profile or administrator credentials. HTML/JSON reports and failure screenshots/traces are generated under ignored `artifacts/playwright/`, and Windows CI uploads them after running the suite. Native Electron acceptance remains subject to the Windows App Control limitation recorded above.

## Original-data migration support — 2026-10-13

The importer now preserves a previously provisioned administrator's password while retaining matching original user IDs and their historical references. Original disabled modules remain disabled. Five focused tests passed for login preservation, independent local-account retention, foreign-client rejection, broken-reference rejection and disabled-module preservation. Targeted ESLint passed.

For the explicitly requested customer migration, a private read-only production snapshot was tested in a disposable MongoDB profile before the real local import. Imported document values, identities, relationships, financial totals, receipt snapshots, member/receipt screens, original branding and the configured local login were verified. Source data was unchanged; safety snapshots and private export/logo/verification copies were retained locally. Customer records, exact totals, credentials, SSH material and private reports are excluded from this repository.

Profile branding rehydration was checked against the private original image by SHA-256. The updated desktop source uses this helper on startup after packaging; the currently running build received the image directly without rebuilding its executable. Normal desktop launch subsequently succeeded with the migrated local database. This does not replace full native hardware/installer acceptance or make the unsigned executable universally permitted by Windows policy.
