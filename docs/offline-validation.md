# Local validation — 2026-10-12

Base: `codex/electron-client-maintenance`, commit `0bc70d7749bb68ac76b1d60fd87ef4cc49a96fbb`. Implementation branch: `codex/offline-nosql`.

Completed on Windows x64 with disposable test profiles, without accessing live club data:

- TypeScript checking and ESLint passed.
- 60 Vitest files, 365 tests passed, including business scenarios, concurrent payments, ledger corrections, permissions and tenant isolation.
- Local MongoDB runtime test passed: transactions/rollback, backup integrity, restore, nullable unique phones and persistence after database restart.
- Production Next.js standalone build passed. Packaged resources include the complete runtime dependency graph, Prisma Windows query engine, local fonts and MongoDB runtime.
- Production local-server integration passed using those packaged resources under Node: first administrator setup, duplicate-setup rejection, login, sport/coach/group/plan creation, paid member enrollment, eleven authenticated pages, access-header enforcement, cross-origin rejection, backup/restore including the card-signing key, and persistence after restarting both database and server.

The unsigned packaged desktop executable could not launch on this machine. Windows App Control returned “Une stratégie de contrôle d’application a bloqué ce fichier.” No Windows policy was changed or bypassed. Full native desktop smoke verification remains incomplete until the app is signed or explicitly approved through the machine’s normal Windows administration process. The independent production-server test does not validate the Electron window, camera, printer hardware or installer installation.

The desktop smoke test and Windows CI workflow are checked in for execution in an environment where the application is permitted. No passing native result is claimed here. The installer is unsigned, and no signing credentials are configured.

The offline edition starts with a fresh local database. Export/import tools are provided, but existing cloud customer records have not been exported or migrated as part of implementation.
