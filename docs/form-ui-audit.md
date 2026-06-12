# Audit UI des formulaires

Audit du 12 juin 2026 sur 27 formulaires.

## Priorité haute

- Inscription multi-membres : conserver des libellés visibles pour tous les champs dynamiques et afficher les erreurs au niveau de la ligne concernée.
- Création et modification de groupes : remplacer la grande table de sélection sur mobile par une liste compacte avec résumé de sélection.
- Formulaires membres : découper clairement identité, contact, responsable légal et abonnement; ne pas mélanger création du dossier et encaissement sans résumé final.
- Offres : séparer les règles par type dans des sections visuelles et afficher un aperçu du résultat avant création.
- Paramètres utilisateurs : ne jamais exposer URL de test, fournisseur email, variables serveur ou commandes techniques.

## Priorité moyenne

- Abonnements et paiements : uniformiser les résumés financiers, unités, champs calculés en lecture seule et messages de dépassement.
- Plans et créneaux : remplacer les champs numériques isolés par des groupes avec unité visible et aide concise.
- Édition inline des coachs et disciplines : ouvrir un panneau ou une carte d'édition stable plutôt que faire grandir une ligne de liste.
- Paramètres du club : rendre les conséquences de chaque règle explicites avec exemples métier, sans vocabulaire technique.

## Règles transversales

- Libellé visible pour chaque champ; le placeholder sert uniquement d'exemple.
- Une action principale par formulaire, placée à droite sur desktop et en pleine largeur sur mobile.
- Barre sticky uniquement pour les formulaires longs ou les assistants en plusieurs étapes.
- Navigation immédiate après succès; pas de délai artificiel.
- Erreur près de la zone concernée et résumé global uniquement si plusieurs sections sont touchées.
- Champs calculés clairement marqués en lecture seule.
- États de chargement qui conservent la taille du contenu pour éviter les sauts.
- Sections de formulaire limitées à une largeur de lecture confortable, même en mode large.
