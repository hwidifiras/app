# Electron route inventory

Baseline: deployed commit `3bd00f0`. Every page and API route file under `src/app` is listed below. This is an implementation checklist, not a claim that every workflow has passed desktop testing.

## Pages

Client entries reproduce the current focused-mode allowlist; ordinary permissions and module restrictions still apply. Public flows remain available as supporting web/authentication journeys. Maintenance reuses the existing private screens.

| Route | Desktop placement | Source |
| --- | --- | --- |
| `/accueil` | Public or authentication support | [page](../src/app/accueil/page.tsx) |
| `/attendance/groups` | Owner Maintenance | [page](../src/app/attendance/groups/page.tsx) |
| `/attendance` | Owner Maintenance | [page](../src/app/attendance/page.tsx) |
| `/attendance/sessions/[id]` | Owner Maintenance | [page](../src/app/attendance/sessions/[id]/page.tsx) |
| `/attendance/today` | Owner Maintenance | [page](../src/app/attendance/today/page.tsx) |
| `/coaches` | Client main navigation | [page](../src/app/coaches/page.tsx) |
| `/demo` | Public or authentication support | [page](../src/app/demo/page.tsx) |
| `/enrollment` | Client main navigation | [page](../src/app/enrollment/page.tsx) |
| `/find-workspace` | Public or authentication support | [page](../src/app/find-workspace/page.tsx) |
| `/forgot-password` | Public or authentication support | [page](../src/app/forgot-password/page.tsx) |
| `/groups/[id]/edit` | Client supporting flow | [page](../src/app/groups/[id]/edit/page.tsx) |
| `/groups/[id]/schedules` | Client supporting flow | [page](../src/app/groups/[id]/schedules/page.tsx) |
| `/groups/new` | Client supporting flow | [page](../src/app/groups/new/page.tsx) |
| `/groups` | Client main navigation | [page](../src/app/groups/page.tsx) |
| `/gym/check-in` | Owner Maintenance | [page](../src/app/gym/check-in/page.tsx) |
| `/gym/import` | Owner Maintenance | [page](../src/app/gym/import/page.tsx) |
| `/gym/visits` | Owner Maintenance | [page](../src/app/gym/visits/page.tsx) |
| `/homepage` | Public or authentication support | [page](../src/app/homepage/page.tsx) |
| `/login` | Public or authentication support | [page](../src/app/login/page.tsx) |
| `/logs/[id]` | Owner Maintenance | [page](../src/app/logs/[id]/page.tsx) |
| `/logs` | Owner Maintenance | [page](../src/app/logs/page.tsx) |
| `/members/[id]/add-to-group` | Client supporting flow | [page](../src/app/members/[id]/add-to-group/page.tsx) |
| `/members/[id]` | Client supporting flow | [page](../src/app/members/[id]/page.tsx) |
| `/members/new` | Client supporting flow | [page](../src/app/members/new/page.tsx) |
| `/members` | Client main navigation | [page](../src/app/members/page.tsx) |
| `/offers` | Owner Maintenance | [page](../src/app/offers/page.tsx) |
| `/onboarding` | Owner Maintenance | [page](../src/app/onboarding/page.tsx) |
| `/` | Owner Maintenance | [page](../src/app/page.tsx) |
| `/payments/[id]/edit` | Client supporting flow | [page](../src/app/payments/[id]/edit/page.tsx) |
| `/payments/new` | Client supporting flow | [page](../src/app/payments/new/page.tsx) |
| `/payments` | Client main navigation | [page](../src/app/payments/page.tsx) |
| `/plans` | Owner Maintenance | [page](../src/app/plans/page.tsx) |
| `/receipts/[id]` | Client supporting flow | [page](../src/app/receipts/[id]/page.tsx) |
| `/receipts/verify` | Public or authentication support | [page](../src/app/receipts/verify/page.tsx) |
| `/register` | Public or authentication support | [page](../src/app/register/page.tsx) |
| `/reset-password` | Public or authentication support | [page](../src/app/reset-password/page.tsx) |
| `/sessions/[id]/postpone` | Client supporting flow | [page](../src/app/sessions/[id]/postpone/page.tsx) |
| `/sessions` | Client main navigation | [page](../src/app/sessions/page.tsx) |
| `/settings/account` | Client main navigation | [page](../src/app/settings/account/page.tsx) |
| `/settings/club` | Owner Maintenance | [page](../src/app/settings/club/page.tsx) |
| `/settings/data-import` | Owner Maintenance | [page](../src/app/settings/data-import/page.tsx) |
| `/settings` | Owner Maintenance | [page](../src/app/settings/page.tsx) |
| `/settings/schedules` | Owner Maintenance | [page](../src/app/settings/schedules/page.tsx) |
| `/settings/users` | Client main navigation | [page](../src/app/settings/users/page.tsx) |
| `/signup` | Public or authentication support | [page](../src/app/signup/page.tsx) |
| `/signup/verify` | Public or authentication support | [page](../src/app/signup/verify/page.tsx) |
| `/sports` | Owner Maintenance | [page](../src/app/sports/page.tsx) |
| `/subscription-plans/[id]/edit` | Owner Maintenance | [page](../src/app/subscription-plans/[id]/edit/page.tsx) |
| `/subscription-plans/new` | Owner Maintenance | [page](../src/app/subscription-plans/new/page.tsx) |
| `/subscription-plans` | Owner Maintenance | [page](../src/app/subscription-plans/page.tsx) |
| `/subscription-status` | Client supporting flow | [page](../src/app/subscription-status/page.tsx) |
| `/subscriptions/[id]/edit` | Client supporting flow | [page](../src/app/subscriptions/[id]/edit/page.tsx) |
| `/subscriptions/new` | Client supporting flow | [page](../src/app/subscriptions/new/page.tsx) |
| `/subscriptions` | Client supporting flow | [page](../src/app/subscriptions/page.tsx) |

## API operations

Existing guard names are static source observations, not a complete authorization audit. Helper calls and per-method conditions require review. Public authentication and signup endpoints have their own validation. Maintenance policy must classify methods and actions, not deny every API associated with a hidden screen; client enrollment and planning rely on shared APIs.

| Route | Methods | Existing guard references |
| --- | --- | --- |
| [`/api/account`](../src/app/api/account/route.ts) | GET, PATCH | requireAuth |
| [`/api/attendances/recovery-candidates`](../src/app/api/attendances/recovery-candidates/route.ts) | GET | requirePermission |
| [`/api/attendances`](../src/app/api/attendances/route.ts) | GET, POST, PATCH, DELETE | requirePermission |
| [`/api/attendances/sessions/[id]/finalize`](../src/app/api/attendances/sessions/[id]/finalize/route.ts) | POST | requirePermission |
| [`/api/auth/demo`](../src/app/api/auth/demo/route.ts) | GET | Custom or public flow |
| [`/api/auth/forgot-password`](../src/app/api/auth/forgot-password/route.ts) | POST | Custom or public flow |
| [`/api/auth/handoff`](../src/app/api/auth/handoff/route.ts) | POST | Custom or public flow |
| [`/api/auth/login`](../src/app/api/auth/login/route.ts) | POST | Custom or public flow |
| [`/api/auth/logout`](../src/app/api/auth/logout/route.ts) | POST | Custom or public flow |
| [`/api/auth/me`](../src/app/api/auth/me/route.ts) | GET | Custom or public flow |
| [`/api/auth/register`](../src/app/api/auth/register/route.ts) | POST | Custom or public flow |
| [`/api/auth/reset-password`](../src/app/api/auth/reset-password/route.ts) | POST | Custom or public flow |
| [`/api/club-settings/logo`](../src/app/api/club-settings/logo/route.ts) | POST, DELETE | requirePermission |
| [`/api/club-settings`](../src/app/api/club-settings/route.ts) | GET, PATCH | requireAuth, requirePermission |
| [`/api/coaches`](../src/app/api/coaches/route.ts) | GET, POST, PATCH, DELETE | requirePermission |
| [`/api/data-import/bulk`](../src/app/api/data-import/bulk/route.ts) | POST | requirePermission |
| [`/api/data-import`](../src/app/api/data-import/route.ts) | GET, POST | requirePermission |
| [`/api/enrollment/apply`](../src/app/api/enrollment/apply/route.ts) | POST | requirePermission |
| [`/api/enrollment/context`](../src/app/api/enrollment/context/route.ts) | GET | requirePermission |
| [`/api/enrollment/quote`](../src/app/api/enrollment/quote/route.ts) | POST | requirePermission |
| [`/api/enrollment/revert`](../src/app/api/enrollment/revert/route.ts) | POST | requirePermission |
| [`/api/group-members/bulk`](../src/app/api/group-members/bulk/route.ts) | POST, DELETE | requirePermission |
| [`/api/group-members`](../src/app/api/group-members/route.ts) | GET, POST, PATCH, DELETE | requirePermission |
| [`/api/groups/[id]/schedules`](../src/app/api/groups/[id]/schedules/route.ts) | GET, POST, PATCH, DELETE | requirePermission |
| [`/api/groups`](../src/app/api/groups/route.ts) | GET, POST, PATCH, DELETE | requirePermission |
| [`/api/gym/check-in`](../src/app/api/gym/check-in/route.ts) | GET, POST | requirePermission, requireTenantModule |
| [`/api/gym/credentials`](../src/app/api/gym/credentials/route.ts) | GET, POST, DELETE | requirePermission, requireTenantModule |
| [`/api/gym/import`](../src/app/api/gym/import/route.ts) | POST | requirePermission, requireTenantModule |
| [`/api/gym/reports`](../src/app/api/gym/reports/route.ts) | GET | requirePermission, requireTenantModule |
| [`/api/gym/visits/export`](../src/app/api/gym/visits/export/route.ts) | GET | requirePermission, requireTenantModule |
| [`/api/gym/visits`](../src/app/api/gym/visits/route.ts) | GET, PATCH | requirePermission, requireTenantModule |
| [`/api/health`](../src/app/api/health/route.ts) | GET | Custom or public flow |
| [`/api/households`](../src/app/api/households/route.ts) | GET, POST, PATCH | requirePermission |
| [`/api/member-directory`](../src/app/api/member-directory/route.ts) | GET | requirePermission |
| [`/api/member-subscriptions/[id]/entitlements/[entitlementId]/adjust`](../src/app/api/member-subscriptions/[id]/entitlements/[entitlementId]/adjust/route.ts) | POST | requirePermission |
| [`/api/member-subscriptions/[id]/pause`](../src/app/api/member-subscriptions/[id]/pause/route.ts) | POST | requirePermission |
| [`/api/member-subscriptions/[id]/replace`](../src/app/api/member-subscriptions/[id]/replace/route.ts) | POST | requirePermission |
| [`/api/member-subscriptions/[id]/resume`](../src/app/api/member-subscriptions/[id]/resume/route.ts) | POST | requirePermission |
| [`/api/member-subscriptions`](../src/app/api/member-subscriptions/route.ts) | GET, POST, PATCH, DELETE | requireAnyPermission, requirePermission |
| [`/api/members/[id]/applicable-offers`](../src/app/api/members/[id]/applicable-offers/route.ts) | GET | requirePermission |
| [`/api/members/[id]/memberships`](../src/app/api/members/[id]/memberships/route.ts) | GET | requirePermission |
| [`/api/members/[id]`](../src/app/api/members/[id]/route.ts) | GET, DELETE, PATCH | isTechnicalAdmin, requireAdmin, requirePermission |
| [`/api/members`](../src/app/api/members/route.ts) | GET, POST, PATCH, DELETE | requirePermission |
| [`/api/navigation-badges`](../src/app/api/navigation-badges/route.ts) | GET | requireAuth |
| [`/api/notifications`](../src/app/api/notifications/route.ts) | GET, PATCH | requireAuth |
| [`/api/offers`](../src/app/api/offers/route.ts) | GET, POST, DELETE | requirePermission |
| [`/api/onboarding`](../src/app/api/onboarding/route.ts) | GET, PATCH | requireAdmin |
| [`/api/payments/reminders`](../src/app/api/payments/reminders/route.ts) | POST | requireAnyPermission |
| [`/api/payments`](../src/app/api/payments/route.ts) | GET, POST, PATCH, DELETE | requireAnyPermission, requirePermission |
| [`/api/ready`](../src/app/api/ready/route.ts) | GET | Custom or public flow |
| [`/api/receipts/[id]/send`](../src/app/api/receipts/[id]/send/route.ts) | POST | requireAnyPermission |
| [`/api/saas-signup/config`](../src/app/api/saas-signup/config/route.ts) | GET | Custom or public flow |
| [`/api/saas-signup/handoff`](../src/app/api/saas-signup/handoff/route.ts) | POST | Custom or public flow |
| [`/api/saas-signup/provision`](../src/app/api/saas-signup/provision/route.ts) | POST | Custom or public flow |
| [`/api/saas-signup/resend`](../src/app/api/saas-signup/resend/route.ts) | POST | Custom or public flow |
| [`/api/saas-signup/slug`](../src/app/api/saas-signup/slug/route.ts) | GET | Custom or public flow |
| [`/api/saas-signup/start`](../src/app/api/saas-signup/start/route.ts) | POST | Custom or public flow |
| [`/api/saas-signup/state`](../src/app/api/saas-signup/state/route.ts) | GET | Custom or public flow |
| [`/api/saas-signup/verify`](../src/app/api/saas-signup/verify/route.ts) | POST | Custom or public flow |
| [`/api/saas-signup/workspace`](../src/app/api/saas-signup/workspace/route.ts) | POST | Custom or public flow |
| [`/api/schedule-templates/[id]/apply`](../src/app/api/schedule-templates/[id]/apply/route.ts) | POST | requirePermission |
| [`/api/schedule-templates/[id]`](../src/app/api/schedule-templates/[id]/route.ts) | PATCH, DELETE | requirePermission |
| [`/api/schedule-templates`](../src/app/api/schedule-templates/route.ts) | GET, POST | requirePermission |
| [`/api/sessions/[id]/postpone`](../src/app/api/sessions/[id]/postpone/route.ts) | PATCH | requirePermission |
| [`/api/sessions/[id]`](../src/app/api/sessions/[id]/route.ts) | GET, PATCH, DELETE | requireAnyPermission, requirePermission |
| [`/api/sessions`](../src/app/api/sessions/route.ts) | GET, POST | requireAnyPermission, requirePermission |
| [`/api/setup-guide`](../src/app/api/setup-guide/route.ts) | GET | requireAuth |
| [`/api/sports`](../src/app/api/sports/route.ts) | GET, POST, PATCH, DELETE | requirePermission |
| [`/api/subscription-plans`](../src/app/api/subscription-plans/route.ts) | GET, POST, PATCH, DELETE | requirePermission |
| [`/api/users/[id]`](../src/app/api/users/[id]/route.ts) | PATCH | requireAdmin |
| [`/api/users/[id]/send-reset`](../src/app/api/users/[id]/send-reset/route.ts) | POST | requireAdmin |
| [`/api/users`](../src/app/api/users/route.ts) | GET, POST | requireAdmin |

## Shared areas reviewed

- Layout, navigation, focused-mode allowlist and account state.
- Authentication, user management, owner cleanup helper, tenant resolution and route permissions.
- Enrollment, subscription lifecycle, independent insurance coverage, finance ledger and recovery policies.
- Planning, attendance consumption, schedules and gym access/credential services.
- Receipt printing and delivery, imports/exports, camera scanner and browser storage.
- Prisma schema/migrations, Docker runtime, CI, Vitest setup and database reset safeguards.
- SaaS product modules, subscription gating, onboarding and public signup boundaries.
- Existing uncommitted Playwright session/workspace tests in the sibling checkout; they remain untouched and need deliberate integration.

The [implementation plan](electron-app-plan.md) maps these areas to parity scenarios, access changes and release milestones.
