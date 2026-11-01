# Diagnostic — module « Campagne email (Brevo) »

Lecture seule : aucun fichier, aucune table, aucune configuration modifiés, aucun appel Brevo.

## 1. Où se trouve le code

| Élément | Emplacement |
|---|---|
| Page clients + ciblage + export + formulaire campagne | `src/routes/_authenticated/espace.$slug.clients.tsx` (filtres, `CampaignPanel`, historique ~l.330) |
| Envoi (test et réel) | `src/lib/campaign.functions.ts` → `sendCampaign` |
| Gabarit HTML + jeton de désabonnement | `src/lib/campaign.server.ts` → `campaignHtml`, `unsubToken`, `checkUnsubToken` |
| Désabonnement public | `src/routes/desabonnement.tsx` + `unsubscribe` (même fichier serveur) |
| Historique | table `restaurant_campaigns` (migration `20261004114525_…`) |
| Contacts | table `restaurant_customers` (`restaurant_id`, `email`, `marketing_consent`, `consent_at`, `consent_source`) |
| Emails de commande (autre usage Brevo) | `src/lib/order-email.server.ts` — non concerné |

## 2. Ce qui fonctionne déjà (constaté dans le code)

- **Ciblage** : filtres côté navigateur (commandé, consentement, avec email, montants, inactivité…) ; le compteur « 419 » = clients filtrés localement ayant consentement + email. Ce sont des fiches LC Digitale, **pas des contacts Brevo**.
- **Export** CSV/Excel et liste de diffusion (consentants avec email uniquement).
- **Accès** : panneau réservé à l'agence (affiché si `isAgency`, et le serveur revérifie `has_role admin`).
- **Clé API** : uniquement côté serveur (`process.env`, passerelle connecteur). Rien dans le navigateur.
- **Cloisonnement à l'envoi** : le serveur ne fait pas confiance à la liste du navigateur ; il relit `restaurant_customers` filtré par `restaurant_id` + `marketing_consent = true` + email non vide.
- **Isolation Brevo** : envoi via l'API transactionnelle (`/smtp/email`, lots de 500 via `messageVersions`). **Aucun contact, aucune liste, aucune campagne n'est créé dans Brevo** → aucun mélange possible entre restaurants côté compte mutualisé.
- **Expéditeur** : `contact@lcdigitale.fr` avec nom du restaurant, réponse vers l'email du restaurant.
- **Éditeur** : objet + message **texte brut** (échappé, retours ligne → `<br>`), bouton optionnel (lien + libellé), couleur d'accent du restaurant, « Bonjour {prénom} ».
- **Envoi test** : vers une adresse, objet préfixé `[TEST]`, non historisé.
- **Désabonnement** : lien signé HMAC par client, met `marketing_consent = false` avec date et source.
- **Historique** : 20 dernières campagnes (objet, nombre, statut sent/partial/failed, erreur), lisible par les gérants du restaurant via RLS ; écriture serveur uniquement.

## 3. Ce qui manque

- Pas d'éditeur HTML / mise en forme (gras, listes), pas d'aperçu avant envoi.
- Pas d'ajout d'image (ni upload, ni URL).
- Pas de templates enregistrés ni de brouillons.
- Pas de statistiques ouverture / clic : aucun `tag` ni identifiant de campagne transmis à Brevo, aucun webhook, aucune colonne de stats.
- Historique minimal : pas de contenu envoyé, pas de liste des destinataires, pas de détail par lot.
- Pas d'envoi programmé, pas de confirmation explicite « envoyer à N clients ».

## 4. Risques et points d'attention

1. **Lien de désabonnement de l'email test** non signé (`/desabonnement` sans paramètres) : sans conséquence sur les données, mais le testeur voit un lien inopérant.
2. **Pas d'en-tête `List-Unsubscribe`** : risque de délivrabilité (exigence Gmail/Yahoo pour l'envoi en masse).
3. **API transactionnelle pour du marketing** : Brevo le tolère mais le recommande moins ; à surveiller (quota, réputation du domaine partagé `lcdigitale.fr` pour tous les restaurants).
4. **Échec partiel** : si un lot échoue au milieu, les lots suivants ne partent pas ; relancer réenverrait aux premiers (pas de déduplication).
5. **Limite 5000 identifiants** par appel et un seul appel serveur long : risque de délai dépassé sur grosses listes.
6. **Désabonnements faits dans Brevo** (bouton natif, plaintes) ne remontent pas dans `restaurant_customers`.
7. **Statistiques futures** : si on les ajoute, chaque événement doit porter l'id du restaurant et de la campagne pour garantir le cloisonnement.

## 5. Incertitudes (non vérifiées)

- Je n'ai pas lu le rendu exact de `CampaignPanel` en entier ni testé l'écran ; état réel du connecteur Brevo et domaine expéditeur authentifié (SPF/DKIM) non vérifiés.
- Le chiffre 419 dépend des filtres actifs dans la capture ; non recompté en base.
- Je n'ai pas vérifié les quotas du compte Brevo.

## 6. Plan d'évolution par petites étapes

Chaque étape est indépendante et validable avant la suivante.

1. **Corrections de sûreté (petit)** : lien de désabonnement valide dans l'email test, en-tête `List-Unsubscribe`, confirmation « Envoyer à N clients ? ».
2. **Aperçu** : bouton « Aperçu » qui affiche le gabarit réel (rendu serveur), sans envoi.
3. **Image** : une image d'en-tête optionnelle (upload dans le stockage du restaurant, chemin cloisonné par restaurant, URL publique insérée dans le gabarit).
4. **Mise en forme simple** : gras / liens / listes en syntaxe légère convertie et assainie côté serveur (pas de HTML libre, pour éviter les injections).
5. **Templates / brouillons** : table `restaurant_campaign_templates` (par restaurant, RLS gérants/agence), boutons « Enregistrer » / « Charger ».
6. **Historique enrichi** : stocker contenu, id de campagne, nombre ciblé vs envoyé ; reprise des seuls destinataires non servis en cas d'échec partiel.
7. **Statistiques** : envoyer un `tag` `rest_<id>:camp_<id>` à Brevo, recevoir les événements (ouverture, clic, désabonnement, rebond) via une route publique signée, agrégés par campagne, et répercuter désabonnements/plaintes sur le consentement.
8. *(Optionnel, plus tard)* Envoi programmé et découpage en tâches pour les grosses listes.

Aucune étape ne crée de contacts ni de listes dans Brevo : l'isolation reste garantie par la base LC Digitale.

## Détails techniques

- Étapes 1–2 : uniquement `campaign.functions.ts`, `campaign.server.ts`, `CampaignPanel` ; aucune migration.
- Étape 3 : bucket de stockage existant ou nouveau, chemin `restaurantId/campaigns/…`, validation type/taille.
- Étapes 5–7 : migrations avec RLS `is_restaurant_manager`, écriture service-role ; webhook sous `/api/public/brevo/…` vérifié par secret.
- Chaque étape : tests unitaires ciblés (gabarit, filtrage consentement/restaurant), aucun envoi réel pendant le développement (envoi test uniquement, sur validation de votre part).
