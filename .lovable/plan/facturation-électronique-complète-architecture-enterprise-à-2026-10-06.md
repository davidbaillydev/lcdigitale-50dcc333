# Facturation électronique complète + architecture "Enterprise" à coût minimal

Déjà en place : bouton « Facture » en Cuisine, numérotation continue par établissement, données figées, PDF Factur-X, données juridiques issues de « Légal & RGPD ». Ce plan complète le reste en 3 étapes.

## Étape A — Facturation conforme (priorité)

1. **Numérotation** : format `FAC-2026-00001`, séquence par établissement et par année, sans trou (verrou en base). Les factures déjà émises gardent leur numéro.
2. **Données juridiques** : ajout de « Adresse du siège social » dans « Légal & RGPD » (si absente), reprise sur la facture avec raison sociale, forme, capital, SIRET, RCS, TVA.
3. **TVA par ligne** : taux par plat (5,5 %, 10 %, 20 %) réglable dans la Carte, défaut 10 % (sur place/emporter), 20 % pour l'alcool ; tableau HT/TVA/TTC par ligne et ventilation par taux.
4. **PDF** : logo, vendeur, client (nom, adresse ou table/chambre, email), n°, date d'émission, date de prestation, n° de commande, moyen de paiement (Stripe/CB/Espèces/TPE), statut « Payée », mentions de bas de page (pénalités, indemnité 40 € B2B, TVA non applicable si besoin).
5. **Factur-X** : XML profil BASIC (EN 16931) embarqué en pièce jointe PDF/A-3, généré par notre propre code (aucun service payant).
6. **Client** : bouton « Télécharger ma facture » sur la page de suivi de commande et via le lien dans l'email de confirmation (lien signé, pas de compte requis).
7. **Agence (/admin)** : nouvel onglet « Factures » — liste filtrable (restaurant, période), téléchargement individuel, export ZIP des PDF, export comptable CSV/Excel (HT, TVA par taux, TTC). Le gérant voit aussi les factures de son restaurant.

## Étape B — Notifications à coût zéro

- **Push web gratuit** (application installable) pour clients et livreurs : confirmée, prête/en livraison, livrée.
- **Email transactionnel** : via le Brevo déjà connecté (gratuit jusqu'à 300/jour) plutôt qu'ajouter Resend — un service de moins à payer et gérer. Resend reste possible si vous le préférez.
- **SMS/WhatsApp Twilio** : optionnel, seulement si le client a refusé le push, activable par l'agence uniquement.
- Fait en même temps que l'étape 4 prévue (application installable).

## Étape C — Économies et performances

- **Traductions** stockées en base, générées une seule fois par l'IA à l'enregistrement de la carte (jamais à chaque visite).
- **Réservations** : garantie anti no-show par empreinte bancaire Stripe sans débit (prélevée seulement en cas de no-show).
- **Cache** : menu et infos légales mis en cache côté navigateur pour réduire les lectures en base.

## Ce dont j'aurai besoin

- Confirmer Brevo pour les emails (ou demander Resend).
- Twilio seulement si vous voulez le canal SMS de secours.
- Rappel : l'envoi B2B via plateforme agréée (2026-2027) reste hors périmètre ; les fichiers seront prêts.

## Détails techniques

- Pas de fonctions Edge : génération serveur via createServerFn (pdf-lib, compatible Worker) ; XML CII construit à la main, attaché avec métadonnées XMP PDF/A-3 + AFRelationship=Data.
- `issue_invoice` mis à jour : séquence par (restaurant_id, année), format FAC-YYYY-NNNNN, nouvelle colonne `year`; unicité (restaurant_id, number).
- `vatRate` optionnel par item dans le jsonb menu ; figé dans `orders.items` à la création de commande.
- Lien client : HMAC signé (secret dédié) → route publique `/api/public/invoice/$id`.
- ZIP via jszip côté navigateur ; export via `src/lib/export.ts`.
- Push : table `push_subscriptions` (RLS), clés VAPID en secrets, envoi web-push compatible Worker ; tables `menu_item_translations` (jsonb) et `reservations` avec SetupIntent.
- React Query : staleTime long sur catalogue et légal.  laors tout en respectant les regle frane et europe par rapport a la cible grand puclic 
  &nbsp;