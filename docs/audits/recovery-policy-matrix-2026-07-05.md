# Recovery Policy Matrix - 2026-07-05

## Rule

Human mistakes must be recoverable. Business history must remain traceable.

Use these words consistently:

| Word | Meaning |
| --- | --- |
| Edit | Normal field update where the current value is the source of truth. |
| Correct | Add a traced correction with before/after and a reason. |
| Reverse | Add a negative ledger row that cancels a money movement. |
| Void | Mark an official document/action invalid without deleting it. |
| Archive | Hide from active operations while preserving history. |
| Close | End an assignment or schedule with an end date. |
| Draft delete | Physical delete only for unused drafts/configuration with no business history. |

## Matrix

| Area | Current target | Required reason | History preserved |
| --- | --- | --- | --- |
| Payments | Reverse or correct through ledger rows | Yes | Yes |
| Receipts | Void when payment is corrected/reversed | Yes | Yes |
| Enrollment | Void saved enrollment, reverse payments, cancel subscriptions, close assignments | Yes | Yes |
| Members | Archive instead of delete | No by default | Yes |
| Group assignments | Close with `endDate` | No by default | Yes |
| Attendance | Correct with reason after finalization/lock | Yes | Yes |
| Catalog records | Deactivate/archive once they can have business history | No by default | Yes |
| Draft/import rollback rows | Physical delete only while no later business activity exists | No | No |

## Implementation Notes

- The typed source of this policy is `src/lib/recovery-policy.ts`.
- Receipt foundation is implemented first because it protects money trust.
- Enrollment recovery now uses an official void-style flow: created payments are reversed, receipts are voided, subscriptions are cancelled, assignments are closed, and newly created members are archived.
- Catalog `DELETE` routes for sellable records should continue to mean deactivate/archive, not physical deletion. Physical deletion remains acceptable only for unused drafts or rollback rows that have no later business activity.
- Attendance cancellation is the remaining medium-good area: the current row is physically removed after guards and audit snapshot, but a future append-only attendance schema would make this excellent.
