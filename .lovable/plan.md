# Séparation des espaces : Super-admin agence / Restaurateurs

## Objectif
Deux espaces distincts et sécurisés, avec une seule page de connexion qui oriente chacun vers le bon tableau de bord.

```text
/connexion
   ├── Super-admin (agence) ──> /admin
   │      Tous les restaurants, création, réglages complets, équipes
   └── Restaurateur (gérant / cuisine) ──> /espace
          Uniquement SES restaurants : commandes, carte, horaires, équipe
```

## 1. Espace Super-admin (/admin)
- **Vue réseau** : liste de tous les restaurants, statut en ligne/hors ligne, commandes du jour, recherche.
- **Assistant de création d'un restaurant** (étapes) :
  1. Identité : nom, adresse web, adresse, ville, téléphone, email.
  2. Marque : logo, couleurs, aperçu.
  3. Horaires : jours et plages d'ouverture, jours fermés.
  4. Commande & acceptation : retrait / livraison / sur place activés, délai de préparation, taille des créneaux, acceptation manuelle ou automatique des commandes, modes de paiement acceptés.
  5. Livraison : zone (km ou codes postaux), frais, minimum de commande, livraison offerte à partir de.
  6. Carte : partir d'une carte modèle, d'une carte vide ou importer (glisser-déposer + IA, validation manuelle).
  7. Équipe : inviter le gérant par email (compte restaurateur).
- **Fiche restaurant** : les mêmes réglages modifiables à tout moment + accès direct au site, à la borne et à la cuisine.
- **Gestion des comptes** : voir/retirer les accès des restaurateurs.

## 2. Espace Restaurateur (/espace)
- **Gérant** : commandes en temps réel, carte (édition + import), horaires, options de livraison/acceptation de SON restaurant, équipe cuisine.
- **Cuisine** : uniquement l'écran des commandes.
- Aucun accès aux autres restaurants ni aux réglages agence (marque, adresse web, activation).

## 3. Sécurité
- Tous les écrans privés passent derrière un contrôle de connexion avant affichage (plus d'affichage puis redirection).
- Chaque action (créer, modifier, enregistrer la carte, inviter) est revérifiée côté serveur selon le rôle : super-admin, gérant du restaurant, ou cuisine.
- Les anciennes adresses (/agence, /cuisine...) redirigent vers les nouveaux espaces.
- Correction des 4 alertes d'accès relevées précédemment.

## Détails techniques
- Routes privées déplacées sous `_authenticated/` (gate géré, `ssr:false`) : `_authenticated/admin/*`, `_authenticated/espace/*` ; garde de rôle dans `beforeLoad` des sous-layouts (has_role admin / restaurant_members).
- `/connexion` : après login, redirection selon rôle.
- Nouvelles clés jsonb dans `restaurants.config` (modes activés, autoAccept, paiements, lead times) et `delivery` (zone, fees) ; validation zod dans les server functions ; `createOrder`/`createKioskOrder` respectent les modes et paiements activés ; autoAccept met le statut à `accepted`.
- Server functions : `admin.functions.ts` (assertAgency), `restaurant-settings.functions.ts` (is_restaurant_manager, champs limités pour gérant).
- Invitation : création de compte via admin client après vérification du rôle, ajout dans `restaurant_members`.
- Mise à jour d'AGENTS.md.
