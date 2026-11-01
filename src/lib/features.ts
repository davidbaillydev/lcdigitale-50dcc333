/** Modules activables par l'agence pour chaque restaurant (restaurants.enabled_features). */
export const FEATURES = [
  ["borne", "Borne tactile", "Commande en libre-service sur tablette (/borne)."],
  ["kds", "Écran cuisine", "Réception des commandes en temps réel."],
  ["livraison", "Logistique & livraison", "Zones de livraison, livreurs et écran livreur."],
  ["reservation", "Réservation de table", "Réservation en ligne avec empreinte bancaire."],
  ["qrcode", "Commande à table QR", "QR codes table, room service et libre-service."],
  ["facturx", "Facturation B2B & Factur-X", "Espace Factures, exports et raccordement PDP."],
  ["pos_sync", "Intégration API caisse", "Synchronisation avec le logiciel de caisse."],
  ["pos", "Caisse comptoir (POS)", "Écran d'encaissement tactile, espèces, CB, titres restaurant et clôture Z."],
  ["borne_cash_payment", "Espèces sur la borne", "Autoriser le paiement au comptoir depuis la borne."],
  ["embed", "Bouton pour site web", "Bouton de commande à intégrer sur le site ou la page Facebook du restaurant."],
] as const;

export type FeatureKey = (typeof FEATURES)[number][0];
export type Features = Record<FeatureKey, boolean>;

/** Modules à opt-in strict : jamais actifs tant que l'agence ne les a pas explicitement allumés. */
export const OPT_IN_FEATURES = ["pos"] as const satisfies readonly FeatureKey[];

/** Toute clé absente est considérée active, sauf les modules d'opt-in strict qui exigent `true`. */
export function featuresOf(raw: unknown): Features {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return Object.fromEntries(FEATURES.map(([k]) => [k, (OPT_IN_FEATURES as readonly string[]).includes(k) ? o[k] === true : o[k] !== false])) as Features;
}

export const FEATURE_OFF_MESSAGE = "Module non inclus dans votre abonnement";
