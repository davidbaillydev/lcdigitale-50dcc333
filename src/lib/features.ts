/** Modules activables par l'agence pour chaque restaurant (restaurants.enabled_features). */
export const FEATURES = [
  ["borne", "Borne tactile", "Commande en libre-service sur tablette (/borne)."],
  ["kds", "Écran cuisine", "Réception des commandes en temps réel."],
  ["livraison", "Logistique & livraison", "Zones de livraison, livreurs et écran livreur."],
  ["reservation", "Réservation de table", "Réservation en ligne avec empreinte bancaire."],
  ["qrcode", "Commande à table QR", "QR codes table, room service et libre-service."],
  ["facturx", "Facturation B2B & Factur-X", "Espace Factures, exports et raccordement PDP."],
  ["pos_sync", "Intégration API caisse", "Synchronisation avec le logiciel de caisse."],
  ["borne_cash_payment", "Espèces sur la borne", "Autoriser le paiement au comptoir depuis la borne."],
] as const;

export type FeatureKey = (typeof FEATURES)[number][0];
export type Features = Record<FeatureKey, boolean>;

/** Toute clé absente est considérée active (préserve le fonctionnement existant). */
export function featuresOf(raw: unknown): Features {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return Object.fromEntries(FEATURES.map(([k]) => [k, o[k] !== false])) as Features;
}

export const FEATURE_OFF_MESSAGE = "Module non inclus dans votre abonnement";
