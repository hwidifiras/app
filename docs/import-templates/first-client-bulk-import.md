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

Required or commonly filled:

- `Code membre (auto)`: optional. Leave it empty and the app generates one like `M001-prenomnom-1234` from the row number, member name, and the last 4 digits of the phone. Old headers such as `reference`, `ref`, `code`, `matricule`, and `externalId` still work.
- `prenom`
- `nom`
- `typeMembre`: `ADULT`, `KID`, or `NOT_SPECIFIED`.
- `telephone`: required for adults.
- `telephoneParent`: required for kids.
- `dateInscription`: date member joined the club, `YYYY-MM-DD`.
- `groupe`: must match a current group name.
- `formule`: must match a current formula name.
- `debutAbonnement`
- `finAbonnement`
- `montant`: full subscription amount in normal currency units, for example `40`.
- `paye`: amount already paid, for example `20`.
- `seancesRestantes`: current remaining session balance.

Optional:

- `email`
- `dateNaissance`
- `adresse`
- `nomParent`
- `debutGroupe`: defaults to subscription start.
- `datePaiement`: defaults to cutover date when `paye > 0`.
- `modePaiement`: `REPRISE_EXCEL`, `CASH`, `CARD`, `TRANSFER`, or `CHECK`.
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
