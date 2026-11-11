# Audit Téléphone IA / Vapi — préparation Kaito Customer (lecture seule)

Aucun fichier, migration, package, configuration ou secret n'a été modifié pendant cet audit.

## 1. Ce qui existe (vérifié dans le code)

| Élément | Emplacement | Constat |
|---|---|---|
| Webhook Vapi | `src/routes/api/public/vapi.$restaurantId.ts` | Un point d'entrée par restaurant. En-tête `x-vapi-secret` comparé en temps constant au secret de `restaurant_voice_channels`. Canal et restaurant doivent être actifs. En-tête `x-lc-test: 1` = simulation sans écriture. |
| Outils exposés | même fichier | Deux seulement : `get_menu` et `create_order`. Pas d'outil de récapitulatif ni de paiement. |
| Lecture du menu | `get_menu` → `getCatalog` + `loadOptionData`/`withOptions` | Catégories, articles non masqués, prix, allergènes, groupes d'options. **Ne filtre pas** les ruptures (`menu_stock`) ni les plages horaires des plats. |
| create_order | même fichier | Validation zod, pause des commandes, mode, créneau, ouverture, options, zone et minimum de livraison. **Prix recalculés côté serveur.** Insertion directe : `source: "phone"`, `payment_method: "on_site"`, `status: new` (ou `accepted` si acceptation auto). Pas de code promo, pas d'e-mail client, pas de CGV, pas de `platform_fee`, pas de clé d'idempotence (un nouvel appel de l'outil peut créer un doublon). |
| Journal des appels | `restaurant_voice_calls` (upsert par `call_id`), compteur dans `restaurant_voice_channels` | Mis à jour sur `end-of-call-report` et à la création de commande. |
| Gestion agence | `src/lib/voice.functions.ts`, `VoiceChannelPanel.tsx` | Lecture/enregistrement du canal et liste des appels. |
| Voix web | `src/lib/vapi-web.functions.ts`, `useVapi.ts`, `VapiVoiceWidget.tsx` | Widget navigateur (clé publique + assistant), séparé du téléphone. |

## 2. Paiement et Mollie Connect

- Statut actuel du canal téléphone : **toujours « paiement au retrait / à la livraison »**. Aucun lien de paiement n'est généré.
- Flux en ligne existant réutilisable : `startOnlinePayment` (`src/lib/payments/online.ts`) crée un paiement Mollie avec `metadata.order_id`, `Idempotency-Key = pay_<orderId>`, `webhookUrl` public, et enregistre `payment_ref: mollie:<id>` + `platform_fee`.
- Mollie Connect : OAuth dans `src/lib/payments/mollie.ts` (`startMollieConnect`, renouvellement automatique des jetons, profil récupéré). Secrets plateforme `MOLLIE_CLIENT_ID` / `MOLLIE_CLIENT_SECRET` présents.
- Confirmation serveur : `src/routes/api/public/mollie-webhook.ts` → `handleMolliePayment` relit le paiement chez Mollie, vérifie `order_id`, devise EUR et montant exact, puis `markPaid` (`src/lib/payments/shared.ts`). Échec/expiration → commande annulée.
- Commission : `src/lib/platform-fee.ts`, taux fixe **7 %**, appliqué **seulement aux comptes reliés par Mollie Connect** (`m.oauth`). Canaux connus : `delivery`, `pickup`, `dine_in`, `kiosk`. **Aucun canal « téléphone »** ; une commande téléphone payée en ligne serait aujourd'hui comptée comme livraison ou à emporter et suivrait le réglage de ces canaux. Une constante en double existe (`MOLLIE_PLATFORM_FEE_RATE` dans `mollie.ts`).
- Montants envoyés à Mollie en `EUR` en dur : incompatible avec les restaurants XOF/XAF.

## 3. Notifications

- E-mail (Brevo, `src/lib/order-email.server.ts`) : `sendOrderReceived`, `sendRestaurantNewOrder`, `sendOrderConfirmation`, `notifyNewOrder`. Tous ignorent les commandes `awaiting_payment` ou `cancelled`.
- Téléphone aujourd'hui : seul l'e-mail restaurant + la notification push équipe partent. Le client n'a pas d'e-mail (non demandé par l'outil).
- **SMS : aucun envoi SMS n'existe** dans le code (seulement des mentions de texte). Pas de connecteur SMS lié (secrets présents : Brevo, Zoho, Mollie). Brevo propose un SMS transactionnel, mais il n'est pas branché.

## 4. Moment d'envoi en cuisine

- Téléphone : **immédiatement à la création** (`status new/accepted`), sans paiement.
- Flux payés (site, borne QR, carte) : commande `awaiting_payment`, masquée en cuisine (`kitchen-history.ts` filtre ce statut ; `order-alert.ts` ne sonne qu'à l'INSERT ou au passage `awaiting_payment → payé`), libérée par `markPaid` (statut, e-mails, synchro caisse externe).

## 5. Écarts avec le parcours cible

```text
Cible : appel → récapitulatif → SMS lien de paiement → confirmation serveur → cuisine
Actuel: appel → create_order → cuisine immédiate (paiement sur place)
```

1. Pas d'étape de récapitulatif chiffré serveur avant engagement (le total n'est connu qu'après insertion).
2. Pas de création de paiement Mollie depuis le téléphone.
3. Pas d'envoi SMS.
4. Pas de canal `phone` dans la commission 7 %.
5. Commande transmise en cuisine avant paiement.
6. Pas d'idempotence par appel (risque de doublon).
7. Ruptures de stock non exclues de `get_menu`.

## 6. Risques

- Lien de paiement sans expiration gérée → commandes `awaiting_payment` orphelines (aucune tâche de nettoyage dédiée vérifiée).
- Numéro appelant pouvant différer du numéro dicté : envoi SMS au mauvais destinataire.
- Commission à 0 si le restaurant n'est pas relié par Mollie Connect (clé API directe).
- Devise forcée en EUR.
- Coût et consentement SMS (option contractuelle agence selon la mémoire du projet).

## 7. Plan de modifications minimal (à valider, rien n'est fait)

1. Ajouter le canal `phone` à `platform-fee.ts` (7 %, coché par défaut pour le téléphone uniquement) et dans `PlatformFeePanel`.
2. Nouvel outil Vapi `quote_order` : même calcul que `create_order`, renvoie le récapitulatif et le total sans rien écrire. Extraire le calcul commun en fonction pure testée.
3. `create_order` en mode payant (option par restaurant, ex. `config.voice.payByLink`) : insertion `awaiting_payment`, `payment_method: online`, puis `startOnlinePayment("mollie", …, channel "phone")`. Clé d'idempotence `call_id` + contenu. Mode actuel « sur place » conservé par défaut.
4. Envoi SMS du lien `_links.checkout.href` via un fournisseur à choisir (Brevo SMS ou Twilio via connecteur), au numéro confirmé oralement.
5. Libération cuisine inchangée : webhook Mollie → `handleMolliePayment` → `markPaid`.
6. Annulation automatique des commandes téléphone impayées après un délai (ex. 30 min), via la route webhook/cron publique protégée.
7. Filtrer les ruptures et horaires dans `get_menu`.
8. Tests : commission téléphone 7 %, aucune commande `awaiting_payment` visible en cuisine, idempotence, montant recalculé.

## Points non vérifiables ici

- Configuration réelle des assistants dans Vapi (prompt, outils déclarés, en-têtes envoyés).
- Restaurants réellement reliés par Mollie Connect et leur mode test/live (données non interrogées).
- Activation du SMS sur le compte Brevo et coût.
- Requête temps réel exacte de l'écran cuisine en direct (seul l'historique et l'alerte sonore ont été lus).
- Existence d'une tâche planifiée qui annule déjà les `awaiting_payment` anciens.
