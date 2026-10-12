# We Discipline Electron implementation plan

Preserve the current All in Gym design and every existing club workflow in an Electron application. The client opens the focused workspace they already use; the software owner can enter a separate Maintenance area to access the broader application and help the client. Reuse the existing application instead of rebuilding its screens or business rules.

This branch contains the architecture, scope, baseline findings, and release gates. It does not yet contain an Electron executable. Application implementation follows the milestones below.

## Baseline and decisions

- Branch: `codex/electron-client-maintenance`, based on deployed release `3bd00f0526f468ea44fdc1868a54da68c7b23047`.
- Repository: `hwidifiras/app`. The branch starts from the live release rather than assuming GitHub `main` represents production. Existing branches and the deployed application remain unchanged.
- Current stack: Next.js 16, React 19, Tailwind 4, Prisma 6, PostgreSQL 16. Source inventory: 54 pages, 72 API route files, 174 React component files, 45 database models, 29 migrations, and 60 test files.
- `19549cd` introduced registration-only mode on 20 September 2026; its migration explicitly identifies Allingym as the first client. `3bd00f0` expanded this workspace on 6 October.
- The live club has both class and gym modules enabled and `registrationOnly=true`. Its active client account has the ADMIN role. This flag is a club-wide presentation restriction, not an owner authorization boundary.
- Planning assumptions pending the user's answers: Windows first; use the existing online server and database. Do not treat these assumptions as confirmation of an offline or operating-system requirement.
- Preserve French labels, club branding, current colors, type, spacing, forms, tables, dialogs, responsive behavior, receipt layouts, and theme preferences. No design generation or parallel component library is needed.

See [the route inventory](electron-route-inventory.md) for the complete page and API surface, and [baseline verification](electron-baseline-verification.md) for the actual checks performed.

## Architecture choice

| Option | Reuse and operation | Planning decision |
| --- | --- | --- |
| Electron connected to the existing HTTPS application | Shares the exact Next.js screens, API, PostgreSQL transactions, users, and current data. Requires internet for business operations. | Recommended first release and provisional baseline. |
| Electron with a bundled local Next.js server and PostgreSQL | Can operate offline, but requires database installation, local authentication, migrations, backup and restore, process supervision, and OS-specific packaging. | Replan before implementation if offline operation is required. |
| Offline desktop with cloud synchronization | Requires conflict handling for money, receipt numbering, visit balances, attendance, identities, and concurrent edits. | A separate architecture milestone; not an incidental Electron feature. |

The application cannot simply be exported as static files: server components and route handlers query Prisma, authentication resolves the tenant from the host, and transactions use PostgreSQL-specific locking and SQL. Replacing PostgreSQL with SQLite would change existing business behavior and requires a separate migration project.

For the connected release, use a small Electron package under `desktop/`, with a local application shell hosting the approved HTTPS app in a sandboxed `WebContentsView`. Keep Next.js and its database on the server. Share the existing authentication flow and same-origin cookies; do not reproduce the login screen or expose database credentials in the installer. Follow [Electron's security guidance](https://www.electronjs.org/docs/latest/tutorial/security) for isolated remote content.

Keep desktop dependencies and packaging configuration in `desktop/package.json` with their own lockfile. Root application scripts may delegate to this package. Package only desktop assets and runtime dependencies, never repository environment files, test data, the web source tree, or server secrets.

## Main workspace and Maintenance

The default landing page remains `/enrollment`. Existing ADMIN versus STAFF permissions and coach scoping continue to apply within the focused workspace.

| Main workspace | Workflows to preserve |
| --- | --- |
| Inscrire | Existing class, gym, and mixed enrollment, member lookup/creation, family relationships, pricing and offer calculation, insurance, payment, receipt, and supported undo. |
| Caisse | Payment history, collecting balances, supported corrections, receipt access and delivery. |
| Membres | Profiles, family and child details, subscriptions, group assignments, insurance, archive and existing permitted actions. |
| Planning | Current views, filters, generation, session details, edit/postpone/cancel safeguards, and any attendance actions already reachable inside the planner. |
| Groupes & horaires | Groups, member assignments, dated schedules, rooms, capacity and conflict checks. |
| Coachs | Coach records, qualifications, assignments and existing coach account rules. |
| Équipe & accès | Existing client team administration, subject to protection of owner accounts and grants. |
| Supporting pages | Receipt pages, subscription creation/editing, payment forms, account settings and subscription status remain reachable through their existing flows. |

Maintenance is an owner-only navigation entry using the same shell and components. Its sections expose existing pages: dashboard and reporting; attendance and recovery; gym access, credentials and visit history; disciplines; plans and offers; club settings; schedule templates; imports; and audit history. Include a clear return to the client workspace and a persistent indication when operating in Maintenance.

Keep original feature URLs and components. A small Maintenance index can link to them; avoid copying every screen into a second `/maintenance/...` tree. Replace the unconditional focused-mode redirect with a shared server-evaluated workspace policy. The client default remains focused even during owner support; entering Maintenance must not flip the club-wide flag for everyone.

### Owner access model

An ordinary ADMIN role cannot identify the software owner because the client already has it. Add a server-managed, tenant-scoped owner grant tied to an immutable user ID, plus an expiring server-side maintenance session. Proposed session fields are actor, tenant, creation/expiry, revocation and optional support reason. Require fresh owner authentication to enter; revoke on logout, explicit exit, account disablement or owner-grant removal. Use a separate session partition/window for owner sign-in so the client's authenticated session can remain intact; clear owner session storage on exit.

Do not build the boundary around a hidden tab, a local PIN, a client-side flag, a shared password or an editable email address. `src/lib/technical-admin.ts` currently recognizes certain email addresses for technical cleanup; retain knowledge of that legacy behavior but do not reuse email matching as the new owner grant.

Protect owner accounts and grants from the existing user-create, user-edit, self-account-edit and password-reset routes. Client administrators must not be able to change an owner's password/email, revoke the only owner, promote themselves into ownership, or alter maintenance grants. Provision the first owner through a controlled server-side command; provision credentials only during implementation setup, not in this planning branch.

Apply authorization to both pages and individual API operations. Current focused mode filters pages and navigation while APIs still rely on ordinary permissions. Do not blanket-block supporting APIs: enrollment needs plan/offer/settings reads, and the planner may call attendance endpoints. Document a method/action matrix, preserving operations currently reachable from the client workspace while reserving additional maintenance operations for the owner. UI hints are not authorization. Keep tenant isolation, coach scoping, module checks and SaaS subscription rules; Maintenance does not silently bypass any of them.

Audit maintenance entry, exit, grant changes and support mutations with actor and tenant. Reuse existing correction/reversal services and their reasons instead of introducing untracked database-edit controls. Technical destructive cleanup stays a separate explicit privilege.

## Functional parity and evidence

| Domain | Existing implementation anchors | Required evidence before release |
| --- | --- | --- |
| Identity and tenancy | `src/lib/request-user.ts`, `auth-session.ts`, `tenant-resolver.ts`, `permissions.ts`, `src/proxy.ts` | Login/logout, relaunch, expiry, disabled users, wrong tenant, role change, owner isolation and revocation. |
| Enrollment and insurance | `src/app/api/enrollment/`, `src/lib/annual-insurance.ts`, enrollment components | Class/gym/mixed sale, family/sibling enrollment, optional child phone, flexible price, insurance dates, partial payment, duplicate submit and reversal with exact balances. |
| Subscriptions | `src/modules/sales/`, `src/lib/subscription-entitlements.ts` | Renewal, first-use activation, pause/resume, replacement, cancellation, unit adjustment, entitlement snapshots and existing validity limits. |
| Finance and receipts | `src/modules/finance/payment-service.ts`, `src/lib/receipts.ts`, receipt and payment components | Collection, partial payment, correction/reversal, debt totals, receipt numbering, print, verification, email success/failure and safe retry. |
| Planning and classes | `src/components/sessions/`, `src/lib/session-lifecycle.ts`, attendance and weekly-consumption libraries | Generation, conflicts, dated schedules, postponement, attendance evidence guards, present/absent/override, weekly quotas, finalization, recovery and undo. |
| Gym | `src/modules/gym/`, `src/lib/gym-access-policy.ts` | Manual and card check-in, camera QR, duplicate scan, quota exhaustion, opening hours, exception with reason, reversal, credentials and CSV export. |
| Member and club operations | `src/app/api/members/`, households, groups, coaches, sports, settings, import routes | Main workspace parity plus owner access to catalog/settings/import flows; preview errors, duplicates, tenant isolation and audit evidence. |
| Reporting and operations | Dashboard read models, `src/modules/reports/`, notifications, logs, SaaS and onboarding services | Existing totals and links remain correct; maintenance pages load; server operational tools stay available under appropriate authorization. |

Public marketing, demo, signup and workspace provisioning routes remain part of the web project. They are not promoted into the client's desktop menu. Open public account/recovery journeys in a controlled app flow or approved system-browser URL as appropriate; test returning to the correct tenant. Existing server commands for backups, migrations and SaaS administration remain server operations, not a desktop shell-command interface.

## Desktop behavior

- App lifecycle: single instance; restore safe window size/position; recover a window placed on a removed monitor; controlled close/relaunch; friendly local loading/error screen and retry.
- Navigation: allow exact approved app origins; validate redirects and new-window requests; handle same-origin receipt links inside the authenticated app; open approved external HTTPS links in the system browser. Reject arbitrary protocols, command-line URLs and malformed deep links.
- Sessions: persistent tenant-specific client storage, HTTP-only server cookies, no custom token storage. Owner storage is separate and cleared after maintenance. Test saved sessions, logout and shared-machine behavior.
- Printing: retain receipt and access-card print CSS; native printer selection and PDF output; test accents, QR codes, page size, margins, cancellation, missing printers and duplicate print requests. Do not silently print by default.
- Files: preserve CSV/XLSX selection and validation, CSV export and template downloads. Implement safe save/cancel behavior and sanitized filenames. A canceled dialog does not mark an operation successful.
- Scanners: preserve keyboard-input readers and the current camera QR workflow. Credential media names do not prove support for arbitrary NFC/RFID hardware; certify actual reader models. Native USB/HID/serial drivers are additional scope only if required.
- Failure handling: network loss, server 503, invalid TLS, session expiry and renderer crash show recoverable states. Do not claim offline writes succeed or automatically retry a payment without checking its idempotency outcome.
- Versioning: expose app/server version in a small support view; define a compatibility contract and minimum supported desktop version. Web changes can arrive independently of installer updates.
- Diagnostics: allow explicit export of a redacted log bundle containing versions and error identifiers. Omit cookies, passwords, tokens, full member records and payment payloads. No automatic support upload.

The Electron process keeps `nodeIntegration=false`, `contextIsolation=true`, sandboxing and web security enabled. Limit native APIs to narrowly typed operations, validate IPC sender/origin/frame and payloads, and explicitly handle camera permission requests. No arbitrary filesystem paths, shell execution or unrestricted IPC bridge. These choices follow the [official security recommendations](https://www.electronjs.org/docs/latest/tutorial/security).

## Packaging and performance

Use Electron Forge as the initial packaging candidate, then select the installer maker and compatible updater together after the target OS decision. Pin a supported stable Electron release at implementation time; do not add unrelated framework upgrades. Forge covers packaging and distribution, but signing and update configuration remain explicit implementation tasks. [Distribution documentation](https://www.electronjs.org/docs/latest/tutorial/forge-overview)

Provisional release target is Windows x64 on an OS supported by the selected Electron version. Build and test on a native Windows CI runner. Add macOS signing/notarization and architecture-specific builds, or Linux packages/update handling, only if those platforms are selected. Keep signing credentials in the release system, never in the app.

Use separate internal and stable release channels, signed installers, checksums and a trusted HTTPS update feed suitable for a private application. Check updates without disrupting work; defer restart during unsaved forms, payment submission or printing. Test interrupted download, invalid update, install/relaunch and recovery to a known-good release. Do not embed a GitHub access token to download private updates. [Electron update guidance](https://www.electronjs.org/docs/latest/tutorial/updates)

Reuse the current server-rendered screens, data access and dynamic scanner import. Keep one client renderer and create an owner renderer only when needed. Stop camera streams, polling and subscriptions when their surfaces close. Avoid a local Next.js/PostgreSQL process in the connected installer.

Provisional performance gates, to calibrate against an agreed Windows test machine and fixed network profile: shell/error UI visible within 2 seconds; usable enrollment within 5 seconds on a healthy connection; local navigation interactions under 200 ms excluding server requests; no sustained memory growth above 15% after warm-up across 100 navigation/dialog cycles. Record app-wide process memory, p50/p95 timings, installer size, idle CPU, server latency and printing time. These are proposed targets, not measured promises.

## Implementation milestones

| Order | Deliverable and main changes | Exit condition |
| --- | --- | --- |
| 0 | Confirm online/offline and OS choices; retain this route inventory; establish a reproducible baseline and disposable fixtures; integrate the existing uncommitted Playwright work only after reviewing it. | Baseline failures classified and either repaired or explicitly resolved before release; architecture decisions recorded. |
| 1 | Add `desktop/` main process, local shell, approved-origin configuration, isolated web view, lifecycle, offline/error screen and development scripts. | Launch/login/enrollment works against isolated staging; renderer has no Node access; invalid navigation is rejected. |
| 2 | Add owner grants/sessions, owner provisioning command, API action policy, account protections and a Maintenance index; extend shared account/layout/navigation models. | Client ADMIN cannot enter Maintenance or invoke protected operations; owner can enter and exit without changing the client workspace or tenant. |
| 3 | Connect all existing main and maintenance workflows, including supporting links and embedded planner actions. | Every private page has an explicit access disposition and every business scenario has executable coverage; shared components and visual baseline preserved. |
| 4 | Complete print/PDF, file import/export, camera/reader behavior, recovery, diagnostics and server/desktop version compatibility. | Native and failure-path test matrix passes, with hardware evidence for supported printers/readers. |
| 5 | Add OS packaging, signing, update feed, staged channels and CI jobs. | A clean target machine can install, launch, update and uninstall without development tools; user data/session handling is verified. |
| 6 | Run full regression, visual comparisons, tenant/owner authorization tests, restore drill and performance/soak tests on release artifacts. | No unresolved critical/high functional or access defects; complete evidence manifest and documented remaining limitations. |
| 7 | Pilot with the client, verify representative daily work, then promote the same tested installer and compatible server release. | Client acceptance and owner support runbook complete; rollback path tested. |

Likely application touchpoints: `src/app/layout.tsx`; `src/app/api/account/route.ts`; account data provider; desktop/mobile navigation; `src/lib/registration-only-workspace.ts`; authentication/request-user and permission helpers; user/account/reset handlers; additive Prisma migrations for owner grants/sessions. Preserve existing domains and avoid broad file moves.

## Test and release contract

1. Existing checks: Prisma validation, TypeScript, ESLint, full Vitest scenarios against disposable PostgreSQL, and the production Next.js build. Install from the branch lockfile in clean CI.
2. Shared browser scenarios: deterministic client ADMIN, restricted staff, coach, authorized owner, revoked owner and a second tenant. Cover the functional parity table through real form submission and database outcomes, not just page loading.
3. Electron automation: launch the built app through Playwright, exercise its real web contents, relaunch/session persistence, owner isolation, offline/reconnect, navigation rejection, popup behavior and downloads. Playwright's Electron support is experimental; pin the tested Electron/Playwright pair. [Playwright Electron API](https://playwright.dev/docs/api/class-electron)
4. Native evidence: automated orchestration plus real target-OS checks for installer/update, native dialogs, physical printing, camera permission and actual scanners. Playwright does not intercept Electron native dialogs; use controlled stubs for automated cancel/error branches and retain real-device acceptance separately.
5. Visual parity: compare the same seeded data, viewport and OS in web and Electron for enrollment, members, cash, planning, dialogs, receipt and representative maintenance screens. Permit only reviewed OS chrome/font differences.
6. Access tests: direct URL/API attempts, forged local state, stale sessions, grant revocation, role/email changes, owner reset attempts, cross-tenant IDs, redirects and untrusted IPC. Validate CSRF/origin handling for maintenance mutations.
7. Reliability: lost response after a committed enrollment/payment, duplicate submit/scan, concurrent operators, timezone/day rollover, crash/relaunch, update interruption and server rollback. Verify ledger, balances, insurance, visits, receipts and audit history.
8. Release evidence: commit IDs, dependency locks, app/server versions, artifact hashes/signing, fixture version, automated reports, OS/hardware checklist, timing/memory measurements and unresolved defects. Missing required fixtures or skipped critical cases fail release readiness.

The existing `npm test` pretest resets a database. Run it only with explicit disposable database URLs. Never point Electron mutation tests, audit seed scripts or migration/reset commands at the client's live database. Store diagnostics and test artifacts outside the source package and redact them before sharing.

## Open inputs

- User choice: connected, standalone offline, or offline with synchronization.
- User choice: Windows only or additional platforms and CPU architectures.
- Before native acceptance: client printer/scanner models, representative workstation and receipt paper sizes.
- Before distribution: application display name/icon confirmation, signing setup and update-feed destination.
- Before owner provisioning: the intended owner identity and support-access lifecycle. The current client account is not automatically promoted into ownership.

Until the first two choices are settled, implementation can prepare shared access policy, fixtures and component reuse, but should not commit to an offline database design or claim platform support.
