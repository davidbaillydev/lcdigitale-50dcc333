- [ ] Accès WhatsApp agence : boutons liste/fiche, message personnalisé avec liens et frais réels, édition téléphone/texte, copie et ouverture WhatsApp ; tests et parcours connecté sans envoi.
- [x] Chicken n Co : carte PDF vérifiée visuellement, 51 produits et 11 catégories enregistrés ; IDs existants conservés, tailles/prix/choix corrigés, assiette Veggie ajoutée. 32 tests réussis ; simulation connectée tacos XL 3 viandes 12,50 € relue sans paiement ni cuisine. Établissement désactivé : page publique inaccessible, activation volontairement inchangée. Quantités Chicken stick/Oignon rings et marques des boissons à confirmer (PDF ambigu ou non précis).
- [x] Historique Cuisine : contrôles de remboursement existants et badge, champs de paiement explicites, actions 56 px et actualisation après succès ; 38 tests réussis, compilation OK, commande réelle 1149 et fenêtre vérifiées connecté sur tablette. Aucun remboursement réel effectué ; droits serveur inchangés.
- [x] Tablette : réglages et historique réorganisés, grandes commandes espacées, recherche/fermeture/pagination accessibles ; 38 tests réussis et parcours connecté avec ticket réel n° 1104 vérifié en 768×1024, 1024×768 et 820×1180 sans erreur. Aucune commande modifiée, impression physique non testée.
- [x] Cuisine : roue de réglages avec sections filtrées par rôle, accès Ventes & tickets (recherche nom/numéro/date, pagination, aperçus et réimpression partagée). 38 tests réussis, compilation OK ; recherche n° 1104 et aperçu du ticket réel Tacos House vérifiés connecté, retour et petit écran contrôlés sans erreur. Aucune commande modifiée, impression physique non testée ; session de vérification agence, protections RLS existantes conservées.
- [x] Tickets : noms commerciaux inchangés, choix identifiés un par ligne, groupes retrouvés par IDs sans toucher aux commandes/prix ; 34 tests réussis, aperçus 58/80 mm vérifiés sans débordement, compilation OK. Cuisine ouverte avec accès agence, aucune commande active pour un aperçu réel ; impression physique non testée.
- [x] Modèles de structure issus de restaurants : bibliothèque agence, formats/choix et catégories, correspondance explicite dans le brouillon/import, prix configurables, sauvegarde différée. TACOS HOUSE défini comme modèle et relu après rechargement ; application au brouillon Wok & Sushi vérifiée connecté, mobile sans débordement. Carte publiée inchangée. Analyse IA de l’import non aboutie pendant le contrôle ; logique d’application et fusion testée séparément.
- [x] Disponibilités par plat : jours/heures Paris, réglage carte et raccourcis, badges site/borne, validation immédiate/planifiée ; 29 tests passent dont sauvegarde et refus serveur web/borne. Réglage et blocage du configurateur vérifiés connecté sans sauvegarder la carte ; compilation OK. Aucun paiement ou commande réelle créé.
- [x] Import IA non destructif : ajouter/remplacer/annuler, bilan de fusion et 13 tests réussis ; import TXT réel vérifié connecté, 2 nouveautés ajoutées au brouillon dans une catégorie existante et une nouvelle. Aucun enregistrement ni changement de carte publiée ; compilation OK.
- [x] Épurer les tickets HTML et ESC/POS : options sobres, allergènes sur demande, client, récapitulatif et établissement ; 15 tests passent, aperçu 58/80 mm sans débordement. Aucun essai sur imprimante physique.
- [x] Reproduire la photo complète : bandeaux inversés paiement/délai/mode, prénom/nom alignés, quantité à gauche, encadré commande en ligne et pied centré ; aperçu intégré vérifié connecté aux réglages agence sans sauvegarde. Aucune commande réelle disponible dans le KDS pour ouvrir son aperçu.
- [x] Réordonner les groupes, leurs suppléments et les tailles par flèches et glisser-déposer avec sauvegarde automatique ; 3 tests réussis, flèches et déplacement souris vérifiés connecté sur les suppléments Wok & Sushi, ordre initial rétabli, contrôle mobile sans débordement. Groupes multiples et tailles non exercés sur données réelles (un seul groupe, aucune taille).
- [x] Clarifier les tickets : catégorie par article, choix inclus vs suppléments payants, remarques encadrées et accents/apostrophes thermiques ; tests unitaires réussis.
- [x] Ajouter le repli automatique Gemini → Lovable AI pour clé rejetée, quotas ou indisponibilité, avec avertissement agence ; refus de contenu et d’accès sans repli, tests réussis.
- [x] Brancher Google Imagen 3 pour les photos de plats avec la clé Google agence et repli Lovable AI ; tests unitaires réussis.
- [ ] Vérifier un import réel Gemini, une photo Imagen 3 et leurs replis : attend une clé Google valide saisie dans la console et des crédits Lovable ; aucune clé réelle disponible, cartes publiées inchangées.
- [x] Réorganiser les réglages restaurant et agence par thème ; enregistrements placés au bas des sections, barre visible pour les réglages principaux ; navigation connectée et conservation des changements vérifiées sur ordinateur/mobile sans enregistrer de données réelles.
- [x] Add secure per-restaurant banner upload and removal in restaurant settings.
- [x] Corriger l’incompatibilité PDF des anciens navigateurs : PDF.js 4.10.38 legacy + worker correspondant ; lecture réelle des noms/prix vérifiée connecté avec fonctions récentes désactivées, 7 tests réussis et compilation OK. L’analyse reste bloquée par le crédit IA insuffisant ; aucune carte publiée modifiée.
- [x] Corriger la lecture native des PDF texte et les réponses IA interrompues : 7 tests passent, compilation OK, import connecté exécuté sans modifier la carte publiée.
- [ ] Vérifier la proposition de carte complète : bloqué par le refus 402 du service IA (crédit insuffisant), nécessite une recharge puis un nouvel import.
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

- [x] Cuisine : défilement global bloqué, colonnes indépendantes et navigation horizontale étroite ; session connectée vérifiée à 320/390/1024/1280px sans modifier les commandes. Tests génériques de navigation en échec (montage document HTML), hors de cette refonte.
- [x] Cuisine : mode service et plein écran entrée/sortie vérifiés connecté, 320/390/1024px, alternative navigateur vérifiée ; safe areas simulées (34px bas), aucun changement de commande. Matériel iOS/Android non testé.
- Modules par restaurant (feature flags) : fait
- TPE Cloud borne + mentions non fiscales : fait (non testé sur lecteur réel)
- [x] Ajouter la liste et l'invitation sécurisée d'administrateurs agence : 8 tests réussis, liste et ajout sans doublon vérifiés connecté sur ordinateur/mobile ; aucun nouvel email d'invitation envoyé pendant les tests.
- [x] Ingrédients retirables par plat : réglage auto/liste/aucun dans la carte, retrait côté client (site + borne), ligne « SANS : » sur tickets, 6 tests réussis, vérifié à l’écran sur Wok & Sushi
- [x] Mobile : section livraison du tunnel de paiement déborde
- [x] Simulation séparée depuis la Carte : brouillon, options, panier sans paiement et historique temporaire ; 39 tests réussis, commande TEST créée et relue connecté, aucun appel de création/paiement, affichage mobile vérifié, compilation OK.
- [x] Présentation food-court et accès professionnels latéraux : grille avec logos, recherche, lien restaurant et connexion vérifiés ; thèmes clair/sombre, 320/390/768/1280 px sans débordement ni erreur navigateur. Compilation OK. Deux anciens tests de navigation échouent sur le montage HTML du document, défaut déjà documenté hors de cette refonte.
- [x] Affiner les cartes restaurants : photo de couverture prioritaire avec logo, une carte par ligne sur smartphone, relief et boutons clairs ; accès professionnels de 72 px, raccourci et drapeau français. Vérifiés de 320 à 1440 px sans débordement, images chargées, recherche et ouverture de carte fonctionnelles, thèmes clair/sombre et compilation OK.
- [x] Vue « Gains agence » (/admin/gains) : frais de service, commandes validées et CA par restaurant, périodes 7/30/90 jours et mois en cours, graphique par jour ; fonction serveur réservée à l'agence, 4 tests réussis, page vérifiée connectée (100 commandes, 2 263,34 € de CA sur 30 jours, 0 € de frais car aucun restaurant n'a activé les frais de service).
