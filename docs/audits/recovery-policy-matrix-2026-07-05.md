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
| Catalog drafts | Delete only if unused and no business history exists | No | No |

## Implementation Notes

- The typed source of this policy is `src/lib/recovery-policy.ts`.
- Receipt foundation is implemented first because it protects money trust.
- Enrollment undo still needs a full product pass: the API should stop physically deleting saved business rows and move to an official void flow.
- Catalog `DELETE` routes remain a follow-up: sports, coaches, and formulas should become deactivate/archive in the sellable SaaS version.

