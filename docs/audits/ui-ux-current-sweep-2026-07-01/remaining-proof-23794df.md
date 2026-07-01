# Remaining UI Proof - 2026-07-01

## Scope

- Target: live SaaS app at `https://we-discipline.com`.
- Commit deployed before capture: `23794df` (`fix: polish import template and operational labels`).
- Temporary dataset: `audit-ux-*` seeded with same-tenant members, sessions, attendances, payments, offers, and one audit admin.
- Account: `audit-ux-20260701@we-discipline.test`.
- Evidence folder: `screenshots/remaining-proof-23794df/` (ignored by Git).
- Viewports:
  - Mobile: `390x844`.
  - Desktop: `1440x900`.
- Capture mode: direct navigation, no create/import/payment/finalization/deactivation action was submitted.

## Captured Steps

1. Dashboard `/`
   - Health: healthy.
   - Evidence: today session, priority debt, and quick actions render with realistic audit data.

2. Payment creation `/payments/new?memberId=audit-ux-member-partial`
   - Health: healthy.
   - Evidence: selected member/subscription, remaining balance, section chips, and neutral amount-first submit hierarchy render correctly on mobile and desktop.

3. Attendance session detail `/attendance/sessions/audit-ux-session-today`
   - Health: healthy.
   - Evidence: valid same-tenant session now captures successfully; status is shown as `Planifiée`, operator names render as `Audit UX`, inactive history is labelled `Hors liste active`, and no raw internal id is visible.

4. Today attendance `/attendance/today?sessionId=audit-ux-session-today`
   - Health: healthy.
   - Evidence: session-specific pointage loads without a login wall or empty-state mismatch.

5. Postpone/session edit redirect `/sessions/audit-ux-session-tomorrow/postpone`
   - Health: healthy.
   - Evidence: route redirects to `/sessions?week=2026-06-29&groupId=audit-ux-group&sessionId=audit-ux-session-tomorrow` and opens the planning edit modal for the selected session.

6. Offers `/offers`
   - Health: healthy.
   - Evidence: list-first mobile layout, `Ajouter une offre`, labelled `Désactiver`, and create form are visible without horizontal overflow.

7. Reprise/import `/settings/data-import`
   - Health: healthy.
   - Evidence: closed mode now exposes `Télécharger le modèle` before activation on mobile and desktop.

8. Formula creation `/subscription-plans/new`
   - Health: healthy.
   - Evidence: screen uses `Nouvelle formule`, `Retour aux formules`, `Nom de la formule`, and `Créer formule` wording instead of old `plan` copy.

## Metrics

| Viewport | Screens | Horizontal overflow | Login walls | Error pages |
| --- | ---: | ---: | ---: | ---: |
| Mobile `390x844` | 8 | 0 | 0 | 0 |
| Desktop `1440x900` | 8 | 0 | 0 | 0 |

## Text Scan

Focused capture text was scanned for the previous UI leaks and stale copy:

- `externalId`
- `firstName`
- `lastName`
- raw session states: `PLANNED`, `RESCHEDULED`, `COMPLETED`, `CANCELLED`
- `Créer plan`
- `Nom du plan`
- `Retour aux plans`
- `Salle Salle`
- `audit-ux-admin`
- `Code membre auto se calcule`

Result: no matches in `screenshots/remaining-proof-23794df/capture-results.json`.

## Evidence Limits

- This pass proves visual state, routing, responsive reflow, and absence of the scanned raw/internal copy in the captured routes.
- It does not prove full accessibility compliance, keyboard order, screen-reader output, or form error recovery.
- No mutating workflow was submitted during capture. Payment, import, finalization, offer deactivation, and session edit behavior still need functional scenario tests in a writable test tenant.

