- [x] Add secure per-restaurant banner upload and removal in restaurant settings.
- [x] Show the banner on the customer site and kiosk, with brand/logo fallback.
- [x] Verify upload, persistence, removal, fallback and current app errors.
- [x] Apply the selected editorial direction to the directory; verify themes, imagery and navigation.
- [x] Extend the selected editorial LC Digitale direction to all authenticated administration screens and dialogs; preserve permissions and verify light/dark views.
- [x] Adapt agency/manager cards, customer tables and sales summaries to small screens; verify authenticated layouts and unchanged actions.
- [x] Enlarge mobile console controls; verify authenticated touch targets, dialogs and layouts.
- [x] Adapt mobile console dialogs/menus with accessible sticky close, bounded scrolling and touch navigation; verify actual flows.
- [x] Apply the bold poster composition to the partner directory and kitchen KDS, preserving existing actions and permissions.
- [x] Verify both screens in light/dark at 320/390/1024/1280px: no overflow/runtime errors; ordering links, sound and menu navigation pass. Populated tickets and status actions checked with browser-only fixtures, without modifying real orders.
- [x] Reinforce LC Digitale Élite branding in the restaurant workspace; preserve rights and verify connected navigation in light/dark. Connected agency session: restaurant picker, kitchen, menu, settings and sales inspected; no overflow or runtime errors, automatic build OK. No permissions or order data changed.

Verified on a temporary restaurant, now deactivated: upload and reload persistence, customer site and kiosk rendering, removal, mobile fallback without horizontal overflow, and no browser errors. Three banner component tests pass; automatic build passes. Storage is private and direct anon/authenticated access is denied. Five database advisor findings predate this change and remain outside its scope.
- [x] Dish photos (import + AI), table QR codes, Google review invite

## 7 modules avancés (plan approuvé 2026-10-05)
- [x] Étape 1 : ruptures temps réel depuis la Cuisine + QR room service / libre-service / consultation
- [ ] Étape 2 : zones de livraison (CP/rayon), livreurs, statuts de livraison
- [ ] Étape 3 : menu FR/EN/ES/DE + réservations avec acompte Stripe
- [ ] Étape 4 : SMS/WhatsApp (attend compte Twilio) + application installable
- [x] Pages légales auto par restaurant (mentions, RGPD, CGV, cookies) + bandeau cookies + case CGV
- [ ] Facturation : facture PDF par commande, puis Factur-X / plateforme agréée (compte externe requis)
- [x] Factures PDF normalisées + Factur-X par commande

- [x] Facturation électronique A : FAC-AAAA-NNNNN, TVA par plat, Factur-X BASIC, facture client, page Factures (ZIP/CSV/Excel)
- [x] Étape B1 : push web clients + application installable (icônes, Capacitor)
- [ ] Étape B2 : push livreurs (attend le module Livreurs, étape 2), emails Brevo, Twilio optionnel
- [x] Étape C1 : traductions de la carte stockées (EN/ES/DE), sélecteur de langue client
- [x] Étape C2 : réservations + empreinte CB Stripe (SetupIntent) + débit no-show
- [x] Étape C3 : cache 15 min carte/légal (TanStack Query), Realtime réservations

- [x] Logistique : zones carte (rayon/polygone), éligibilité adresse, écran /livreur PIN, ruptures 1 clic (carte), QR logo + PNG/PDF + validation tables, /admin/qrcodes
- [x] Validation libre-service (pending_approval), dispatch livreurs (driver_id), tests E2E

## Finalisation demandée le 7 octobre 2026
- [x] Harmoniser écran livreur/identité établissement et accès/actions, gestion équipe/lien partagé ; back-office éditorial préservé. Accès et gestion connectée vérifiés ; aucune course réelle (PIN désactivé, équipe vide).
- [x] Vérifier les scans accessibles (basic et dépendances sans alerte) ; empêcher l'omission de profil d'élargir les lectures/actions livreurs, vérifier actif/statuts côté serveur, ne plus déduire paiement de ready/done.
- [ ] Analyser les 11 anciennes alertes : non retournées par le service actuel ; analyse approfondie non exécutée par les outils disponibles.
- [x] Préparer contrat et diagnostic B2B par facture, documentation des prérequis ; aucune transmission ni conformité certifiée annoncée.
- [ ] Raccorder plateforme agréée : attend choix, documentation sandbox, compte/mandat, identités juridiques et clients B2B, validation normative/comptable.
- [x] Compléter persistance QR et caisse room service, garde staff avant écriture libre-service ; session autorisée enregistrée hors dépôt, test d'accès gestion connecté réussi, consultation réussie ; 7 tests unitaires réussis.
- [ ] Exécuter room service/libre-service complets : attend restaurant de test avec modes activés et autorisation d'écriture (modes Wok & Sushi désactivés). Ne pas modifier la configuration de production pour les tests.

- [x] Tailles/formats + groupes de suppléments (BDD, carte, site/borne/QR, KDS, tickets)
