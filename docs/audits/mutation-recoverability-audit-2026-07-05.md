# Mutation Recoverability Audit - 2026-07-05

## Purpose

This audit answers one product-risk question: if a staff member makes a mistake, can the app recover without destroying business history?

The target behavior is not "everything can be freely edited." The target is safer:

- harmless profile/config details can be edited;
- money is corrected through ledger entries;
- official documents are voided, not rewritten;
- enrollment/import mistakes can be reversed only while safe;
- schedules/assignments close with dates;
- business records archive/deactivate instead of disappearing;
- every important mutation leaves an actor-linked audit trail.

## Recovery Vocabulary

The codebase already has `src/lib/recovery-policy.ts` with this shared vocabulary:

| Behavior | Meaning |
| --- | --- |
| `edit` | Normal correction of safe details. |
| `correct` | Creates a correction entry with before/after detail and reason. |
| `reverse` | Adds a reversal row, preserving the original action. |
| `void` | Invalidates an official action/document without deleting it. |
| `archive` | Removes from active work while preserving the row. |
| `close` | Ends a schedule/assignment with an end date. |
| `draft-delete` | Physical delete allowed only for generated/draft data with no later business activity. |

## Mutation Matrix

| Area | Route / Surface | Current Behavior | Recoverability Verdict |
| --- | --- | --- | --- |
| Payments | `POST /api/payments` | Creates `Payment` ledger row, issues receipt, writes `PAYMENT_CREATED` and `RECEIPT_ISSUED`. | Good. |
| Payment correction | `PATCH /api/payments` | Admin-only correction row with `correctionReason`, original payment preserved, original receipt voided. | Good. |
| Payment cancellation | `DELETE /api/payments` | Admin-only reversal row with reason, original preserved, original receipt voided. | Good. |
| Enrollment | `POST /api/enrollment/apply` | Creates member/subscription/assignment/payment with audit logs and recovery snapshot. | Good, but UI should keep the recovery path visible. |
| Enrollment recovery | `POST /api/enrollment/revert` + `src/lib/enrollment-undo.ts` | Reverses created payments, voids receipts, cancels subscription, closes assignment, archives new member. | Good. |
| Members | `DELETE /api/members` and `DELETE /api/members/[id]` | Archives member with audit instead of hard deleting. | Good. |
| Subscriptions | `DELETE /api/member-subscriptions` | Cancels subscription in transaction with audit. | Good. |
| Group assignment | `DELETE /api/group-members` | Sets `status=INACTIVE` and `endDate=now`, writes audit. | Good. |
| Bulk assignment removal | `DELETE /api/group-members/bulk` | Closes selected assignments with audit. | Good. |
| Groups | `DELETE /api/groups` | Sets `isActive=false`, writes `GROUP_DEACTIVATED`. | Good. |
| Group schedules | `DELETE /api/groups/[id]/schedules` | Sets `effectiveTo`, writes `GROUP_SCHEDULE_CLOSED`. | Good. |
| Schedule templates | `DELETE /api/schedule-templates/[id]` | Sets `isActive=false`, writes audit. | Good. |
| Sessions | `DELETE /api/sessions/[id]` | Cancels session only if not completed and no attendances block edit, writes audit. | Good. |
| Attendance creation/update | `POST/PATCH /api/attendances` | Uses attendance/session policies and writes audit. | Good, but finalization correction UX still needs review. |
| Attendance delete | `DELETE /api/attendances` | Physically deletes the attendance row after session-state checks, restores session balance, writes audit. | Medium: behavior is safeguarded, but "delete" removes the pointage row. Consider future correction/void row if pointage history must be fully append-only. |
| Data import apply | `POST /api/data-import` and `/api/data-import/bulk` | Applies import with audit details and rollback metadata. | Good for migration mode. |
| Data import rollback | `rollbackDataImport()` | Physically deletes imported member/subscription/assignment/payment/attendance only if no new activity exists, then writes rollback audit. | Acceptable `draft-delete`, because rollback is blocked after real activity. |
| Disciplines/coaches/formulas/offers | catalog routes | Delete paths deactivate/archive and write audit. | Good. |
| Club/settings/users | settings routes | Updates write audit logs. | Good, but settings pages need clearer preview/risk copy for business-changing settings. |

## P0 Follow-Up Checks

1. Attendance delete should be reviewed as a product decision:
   - Current behavior is guarded and audited.
   - If the client wants perfect pointage history, change delete into `ATTENDANCE_VOIDED` or `ATTENDANCE_CORRECTED` with a preserved row.

2. Session edits with existing business activity should stay conservative:
   - Current cancellation checks attendances.
   - Keep requiring reason and before/after audit for edits affecting time, coach, room, or group.

3. Enrollment recovery must be visible in UI:
   - The code supports traceable recovery.
   - Staff still needs a plain-language action from member/subscription/payment context.

4. Data import rollback should keep the safe boundary obvious:
   - Rollback is safe only before new activity.
   - UI should show why rollback is unavailable when blocked.

5. Offers after use need a historical-meaning check:
   - If an offer was used, editing its value can change the meaning of old enrollments.
   - Prefer version/deactivate/new offer for used offers.

## Immediate Code Direction

- Keep `src/lib/recovery-policy.ts` as the product vocabulary.
- Expand it with all real audit actions currently emitted by the app.
- Use it in audit-log presentation and risky-action copy so staff sees `Correction`, `Annulation tracable`, `Archive`, or `Fermeture` instead of technical delete/update language.
- For attendance delete, decide whether the next pass should preserve rows instead of deleting them physically.
