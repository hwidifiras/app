# UI/UX Change Register - 2026-06-29

## Audit Target

- Target: SaaS staging through `127.0.0.1:3002` over SSH tunnel.
- Evidence folder: `docs/audits/full-product-audit-2026-06-29/screenshots/` (ignored by Git).
- Captures: 62 screenshots total.
- Viewports: desktop `1440x900`, mobile `390x844`.
- Data states: empty-state pass plus staging-only `audit-ux-*` operational dataset.

## Already Shipped Or Verified

- Dashboard is now reception-first: today sessions, quick actions, priorities, and money are visible in the first viewport.
- Private app shell follows the SaaS palette: light workspace, white surfaces, navy text, primary blue actions, green/amber/red status tones.
- Sidebar/mobile bottom nav labels are practical: Dashboard, Pointage, Inscrire, Encaisser/Caisse, Planning, Membres.
- Responsive layout passed automated horizontal-overflow checks on all captured core pages.
- Login page is visually aligned with the SaaS palette and responsive on mobile.
- Favicon and app icons are present and public.

## Fixes Applied In This Pass

- Removed receptionist-facing technical wording from offers copy.
- Reworded admin user creation helper text and reset-link action labels.
- Replaced degraded-state npm/Prisma instructions with staff-safe support copy.
- Replaced `Min 8 caractères` placeholders with clearer `8 caractères minimum`.

Commit: `6af348b fix: polish staff-facing ui copy`.

## Still Needs Product Work

- Payment mobile flow: amount input and payment method are below the first mobile fold, while the disabled submit button is visible first.
- Session detail can show inactive/archived assignment rows if stale assignment data exists; the UI should make inactive rows explicit or hide them by default.
- Dashboard setup guide competes visually with daily work on mobile when the club is not fully configured.
- Offers are better after copy cleanup, but the form still deserves a short practical example per offer type.
- Empty staging data hid payment/attendance realism until a scenario dataset was added; future audits should start with a maintained demo tenant.

## Out Of Scope For This Pass

- Public marketing homepage redesign.
- Database schema changes.
- Production cutover.
- SaaS billing/self-serve tenant onboarding.
- Full business-logic hardening beyond documenting audit findings.
