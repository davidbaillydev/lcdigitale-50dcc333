# Raccordement B2B — préparation, non connecté

Le PDF avec XML joint ne constitue pas à lui seul un raccordement à la réforme. Le moteur actuel n'a pas été validé par un validateur PDF/A et XML/Schematron ; ne pas présenter ses fichiers comme certifiés. BASIC n'est pas équivalent à une conformité intégrale EN 16931.

## Informations attendues de l'agence
- Plateforme agréée choisie, compte de chaque établissement, contact technique, documentation API et environnement de test.
- Mandat de transmission, identifiant du tenant/établissement, inscription à l'annuaire et adresse de réception. Les secrets seront recueillis par le gestionnaire sécurisé, jamais par email ou dans le code.
- Raison sociale, SIREN/SIRET, adresse complète, TVA intracommunautaire ou régime d'exonération, catégorie de taille de chaque entreprise.
- Périmètre : ventes B2B françaises, particuliers (e-reporting), ventes internationales ; nature biens/services/mixte et règles d'encaissement validées par le comptable.
- Données des clients professionnels : raison sociale, SIREN, TVA si applicable, adresse structurée, routage de facturation ; aucune déduction depuis le prénom d'une commande.
- Politique d'archivage, durée de conservation et responsable comptable.

## Architecture préparée
`src/lib/invoice-platform.ts` définit le contrat de dépôt, clé d'idempotence, accusé et états normalisés, et vérifie les lacunes des factures existantes. Aucune transmission n'est autorisée tant que ces lacunes et la validation normative ne sont pas résolues.

Après choix de la plateforme : adaptateur dans un helper serveur, domaines de destination fixes (pas d'URL arbitraire fournie par le navigateur), secrets par établissement, action agence vérifiée côté serveur, file durable et idempotente, pièces figées et empreintes, reprise contrôlée des erreurs. Webhook sous `/api/public/` avec vérification de signature, anti-rejeu et correspondance fournisseur/établissement/facture avant mise à jour. États externes mappés depuis la documentation réelle, journal d'événements horodaté ; jamais `paid` depuis une simple notification non vérifiée.

Les factures existantes restent immuables. Identité B2B collectée avant émission ; facture déjà émise corrigée par un document comptable adapté, pas par modification de son snapshot. Paiement déterminé par `payment_status` vérifié, jamais déduit de `ready` ou `done`. TVA/remises multi-taux, exonérations, avoirs, adresses, échéances, mentions et profil XML sont à valider avec le comptable et la plateforme. Dépôt, rejet, approbation/refus et encaissement doivent suivre les codes de la plateforme.

## Recette obligatoire avant production
Vérifier XML avec schéma et règles de gestion officiels, PDF/A avec validateur, puis dépôt sandbox → accusé → statut relu ; rejets et doublons, isolation entre établissements, signature invalide, indisponibilité, remboursement/avoir et e-reporting. Aucun de ces échanges n'est encore testé.

## Calendrier à confirmer avec les sources officielles
Réception : toutes les entreprises assujetties à la TVA au 1er septembre 2026. Émission/e-reporting : grandes entreprises et ETI à cette date, PME/microentreprises au 1er septembre 2027. Le PPF n'est pas une alternative gratuite d'émission directe : la transmission passe par une plateforme agréée.

Sources : https://www.impots.gouv.fr/facturation-electronique ; https://www.economie.gouv.fr/entreprises/facturation-electronique-entreprises