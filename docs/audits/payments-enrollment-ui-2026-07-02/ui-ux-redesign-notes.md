# Payments And Enrollment UI/UX Notes

Date: 2026-07-02

## Evidence

- `01-payments-new-desktop.png`: `/payments/new`, 1440x900
- `02-payments-new-mobile.png`: `/payments/new`, 390x844
- `03-enrollment-desktop.png`: `/enrollment`, 1440x900
- `04-enrollment-mobile.png`: `/enrollment`, 390x844

All captured screens show no horizontal overflow.

## Scope

Review the live payment and enrollment pages from a receptionist/admin handover perspective, then implement the agreed first UX pass without changing routes, APIs, schema, or business rules.

## Implemented In This Pass

- `/payments/new`: renamed the flow around `Dette`, `Montant reçu`, `Mode`, and `Confirmer`; added a stronger live cash summary; added quick amount actions for full balance, half balance, and clearing the amount; made the confirmation panel more receipt-like.
- `/enrollment`: kept the existing three-step quote/apply flow, added a desktop side summary and mobile checklist, clarified step copy, and made the quote/payment section easier to scan.
- Verification passed: `npm.cmd run lint`, `npm.cmd run build`, and `npx.cmd prisma validate`.
- Verification blocked: `npm.cmd test` and local browser QA need local PostgreSQL on `localhost:5432`; the test reset failed before Vitest started.

## Payments: Current Strengths

- The page is already structured around a real cashier task: member, subscription, amount, payment method, recap.
- TND is visible and consistent.
- The right-side recap creates trust before submitting.
- Mobile layout is readable and does not overflow.
- Sticky bottom action bar is useful for a long operational form.

## Payments: UX Risks

- The page still feels like a full accounting form instead of a fast cash desk flow.
- On desktop, the step tabs take a full band but do not clearly show completion/progress.
- The live balance summary is useful, but it competes with the input form instead of becoming the main action surface.
- On mobile, the first viewport shows both "Dossier" and the beginning of "Montant"; the user may scroll before understanding the exact next action.
- Disabled submit state is visually present, but the reason is only implicit.

## Payments: Recommended Better Flow

1. Header: `Encaisser`
   - Short copy: `Sélectionnez une dette, saisissez le montant, confirmez le reçu.`
   - Primary context pill: `Reste à encaisser: 15,00 TND`.

2. Step 1: `Dette`
   - One compact block: member selector + subscription selector.
   - Immediately below: three strong figures only: `Prix`, `Déjà payé`, `Reste`.
   - Remove or hide `Séances` unless it matters for the selected subscription.

3. Step 2: `Montant reçu`
   - Make this the visual center.
   - Amount field first, full width.
   - Quick buttons: `Solder 15,00 TND`, `Moitié`, `Autre`.
   - Inline computed result: `Solde après paiement: 0,00 TND`.

4. Step 3: `Mode`
   - Payment method as compact icon cards.
   - Date as a secondary row, default today.
   - Note/motif collapsed under `Ajouter une note`.

5. Step 4: `Confirmer`
   - Receipt-style recap:
     - Member
     - Abonnement
     - Montant reçu
     - Solde après
     - Mode
   - Final CTA: `Encaisser 15,00 TND`.

## Payments: UI Direction

- Desktop: keep two columns, but make right recap sticky and more receipt-like.
- Mobile: make one cashier card per step, with a sticky CTA that says exactly what is missing, for example `Saisir un montant`.
- Keep the status colors: blue for action, green for paid/healthy, red only for remaining debt or error.

## Enrollment: Current Strengths

- The user understands the broad sequence: students, offer, quote.
- The reminder explains a confusing business rule.
- The form is clean and matches the SaaS palette.
- Mobile stacking is readable and no horizontal overflow appears.

## Enrollment: UX Risks

- Desktop has too much empty width; the form feels stretched instead of guided.
- The first step asks for several decisions without a live outcome preview.
- The stepper is visually large but not very informative.
- The reminder card takes important first-viewport space even when the user already knows the rule.
- On mobile, the primary next action is below the fold and disabled, while the user has not yet been shown a compact "what is missing" checklist.

## Enrollment: Recommended Better Flow

1. Header: `Inscrire`
   - Short copy: `Ajoutez l'élève, choisissez le cours, vérifiez le devis.`
   - Replace large reminder with a compact info row: `Le paiement règle la formule, il n'ajoute pas de séances.`

2. Step 1: `Élève`
   - First decision: `Existant` / `Nouveau`.
   - If existing: member selector only.
   - If new: name + phone + optional parent info.

3. Step 2: `Cours`
   - Group selector with richer option cards:
     - discipline
     - age group
     - coach
     - schedule
     - seats available
   - Formula selector filtered after group selection.

4. Step 3: `Offre`
   - Default: `Aucune offre`.
   - Presets: family, second discipline, launch promo, manual discount.
   - Preview discount before continuing.

5. Step 4: `Devis`
   - Right-side desktop summary / mobile summary card:
     - catalogue price
     - offer discount
     - amount to pay now
     - remaining balance
     - sessions included
   - Primary CTA: `Créer et encaisser` when payment is expected, otherwise `Créer l'inscription`.

## Enrollment: UI Direction

- Desktop: move from one huge full-width form to a 2-column command view:
  - left: active step inputs
  - right: live `Devis` / `Prêt à inscrire` summary
- Mobile: show one step at a time with a compact missing-fields checklist.
- Keep `Ajouter un élève`, but make multi-student enrollment a secondary expandable section rather than first-class complexity.

## Accessibility Risks Visible From Screenshots

- Some light gray helper text may be low contrast on mobile.
- Disabled buttons need explicit text explaining what is missing.
- Segmented steppers should expose current step and completed state semantically.
- Mobile bottom nav and sticky action bars need spacing checks so they do not cover the final controls.

## Evidence Limits

- Screenshots cannot prove keyboard navigation, screen-reader labels, focus order, dropdown behavior, or validation behavior.
- No destructive form submission was performed.
- Dropdown contents and error states were not fully audited in this pass.
