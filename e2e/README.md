# Tests QR et session gérant

Les tests publics n'effectuent aucune commande. Les modes désactivés restent ignorés : ne pas activer room service ou libre-service sur un restaurant en production pour faire passer les tests.

## Session enregistrée

En environnement Lovable, `lovable auth-session --json` prépare une session autorisée. Restaurer sa session sur localhost, puis enregistrer `context.storageState()` dans `/tmp/browser/manager-state.json`. Ne jamais afficher le contenu, committer le fichier ou l'ajouter aux pièces jointes. Ce fichier expire : le recréer avant les tests.

Sur un environnement externe, ouvrir `bunx playwright codegen --save-storage=/tmp/manager-state.json http://localhost:8080/connexion`, se connecter avec un compte autorisé, ouvrir le restaurant puis fermer le navigateur. La connexion n'est pas automatisée avec des mots de passe dans le dépôt.

Exécuter `E2E_STAFF_STATE=/tmp/browser/manager-state.json bun run test:e2e e2e/manager-session.spec.ts`. Les tests publics gardent des contextes séparés de la session gérant.

## Parcours complets avec écritures

Utiliser un restaurant dédié ayant les modes room service/libre-service activés, une carte, une ouverture et un paiement sur place autorisé. Exécuter `E2E_SLUG=<restaurant-test> E2E_STAFF_STATE=/tmp/browser/manager-state.json E2E_ALLOW_WRITES=1 bun run test:e2e e2e/qr-modes.spec.ts` seulement avec autorisation de créer des commandes. Ces commandes peuvent déclencher impression, email et push ; aucun email client n'est renseigné par le test.

Libre-service exige la session avant l'écriture, vérifie l'attente côté client, valide depuis le KDS et relit après actualisation. Room service vérifie la chambre après actualisation et à la caisse, sans soumettre de commande. La consultation vérifie l'absence de panier après actualisation.