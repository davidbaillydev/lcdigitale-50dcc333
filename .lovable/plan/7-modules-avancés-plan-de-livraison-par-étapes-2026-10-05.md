# 7 modules avancés — plan de livraison par étapes

Les 7 modules sont trop gros pour un seul passage. Je propose de les livrer en 4 étapes, chacune vérifiée avant la suivante. Les droits actuels ne changent pas : le gérant gère ses opérations, l'agence garde les réglages sensibles.

## Étape 1 — Stocks en direct + modes QR (rapide, forte valeur)
- **Rupture temporaire depuis la Cuisine** : un interrupteur par plat sur l'écran Cuisine. Le plat disparaît (ou passe en « Épuisé ») immédiatement sur le site, la borne et le menu QR, sans recharger la page. Le serveur refuse aussi toute commande qui contient un plat épuisé.
- **QR Room Service** : `?room=102` → le numéro de chambre est ajouté à la commande, au ticket et à la Cuisine.
- **QR Libre-service** : le client compose sa commande, qui arrive dans « À valider » et n'est envoyée en cuisine qu'après validation par le personnel.
- **QR Consultation seule** : menu vitrine sans panier ni boutons de commande.
- Page « QR tables & avis » : choix du type de QR et génération du lien correspondant.

## Étape 2 — Livraison avancée & livreurs
- Zones tarifaires **par code postal ou par rayon (km)** depuis l'adresse du restaurant, chacune avec ses frais, son minimum et son seuil de livraison gratuite.
- Frais recalculés en direct à la caisse et revérifiés par le serveur.
- Fiches livreurs (nom, téléphone, actif) et tableau de bord Livraisons : attribution manuelle ou automatique (livreur disponible le moins chargé), statuts **Assignée → En cours de livraison → Livrée**.
- Écran mobile simple pour le livreur (lien sécurisé personnel, sans compte).

## Étape 3 — Menu multilingue + réservations
- Carte en **FR, EN, ES, DE** : traduction automatique par l'IA de tous les noms, descriptions et options, modifiable à la main avant enregistrement.
- Sélecteur de langue dans l'en-tête du site, du QR et de la borne, mémorisé par appareil.
- **Réservations** : date, service midi/soir, créneaux, couverts, capacité par créneau ; liste dans l'espace gérant (confirmer / annuler / no-show).
- **Acompte anti no-show** via le Stripe déjà configuré par restaurant : acompte fixe par couvert, ou empreinte bancaire (autorisation sans débit, capturée seulement en cas de no-show).

## Étape 4 — Notifications SMS/WhatsApp + application installable
- Message automatique au client à chaque statut : confirmée, prête / en livraison, livrée. Textes modifiables par restaurant, activation réservée à l'agence (option payante, comme les campagnes).
- **Application installable** : manifest complet avec icônes, fonctionnement hors ligne limité au menu déjà consulté (jamais dans l'aperçu de l'éditeur), et notes pour un export Capacitor iOS/Android.

## Ce dont j'aurai besoin de vous
- **SMS/WhatsApp** : un compte Twilio (connexion proposée au moment de l'étape 4). WhatsApp demande en plus des modèles validés par Meta.
- **Acompte** : les clés Stripe du restaurant (déjà prévues dans le panneau paiements).
- **Publication sur les stores** : faite hors de Lovable (Xcode/Android Studio, comptes Apple/Google développeur).

## Détails techniques
- Nouvelles tables : `delivery_zones`, `drivers`, `order_deliveries`, `reservations`, `menu_stock` (rupture par plat + realtime), `menu_translations`, `notification_settings`/`notification_logs`. GRANT + RLS via `can_access_restaurant` / `is_restaurant_manager` / `has_role` ; tables secrètes en service-role seulement.
- `orders` : ajout de `room_label`, `qr_mode`, statut `pending_validation`, `driver_id`. La carte reste en jsonb (`restaurants.menu`) ; `menu_items` n'est pas créée en doublon, le stock est une table à part pour le temps réel.
- Calcul rayon : géocodage de l'adresse client (service public BAN, France) + distance à vol d'oiseau, recalculé côté serveur dans `createOrder`.
- Twilio via le connecteur, appelé côté serveur sur changement de statut ; Stripe acompte via PaymentIntent `capture_method=manual` pour l'empreinte.
- PWA : `vite-plugin-pwa` avec garde preview/iframe, `NetworkFirst` pour les pages.
