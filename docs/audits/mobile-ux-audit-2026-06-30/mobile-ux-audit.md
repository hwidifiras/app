# Mobile UX And Responsiveness Audit - 2026-06-30

## Scope

- Target: live SaaS app at `https://we-discipline.com` after the PostgreSQL cutover.
- Viewports captured: desktop `1440x900` and mobile `390x844`.
- Evidence folder: `docs/audits/mobile-ux-audit-2026-06-30/screenshots/`.
- Screens covered: dashboard, pointage, inscription, encaissement, membres, abonnements, paiements, planning, cours, coachs, disciplines, offres, utilisateurs, club, and formules.
- A temporary audit admin account was created only to capture private screens and was disabled after capture.

## Step Health

1. Login: healthy. The page is polished and responsive, but private access required a temporary audit account because seed credentials are not valid on migrated data.
2. Dashboard: healthy. Mobile first fold is clear and reception-oriented; quick actions are easy to find.
3. Pointage: mostly healthy. Session cards are understandable and status color helps, though vertical density is high.
4. Inscrire: usable with friction. Steps are clear, but the disabled primary action looks too much like an active CTA.
5. Encaisser: usable with friction. Money summary is strong, but the disabled submit button dominates before the user has finished the form.
6. Membres: healthy direction. Table-to-card mobile conversion works, but cards spend too much space on the action area.
7. Abonnements/Paiements/Formules: mostly healthy. Cards communicate payment state well; destructive actions need clearer visual hierarchy.
8. Planning: needs fix. Mobile shows horizontal overflow and a bottom sideways scrollbar.
9. Configuration pages: usable but heavy. Long forms are readable, but sticky submit actions compete with the mobile bottom nav.

## Strengths

- The app now feels like one SaaS product: white surfaces, blue primary actions, restrained borders, and consistent reception language.
- Desktop layout is stable across the audited pages; no desktop horizontal overflow was detected.
- Mobile bottom navigation is clear for the five main reception tasks.
- Data tables generally become card lists on mobile, which is the right direction for reception/admin use.
- Dashboard hierarchy is much better than the old debt-first view: today's work and quick actions are visible immediately.

## Findings

### P1 - Planning Mobile Horizontal Overflow

Evidence: `23-mobile-390x844-sessions.png`.

The planning page creates a horizontal scrollbar at `390px` wide. Metrics showed `scrollWidth=401` and `clientWidth=375`. The visible symptom is a sideways scrollbar at the bottom, and the session action row feels squeezed.

Recommended fix:
- Add a hard `overflow-x-hidden` safety boundary to the mobile app frame.
- Ensure off-canvas sidebar/drawer elements cannot contribute to page width.
- Make session card actions wrap into a two-row or full-width mobile action stack.
- Add `min-w-0` to nested flex/grid children in the session planner.

### P2 - Disabled Primary Buttons Look Too Active

Evidence: `18-mobile-390x844-enrollment.png`, `19-mobile-390x844-payment-new.png`.

Disabled buttons such as `Suivant : offres` and `Encaisser le paiement` stay large, blue, and visually primary. A normal receptionist may read them as available and wonder why they do not work.

Recommended fix:
- Give disabled primary buttons a neutral disabled style: pale slate/blue, no heavy shadow, disabled cursor, and clearer helper text near the missing field.
- Keep the real next action visually strong only once required inputs are valid.

### P2 - Mobile Cards Spend Too Much Space On Actions

Evidence: `20-mobile-390x844-members.png`, `32-mobile-390x844-subscription-plans.png`.

The mobile cards are readable, but repeated `Actions`, `Details`, `Voir plus`, `Modifier`, `Supprimer` blocks make lists taller than needed. This slows scanning when a receptionist is looking for one member or one plan.

Recommended fix:
- Standardize a compact mobile card pattern:
  - Title and status in the first row.
  - Two key facts max in the body.
  - One full-width primary action.
  - Secondary actions behind `Voir plus` or an icon menu.
- Make destructive actions visually secondary/red outline, not equal weight to edit actions.

### P2 - Sticky Form Actions Compete With Bottom Navigation

Evidence: `29-mobile-390x844-settings-users.png`, `30-mobile-390x844-settings-club.png`.

The sticky form submit is useful, but on mobile it sits directly above the persistent bottom nav. The result is a heavy bottom stack and less breathing room for form content.

Recommended fix:
- Add a shared mobile sticky-action component with `bottom: mobile-nav-height + safe-area`.
- Reduce sticky action height on mobile.
- Add enough bottom padding to forms so final fields never hide behind nav/action bars.

### P2 - Mobile Top Chrome Uses A Lot Of The First Fold

Evidence: all mobile screenshots.

The brand, notification bell, account button, and menu are clean, but they consume a fixed top band on every operational screen. Combined with the bottom nav, the working viewport becomes tight.

Recommended fix:
- Keep the top bar, but shrink mobile account display to avatar-only plus menu.
- Hide non-urgent notification count details until the drawer/account menu.
- Consider a slightly denser mobile header height for private app pages.

### P3 - `/plans` Is Not A Product Route

Evidence: `27-mobile-390x844-plans.png`.

The captured `/plans` route returns `404`, but code inspection shows the real route is `/subscription-plans`, and no app references to `/plans` were found. This is not an app bug unless external documentation or bookmarks point there.

Recommended fix:
- Do nothing for the app navigation.
- Optional: add a redirect from `/plans` to `/subscription-plans` if users or old docs may try it.

## Suggested First Polish Batch

1. Fix `/sessions` mobile horizontal overflow.
2. Create a shared disabled-primary style and apply it to form CTAs.
3. Introduce a compact mobile card action pattern for members, groups, plans, subscriptions, and payments.
4. Add a shared mobile sticky action/footer component that respects bottom nav height.
5. Tighten the mobile top bar account/notification area.
6. Add a quick route alias `/plans -> /subscription-plans` only if desired.

## First Polish Applied

- Commit: `28d74eb` (`fix: polish mobile app responsiveness`).
- Deployed to the live SaaS app on `127.0.0.1:3002`.
- Fixed `/sessions` mobile overflow: after capture at `390x844` reported `scrollWidth=375`, `clientWidth=375`, `horizontalOverflow=false`.
- Updated disabled primary button styling so blocked form CTAs read as unavailable instead of active.
- Increased the shared sticky `FormActions` mobile bottom offset so sticky form actions sit more comfortably above the bottom nav.
- After screenshots were saved in `screenshots/after-polish/` for `/sessions`, `/enrollment`, `/payments/new`, and `/settings/users`.
- The temporary audit admin account was disabled after the verification pass.

## Later Mobile Polish Applied

- Commits:
  - `a288f6e` (`fix: compact mobile card actions`).
  - `4503e51` (`fix: clean up member mobile actions`).
  - `46b5eb2` (`fix: tighten mobile app chrome and cards`).
- Deployed to the live SaaS app on `127.0.0.1:3002`.
- Added `/plans -> /subscription-plans` redirect for safer old bookmarks or guessed navigation.
- Compact card actions were verified on `/members` and `/subscription-plans`; each visible member card now shows one `Détails` action plus one `Voir plus` toggle.
- Tightened the mobile top bar, account/notification/setup controls, bottom nav, shared page header rhythm, mobile table-card spacing, mobile card labels, `Voir plus` affordance, and sticky form action offset.
- Viewport screenshots were saved in `screenshots/responsive-polish-after-46b5eb2/` for dashboard, pointage, inscription, encaissement, membres, abonnements, paiements, planning, cours, coachs, disciplines, formules, offres, club, and logs.
- Visual result at `390x844`: cards are more compact, top/bottom chrome consumes less of the first fold, table cards remain readable, and primary actions stay visible without horizontal scrolling.
- Automated overflow metrics still flag the closed off-canvas mobile drawer because it exists offscreen with a transform. The accepted screenshots do not show user-visible horizontal scrolling after this pass.
- Verification completed:
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - Live HTTPS smoke check returned `200 OK` on `https://we-discipline.com/login`.
  - Server repo is on `46b5eb2`.
- The temporary audit admin account was disabled after the verification pass.

## Remaining Mobile UX Notes

- The top chrome is now acceptable, but it still occupies a fixed band on every screen; a future redesign could collapse secondary controls into the menu on very small devices.
- Long forms such as club settings and coach creation remain readable, but they are still lengthy. A later pass should consider section anchors or progressive grouping for configuration-heavy screens.
- Several configuration lists intentionally hide secondary details behind `Voir plus`; this keeps scanning fast, but power users may eventually want inline quick actions per row.

## Secondary Screens Pass

- Commit: `85cc067` (`fix: clean attendance operator display`).
- Deployed to the live SaaS app on `127.0.0.1:3002`.
- Captured additional mobile screenshots in `screenshots/remaining-screens-before/` for:
  - attendance history, group reports, session detail
  - member detail and add-to-group
  - subscription new/edit, payment correction
  - group new/edit/schedules, plan new/edit
  - session edit modal, account/users/data-import settings, log detail
- Finding fixed: attendance history was exposing an internal operator id in the mobile `Pointage` row. It now resolves known user ids to account names and falls back to `Utilisateur` for unresolved internal ids.
- After screenshots were saved in `screenshots/remaining-screens-after-85cc067/`; browser text checks reported no raw CUID-like strings on attendance history or session detail screens.
- Remaining low-priority polish: the add-to-group screen title can still become long when member names are long. The screen remains usable, but a later copy-only pass should shorten it to `Affecter à un groupe` and move the member name into supporting text.
- Verification completed:
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - VPS Docker build and restart passed.
  - Live HTTPS smoke check returned `200 OK` on `https://we-discipline.com/login`.
- The temporary audit admin account was disabled after verification.

## Mobile Responsiveness Follow-Up

- Commit: `f5e7f18` (`fix: align mobile soft action copy`).
- Deployed to the live SaaS app on `127.0.0.1:3002`.
- Captured a fresh `390x844` mobile evidence set in `screenshots/mobile-responsive-pass-f5e7f18/`:
  - dashboard, pointage, inscription, encaissement
  - membres, abonnements, paiements, planning
  - add-to-group, cours list, expanded cours actions, deactivation dialog
- Result: all captured screens reported `horizontalOverflow=false`.
- Fixed the add-to-group page title from the long member-name sentence to `Affecter à un groupe`; the member name now lives in supporting text. This keeps the first mobile fold cleaner for long names.
- Fixed the courses list safety copy: the action now reads `Désactiver`, uses a warning tone instead of a delete/trash treatment, keeps the row visible after success, and explains that sessions/history remain consultable.
- Verified the new deactivation dialog without confirming the destructive action. The dialog now says the course will stop being offered for new registrations while preserving history.
- Current mobile assessment:
  - Dashboard remains strong and reception-first; first fold is clear.
  - Forms for `Inscrire` and `Encaisser` are readable with large inputs and clear step/action hierarchy.
  - Members, subscriptions, payments, sessions, and groups now behave as card lists without visible sideways scrolling.
  - Bottom navigation is stable and gives the five main reception tasks quick access.
- Remaining UX polish worth a later pass:
  - Expanded row actions on configuration cards are still icon-only; mobile users would benefit from clearer labels or a compact action menu.
  - Search/filter/primary-action toolbars consume a lot of first-fold height on list pages; acceptable now, but a denser toolbar pattern would improve scan speed.
  - Long operational forms remain usable, but progressive sectioning or anchors would make settings-heavy screens easier for non-technical users.
- Verification completed:
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - VPS Docker build and restart passed.
  - Live HTTPS smoke check returned `200 OK` on `https://we-discipline.com/login`.
  - `npm.cmd test` was blocked in the Windows workspace because local Postgres/Docker is unavailable; no production/staging data reset was attempted.
  - `npm.cmd audit --omit=dev` reported two moderate advisories through Next's bundled PostCSS dependency. No automated force-fix was applied because npm suggested a breaking downgrade path.
- The temporary audit admin account was disabled after verification.

## Mobile Action Labels Pass

- Commit: `b985656` (`fix: label mobile card actions`).
- Deployed to the live SaaS app on `127.0.0.1:3002`.
- Captured focused `390x844` screenshots in `screenshots/mobile-action-labels-b985656/`:
  - `01-groups-labelled-actions.png`
  - `02-plans-labelled-actions.png`
- Result: expanded course card actions now show readable mobile labels (`Planifier`, `Modifier`, `Désactiver`) instead of icon-only square buttons.
- The shared mobile card action CSS now wraps compact action pills and derives visible labels from `aria-label` for icon-only controls.
- Subscription/formula-style cards with already visible text actions remain full-width and unchanged in behavior.
- Both captured screens reported `horizontalOverflow=false`.
- Verification completed:
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - VPS Docker build and restart passed.
- The temporary audit admin account was disabled after verification.

## Mobile Toolbar Compact Pass

- Commit: `aa3308e` (`fix: compact mobile list toolbars`).
- Deployed to the live SaaS app on `127.0.0.1:3002`.
- Captured focused `390x844` screenshots in `screenshots/mobile-toolbar-compact-aa3308e/`:
  - `01-members-toolbar.png`
  - `02-groups-toolbar.png`
  - `03-payments-toolbar.png`
  - `04-sessions-toolbar.png`
  - `05-attendance-history-toolbar.png`
- Result: the shared mobile list toolbar now uses shorter search fields, filter buttons, action buttons, padding, and result-count text while keeping touch targets readable at about `41px` high.
- Applied the shared `list-toolbar` hook to members, groups, payments, subscriptions, formulas, attendance history, planning, and group reports.
- All captured toolbar screens reported `horizontalOverflow=false`.
- Visual result: list pages now show more real content in the first mobile fold without removing the search/filter/action workflow.
- Verification completed:
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - VPS Docker build and restart passed.
- The temporary audit admin account was disabled after verification.

## Mobile Form Section Navigation Pass

- Commit: `1fcb333` (`fix: add mobile form section navigation`).
- Deployed to the live SaaS app on `127.0.0.1:3002`.
- Captured focused `390x844` screenshots in `screenshots/mobile-form-nav-1fcb333/`:
  - `01-settings-club-mobile-viewport.png`
  - `02-settings-account-mobile-viewport.png`
  - `03-settings-data-import-closed-mobile-viewport.png`
  - `04-settings-data-import-active-mobile-viewport.png`
- Added shared `FormSectionNav` anchors for long settings/reprise forms.
- Result: club settings, account settings, and active reprise mode now expose short mobile section chips (`Identité`, `Pointage`, `Alertes`, `Profil`, `Thème`, `Sécurité`, `État réel`, `Pointages`) before long form content.
- All captured form screens reported `horizontalOverflow=false`.
- Reprise mode was opened only to verify the active form layout; no import was applied, and the mode was closed immediately after capture.
- Verification completed:
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - VPS Docker build and restart passed.

## Current Mobile Review And Config List Priority

- Commit: `d299052` (`fix: prioritize config lists on mobile`).
- Deployed to the live SaaS app on `127.0.0.1:3002`.
- Captured a fresh current-state `390x844` review set in `screenshots/mobile-current-review-1fcb333/` for:
  - dashboard, pointage, inscription, encaissement
  - membres, abonnements, paiements, planning
  - cours, coachs, disciplines, formules, offres, club settings
- Result: all 14 reviewed routes reported `horizontalOverflow=false`.
- Finding: high-frequency reception pages are now stable, but configuration pages still felt form-first on mobile. Coachs and Disciplines opened on creation forms before showing the existing data, which is backwards for a normal admin checking or editing records.
- Fix applied:
  - Coachs and Disciplines now show the existing list first on mobile.
  - A clear primary jump action (`Ajouter un coach`, `Ajouter une discipline`) remains in the page header.
  - Desktop keeps the management layout with the create form first/left and the list beside it.
  - Coach mobile card actions now show readable `Modifier` and `Supprimer` labels instead of icon-only square controls.
- After screenshots were saved in `screenshots/mobile-config-list-priority-d299052/`:
  - `01-coaches-list-first.png`
  - `02-sports-list-first.png`
- Both changed pages reported `horizontalOverflow=false` after deployment.
- Verification completed:
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - VPS Docker build and restart passed.
  - Live HTTPS smoke check returned `200 OK` on `https://we-discipline.com/login`.
  - `npm.cmd test` remains blocked in the Windows workspace because the local PostgreSQL test database at `localhost:5432` is unavailable; the failure happens during `scripts/test-db-reset.mjs` before tests run.

## Mobile Deep Screens And Users List Priority

- Commit: `fa5688c` (`fix: prioritize users list on mobile`).
- Deployed to the live SaaS app on `127.0.0.1:3002`.
- Captured a deep `390x844` mobile evidence set in `screenshots/mobile-deep-screens-0a0e93b/` for:
  - attendance history, group reports, session detail
  - member detail, add-to-group, member new redirect to enrollment
  - subscription new/edit, payment correction
  - group new/edit/schedules
  - formula new/edit
  - session postpone redirect to planning
  - account, users, reprise, logs, log detail
- Result: all deep-screen captures reported `horizontalOverflow=false`.
- Tenant isolation observation: the first member-detail sample used `audit-other-member`, which belongs to `tenant_audit_other`; `we-discipline.com` correctly returned a private-app 404. The member screenshots were recaptured with same-tenant member `audit-ux-member-partial`.
- Route behavior observation: `/sessions/[id]/postpone` intentionally redirects into the planning editor with `week`, `groupId`, and `sessionId` query parameters, so the planning editor is the effective postpone screen.
- Finding: `Utilisateurs` still opened on the long create form on mobile. This was inconsistent with the newer Coachs/Disciplines pattern and slowed down the admin task of checking or editing existing accounts.
- Fix applied:
  - `Utilisateurs` now shows the existing account list first on mobile.
  - A primary header action links to `Ajouter un utilisateur`.
  - Desktop keeps the create form above the list, preserving the existing admin workflow.
- After screenshot saved in `screenshots/mobile-users-list-priority-fa5688c/`:
  - `01-settings-users-list-first.png`
- The changed users screen reported `horizontalOverflow=false`; first visible panel is now `Liste (5)`.
- Verification completed:
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - VPS Docker build and restart passed.
  - Live HTTPS smoke check returned `200 OK` on `https://we-discipline.com/login`.
  - `npm.cmd test` remains blocked in the Windows workspace because the local PostgreSQL test database at `localhost:5432` is unavailable; the failure happens during `scripts/test-db-reset.mjs` before tests run.
- The temporary audit admin account was disabled after verification.

## Long Operational Forms Section Navigation

- Commit: `b295f7a` (`fix: add mobile section nav to long forms`).
- Deployed to the live SaaS app on `127.0.0.1:3002`.
- Captured focused `390x844` screenshots in `screenshots/mobile-form-nav-b295f7a/` for:
  - payment creation and payment correction
  - subscription renewal and subscription edit
  - group creation, group edit, and group schedules
  - formula creation and formula edit
- Result: all 9 captured long-form routes reported `horizontalOverflow=false`.
- Added short section chips to long operational forms so mobile users can jump between major form areas:
  - `Dossier`, `Montant`, `Règlement`, `Récap` on payment creation.
  - `Original`, `Correction`, `Impact`, `Annulation` on payment correction.
  - `Dossier`, `Formule`, `Paiement`, `Récap` on renewal.
  - `Membre`, `Formule`, `Période`, `Valeurs` on subscription edit.
  - `Infos`, `Membres` on group create/edit.
  - `Créneaux`, `Ajouter` on group schedules.
  - `Modèles`, `Infos`, `Quota`, `Validité`, and `Statut` where relevant on formula forms.
- Anchor QA:
  - Every captured section chip pointed to an existing page anchor.
  - Tapping `Récap` on `/payments/new` changed the hash to `#payment-summary`, scrolled the page, and brought the recap panel into the viewport.
  - Browser console check after the anchor click returned no errors.
- Visual result:
  - Cards remain full-width and readable on mobile.
  - Long forms now communicate their structure in the first fold.
  - Summary panels are easier to reach before submit, which helps cashier/reception confidence.
  - No public route, API, schema, or business behavior was changed.
- Verification completed:
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - VPS Docker build and restart passed.
  - `npm.cmd test` remains blocked in the Windows workspace because the local PostgreSQL test database at `localhost:5432/gymday_test` is unavailable; the failure happens during `scripts/test-db-reset.mjs` before tests run.
  - `npm.cmd audit --omit=dev` reported two moderate advisories through Next's bundled PostCSS dependency. No force-fix was applied because npm suggested a breaking path.

## Offers Mobile Action Clarity

- Commit: `27aada8` (`fix: clarify offers mobile actions`).
- Deployed to the live SaaS app on `127.0.0.1:3002`.
- Captured focused `390x844` screenshot in `screenshots/mobile-offers-actions-27aada8/`:
  - `01-offers-mobile-actions.png`
- Result: `/offers` reported `horizontalOverflow=false`.
- Fixed the last inconsistent configuration action pattern found in the current pass:
  - Added a header primary action `Ajouter une offre` that jumps to the create form.
  - Kept the mobile list-first layout: `Offres actives` remains above `Créer une offre`.
  - Replaced the icon-only trash-style action with a labelled warning action, `Désactiver`.
  - Preserved the existing deactivate flow and confirmation dialog; no offer was actually deactivated during QA.
- Anchor/action QA:
  - `#offer-create` exists.
  - Tapping `Ajouter une offre` changed the hash to `#offer-create`, scrolled the page, and brought the create form into view.
  - Browser console check after the anchor click returned no errors.
- Verification completed:
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - VPS Docker build and restart passed.
  - Live HTTPS smoke check returned `200 OK` on `https://we-discipline.com/login`.
- The temporary audit admin account was disabled after verification.

## Responsive Cards And Mobile Actions Follow-Up

- Commits:
  - `01a112b` (`fix: improve mobile table card actions`).
  - `14f5b39` (`fix: compact subscription card actions`).
- Deployed to the live SaaS app on `127.0.0.1:3002`.
- Captured a fresh `390x844` route set in `screenshots/responsive-pass-20260630/`:
  - login, dashboard, pointage, inscription, encaissement
  - membres, abonnements, paiements, planning, cours, club settings
  - focused after screenshots for members, subscriptions, and courses
- Result: every captured route reported `horizontalOverflow=false`.
- UX critique from the evidence:
  - Overall mobile responsiveness is now stable; the app behaves like a real mobile admin tool rather than a squeezed desktop table.
  - The main remaining weakness was action clarity on table-card lists: too many cards asked users to expand with `Voir plus` before exposing the next useful action.
  - The shared row toggle now reads `Infos` / `Réduire`, which makes expansion feel secondary instead of the main task.
  - Member cards now use `Ouvrir` instead of `Détails`, which is clearer as an operational action.
  - Course cards expose `Planifier`, `Modifier`, and `Désactiver` directly on mobile cards; this improves discoverability for admin maintenance.
  - Subscription cards now expose `Encaisser` directly for active unpaid/partial subscriptions, with `Modifier` as the secondary action. This better matches reception work.
- Visual QA caught and fixed one regression:
  - The first subscription action layout made `Modifier` too tall on mobile.
  - Commit `14f5b39` removed the extra wrapper so the shared compact action stack controls button height again.
- Final subscription metrics at `390x844`:
  - `path=/subscriptions`
  - `horizontalOverflow=false`
  - visible/available actions include `Renouveler`, `Filtres`, `Encaisser`, `Modifier`, and `Infos`.
- Verification completed:
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - VPS Docker build and restart passed for both commits.
- `npm.cmd test` was not rerun in this small UI-only follow-up; previous passes remain blocked locally by the unavailable PostgreSQL test database at `localhost:5432/gymday_test`.

## Data Import Mobile Clarity Follow-Up

- Finding: the reprise/import preview reused the shared mobile card table behavior, but the bulk preview cells did not expose `data-label` values. On mobile this could show row values without enough context for a receptionist checking an Excel file.
- Fix:
  - Added labelled mobile preview fields for `Ligne`, `Membre`, `Groupe`, `Formule`, `Solde`, and `Statut`.
  - Kept the generated member reference visible as `Réf.` under the member name instead of exposing `externalId` language to the user.
  - Added a short note explaining that `Référence` is optional and is generated automatically when blank.
  - Reused the shared sticky `FormActions` layout for the manual reprise submit bar.
  - Cleaned the visible import copy: `modèle`, `prévalidation`, and `Importées`.
- Verification completed:
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint -- --format stylish`
  - `npm.cmd run build`
  - `git diff --check` returned no whitespace errors, only the normal CRLF warning for this workspace.
- `npm.cmd test` remains blocked locally because the PostgreSQL test database `localhost:5432/gymday_test` is unavailable; the failure happens during `scripts/test-db-reset.mjs` before Vitest starts.
- No file was uploaded and no import/apply action was performed during this pass.

## Manual Card Consistency Follow-Up

- Finding: after the shared card/table work, a few manual list implementations still differed from the app pattern:
  - `Membres` and `Formules` used malformed `bg-(--surface-soft)` / `hover:bg-(--surface-soft)` classes, so intended surface and hover colors could fail to render.
  - Group schedule and formula mobile cards still used `Détails` instead of the shared `Infos` / `Réduire` affordance.
- Fix:
  - Replaced the malformed surface classes with `bg-[var(--surface-soft)]` and `hover:bg-[var(--surface-soft)]`.
  - Updated manual mobile toggles on group schedules and formulas to `Infos` when closed and `Réduire` when open.
  - Added the missing `data-label="Actions"` on the formula action cell so it matches the table-card semantics.
- Static search after the fix found no remaining malformed `bg-(--surface-soft)` classes or standalone old `Détails` mobile toggles in `src/app` or `src/components`.
- Verification completed:
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint -- --format stylish`
  - `npm.cmd run build`
  - `git diff --check` returned no whitespace errors, only the normal CRLF warning for this workspace.
- `npm.cmd test` remains blocked locally because the PostgreSQL test database `localhost:5432/gymday_test` is unavailable; the failure happens during `scripts/test-db-reset.mjs` before Vitest starts.

## Evidence Limits

- This audit is screenshot and DOM-metric based; it does not prove full WCAG compliance.
- It did not submit forms, create payments, change members, or perform destructive actions.
- It used real migrated/staging data visible in the live app after cutover, plus a temporary audit admin that was disabled immediately after capture.
