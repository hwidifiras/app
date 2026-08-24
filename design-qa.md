# Design QA — We Discipline Option 2 shared SaaS redesign

Date: 2026-08-24

## Decision and scope

- Design 2 is the only visual authority. Design 1, Design 3, and the earlier hybrid direction are excluded.
- The implementation is in the real shared SaaS components used by the current tenant, the demo tenant, administrator accounts, martial-arts/class tenants, gym and hybrid tenants, and future tenants.
- No user-facing page was replaced by the QA harness and no route was removed. The final production build contains 54 user-facing pages across tenant operations, administration, gym, onboarding, public, and account flows.
- Planning received the deepest workflow redesign. Pointage, dashboard, navigation, forms, tables, status surfaces, demo safeguards, and permission-aware actions inherit the same system.

## Visual source and final evidence

- Design 2 source: `C:\Users\Dell\.codex\generated_images\01a018d7-f34f-7ee1-ab5b-a82379b157e8\exec-c4217bf0-7327-4291-927e-cb8a0a744d82.png`
- Equal-size Design 2 + final Pointage comparison: `C:\Users\Dell\.codex\visualizations\2026\08\19\01a018d7-f34f-7ee1-ab5b-a82379b157e8\we-discipline-option2-final-qa\design2-pointage-comparison-final.png`
- Final Planning desktop: `C:\Users\Dell\.codex\visualizations\2026\08\19\01a018d7-f34f-7ee1-ab5b-a82379b157e8\we-discipline-option2-final-qa\planning-production-final.png`
- Final Pointage desktop: `C:\Users\Dell\.codex\visualizations\2026\08\19\01a018d7-f34f-7ee1-ab5b-a82379b157e8\we-discipline-option2-final-qa\pointage-1487x1058-final3.png`
- Planning mobile list: `C:\Users\Dell\.codex\visualizations\2026\08\19\01a018d7-f34f-7ee1-ab5b-a82379b157e8\we-discipline-option2-final-qa\planning-mobile-390x844-cdp.png`
- Planning mobile selected-session sheet: `C:\Users\Dell\.codex\visualizations\2026\08\19\01a018d7-f34f-7ee1-ab5b-a82379b157e8\we-discipline-option2-final-qa\planning-mobile-sheet-390x844.png`
- Pointage mobile list: `C:\Users\Dell\.codex\visualizations\2026\08\19\01a018d7-f34f-7ee1-ab5b-a82379b157e8\we-discipline-option2-final-qa\pointage-mobile-390x844-cdp.png`
- Pointage mobile selected-session sheet: `C:\Users\Dell\.codex\visualizations\2026\08\19\01a018d7-f34f-7ee1-ab5b-a82379b157e8\we-discipline-option2-final-qa\pointage-mobile-sheet-390x844.png`
- Planning tablet: `C:\Users\Dell\.codex\visualizations\2026\08\19\01a018d7-f34f-7ee1-ab5b-a82379b157e8\we-discipline-option2-final-qa\planning-tablet-820x1180-cdp.png`
- Pointage tablet selected-session sheet: `C:\Users\Dell\.codex\visualizations\2026\08\19\01a018d7-f34f-7ee1-ab5b-a82379b157e8\we-discipline-option2-final-qa\pointage-tablet-sheet-820x1180.png`

## Viewports and states

| Evidence | Exact CSS viewport | State |
| --- | ---: | --- |
| Design 2 source and desktop implementation | 1487 × 1058 | Light theme, expanded Option 2 rail, selected operational item and contextual inspector |
| Mobile implementation | 390 × 844 | Base list plus selected-session bottom sheet |
| Tablet implementation | 820 × 1180 | Dense base board plus selected-session right sheet |

The mobile and tablet captures use Chrome device metrics directly. Chrome reported `innerWidth` equal to the requested viewport and `documentElement.scrollWidth` equal to it at both 390 and 820 pixels, confirming no accidental page-level horizontal overflow.

## Final findings

No actionable P0, P1, or P2 visual, interaction, responsive, or accessibility mismatch remains.

- Shell fidelity: slim navy rail, solid-blue active item, quiet light top bar, tenant identity, alerts, date/week context, and compact operational surfaces follow Design 2.
- Shared-tenancy behavior: account and product context are server-bootstrapped, so the real tenant and demo do not flash an empty sidebar while account data loads. A failed background refresh preserves the last valid account unless the server explicitly returns an authorization failure.
- Planning desktop: week controls, compact summary metrics, conflict alert, view controls, filters, deliberate horizontal day board, compact session cards, and contextual inspector fit together on the first operational screen.
- Planning tablet/mobile: the permanent inspector becomes a right sheet or bottom sheet; filters collapse; the active day becomes the primary work surface; the first useful session appears in the initial mobile screen instead of far below the fold.
- Planning selection safety: an explicit selected session never silently changes to a recommended session after filtering. The sheet closes and clears safely when the selected item disappears.
- Pointage desktop: Maintenant, Ensuite, À régulariser, and Finalisées are compact queue sections. The selected roster remains available in the right inspector without stretching queue cards.
- Pointage live behavior: queue classification starts from server time in the tenant time zone and refreshes at every minute boundary. A session moves from Maintenant to À régulariser at its exact end time, and tenant-midnight rollover reclassifies both days without discarding optimistic attendance edits.
- Pointage tablet/mobile: the roster becomes a task-focused sheet with bulk attendance, payment warnings, individual Present/Absent actions, exceptions, undo, finalize/reopen, and postpone behavior preserved.
- Demo safety: the demo workspace is visibly read-only and all shared or standalone mutation paths reviewed in this change are blocked, including subscription lifecycle actions, user and sport changes, group assignment, household changes, reminders, notification state, receipt email actions, attendance/session mutations, and every data-import mutation. Data-import preview POST controls are also disabled so the interface never advertises a request that the read-only proxy will reject.
- Permission-aware UI: collection, correction, subscription, and group-assignment actions are only shown when the current account can perform them. Payment corrections remain administrator-only to match the server API.
- Accessibility: view/day selectors use ordinary buttons with `aria-pressed`; session selection exposes pressed state; dialogs and sheets restore focus; visible controls keep keyboard focus styles and appropriate touch targets.
- Assets: tenant branding and the existing Lucide icon family are retained. No emoji, placeholder imagery, CSS-drawn icons, or invented decorative assets were introduced.

## Comparison history

### Audit baseline — blocked

- P1: the original Planning board began too far below its controls on desktop, and the first useful mobile session appeared around 1417px down the page.
- P1: session cards were too tall for weekly scanning and a permanent detail panel consumed useful width at intermediate sizes.
- P1: Pointage and demo controls could appear mutable even when the workspace was read-only.
- P1: account hydration could briefly remove tenant navigation and identity.

### Implementation review — blocked

- P1: filtering could remove an explicit Planning selection while the inspector silently fell back to another session.
- P1: Pointage used a server-time snapshot that could become stale on a long-open page.
- P1: Pointage could leave a just-ended session in a non-actionable queue until a reload, and tenant-midnight rollover needed an explicit live derivation.
- P1: some correction and group-assignment links used broader route permissions than their underlying actions.
- P1: the demo Excel preview looked available even though its unsafe POST request was correctly rejected by the read-only proxy.
- P2: tab roles were incomplete because the controls did not implement the full tab keyboard model.
- Fixes: safe selection clearing, tenant-time minute and day updates, exact end-boundary queue derivation, exact route/action gates, truthful demo import controls, and ordinary pressed-button semantics.

### Side-by-side visual review — blocked

- P1: the desktop Pointage queue grid stretched one-row sections, producing excess blank space compared with Design 2.
- Fix: queue tracks now align to their content while the rail itself retains independent vertical scrolling.

### Final Chrome review — passed

- Equal-size 1487 × 1058 source/implementation comparison reviewed.
- Planning and Pointage reviewed at desktop, tablet, and true 390px mobile widths.
- Base-list and selected-session sheet states reviewed.
- No page-level horizontal overflow at 390 or 820 CSS pixels.
- No actionable P0, P1, or P2 finding remains.

## Verification

- TypeScript: passed with `--noEmit --incremental false`.
- ESLint: full repository passed.
- Targeted regression suite: 65/65 tests passed across UI contracts, modules, demo safety, permissions, payment navigation, notifications, attendance queue boundaries, lifecycle, and SaaS access.
- Production build: passed with 54 user-facing pages and 131 compiled app/API entries.
- Database-dependent integration tests were not counted in this design pass because the local environment has no `DATABASE_URL`; their failure mode was environment validation before test execution, not a product assertion.

final result: passed
