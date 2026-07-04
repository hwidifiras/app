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

## Follow-Up Fixes Applied After This Pass

- Payment creation on mobile now avoids showing a large disabled primary payment button before an amount is entered: `74b9b86`.
- Attendance session detail now separates active expected members from inactive history rows and marks old rows as `Hors liste active`: `ca26d4a`.
- Setup guide visibility is now admin-only, and role parsing uses the current `/api/account` shape: `e2a8a4d`.
- The reprise/import workbook now uses client-facing French columns, removes the confusing code column, and lets the app auto-generate member codes: `0e5e07c`.
- Offers creation has practical examples and a live preview in `src/components/offers/offers-manager.tsx`.

## Still Needs Product Work

- Fresh screenshot proof for the follow-up fixes above, especially payment creation, staff dashboard, offers creation, attendance session detail, and reprise/import.
- A valid tenant-scoped session dataset for attendance detail and postpone screens; the July 1 sweep could not accept those routes.
- Maintained demo tenant data for payment/attendance realism before future sales demos or audits.
- Accessibility verification beyond screenshots: keyboard order, visible focus, screen-reader labels, and form error recovery.

## Out Of Scope For This Pass

- Public marketing homepage redesign.
- Database schema changes.
- Production cutover.
- SaaS billing/self-serve tenant onboarding.
- Full business-logic hardening beyond documenting audit findings.
