import { serviceFeeDefaults, type ServiceFeeConfig } from "./service-fee";

export type WhatsAppRestaurant = {
  name: string;
  slug: string;
  phone: string | null;
  config: { ordersPaused?: boolean; serviceFee?: Partial<ServiceFeeConfig> };
};

// Shared public origin, never the temporary preview or a restaurant-only domain.
const PUBLIC_ORIGIN = "https://lcdigitale.lovable.app";

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

💳 Frais de service sur la livraison
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