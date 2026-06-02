# Scenario audit — how the code behaves

This document maps **real reception scenarios** to **exact code paths**, **HTTP responses**, and **automated test coverage**.

Run tests: `npm test` (39 scenarios in `tests/dojo-scenarios.test.ts`).

Business rules reference: `docs/03-REGLES-METIER.md` (repo root).

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Covered by automated test |
| ⚠️ | Partially covered or manual QA only |
| ❌ | Not covered — rely on manual checks |
| `RM-xx` | Business rule ID from `03-REGLES-METIER.md` |

---

## 1. Catalog — sports, plans, coaches, groups

### Delete a discipline (sport)

| Step | Behavior | Code | Test |
|------|----------|------|------|
| Sport has linked groups, plans, or subscriptions | **409** + French message listing counts | `src/app/api/sports/route.ts` — pre-check queries, then `prisma.sport.delete` | ✅ `rejects deleting a linked sport and deletes an unused sport` |
| Sport unused | **200** + `{ data: { id } }` | Same route, delete after empty checks | ✅ same test |
| FK hit without pre-check | **409** fallback on Prisma `P2003` | catch block in DELETE handler | ⚠️ implicit |

### Delete a subscription plan (formule)

| Step | Behavior | Code | Test |
|------|----------|------|------|
| Plan has member subscriptions | **409** — *formule encore utilisée* | `src/app/api/subscription-plans/route.ts` — `memberSubscription.findMany` | ✅ `rejects deleting a linked subscription plan…` |
| Plan unused (0 souscriptions) | **200** | `prisma.subscriptionPlan.delete` | ✅ same test |
| Plan name duplicate on create | **409** | POST handler `P2002` | ❌ |

### Subscription plan fields

| Step | Behavior | Code | Test |
|------|----------|------|------|
| Plan must have a sport | Zod + DB FK | `src/lib/schemas/subscription-plan.ts`, schema `sportId` | ✅ `requires a discipline on every subscription plan` |
| `totalSessions` derived from `sessionsPerWeek × 4` | Transform on create/update | `src/lib/subscription-plan-utils.ts` | ✅ `derives monthly sessions from weekly frequency` |

---

## 2. Enrollment (Inscrire)

| Scenario | Behavior | Code | Test |
|----------|----------|------|------|
| Plan sport ≠ group sport | Quote blocked | `src/lib/membership-rules.ts` + enrollment quote API | ✅ `blocks plan/course sport mismatch` |
| Adult in kids group / kid in adults | Blocked | Quote validation by `groupType` | ✅ `blocks adult in kids group…` |
| Group at capacity | Blocked before apply | Capacity check in quote/apply | ✅ `blocks full course capacity…` |
| Schedule overlap (existing assignment) | Blocked | Schedule collision logic | ✅ `blocks schedule collisions against existing assignments` |
| Two lines same member overlap in one quote | Blocked | Same quote collision check | ✅ `blocks schedule collisions inside the same quote…` |
| New child without parent phone/name | Blocked | `enrollmentQuoteSchema` | ✅ `requires parent name and phone when enrolling a new child` |
| Schedules touch end-to-end (no gap) | Allowed | Minute-level slot comparison | ✅ `allows schedules that touch exactly…` |
| Family bundle — unrelated members | Blocked | Offer/household rules | ✅ `blocks family bundle for unrelated existing members` |
| Family bundle — household linked | Discount applied | `buildEnrollmentQuote` | ✅ `applies family bundle for linked household members` |
| Second discipline discount | Applied when another active sport exists | Offer engine | ✅ `applies second discipline discount…` |
| Inactive offer | Ignored | Offer filter `isActive` | ✅ `ignores inactive offers` |
| Fixed discount > line price | Capped at line price | Offer cap logic | ✅ `caps fixed discounts at the line price` |
| Percent offer `maxMembers` | Enforced | Offer engine | ✅ `respects maxMembers on percent offers` |

---

## 3. Subscriptions & payments

| Scenario | Behavior | Code | Test |
|----------|----------|------|------|
| Same discipline, second group | Reuses active subscription | `resolveActiveSubscription` / apply flow | ✅ `reuses an active subscription for another group in the same discipline` |
| Different discipline | New subscription allowed | Membership rules | ✅ `allows a second active subscription for another discipline` |
| Subscription past end date | Treated expired; not resolved as active | `expireStaleSubscriptions` | ✅ `expires stale subscriptions…` |
| Payment > remaining debt | **400** rejected | `src/app/api/payments/route.ts` | ✅ `rejects overpayment and accepts exact remaining payment` |
| Exact remaining payment | **201** | Same route | ✅ same test |
| Renew same discipline | Old sub expired, new one created server-side | `createSubscriptionFromPlan` in `subscription-service.ts` | ✅ `renews same-discipline subscriptions…` |
| Renew with carry-over | New sub gets `plan.totalSessions + old.remainingSessions` when flag set | Same service + POST body `carryOverRemainingSessions` | ✅ `carries over remaining sessions when renewing…` |
| Admin adjusts amount/sessions | **400** without `adjustmentReason`; **200** with reason (admin only) | `member-subscriptions/route.ts` PATCH | ✅ `requires adjustmentReason when admin changes…` |
| Partial payment + check-in | Allowed only if club setting on | `canCheckInWithPayment` + `clubSettings` | ✅ `allows partial-payment check-in only when club setting permits it` |
| Check-in without subscription | **403** by default (`allowCheckInWithoutSubscription: false`) | `attendances/route.ts` + club settings | ✅ override test (subscription required) |

---

## 4. Sessions & scheduling

| Scenario | Behavior | Code | Test |
|----------|----------|------|------|
| Coach double-booked (overlap) | Blocked | `src/lib/session-slot-conflict.ts` | ✅ `blocks coach overlap across groups but allows touching slots` |
| Same room double-booked | Blocked | Same module | ✅ `blocks room overlap across groups` |
| Sessions touching (end = start) | Allowed | Slot boundary logic | ✅ coach overlap test (touching allowed) |

---

## 5. Attendance (pointage) — `RM-01`, `RM-04`, `PO-01`–`PO-04`

| Scenario | Behavior | Code | Test |
|----------|----------|------|------|
| PRESENT | `remainingSessions -= 1` | `src/app/api/attendances/route.ts` POST | ✅ `decrements sessions for PRESENT and ABSENT…` |
| ABSENT | Decrements when `absentConsumesSession: true` (default) | Same route + `clubSettings` | ✅ same test |
| ABSENT + setting off | No session debit | Same route | ✅ `does not decrement sessions for ABSENT when absentConsumesSession is disabled` |
| Duplicate check-in same session | **409** unique `(sessionId, memberId)` | Prisma + route | ✅ same test |
| No remaining sessions | **400** blocked | Subscription check before create | ✅ `rejects normal check-in with no remaining sessions` |
| Weekly quota exceeded | **400** unless override | `countWeeklySlotUsage` in `attendance-rules.ts` | ✅ `enforces weekly attendance limit` |
| OVERRIDE without reason | **400** | Zod + route validation | ✅ `requires override reason and blocks the fourth override…` |
| 4th OVERRIDE in 30 days | **400** blocked | `countOverrides` in attendances route | ✅ same test |
| Recovery after ABSENT same week | OVERRIDE with `Récupération…` — no extra session debit | `validateRecoveryCheckIn` in `attendance-rules.ts` | ✅ `allows recovery check-in on another equivalent group after an absence` |

**Manual / partial:**

| Scenario | Status | Notes |
|----------|--------|-------|
| Archived member check-in | ⚠️ | Block expected via member status — verify in QA |
| Edit attendance after save | ⚠️ | PATCH route exists — no dedicated scenario test |
| Concurrent double check-in (two staff) | ⚠️ | DB unique constraint → 409; no concurrency test |

---

## 6. Auth, users, password reset

| Scenario | Behavior | Code | Test |
|----------|----------|------|------|
| Forgot password — unknown email | **200** `{ ok: true }` — **no email**, no audit | `forgot-password/route.ts` early return | ✅ `returns ok without sending when forgot-password email is unknown` |
| Forgot password — known user (dev) | Token created; `resetUrl` in JSON if email not configured | `createPasswordResetToken` + `sendPasswordResetEmail` | ✅ `creates a reset token, changes the password…` |
| Forgot password — production + Resend OK | Email sent; no `resetUrl` in response | `email.ts` + Resend API | ⚠️ manual / server test |
| Reset token reuse | **400** | `reset-password/route.ts` | ✅ password reset test |
| Staff limited permissions | Only selected keys stored | `users/route.ts` POST | ✅ `lets an admin create a limited staff account…` |
| Staff cannot edit club rules | **403** | `club-settings/route.ts` + proxy | ✅ `lets admin update club settings and blocks staff` |
| Strict reception default | Check-in without subscription **off** by default; partial payment **on** | `club-settings.ts` + migration | ✅ partial-payment test |
| Reception rules card | In-app summary on club settings page | `reception-rules-card.tsx` | ⚠️ manual QA (UI) |

**Production ops (your server issue):**

| Scenario | Behavior |
|----------|----------|
| Empty `User` table on fresh deploy | Forgot password returns OK but sends nothing — **run `npm run admin:create` in container** |
| Resend not configured | `emailConfigured: false`, audit `delivered: false` |
| Resend OK + user exists | Email sent; success not logged (only failures log to stdout) |

---

## 7. Admin & audit trail — `RM-08`

| Action | Logged as | Code |
|--------|-----------|------|
| Password reset requested | `PASSWORD_RESET_REQUESTED` | `forgot-password/route.ts` |
| Admin send reset | `PASSWORD_RESET_SENT_BY_ADMIN` | `users/[id]/send-reset/route.ts` |
| Password changed | `PASSWORD_RESET_COMPLETED` | `reset-password/route.ts` |
| Check-in / override | Attendance row + audit | `attendances/route.ts` |

View in app: **Paramètres → Journal actions** (`src/lib/audit-log-presenter.ts` for labels).

---

## 8. Gaps — manual QA before client handoff

From `docs/first-client-handoff.md` §5 and `docs/REALWORLD-SCENARIO-AUDIT.md`:

| Area | Priority | Why |
|------|----------|-----|
| Mobile Safari check-in drawer | High | Layout / safe area |
| Logo upload | Medium | Club settings |
| Payment edit/delete debt recalc | Medium | No automated test |
| Session postpone flow | Medium | UI + API exist, limited tests |
| Member archive → assignments | Medium | `RM-12` |
| Dashboard debt list threshold | Low | Club setting driven |

---

## 9. How to add a new scenario test

1. Add fixture data in `dojoFixture()` or inline in the test.
2. Call the route handler directly (same pattern as existing tests).
3. Assert HTTP status + DB state.
4. Document the scenario in this file (table row + ✅).

Example pattern:

```ts
await signIn();
const fx = await dojoFixture();
const res = await someHandler(jsonRequest("POST", { ... }));
expect(res.status).toBe(409);
```

---

## 10. Quick command reference

| Command | Purpose |
|---------|---------|
| `npm test` | Run all scenario tests |
| `npm run handoff:check` | Tests + production build |
| `docker compose exec dojo-app npm run admin:create` | First admin on server |
| `docker compose logs dojo-app \| grep -i resend` | Email failures only (success is silent) |
