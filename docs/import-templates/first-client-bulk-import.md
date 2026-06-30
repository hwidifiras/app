# First Client Bulk Import - Excel Format

## Where To Use It

App path: `/settings/data-import`

Workflow:

1. Admin opens `Reprise`.
2. Clicks `Activer pour 4 heures`.
3. Downloads `we-discipline-reprise-membres.xlsx`.
4. Fills the `Membres` sheet.
5. Uploads the file.
6. Clicks `Vérifier Excel`.
7. Applies import only when every row is valid.

The import stays behind the temporary reprise mode and creates rollbackable `DATA_IMPORT_APPLIED` audit logs.

## Colonnes Du Modele

Fill one row per active member to resume. The downloadable template uses French headers, and old English headers remain accepted for compatibility.

The member code is generated automatically. The client does not need to fill an `externalId` or reference column. If an old file still contains `reference`, `ref`, `code`, `matricule`, or `externalId`, the importer will continue to accept it.

Required or commonly filled:

- `Prenom`
- `nom`
- `Type membre`: `ADULT`, `KID`, or `NOT_SPECIFIED`.
- `Telephone`: required for adults.
- `Telephone parent`: required for kids.
- `Date inscription`: date member joined the club, `YYYY-MM-DD`.
- `Groupe`: must match a current group name.
- `Formule`: must match a current formula name.
- `Debut abonnement`
- `Fin abonnement`
- `Montant total`: full subscription amount in normal currency units, for example `40`.
- `Deja paye`: amount already paid, for example `20`.
- `Seances restantes`: current remaining session balance.

Optional:

- `Email`
- `Date naissance`
- `Adresse`
- `Nom parent`
- `Debut groupe`: defaults to subscription start.
- `Date paiement`: defaults to cutover date when `Deja paye > 0`.
- `Mode paiement`: `REPRISE_EXCEL`, `CASH`, `CARD`, `TRANSFER`, or `CHECK`.
- `Note reprise`

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
