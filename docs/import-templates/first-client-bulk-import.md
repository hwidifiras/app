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

La première colonne du modèle est `Code membre auto (laisser vide)`. Le client n'a rien à inventer: l'application génère un code sûr au moment de `Vérifier Excel`, avec le format `M001-prenomnom-9999` selon l'ordre réel des lignes non vides, le nom et le téléphone. Si un ancien fichier contient encore `reference`, `ref`, `code`, `matricule` ou `externalId`, l'import reste compatible.

Required or commonly filled:

- `Code membre auto (laisser vide)`: optional; generated automatically by the app.
- `Prénom`
- `Nom`
- `Type membre`: `ADULT`, `KID`, or `NOT_SPECIFIED`.
- `Téléphone`: required for adults.
- `Téléphone parent`: required for kids.
- `Date inscription`: date member joined the club, `YYYY-MM-DD`.
- `Groupe`: must match a current group name.
- `Formule`: must match a current formula name.
- `Début abonnement`
- `Fin abonnement`
- `Montant total`: full subscription amount in normal currency units, for example `40`.
- `Déjà payé`: amount already paid, for example `20`.
- `Séances restantes`: current remaining session balance.

Optional:

- `Email`
- `Date naissance`
- `Adresse`
- `Nom parent`
- `Début groupe`: defaults to subscription start.
- `Date paiement`: defaults to cutover date when `Déjà payé > 0`.
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
