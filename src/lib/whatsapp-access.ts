import { serviceFeeDefaults, type ServiceFeeConfig } from "./service-fee";
import type { DeliveryConfig } from "./shop";

export type WhatsAppRestaurant = {
  name: string;
  slug: string;
  phone: string | null;
  config: { ordersPaused?: boolean; serviceFee?: Partial<ServiceFeeConfig> };
  delivery?: DeliveryConfig | null;
};

// Shared public origin, never the temporary preview or a restaurant-only domain.
const PUBLIC_ORIGIN = "https://lcdigitale.lovable.app";

const euros = (value: number) => `${value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
export function configuredDeliveryRates(delivery?: DeliveryConfig | null) {
  if (!delivery) return [];
  const zones = delivery.geoZones ?? [];
  return zones.length
    ? zones.map((zone) => ({ name: zone.name, fee: zone.fee, freeFrom: zone.freeFrom > 0 ? zone.freeFrom : null, minOrder: zone.minOrder, tiers: zone.tiers ?? [] }))
    : [{ name: "Livraison", fee: delivery.fee, freeFrom: delivery.freeFrom, minOrder: delivery.minOrder, tiers: [] }];
}

export function deliveryRateLabels(delivery?: DeliveryConfig | null) {
  return configuredDeliveryRates(delivery).map((rate) => `${rate.name} : ${euros(rate.fee)} de livraison, ${rate.freeFrom === null ? "sans seuil de gratuité" : `offerte dès ${euros(rate.freeFrom)}`}, minimum ${euros(rate.minOrder)}${rate.tiers.map((tier) => ` ; dès ${euros(tier.from)}, livraison ${euros(tier.fee)}`).join("")}`);
}

export function configuredServiceFee(config?: Partial<ServiceFeeConfig>) {
  const fee = serviceFeeDefaults(config);
  return { ...fee, activeChannels: fee.enabled && fee.value > 0 ? (Object.keys(fee.modes) as Array<keyof typeof fee.modes>).filter((channel) => fee.modes[channel]) : [] };
}

export function serviceFeeRateLabel(config?: Partial<ServiceFeeConfig>) {
  const fee = configuredServiceFee(config);
  if (!fee.activeChannels.length) return "Frais de service : désactivés";
  const channels = { delivery: "livraison", pickup: "retrait", dine_in: "sur place", kiosk: "borne" };
  const amount = fee.kind === "percent" ? `${fee.value.toLocaleString("fr-FR")} % du sous-total` : `${euros(fee.value)} par commande`;
  return `Frais de service : ${amount} · ${fee.activeChannels.map((channel) => channels[channel]).join(", ")}`;
}

/** Plain text only; clickable preview recognizes HTTP(S), never HTML or script URLs. */
export function whatsappMessageParts(message: string) {
  return message.split(/(https?:\/\/[^\s<>]+)/g).filter(Boolean).map((text) => ({ text, href: /^https?:\/\/[^\s<>]+$/.test(text) ? text : null }));
}

export function deliveryServiceFeeSummary(config?: Partial<ServiceFeeConfig>) {
  const fee = serviceFeeDefaults(config);
  if (!fee.enabled || !fee.modes.delivery || fee.value <= 0) {
    return "Aucun frais de service n’est actuellement appliqué sur la livraison.";
  }
  const amount = fee.kind === "percent"
    ? `${fee.value.toLocaleString("fr-FR")} % du sous-total`
    : `${fee.value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € par commande`;
  return `Frais de service appliqués sur la livraison : ${amount}, distincts des frais de livraison et affichés au client avant le paiement.`;
}

export function buildWhatsAppOnboarding(restaurant: WhatsAppRestaurant) {
  const slug = encodeURIComponent(restaurant.slug);
  const workspace = `${PUBLIC_ORIGIN}/espace/${slug}`;
  return `Bonjour ${restaurant.name} !

Voici vos accès à la plateforme LC Digitale pour ${restaurant.name} (/${restaurant.slug}). Connectez-vous avec votre compte invité ; chaque membre conserve les accès autorisés pour son rôle.

🍳 Espace Cuisine & commandes
${workspace}

🚚 Livraison & livreurs
${workspace}/livraison

🍽️ Carte
${workspace}/carte

⚙️ Réglages
${workspace}/reglages

🚚 Tarifs de livraison configurés
${deliveryRateLabels(restaurant.delivery).join("\n") || "Tarifs de livraison non renseignés."}
${restaurant.delivery?.geoZones?.length ? "Le tarif dépend de l’adresse et de la zone de livraison." : ""}

💳 Frais de service configurés
${serviceFeeRateLabel(restaurant.config.serviceFee)}
${deliveryServiceFeeSummary(restaurant.config.serviceFee)}
Lorsqu’ils sont activés, ces frais accompagnent la sécurisation du paiement par carte bancaire (CB) et la protection des données.

👥 Mise en place des livreurs
1. Ouvrez « Livraison & livreurs », puis l’onglet « Équipe & Livreurs ».
2. Dans « Équipe de livraison », saisissez le nom de chaque livreur, cliquez sur « Ajouter » et vérifiez qu’il est actif.
3. Dans « Accès livreurs », choisissez un PIN de 4 à 6 chiffres et cliquez sur « Définir ». Sans PIN actif, l’écran livreur reste fermé.
4. Communiquez le PIN séparément aux livreurs autorisés. Ils ouvrent le lien ci-dessous, saisissent le PIN et sélectionnent leur nom.

📲 Lien direct livreur
${PUBLIC_ORIGIN}/livreur?r=${slug}

🛍️ Lien de commande client à partager
${PUBLIC_ORIGIN}/${slug}

L’équipe LC Digitale`;
}

/** Local French numbers become international; explicit international prefixes are preserved. */
export function normalizeWhatsAppPhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (phone.trim().startsWith("00")) digits = digits.slice(2);
  else if (/^0[1-9]\d{8}$/.test(digits)) digits = `33${digits.slice(1)}`;
  return digits;
}

export function whatsappUrl(phone: string, message: string): string {
  const digits = normalizeWhatsAppPhone(phone);
  return `https://wa.me/${digits ? digits : ""}?text=${encodeURIComponent(message)}`;
}