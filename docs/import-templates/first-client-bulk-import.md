# First Client Bulk Import - Excel Format

## Where To Use It

App path: `/settings/data-import`

Workflow:

1. Admin opens `Reprise`.
2. Clicks `Activer pour 4 heures`.
3. Downloads `we-discipline-first-client-bulk-import.xlsx`.
4. Fills the `Membres` sheet.
5. Uploads the file.
6. Clicks `Verifier Excel`.
7. Applies import only when every row is valid.

The import stays behind the temporary reprise mode and creates rollbackable `DATA_IMPORT_APPLIED` audit logs.

## Required Columns

Fill one row per active member to resume.

- `externalId`: stable line id from the client sheet, for example `M001`.
- `firstName`
- `lastName`
- `memberType`: `ADULT`, `KID`, or `NOT_SPECIFIED`.
- `phone`: required for adults.
- `parentPhone`: required for kids.
- `joinedAt`: date member joined the club, `YYYY-MM-DD`.
- `groupName`: must match a current group name.
- `planName`: must match a current formula name.
- `subscriptionStartDate`
- `subscriptionEndDate`
- `amount`: full subscription amount in normal currency units, for example `40`.
- `paid`: amount already paid, for example `20`.
- `remainingSessions`: current remaining session balance.

Optional:

- `email`
- `birthDate`
- `address`
- `parentName`
- `assignmentStartDate`: defaults to subscription start.
- `paymentDate`: defaults to cutover date when `paid > 0`.
- `paymentMethod`: `REPRISE_EXCEL`, `CASH`, `CARD`, `TRANSFER`, or `CHECK`.
- `note`

## Current First-Client References

Current groups:

- `Airobic`
- `bac sport`
- `Self Def Adulte`
- `Self Def Kids`
- `Total combat`
- `Gym Adulte`
- `Groupe Gym kids`
- `kick boxing`
- `sport kids`

Current formula:

- `plan airobic` for discipline `Airobic`

Before importing members for other disciplines, create formulas for those disciplines first.

## Safety Rules

- The preview stage writes nothing to the database.
- Apply is blocked when any row has errors.
- Duplicate phone numbers in the same file are blocked.
- Existing members with the same resolved phone are blocked.
- Group/formula discipline mismatch is blocked.
- Paid amount above amount due is blocked.
- Remaining sessions above the formula quota is blocked.

