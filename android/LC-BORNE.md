# LC Borne — Android

## Générer et télécharger

Le workflow **APK Android LC Borne** se déclenche manuellement et lors d’une modification de ses fichiers Android/configuration. Il utilise le SDK préinstallé sur GitHub, Java 21, Bun, Capacitor et `assembleDebug -PlcBorneApp=true`.

Le résultat `lc-borne.apk` est joint à la release `v1.0.0-borne`. Pour un dépôt public, le téléchargement anonyme est :

`https://github.com/<propriétaire>/<dépôt>/releases/download/v1.0.0-borne/lc-borne.apk`

Cette adresse est un modèle, pas un lien vérifié. Un dépôt privé exige un accès GitHub. Le workflow ne change pas la visibilité du dépôt. L’APK est signée avec une clé de débogage conservée dans le cache du workflow pour les mises à jour internes ; ce n’est pas une publication Play Store. La perte de ce cache nécessite une désinstallation/réinstallation ou une signature de distribution durable.

## Installation et fonctionnement

- Identifiant : `fr.lcdigitale.borne`, distinct de LC Cuisine.
- Démarrage : `https://restaurant.lcdigitale.fr/borne` ; publier la nouvelle page avant d’installer l’APK.
- Premier lancement : restaurant actif, borne déclarée et active, puis PIN borne (ou PIN cuisine existant en repli). Aucun nouveau numéro n’est créé sur la tablette.
- L’identité est enregistrée uniquement sur cet appareil. Les lancements suivants ouvrent directement la borne correspondante.
- Appui long sur le logo : PIN personnel, puis **Changer de restaurant / réinitialiser** avec confirmation. Un paiement en cours empêche la réinitialisation.
- Écran éveillé et mode immersif permanents tant que l’application est au premier plan. Les barres Android peuvent apparaître temporairement par geste système ; un verrouillage anti-sortie complet requiert le provisionnement Android dédié/administré.

## Impression

Le plugin Capacitor partagé conserve le nom `LcKitchen` pour compatibilité. La borne utilise son réglage d’imprimante séparé, sa file locale et le consentement explicite du client. Le transport réseau envoie les octets ESC/POS directement en TCP (9100 par défaut), uniquement vers une adresse privée du réseau local, sans LC Print ni RawBT requis.

Le résultat natif confirme l’envoi des octets, pas la sortie physique du papier. Tester l’adresse IP, le format de papier et la coupe sur l’imprimante réelle.

## Vérifications restant sur matériel

Installer l’APK, configurer par PIN, relancer l’application, vérifier rotation/paysage, maintien de l’écran et changement de restaurant. Faire une impression réelle avec choix « Oui, imprimer » et vérifier l’absence d’impression avec « Non, merci ».