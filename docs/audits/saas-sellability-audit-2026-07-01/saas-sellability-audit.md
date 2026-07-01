# SaaS Sellability UI/UX And Workflow Audit

Date: 2026-07-01  
Target: `https://we-discipline.com` live SaaS staging app  
Temporary data: `audit-ux-*`, created for this audit and cleaned after capture  
Evidence: `screenshots/`, `capture-results.json`, desktop/mobile contact sheets

## Verdict

The product is sellable for a first manually onboarded dojo or martial arts club after a short polish pass. It clearly solves real reception problems: pointage, unpaid members, subscriptions, payments, planning, enrollment, import, users, and audit logs.

It is not yet ready as a frictionless self-serve SaaS. The blocker is not missing features; it is trust and simplicity. Several screens still feel like admin database tools, and the currency/wording inconsistencies would weaken a sales demo in Tunisia.

## Evidence Captured

- 32 fresh screenshots: 16 desktop at `1440x900`, 16 mobile at `390x844`.
- Browser metrics reported no page-level horizontal overflow on the captured routes.
- Workflow smoke scripts passed:
  - Functional workflows: 23/23 passed.
  - Enrollment smoke: 8/8 passed.
- Temporary audit records were cleaned: members `0`, sessions `0`, attendances `0`, payments `0`, offers `0`, users `0`.

## Strong Points

1. Daily reception flow is now much clearer.
   - Dashboard puts sessions, priorities, caisse, graph, and movements in a usable order.
   - Pointage has direct `Présent`, `Absent`, and `Finaliser` actions.

2. Business logic is much stronger than the UI suggests.
   - Overpayment is rejected.
   - Payment corrections and reversals create ledger rows and require reasons.
   - Unpaid normal attendance is blocked.
   - Partial paid attendance is controlled by club setting.
   - Finalized attendance cannot be edited without reopening.
   - Enrollment can apply and revert safely.

3. Mobile responsiveness is mostly healthy.
   - Captured routes did not show page-level horizontal overflow.
   - Mobile cards for payments, subscriptions, planning, and pointage are usable.

4. The app has real SaaS foundations.
   - Tenant-aware auth and Prisma tenant scoping exist.
   - Admin-only areas are separated.
   - Import mode is temporary and guarded.

## Red Flags Before Selling

### 1. Currency inconsistency is the biggest trust issue

Dashboard and subscription surfaces show `TND`, but many forms still show `€` or hardcoded `EUR`.

Observed evidence:
- Payment mobile screenshot: `Reste à encaisser 20,00 €`, `Montant encaissé (€)`.
- Pointage mobile screenshot: `Solde 20.00 €`.
- Subscription plans mobile screenshot: `Prix 40,00 €`.

Code evidence includes:
- `src/components/payments/payment-add-form.tsx`
- `src/components/payments/payment-edit-form.tsx`
- `src/components/enrollment/enrollment-wizard.tsx`
- `src/components/attendance/check-in-drawer.tsx`
- `src/components/offers/offers-manager.tsx`
- `src/components/settings/data-import-wizard.tsx`
- `src/app/payments/page.tsx`
- `src/lib/email-templates.ts`

Also, `Intl.NumberFormat` with `TND` currently displays values like `40,000 TND`. That is correct for 3-decimal TND formatting, but may confuse clients if they think the price is forty thousand. For this app, use a deliberate club money formatter such as `40 TND` or `40,00 TND`.

Severity: High.  
Fix size: Small to medium.  
Recommendation: centralize currency display and input suffixes behind one helper/config, then replace all hardcoded `€`/`EUR`.

### 2. Pointage logic is safe, but the UX explanation is still thin

The rules work:
- unpaid normal pointage returns `SUBSCRIPTION_UNPAID`;
- override requires a reason;
- partially paid members can pass because the setting allows it.

But the user experience still asks staff to infer too much:
- `Accès restreint` does not explain why or what to do next.
- `Passage exceptionnel` is conceptually correct but still needs a simple staff-facing sentence.
- `Tous présents (1)` can be read as all members are present, while it actually targets remaining/unmarked members.

Severity: High for handoff/training.  
Fix size: Small.  
Recommendation: add a compact policy banner in the drawer: `Non payé: passage normal bloqué. Autorisation exceptionnelle possible avec motif.` Rename `Tous présents (1)` to `Pointer les restants présents`.

### 3. Several pages still feel like database administration

The app is cleaner than before, but these pages still read as operational tables rather than guided workflows:
- `Abonnements`
- `Paiements`
- `Cours`
- `Formules`
- `Utilisateurs`
- `Journal actions`

This is fine for an admin, but not ideal for a receptionist or club owner evaluating a SaaS demo. The product should sell the outcome first: who owes money, who must be pointed, what changed today, what needs renewal.

Severity: Medium.  
Fix size: Medium.  
Recommendation: keep tables, but add task-first views above them: `À encaisser`, `À renouveler`, `À finaliser`, `Cours cette semaine`, `Dernières actions sensibles`.

### 4. Offers are powerful but too open for normal clubs

The Offers page exposes rule creation immediately. On mobile, there is an `Ajouter une offre` button and the create form is already open, which makes the page feel complex.

Severity: Medium.  
Fix size: Small to medium.  
Recommendation: hide the create form by default and offer templates:
- `Réduction famille`
- `Deuxième discipline`
- `Promotion lancement`
- `Remise manuelle`

### 5. Subscription tables still have desktop horizontal scroll

The page-level layout does not overflow, but the subscription table has an internal horizontal scrollbar on desktop. That makes a core business page feel less polished.

Severity: Medium.  
Fix size: Small.  
Recommendation: show fewer columns by default and move secondary fields into an `Infos` expander. Keep money, payment status, end date, remaining sessions, and actions visible.

### 6. Admin logs can confuse non-technical clients

`Journal actions` is useful, but it is raw. It can show system/internal-looking events from operational work. For sales and handoff, clients need a friendly audit log, not an implementation trace.

Severity: Medium.  
Fix size: Small.  
Recommendation: add default filters: `Paiements`, `Présences`, `Inscriptions`, `Paramètres`. Hide or visually separate `Système` entries unless the admin opens advanced filters.

### 7. Local release testing is not frictionless

`npm run lint` and `npm run build` pass, but `npm test` is blocked locally when PostgreSQL test DB is unavailable. That is not a user-facing SaaS blocker, but it is a release discipline blocker.

Severity: Medium.  
Fix size: Small.  
Recommendation: add a one-command local test DB path or CI check so release confidence does not depend on the developer machine.

## Page Health

| Page | Health | Notes |
| --- | --- | --- |
| Dashboard | Good | Clearer after reorg. Fix money decimals and `0 mouvementaujourd'hui` spacing. |
| Pointage | Good logic, medium UX | Strong actions. Needs clearer unpaid/exception explanation and TND labels. |
| Session detail | Good | Useful summary and history. Could be denser on desktop. |
| Enrollment | Good | Wizard structure is right. Keep simplifying copy and make quote/payment consequences more explicit. |
| Payment new | Medium | Flow is logical, but mobile is long and still shows euros. |
| Members | Good | Search/filter/open flow is easy. Good SaaS confidence screen. |
| Member detail | Medium | Useful but long. Needs stronger “next action” hierarchy. |
| Subscriptions | Medium | Core business value is here, but table/card hierarchy should be more debt-first. |
| Payments | Good | Ledger direction is strong. Needs clearer correction/reversal language for non-accountants. |
| Planning | Good | Card actions are practical. Next step should be a more visual weekly timetable. |
| Cours/groups | Medium | Works, but reads as admin configuration more than dojo schedule management. |
| Formules | Medium | Important page, but hardcoded euros and delete wording hurt trust. |
| Offers | Medium-low | Useful feature, but too complex upfront. Needs templates and collapsed create mode. |
| Data import | Good admin tool | Safe temporary mode. Rename/explain `Reprise` for non-technical users. |
| Users | Medium | Functional admin page. Keep hidden from non-admins and simplify permission copy. |
| Logs | Medium | Valuable, but too noisy for ordinary client review. |

## SaaS Readiness

Ready for:
- First paid client with manual onboarding.
- Dojo/martial arts club demos where you control the setup.
- Reception/admin workflows after short training.

Not ready for:
- Self-serve SaaS signup.
- Unassisted trial users.
- Multi-club rollout without a stronger onboarding and configuration checklist.

The product is a problem solver, but it must present itself less like a management database and more like a daily club cockpit.

## Recommended Path

### Before the next serious sales demo

1. Fix all currency labels and formatters to TND.
2. Decide display format: likely `40 TND` or `40,00 TND`, not `40,000 TND`.
3. Fix pointage policy copy: unpaid, partial paid, exceptional override.
4. Rename `Tous présents (1)` to `Pointer les restants présents`.
5. Collapse Offers create form by default.
6. Remove internal desktop table scroll from Subscriptions.
7. Filter admin logs by human action category.

### Next polish pass

1. Add debt-first subscriptions view.
2. Add renewal-first view for expiring subscriptions.
3. Add a real weekly timetable view for Planning.
4. Add offer templates.
5. Add a first-client setup checklist: club info, sports, coaches, groups, formulas, users, import.

### Later SaaS pass

1. Self-serve tenant onboarding.
2. Tenant plan/billing.
3. Guided first-run sample data.
4. Per-tenant currency/settings.
5. CI-backed migration/test pipeline.

## Final Call

No major redesign is required. The product is close enough to sell manually if the sales demo is controlled and the currency/policy copy is fixed first.

The high-leverage move is not adding more features. It is reducing doubt: money labels must be right, pointage rules must explain themselves, and configuration pages must stay out of the receptionist's way until needed.
