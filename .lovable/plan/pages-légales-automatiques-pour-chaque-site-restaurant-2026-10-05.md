# Pages légales automatiques pour chaque site restaurant

## Objectif
À la création d'un restaurant dans l'application, son site public reçoit automatiquement les pages légales européennes et un bandeau cookies. Les textes sont remplis avec les informations du restaurant. La facturation électronique viendra dans une étape suivante.

## Ce que l'agence verra
- Dans la fiche d'un restaurant (console Agence), un nouvel onglet **« Légal & RGPD »** :
  - Informations juridiques : raison sociale, forme (SARL, SAS, EI…), capital, SIRET, RCS/ville, n° TVA intracommunautaire, représentant légal, email de contact RGPD, médiateur de la consommation.
  - Hébergeur pré-rempli.
  - Un indicateur « Complet / À compléter » qui liste les champs manquants.
  - Un aperçu de chaque page et la date de dernière mise à jour.
- Le dialogue « Nouveau restaurant » propose les champs principaux (raison sociale, SIRET, TVA) ; le reste se complète ensuite.
- Le gérant voit les pages en lecture et peut signaler une correction, mais seule l'agence modifie (comme les réglages sensibles).

## Ce que le client verra sur /:slug
- Un pied de page sur le site, le menu QR et la page commande avec : Mentions légales · Confidentialité · CGV · Cookies.
- Quatre pages : `/:slug/mentions-legales`, `/:slug/confidentialite`, `/:slug/cgv`, `/:slug/cookies`, aux couleurs du restaurant.
- **Bandeau cookies** au premier passage : Accepter / Refuser / Personnaliser (mesure d'audience, assistant vocal Kaito, paiement). Choix mémorisé 6 mois, modifiable depuis le pied de page. Kaito ne se charge qu'après consentement.
- **Case obligatoire** au paiement : « J'accepte les CGV » avec lien ; l'heure d'acceptation et la version des CGV sont enregistrées sur la commande.
- La case de consentement marketing existante reste séparée et décochée par défaut.

## Contenu des textes (modèles maintenus par l'agence)
- **Mentions légales** : éditeur, directeur de publication, hébergeur, propriété intellectuelle (LCEN).
- **Confidentialité RGPD** : responsable de traitement, données collectées (commande, livraison, paiement, appels vocaux, marketing), finalités et bases légales, durées de conservation, sous-traitants (hébergement, Stripe/PayPal/Lyra/SumUp, Brevo, Vapi), droits (accès, rectification, effacement, opposition, portabilité), recours CNIL.
- **CGV** : produits et allergènes, prix TTC, commande, paiement, retrait/livraison et zones, absence de droit de rétractation pour les denrées périssables (art. L221-28), réclamations, médiation, droit applicable.
- **Cookies** : liste des traceurs et gestion du consentement.
- Sections conditionnelles : livraison, paiement en ligne, Kaito ou campagnes n'apparaissent que si le restaurant les utilise.
- Avertissement : ce sont des modèles ; une relecture juridique reste recommandée.

## Hors de cette étape (étape suivante)
- **Factures** : facture PDF par commande (numéro séquentiel, TVA 5,5 % / 10 % / 20 % détaillée, mentions obligatoires) téléchargeable par le client et le gérant.
- **Réforme 2026–2027** : format Factur-X et envoi via une plateforme agréée pour les factures entre entreprises ; il faudra un compte chez une plateforme.

## Détails techniques
- Migration : colonne `restaurants.legal jsonb` (identité juridique) + `orders.cgv_accepted_at timestamptz`, `orders.cgv_version text`. Lecture publique via `RESTAURANT_COLUMNS` (aucune donnée sensible) ; écriture agence via server function avec has_role admin.
- `src/lib/legal.ts` : modèles purs `buildLegalDocs(restaurant)` → sections ; version = hash des modèles + date de mise à jour.
- Routes `src/routes/$slug.mentions-legales.tsx`, `.confidentialite.tsx`, `.cgv.tsx`, `.cookies.tsx` avec head() propres.
- `LegalFooter` + `CookieConsent` (localStorage lu dans useEffect) dans le layout `$slug` ; le widget Kaito attend le consentement.
- `createOrder` exige `cgv: true` et stocke date + version ; la borne affiche un lien CGV sans case (vente sur place).
- Panneau `LegalPanel` dans `admin.$slug.tsx`, styles éditoriaux admin existants.
