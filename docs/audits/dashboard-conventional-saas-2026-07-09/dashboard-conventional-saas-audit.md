# Dashboard And Core Pages SaaS Audit

Date: 2026-07-09
Target: live private app at `https://we-discipline.com`
Destination: local evidence folder

## Scope

This audit checks whether the current dashboard and nearby operational pages feel conventional, convenient, and sellable for a regular martial arts club SaaS user. It is based on screenshots captured during this audit run only. No forms were submitted and no production data was mutated.

Covered screens:

- `01-dashboard-desktop.png`
- `03-pointage-desktop.png`
- `04-planning-desktop.png`
- `05-members-desktop.png`
- `06-subscriptions-desktop.png`
- `07-payments-new-desktop.png`
- `08-enrollment-desktop.png`
- `09-settings-desktop.png`
- `10-dashboard-mobile.png`
- `11-pointage-mobile.png`
- `12-planning-mobile.png`
- `13-members-mobile.png`
- `14-subscriptions-mobile.png`
- `15-payments-new-mobile.png`
- `16-enrollment-mobile.png`
- `17-settings-mobile.png`
- `18-dashboard-mid-desktop.png`
- `19-dashboard-low-desktop.png`

Layout sanity check:

- No sampled page showed page-level horizontal overflow at `1440x900` or `390x844`.
- The dashboard page is long: about `2000px` on desktop and `4045px` on mobile.
- The main issue is not broken responsiveness. It is hierarchy, density, and which work appears first.

## Overall Rating

Current state: good foundation, not yet excellent.

The product now looks much more professional than the earlier versions: sidebar, cards, TND money display, bottom mobile navigation, planning cards, and the settings hub all share the same SaaS direction. The remaining problem is that the dashboard mixes three jobs at once:

- daily reception command center,
- owner finance/reporting view,
- setup/data-health view.

For a regular receptionist/admin, that creates avoidable mental load. The app does not look chaotic everywhere, but the dashboard order can feel chaotic because operational work is below analytics.

## Step Health

| Step | Screen | Health | Notes |
| --- | --- | --- | --- |
| 1 | Dashboard desktop top | Medium-good | Strong hero and palette, but the first cards are finance trend and cash, not the immediate pointage work. |
| 2 | Dashboard desktop middle/lower | Medium | Commercial analytics are dense and appear before `Séances du jour`; important daily action is pushed down. |
| 3 | Dashboard mobile | Medium | Responsive layout works, but the top chrome plus hero consume most of the first viewport. The useful work requires scrolling. |
| 4 | Pointage desktop/mobile | Good | Clear card, clear status, good mobile focus. Mostly ready. |
| 5 | Planning desktop | Good | Big improvement: command center, weekly columns, compact session cards, status colors. Still a little top-heavy. |
| 6 | Planning mobile | Medium-good | Works, but week navigation stacks vertically and hides the actual day/session list below fold. |
| 7 | Members desktop/mobile | Good | Conventional search/filter/action layout, clean empty state. |
| 8 | Subscriptions desktop/mobile | Good | Tabs are understandable; mobile layout is clean. Empty state is useful. |
| 9 | Encaisser desktop/mobile | Medium-good | Empty state is clear, but if the club needs advance/manual payments later, this page may feel blocked. |
| 10 | Enrollment desktop | Good | Step model and summary are useful. |
| 11 | Enrollment mobile | Medium | The summary appears before the actual form content, so the user sees missing requirements before the fields they need to complete. |
| 12 | Settings desktop/mobile | Medium-good | Settings hub is much better than before, but still dense and admin-heavy on mobile. Needs a more guided hierarchy. |

## Strengths

- The app now has a recognizable SaaS visual system: light workspace, white cards, blue primary action, green/amber/red status colors.
- Navigation groups are understandable for daily work: today, sales, students, club, settings.
- Mobile has a proper bottom nav for the highest-frequency actions.
- Planning is now much closer to a real operational command center.
- Empty states are generally clear and less technical than before.
- TND appears correctly in sampled money areas.
- The code already has component boundaries for dashboard panels and a setting for commercial dashboard visibility, so the next pass can be focused.

## UX Risks

### 1. Dashboard Work Order Is Backwards For Reception

Evidence: `01-dashboard-desktop.png`, `18-dashboard-mid-desktop.png`, `19-dashboard-low-desktop.png`, `10-dashboard-mobile.png`.

The dashboard headline promises: sessions to point, payments to follow, priorities needing action. But the first content after the hero is:

- `Encaissements 7 jours`
- `Caisse aujourd'hui`
- then a large `Suivi commercial`
- only later `Séances du jour`

For a receptionist, the first fold should answer:

- What sessions are today?
- What must I point/finalize?
- Who owes money now?
- What money came in today?

The 7-day trend and commercial analytics are valuable, but they are owner/manager information. They should not push operational tasks below the fold.

Recommendation:

- Top row after hero: `Séances du jour` left, `Caisse aujourd'hui` right.
- Second row: `Priorités` left, `Encaissements 7 jours` right.
- Commercial insights lower, hidden by default for reception mode or collapsed behind `Voir le suivi commercial`.
- Keep detailed debts only when there is real debt.

### 2. Dashboard Needs Separate Reception And Owner Modes

Evidence: `18-dashboard-mid-desktop.png`.

`Ventes vs encaissé`, `Remises ce mois`, `Traçabilité reçus`, and debt aging are useful. But they are not all daily receptionist decisions. Showing all of them by default makes the dashboard feel more complex than a conventional SaaS home.

There is already a setting named `dashboardShowCommercialInsights`. Use that as the beginning of a cleaner model:

- `Vue réception`: sessions, pointage, payments due, cash today, alerts.
- `Vue pilotage`: 7-day trend, sales vs collected, offers, receipts, top formulas.

Recommendation:

- Keep `dashboardShowCommercialInsights`, but label it as `Afficher les statistiques de pilotage sur l'accueil`.
- Consider defaulting it off for new tenants.
- Add a compact toggle on dashboard only for admins: `Réception | Pilotage`.

### 3. Mobile Top Chrome Is Too Heavy

Evidence: `10-dashboard-mobile.png` through `17-settings-mobile.png`.

On mobile, the top bar includes:

- logo/name,
- setup guide badge,
- refresh,
- notifications,
- account,
- menu.

This consumes attention before the user sees the actual task. It is especially visible on dashboard and planning.

Recommendation:

- Keep logo + one menu/account control + refresh if needed.
- Move setup guide into the menu or show it only as a dismissible setup banner on dashboard.
- Hide or compress the account button label on mobile.
- Notifications can stay as icon only.

### 4. Data Confidence Is Missing

Evidence: `01-dashboard-desktop.png`, `03-pointage-desktop.png`, `04-planning-desktop.png`.

The dashboard says `0 actifs`, but there are planned sessions and pointage. That may be valid after test-data cleanup, but to a normal client it looks contradictory. The app should detect this as a data quality problem.

Recommendation:

Add a small `Données à vérifier` card when:

- there are sessions for groups with `0` active members,
- a group has schedules but no active assignments,
- active sessions exist while active member count is `0`,
- a coach/room/schedule is missing critical data.

This prevents the product from silently looking broken.

### 5. Commercial Cards Are Too Many When Values Are Zero

Evidence: `18-dashboard-mid-desktop.png`, `19-dashboard-low-desktop.png`.

When data is empty, the commercial block creates many zero-value cards. That makes the app feel heavier and less alive.

Recommendation:

- When all commercial values are zero, replace the full block with one compact summary: `Aucune activité commerciale ce mois`.
- Provide 2 actions: `Inscrire` and `Encaisser`.
- Expand the full commercial block only after there is data or when the admin opens `Détail`.

### 6. Enrollment Mobile Shows Summary Before The Form

Evidence: `16-enrollment-mobile.png`.

After the stepper, mobile shows `Résumé` and missing requirements before the fields. This is logical as a desktop side panel, but on mobile it makes the user read errors before seeing what to do.

Recommendation:

- On mobile, show the active form first.
- Move the summary below the form or collapse it into a sticky `Résumé` drawer.
- Keep the disabled next button near the form with one clear reason.

### 7. Planning Mobile Navigation Is Too Tall

Evidence: `12-planning-mobile.png`.

The previous/today/next controls stack as three full-width buttons, then `Générer depuis horaires`, then stat cards. The actual sessions are below the first viewport.

Recommendation:

- Use one compact week navigation row: `<  Aujourd'hui  >`.
- Move `Générer depuis horaires` into a secondary menu or keep it admin-only.
- Keep the day chips closer to the top on mobile, because choosing the day is the main mobile planning action.

### 8. Settings Hub Is Better, But Still Feels Admin-Heavy

Evidence: `09-settings-desktop.png`, `17-settings-mobile.png`.

The settings page is visually acceptable, but it still exposes many configuration concepts at once. For SaaS buyers, settings should feel guided and safe.

Recommendation:

Group settings by user intent:

- `Club`: logo, coordonnées, jours ouverts.
- `Planning`: saisons, horaires types, conflits.
- `Ventes`: formules, offres, reçus, seuils.
- `Données`: import ancien fichier, nettoyage technique.
- `Accès`: utilisateurs, rôles, journal.

Mark risky developer/admin tools as `Technique` and keep them visually lower.

### 9. Sidebar Is Mostly Good, But Could Be Calmer

Evidence: all desktop screenshots.

The current sidebar is usable. The risk is that `Aujourd'hui`, `Ventes`, `Élèves`, `Club`, `Réglages` can still feel like too many first-level ideas for a small club.

Recommended refinement:

- Keep daily links visible: `Accueil`, `Pointage`, `Planning`.
- Keep sales links visible: `Inscrire`, `Encaisser`, `Abonnements`.
- Move history/reporting links slightly lower or into grouped secondary items.
- Keep settings collapsed by default for non-admin users.

This is not urgent, but it can improve perceived simplicity.

## Accessibility Risks

Screenshot-only checks cannot prove full accessibility. Likely risks:

- Some mobile icon-only buttons need confirmed accessible labels and focus states.
- Color communicates status heavily in planning; text labels are present, which helps, but keyboard/focus testing is still needed.
- Long mobile pages may create focus-order friction if the primary form appears after the summary.
- Hero background contrast looks acceptable in screenshots, but should be checked with real computed colors.

## Best Fix Order

### Pass 1: Dashboard Conventional Home

Goal: make the dashboard feel like a normal SaaS home for a club receptionist.

Tasks:

1. Reorder dashboard content:
   - hero,
   - `Séances du jour`,
   - `Caisse aujourd'hui`,
   - `Priorités`,
   - `Encaissements 7 jours`,
   - member overview,
   - commercial insights lower/collapsed.
2. Keep commercial insights behind the existing setting and improve its label.
3. Add compact empty-state behavior for all-zero commercial data.
4. Add `Données à vérifier` exceptions for contradictory data.
5. Fix any stale deploy/cache issue if the live text still shows `mouvementaujourd'hui`.

Expected impact: high. Low risk if implemented as layout/component changes only.

### Pass 2: Mobile Shell Cleanup

Goal: give mobile screens more useful first-viewport content.

Tasks:

1. Compress setup guide on mobile.
2. Keep refresh, notifications, and account controls smaller.
3. Make bottom nav labels remain the primary mobile navigation.
4. Confirm no horizontal overflow after changes.

Expected impact: medium-high.

### Pass 3: Enrollment And Planning Mobile Clarity

Goal: reduce confusion in the two most complex workflows.

Tasks:

1. Put enrollment active form before summary on mobile.
2. Turn summary into collapsible/sticky mobile drawer.
3. Compact planning week controls.
4. Keep generation action secondary/admin-weighted.

Expected impact: high for daily usability.

### Pass 4: Settings Guided Hub

Goal: make configuration feel safe and sellable.

Tasks:

1. Rename groups around user intent.
2. Move technical/risky tools lower.
3. Add short setup progress for missing club basics.
4. Keep receipts and planning settings clear but less visually dense.

Expected impact: medium.

## Not Urgent

- Full sidebar redesign. The current grouping is acceptable enough for first client handoff.
- More dashboard charts. The product needs less chart noise, not more.
- New business logic. The main issues here are hierarchy and data confidence, not schema.

## Go / No-Go For Selling

Go with caution for a first live client if the team is trained and the data is clean.

Before broader SaaS selling, fix:

1. dashboard order,
2. mobile enrollment order,
3. setup/topbar mobile density,
4. data confidence warnings,
5. zero-state commercial block.

Those are the changes most likely to move the product from `good but a bit busy` to `conventional, clear, and easy to trust`.
