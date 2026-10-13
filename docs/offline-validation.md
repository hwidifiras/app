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
