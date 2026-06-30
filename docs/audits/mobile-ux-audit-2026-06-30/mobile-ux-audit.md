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

## Evidence Limits

- This audit is screenshot and DOM-metric based; it does not prove full WCAG compliance.
- It did not submit forms, create payments, change members, or perform destructive actions.
- It used real migrated/staging data visible in the live app after cutover, plus a temporary audit admin that was disabled immediately after capture.
