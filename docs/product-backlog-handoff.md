# Passation backlog produit — We Discipline

**Date :** 2026-06-11  
**Branche :** `master` (commits récents : sécurité P0, consommation séances, report séances)  
**Agent source :** session `0b1f37d1-0977-4c3d-a906-5d7d585ac2a0`  
**Objectif :** documenter la demande utilisateur, l’état avant/après, l’approche d’implémentation (proportionnée au poids), et le statut par item pour reprise par un autre agent.

---

## Prompt utilisateur (verbatim structuré)

1. Dropdown coach (création groupe) : afficher `Nom - Spécialité`.
2. Salle non obligatoire au niveau groupe ; salle variable par séance (persistante ou exceptionnelle).
3. Champ description plan : placeholder « Accès illimité… » — expliquer utilité ou supprimer.
4. Boutons modèle 1/2/3 mois : corriger le calcul prix (addition cumulative au lieu de réactivité).
5. Miniatures dossier membre : qualité visuelle insuffisante.
6. Badge « Accès restreint » + bouton récupération séance : fausse condition ? aligner avec paiement partiel (indicateur jaune, pas blocage).
7. Report séance après pointages : consommation déjà appliquée — undo, désactiver report, rediriger vers édition créneau/groupe.
8. Principe undo (flèches) global, minimum sur page pointage.
9. Table groupes référentiel : 3 boutons → une ligne d’icônes (montre, edit, poubelle).
10. Liste coaches : une ligne par coach, icônes actions à droite, responsive.
11. Layout : réduire marges latérales ; sidebar repliable icônes seules.
12. Offres : abandonner JSON brut ; règles flexibles ; offres depuis dossier membre.
13. Téléphone enfant optionnel ; téléphone parent obligatoire.
14. Tableau de bord : focaliser financements, rappels, notifications paiement.

**Contraintes de livraison :** implémentations prudentes, testées ; documentation avant implémentation proportionnée au poids ; statut traçable.

---

## Légende statuts

| Statut | Signification |
|--------|----------------|
| `pending` | Non commencé |
| `in_progress` | En cours |
| `done` | Implémenté et vérifié |
| `blocked` | Décision produit ou migration requise |
| `deferred` | Reporté volontairement |

| Taille | Effort indicatif |
|--------|------------------|
| **S** | < 2 h, 1–3 fichiers |
| **M** | 0,5–2 j, logique + UI |
| **L** | 2–5 j, plusieurs modules |
| **XL** | > 5 j, architecture / migration |

---

## ITEM-01 — Dropdown coach avec spécialité

**Statut :** `done`  
**Taille :** S

### État avant
- `group-add-form.tsx` / `group-edit-form.tsx` : `{firstName} {lastName}` uniquement.
- `CoachDto` expose déjà `sportName` (discipline du coach).

### Comportement attendu
- Option : `Jean Dupont - Karaté` (tiret + spécialité si connue).

### Approche
- Helper `formatCoachOptionLabel(coach)` réutilisé dans les deux formulaires.
- Aucun changement API/DB.

### Fichiers
- `src/components/groups/group-add-form.tsx`
- `src/components/groups/group-edit-form.tsx`

### Résultat
- Labels enrichis dans les `<select>` coach.

---

## ITEM-02 — Salle optionnelle au groupe, variable par séance

**Statut :** `done`  
**Taille :** L

### État avant
- `Group.room` : `String` **obligatoire** (Prisma + `createGroupSchema` `min(1)`).
- `Session.room` existe déjà ; édition possible via `sessions/[id]` et créneaux groupe.
- UI création groupe : `required` sur input salle.

### Comportement attendu
- Groupe sans salle par défaut OK.
- Salle définie par séance (modification persistante sur créneau ou exception sur une séance).

### Approche recommandée
1. Migration Prisma : `Group.room String?` (default null ou `""` selon convention).
2. Assouplir `src/lib/schemas/group.ts` : `room` optional/nullable.
3. Génération séances : hériter `group.room ?? "—"` ou salle du créneau si modèle étendu.
4. UI : retirer `required` ; message « Salle par séance ».
5. Vérifier listes/filtres qui affichent `group.room`.

### Risques
- Données existantes avec salle obligatoire → migration safe.
- Rapports / exports qui supposent salle non nulle.

### Résultat
- Migration `20260611150000_optional_group_room` : `Group.room` nullable.
- Helpers `src/lib/group-room.ts` ; génération séances avec salle vide si non définie.
- Formulaires groupe : salle optionnelle + hint « par séance ».
- Tests : `group-room.test.ts` + API/schema dans `dojo-scenarios.test.ts`.

---

## ITEM-03 — Champ description du plan d’abonnement

**Statut :** `done` (supprimé du formulaire)  
**Taille :** S

### État avant — **Analyse fonctionnelle**
| Aspect | Détail |
|--------|--------|
| Stockage | `SubscriptionPlan.description` nullable |
| Validation | `max(500)` optional |
| Logique métier | **Aucune** — ni quota, ni tarif, ni éligibilité pointage |
| Usage UI | Liste plans (`subscription-plans-table.tsx`), recherche API `contains` sur nom **ou** description |
| Placeholder | « Accès illimité, 1 coach… » — **trompeur** (le plan est limité par `sessionsPerWeek` × 4 et `validityDays`) |

### Résultat
- Champ retiré de `subscription-plan-form.tsx` (colonne DB conservée pour données existantes).

---

## ITEM-04 — Boutons modèle 1 / 2 / 3 mois (prix)

**Statut :** `done`  
**Taille :** S

### État avant — bug identifié
```typescript
// subscription-plan-form.tsx applyTemplate()
if (price) {
  const base = parseFloat(price) || 0;
  if (base > 0) setPrice((base * months).toFixed(2)); // BUG
}
```
- Clic 1 mois (50 €) → 50 € OK.
- Clic 2 mois → `50 * 2 = 100` OK.
- Clic 3 mois → `100 * 3 = 300` **faux** (devrait être 150 €).

### Comportement attendu
- Prix mensuel normalisé : `prix_mois = prix_actuel / (validité_jours / 30)`.
- Template N mois : `prix = prix_mois × N`, idempotent sur clics répétés.

### Approche
- Normaliser à partir de `validityDays` + `price` courants avant multiplication.

### Fichiers
- `src/components/subscription-plans/subscription-plan-form.tsx`

---

## ITEM-05 — Thumbnails dossier membre

**Statut :** `done`  
**Taille :** M

### Résultat
- `MemberProfileHero` : avatar initiales coloré, stats abos/groupes/solde, CTA encaisser.
- `MemberSubscriptionCards` : cartes avec barre de progression paiement.
- Helpers testés : `src/lib/member-avatar.ts`, `tests/member-avatar.test.ts`.

---

## ITEM-06 — « Accès restreint » et paiement partiel

**Statut :** `done`  
**Taille :** M

### État avant — incohérence UI vs API
- **UI** (`attendance/today/page.tsx` L.109–110) : `if (totalPaid < sub.amount) continue` → exclut du set `activeSubscriptionMemberIds`.
- **API** (`canCheckInWithPayment` dans `membership-rules.ts`) : autorise pointage si `allowCheckInWithPartialPayment && totalPaid > 0`.
- **Drawer** : `!activeSub` → badge « Accès restreint » + modal exceptionnel.

### Cause du faux positif
- Membre **standard**, paiement partiel autorisé par club → badge restreint **à tort**.
- Ce n’est **pas** lié au quota hebdo (`sessionsPerWeek`) seul.

### Comportement attendu (utilisateur)
- Paiement partiel : pointage normal autorisé + **rappel jaune** (montant restant).
- « Accès restreint » uniquement si vraiment non éligible (pas d’abo, sport incompatible, quota épuisé, impayé total si réglage strict).

### Approche implémentée
- Aligner calcul serveur sur `canCheckInWithPayment`.
- Nouveau set `partialPaymentMemberIds` (clés `sessionId_memberId`) pour badge jaune « Solde : X € ».

### Fichiers
- `src/app/attendance/today/page.tsx`
- `src/components/attendance/check-in-panel.tsx`
- `src/components/attendance/check-in-drawer.tsx`

---

## ITEM-07 — Bouton « Récupération séance »

**Statut :** `done`  
**Taille :** M

### État avant — utilité réelle
- **Pas** un lien direct au paiement partiel.
- Flux `OVERRIDE` + `overrideKind: "RECOVERY"` dans `check-in-drawer.tsx`.
- API `GET /api/attendances/recovery-candidates` : membres **absents** cette semaine sur un **groupe équivalent** (même sport) → rattrapage sur séance courante sans double consommation hebdo.

### Résultat
- Bouton « Rattrapage absence (même semaine) » + modal explicatif dans `check-in-drawer.tsx`.

### Fichiers
- `src/components/attendance/check-in-drawer.tsx`
- `src/app/api/attendances/recovery-candidates/route.ts`

---

## ITEM-08 — Report séance + pointages + undo

**Statut :** `done`
**Taille :** XL

### État avant
- Report (`POST /api/sessions/[id]/postpone`) : pas de garde si attendances existent.
- Consommation `remainingSessions` déjà appliquée au POST/PATCH présence.
- UI report : page/modal dédiée `postpone-form.tsx` + lien depuis carte séance.

### Comportement attendu (utilisateur)
1. Dès qu’au moins un membre pointé → **désactiver** report simple OU stack undo.
2. Flèche retour : annuler pointages un par un jusqu’à zéro → report réactivé.
3. Reporter redirige vers le planning séances (`/sessions?week=&groupId=&sessionId=`) avec modal d’édition ouverte.
4. Si navigation vers édition avec pointages existants → formulaire bloqué + message ; annulation préalable via pointage.

### Résultat (P0 + P1 + P2)
- API `409` si pointages existent sur postpone, PATCH et DELETE session ; tests rejet + succès après DELETE.
- UI pointage : Reporter désactivé si pointages ; sinon deep-link planning séances.
- Undo ↶ dans drawer pointage (DELETE create / PATCH revert).
- Planning : `attendanceCount` sur les séances ; modal édition bloquée si pointages.
- Ancienne page `/sessions/[id]/postpone` → redirect vers planning.
- Lien « Planning séances » depuis créneaux groupe ; fix import `PageHeader` sur cette page.

### Fichiers
- `src/lib/session-attendance-guard.ts`
- `src/app/api/sessions/[id]/route.ts`
- `src/app/api/sessions/route.ts`
- `src/app/sessions/page.tsx`
- `src/components/sessions/sessions-planner.tsx`
- `src/app/sessions/[id]/postpone/page.tsx`
- `src/components/attendance/check-in-panel.tsx`
- `src/app/groups/[id]/schedules/page.tsx`

---

## ITEM-09 — Undo global (pattern flèches)

**Statut :** `done`  
**Taille :** L

### État avant
- Aucun undo transversal.

### Résultat
- Hook `useActionHistory<TScope>` : pile d'actions, undo inverse, profondeur max 20, Ctrl/Cmd+Z (hors champs saisis).
- Composant `UndoButton` (icône Undo2).
- **Pointage du jour** : refactoré sur le hook (scope = sessionId).
- **Encaissement** (`/payments/new`) : undo du dernier paiement enregistré via DELETE API.
- **Planning séances** : undo des modifications en mode *Exception* (PATCH inverse).
- **Wizard inscription** : undo via `POST /api/enrollment/revert` + snapshot renvoyé par `/api/enrollment/apply`.
- Non implémenté : undo des modifications *Permanentes* du planning (multi-séances).

### Fichiers
- `src/hooks/use-action-history.ts`
- `src/components/ui/undo-button.tsx`
- `src/components/attendance/check-in-panel.tsx`
- `src/components/attendance/check-in-drawer.tsx`
- `src/components/payments/payment-add-form.tsx`
- `src/components/sessions/sessions-planner.tsx`
- `src/components/enrollment/enrollment-wizard.tsx`
- `src/lib/enrollment-undo.ts`
- `src/app/api/enrollment/revert/route.ts`
- `tests/use-action-history.test.ts`
- `tests/dojo-scenarios.test.ts` (revert inscription)

---

## ITEM-10 — Actions table groupes (icônes)

**Statut :** `done`  
**Taille :** S

### État avant
- `group-list-client.tsx` : 3 boutons texte « Planifier / Modifier / Supprimer » → retour ligne.

### Approche
- `Link` + `button` avec `Clock`, `Pencil`, `Trash2`, `title` aria-label, `btn-icon` ou `btn-ghost btn-sm p-2`.
- `flex-nowrap gap-1` dans `TableActionsCell`.

### Fichiers
- `src/components/groups/group-list-client.tsx`

### Résultat
- Trois icônes (`Clock`, `Pencil`, `Trash2`) sur une seule ligne avec `flex-nowrap`.

---

## ITEM-11 — Liste coaches une ligne + icônes

**Statut :** `done`  
**Taille :** M

### État avant
- `coach-manager.tsx` : cartes deux colonnes, boutons texte.

### Approche
- Table ou liste `flex` : avatar/initiales | nom + tel + sport | actions icônes.
- Breakpoints : stack mobile, ligne unique ≥ md.

### Résultat
- Ligne unique responsive : avatar initiales | nom | tel/email/spécialité/statut | icônes edit/delete.

---

## ITEM-12 — Layout compact + sidebar repliable

**Statut :** `done`  
**Taille :** L

### État avant
- `.app-shell { max-width: 1280px; padding … }` (`globals.css`).
- Sidebar fixe ~264px (`app-sidebar.tsx`), non collapsible.

### Approche
- Réduire padding horizontal (`px-4` → `px-2` lg), `max-width: none` ou `min(100%, 1440px)`.
- Sidebar : état `collapsed` localStorage, icônes seules ~64px, toggle chevron.
- Tables : `overflow-x-auto` conservé mais plus de largeur utile.

### Résultat
- `.app-shell` : max-width supprimé, padding réduit.
- Sidebar repliable (72px icônes), persistance `localStorage`.
- Grille contenu élargie (`xl:grid-cols-4` sur cartes séances).

---

## ITEM-13 — Refonte logique offres (hors JSON)

**Statut :** `done`
**Taille :** XL

### État avant
- `Offer.rules` JSON string ; kinds : `FAMILY_BUNDLE`, `SECOND_DISCIPLINE`, `PERCENT_OFF`, `FIXED_OFF`.
- UI `offers-manager.tsx` construit JSON typé.
- Application : `buildEnrollmentQuote` dans `membership-rules.ts`.
- Pas d’offre depuis dossier membre individuel.

### Vision utilisateur
- Règles configurables sans JSON visible.
- Création offre contextualisée depuis fiche membre.

### Résultat (Phase 1 + Phase 2)
- Colonnes Prisma structurées + dual-read JSON legacy via `resolveOfferRules()`.
- API POST `/api/offers` : champs structurés uniquement (plus de `rules` côté UI).
- `GET /api/members/[id]/applicable-offers` retourne offres + suggestion de création.
- Section `MemberOffersSection` sur fiche membre avec deep-link inscription.
- Deep-link inscription : `/enrollment?memberId=&offerId=&step=2`.
- Forfait famille : sélecteur discipline optionnel (`sportId`).
- Script backfill prod/dev : `npm run offers:backfill:dev` (ou `offers:backfill` avec `DATABASE_URL`).
- Colonne `rules` conservée comme snapshot JSON synchronisé à l’écriture (source de vérité = colonnes structurées).
- Tests : `offer-rules.test.ts` (4), `offer-applicability.test.ts` (2).

### Fichiers
- `prisma/schema.prisma`, migration `20260611160000_offer_structured_rules`
- `src/lib/offer-rules.ts`, `src/lib/offer-applicability.ts`
- `src/lib/schemas/offer.ts`, `src/lib/membership-rules.ts`
- `src/app/api/offers/route.ts`, `src/app/api/members/[id]/applicable-offers/route.ts`
- `src/components/offers/offers-manager.tsx`
- `src/components/members/member-offers-section.tsx`
- `scripts/backfill-offer-rules.ts`, `npm run offers:backfill:dev`
- `src/app/members/[id]/page.tsx`, `src/app/enrollment/page.tsx`, `src/app/offers/page.tsx`

---

## ITEM-14 — Téléphone enfant / parent

**Statut :** `done`  
**Taille :** M

### État avant
- À vérifier dans `enrollment.ts`, `member.ts`, wizard inscription : phone membre souvent required.

### Comportement attendu
- `memberType === KID` : phone enfant optional ; **parent/guardian phone required** (champ dédié ou contact foyer).

### Approche
- Schema Zod conditionnel `.superRefine`.
- Vérifier modèle `Member` / `Household` / contacts parents.

### Résultat
- Schema Zod conditionnel (enfant : parent obligatoire, tel enfant optionnel).
- `resolveMemberPhone()` : tel dérivé unique `parent#prenom-nom` si absent.
- Tests : `member-phone.test.ts`, scénario enrollment enfant.

---

## ITEM-15 — Tableau de bord finance & pilotage

**Statut :** `done` (Phase 1 + Phase 2)
**Taille :** L

### État avant
- `src/app/page.tsx` : KPI génériques + `dashboard-debts-table`.

### Vision
- Impayés, échéances 7 j, taux recouvrement, abonnements expirant, rappels SMS/email (si infra).
- Cartes actionnables, mobile-first.

### Résultat (Phase 1)
- `src/lib/dashboard-finance.ts` : impayés, recouvrement, expirations 7j, partiels.
- Dashboard recentré finance : 6 KPI + impayés à relancer + activité jour.
- Table dettes : lien dossier, badge « Partiel », encaissement via `?memberId=`.
- Tests : `tests/dashboard-finance.test.ts` (3 scénarios).

### Phase 2 (done)
- Rappels email impayés via Resend depuis le dashboard (`POST /api/payments/reminders`).
- Table impayés : bouton **Rappel** par membre + relance groupée des éligibles.
- Cooldown 7 jours (audit `PAYMENT_REMINDER_SENT`), skip si email absent.
- Script/config : `RESEND_API_KEY` + `PASSWORD_RESET_FROM` (même infra que reset mot de passe).
- Tests : `tests/payment-reminders.test.ts` (4 scénarios).
- SMS : hors scope (canal non branché).

### Fichiers Phase 2
- `src/lib/payment-reminders.ts`, `src/lib/schemas/payment-reminder.ts`
- `src/lib/email.ts`, `src/lib/email-templates.ts`
- `src/app/api/payments/reminders/route.ts`
- `src/components/dashboard/dashboard-debts-section.tsx`
- `src/app/page.tsx`

---

## Journal d’exécution (agent session)

| Horodatage | Item | Action | Statut |
|------------|------|--------|--------|
| 2026-06-11 | DOC | Création `docs/product-backlog-handoff.md` | done |
| 2026-06-11 | ITEM-01 | Labels coach avec spécialité | done |
| 2026-06-11 | ITEM-04 | Fix normalisation prix templates | done |
| 2026-06-11 | ITEM-06 | Alignement éligibilité + badge solde | done |
| 2026-06-11 | ITEM-10 | Icônes Planifier/Modifier/Supprimer | done |
| 2026-06-11 | ITEM-08 P0 | Garde API postpone + tests | done |
| 2026-06-11 | ITEM-08 P1 | Undo pointage + Reporter conditionnel | done |
| 2026-06-11 | ITEM-07 | Libellé rattrapage absence | done |
| 2026-06-11 | ITEM-11 | Liste coaches ligne + icônes | done |
| 2026-06-11 | ITEM-12 | Layout compact + sidebar repliable | done |
| 2026-06-11 | ITEM-14 | Tel enfant optionnel + tests | done |
| 2026-06-11 | TESTS | 69 tests (dojo + member-phone + template prix) | done |
| 2026-06-11 | ITEM-15 | Dashboard finance Phase 1 + tests | done |
| 2026-06-11 | ITEM-02 | Salle optionnelle + migration + tests | done |
| 2026-06-11 | ITEM-03 | Description plan retirée du formulaire | done |
| 2026-06-11 | ITEM-05 | Dossier membre hero + cartes abos | done |
| 2026-06-11 | TESTS | 98 tests passent | done |
| 2026-06-11 | ITEM-08 P2 | Deep-link planning + garde PATCH/DELETE session + tests | done |
| 2026-06-11 | ITEM-13 Phase 2 | Backfill + sport forfait famille + suggestion création | done |
| 2026-06-11 | ITEM-09 | Hook undo + pointage + encaissement | done |
| 2026-06-11 | ITEM-09 | Undo planning (exception) + wizard inscription | done |

---

## Ordre de reprise recommandé

Backlog UI/UX principal traité. Pistes futures :
- Undo des modifications *Permanentes* du planning (multi-séances).
- SMS rappels paiement (canal externe).
- Notifications planifiées (cron).

---

## Tests à exécuter après modifications logique

```bash
npm test
npm run build   # nécessite DATABASE_URL en local
```

Scénarios ajoutés :
- Postpone rejeté si pointages ; succès après DELETE attendance.
- PATCH/DELETE session rejetés si pointages ; PATCH succès après DELETE attendance.
- Enfant sans tel propre si parent renseigné (`enrollmentQuoteSchema`).
- `resolveMemberPhone` (3 tests).
- Normalisation prix modèles 1/2/3 mois (2 tests).
- Dashboard finance : dettes, recouvrement, seuil (3 tests).
- Salle optionnelle groupe + helpers room (4 tests).
- Avatar / progression abo membre (3 tests).
- Résolution offres structurées + fallback JSON (3 tests).
- Hook undo `findLastEntryIndex` (2 tests).
- Revert inscription : snapshot apply + garde pointages (3 tests).

---

## Déploiement production (rappel)

```bash
cd /opt/we-discipline && git pull && docker compose up -d --build
```

`.env` serveur : `HOST_PORT=3001`, `APP_URL=https://we-discipline.com`

---

## Pour l’agent suivant

1. Mettre à jour la colonne **Statut** et **Journal** de ce fichier à chaque item traité.
2. Ne pas under-engineer ITEM-08/13 ; ne pas over-engineer ITEM-01/04.
3. Commiter uniquement si demandé par l’utilisateur.
4. Transcript complet : `agent-transcripts/0b1f37d1-0977-4c3d-a906-5d7d585ac2a0.jsonl`.
