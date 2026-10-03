# Wok & Sushi Order Hub

Créer une application web complète de commande en ligne pour Wok & Sushi (en remplacement de GloriaFood sur woknsushi.com) avec paiement Stripe activé.

Besoins fonctionnels :
- Parcours client de commande en ligne avec choix entre 'À emporter' (Click & Collect) et 'Livraison' (avec sélection de créneau horaire et coordonnées)
- Carte et menus complets basés sur les images fournies :
  * Woks Signatures et configurateur étape par étape 'Compose ton Wok' (1. Base, 2. Viandes, 3. Légumes, 4. Sauces, 5. Toppings)
  * Gamme Sushi, Makis, Californias, Rolls, Plateaux et Menus Midi
  * Pokés Bowls (signatures et à composer), Ramens, Currys, Sandwiches wrap, Korean fried chicken, entrées et desserts
- Panier dynamique avec gestion des options, suppléments et passage en caisse sécurisé via Stripe
- Espace restaurateur / cuisine : tableau de bord en temps réel optimisé pour tablette avec alertes sonores à l'arrivée d'une nouvelle commande, affichage du détail de préparation et suivi des statuts (nouvelle, acceptée, prête, terminée)

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://lcdigitale.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ef4b1d64-ea31-491e-adcc-0d022b6d298c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
