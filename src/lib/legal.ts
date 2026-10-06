// Modèles de pages légales (LCEN, RGPD, Code de la consommation) remplis avec les infos du restaurant.
import type { Restaurant } from "./shop";

export type LegalInfo = {
  company?: string; form?: string; capital?: string; siret?: string; rcs?: string; vat?: string;
  representative?: string; dpoEmail?: string; mediator?: string; mediatorUrl?: string;
  host?: string; updatedAt?: string; vatRate?: string; seat?: string;
};

export const DEFAULT_HOST = "Lovable Labs Inc. — infrastructure Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, États-Unis";
export const TEMPLATE_VERSION = "2026.10";

export const LEGAL_FIELDS: { key: keyof LegalInfo; label: string; required?: boolean; placeholder?: string }[] = [
  { key: "company", label: "Raison sociale", required: true, placeholder: "SARL Wok & Sushi" },
  { key: "form", label: "Forme juridique", required: true, placeholder: "SARL, SAS, EI…" },
  { key: "capital", label: "Capital social", placeholder: "10 000 €" },
  { key: "siret", label: "SIRET", required: true, placeholder: "123 456 789 00012" },
  { key: "seat", label: "Adresse du siège social", placeholder: "12 rue …, 31770 Colomiers" },
  { key: "rcs", label: "RCS (ville)", placeholder: "Toulouse" },
  { key: "vat", label: "N° TVA intracommunautaire", placeholder: "FR12 123456789" },
  { key: "representative", label: "Représentant légal / directeur de publication", required: true },
  { key: "dpoEmail", label: "Email contact données personnelles", required: true },
  { key: "mediator", label: "Médiateur de la consommation", required: true, placeholder: "CM2C" },
  { key: "mediatorUrl", label: "Site du médiateur", placeholder: "https://www.cm2c.net" },
  { key: "host", label: "Hébergeur" },
  { key: "vatRate", label: "Taux de TVA restauration (%) — factures", placeholder: "10" },
];

export const missingLegal = (l: LegalInfo) => LEGAL_FIELDS.filter((f) => f.required && !String(l[f.key] ?? "").trim()).map((f) => f.label);
export const cgvVersion = (l: LegalInfo) => `${TEMPLATE_VERSION}-${(l.updatedAt ?? "init").slice(0, 10)}`;

export type LegalDocKey = "mentions-legales" | "confidentialite" | "cgv" | "cookies";
export type Section = { title: string; body: string[] };
export const DOC_TITLES: Record<LegalDocKey, string> = {
  "mentions-legales": "Mentions légales",
  confidentialite: "Politique de confidentialité",
  cgv: "Conditions générales de vente",
  cookies: "Cookies et traceurs",
};

const v = (s: string | undefined, fb = "[à compléter]") => (s && s.trim()) || fb;

export function buildLegalDoc(r: Restaurant, key: LegalDocKey): Section[] {
  const l = (r.legal ?? {}) as LegalInfo;
  const company = v(l.company, r.name);
  const addr = [r.address, r.city].filter(Boolean).join(", ") || "[adresse à compléter]";
  const contact = v(l.dpoEmail, r.email ?? "[email à compléter]");
  const delivery = r.config.modes?.delivery !== false && (r.delivery?.zones?.length ?? 0) > 0;
  const voice = !!(r.is_vapi_web_enabled || r.vapi_phone_number);
  const marketing = !!r.config.marketing;
  const identity = `${company}${l.form ? `, ${l.form}` : ""}${l.capital ? ` au capital de ${l.capital}` : ""}, siège : ${addr}.`;

  if (key === "mentions-legales") return [
    { title: "Éditeur du site", body: [identity, `SIRET : ${v(l.siret)}${l.rcs ? ` — RCS ${l.rcs}` : ""}.`, `TVA intracommunautaire : ${v(l.vat, "non applicable")}.`, `Téléphone : ${v(r.phone ?? undefined)} — Email : ${contact}.`] },
    { title: "Directeur de la publication", body: [v(l.representative)] },
    { title: "Hébergement", body: [v(l.host, DEFAULT_HOST)] },
    { title: "Réalisation", body: ["Site de commande réalisé par LC Digitale (La Communication Digitale)."] },
    { title: "Propriété intellectuelle", body: [`Les textes, photos, logos et marques présents sur ce site sont la propriété de ${company} ou de leurs titulaires. Toute reproduction sans autorisation est interdite.`] },
    { title: "Données personnelles", body: ["Le traitement de vos données est décrit dans notre politique de confidentialité."] },
  ];

  if (key === "confidentialite") return [
    { title: "Responsable du traitement", body: [`${company}, ${addr}. Contact : ${contact}.`] },
    { title: "Données collectées", body: [
      "Commande : nom, téléphone, email (facultatif), contenu de la commande, créneau, notes.",
      ...(delivery ? ["Livraison : adresse et code postal."] : []),
      "Paiement : traité directement par le prestataire de paiement ; nous ne conservons jamais vos numéros de carte.",
      ...(voice ? ["Commande vocale (assistant Kaito) : enregistrement et transcription de l'appel, numéro appelant."] : []),
      ...(marketing ? ["Offres : email et téléphone uniquement si vous avez donné votre accord."] : []),
    ] },
    { title: "Finalités et bases légales", body: [
      "Préparer, livrer et facturer votre commande — exécution du contrat.",
      "Respecter nos obligations comptables et fiscales — obligation légale.",
      "Prévenir la fraude et sécuriser le service — intérêt légitime.",
      ...(marketing ? ["Vous envoyer nos offres — consentement, retirable à tout moment via le lien de désabonnement."] : []),
    ] },
    { title: "Durées de conservation", body: [
      "Données de commande : 3 ans après la dernière commande.",
      "Pièces comptables et factures : 10 ans (Code de commerce, art. L123-22).",
      "Prospection : 3 ans après le dernier contact.",
      ...(voice ? ["Enregistrements d'appels : 30 jours."] : []),
      "Consentement cookies : 6 mois.",
    ] },
    { title: "Destinataires et sous-traitants", body: [
      `Le personnel de ${company} et LC Digitale (maintenance de la plateforme).`,
      "Hébergement et base de données : Lovable / Cloudflare / Supabase.",
      "Paiement en ligne (selon votre choix) : Stripe, PayPal, Lyra / PayZen, SumUp.",
      ...(marketing ? ["Emails : Brevo (Sendinblue), France."] : []),
      ...(voice ? ["Assistant vocal : Vapi, États-Unis."] : []),
      "Les transferts hors Union européenne sont encadrés par les clauses contractuelles types de la Commission européenne ou le Data Privacy Framework.",
    ] },
    { title: "Vos droits", body: [
      "Vous disposez des droits d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité de vos données, ainsi que du droit de retirer votre consentement.",
      `Pour les exercer : ${contact}. Réponse sous un mois.`,
      "Vous pouvez introduire une réclamation auprès de la CNIL (www.cnil.fr).",
    ] },
  ];

  if (key === "cookies") return [
    { title: "Traceurs indispensables (sans consentement)", body: ["Panier, langue, thème clair/sombre, numéro de table, mémorisation de vos choix de cookies et sécurité du paiement."] },
    { title: "Traceurs soumis à votre accord", body: [
      "Mesure d'audience : statistiques anonymes de fréquentation.",
      ...(voice ? ["Assistant vocal Kaito : chargement du service Vapi (micro activé seulement si vous lancez l'appel)."] : []),
    ] },
    { title: "Gérer vos choix", body: ["Votre choix est conservé 6 mois. Vous pouvez le modifier à tout moment via le lien « Gérer les cookies » en bas de page."] },
  ];

  return [
    { title: "Objet", body: [`Les présentes conditions régissent les commandes passées sur le site de ${r.name}, exploité par ${identity}`] },
    { title: "Produits et allergènes", body: ["Les plats sont décrits avec le plus grand soin. Les 14 allergènes réglementaires (règlement UE n°1169/2011) sont indiqués sur chaque plat lorsqu'ils sont renseignés ; en cas de doute, contactez le restaurant avant de commander.", "Photos non contractuelles. Plats proposés dans la limite des stocks disponibles."] },
    { title: "Prix", body: ["Les prix sont indiqués en euros, toutes taxes comprises (TVA incluse).", ...(delivery ? [`Les frais de livraison éventuels sont affichés avant validation (minimum de commande : ${r.delivery.minOrder} €).`] : [])] },
    { title: "Commande", body: ["La commande est ferme après validation et, le cas échéant, paiement. Un numéro de commande et une page de suivi vous sont communiqués.", "Le restaurant peut refuser une commande en cas de rupture, de fermeture ou de motif légitime ; vous êtes alors remboursé intégralement."] },
    { title: "Paiement", body: ["Paiement en ligne sécurisé (carte bancaire, Apple Pay, Google Pay, PayPal selon disponibilité) ou sur place lors du retrait / de la livraison si cette option est proposée."] },
    { title: delivery ? "Retrait et livraison" : "Retrait", body: [
      "Les horaires indiqués sont estimatifs. Le client s'engage à être présent au créneau choisi.",
      ...(delivery ? [`Zones desservies : ${r.delivery.zones.map((z) => `${z.city} (${z.cp})`).join(", ")}.`] : []),
    ] },
    { title: "Droit de rétractation", body: ["Conformément à l'article L221-28 du Code de la consommation, le droit de rétractation ne s'applique pas aux denrées alimentaires susceptibles de se détériorer rapidement."] },
    { title: "Réclamations", body: [`Toute réclamation est à adresser au restaurant : ${v(r.phone ?? undefined)} — ${contact}, si possible le jour de la commande.`] },
    { title: "Médiation", body: [`En cas de litige non résolu, vous pouvez recourir gratuitement au médiateur de la consommation : ${v(l.mediator)}${l.mediatorUrl ? ` (${l.mediatorUrl})` : ""}. Plateforme européenne : https://ec.europa.eu/consumers/odr.`] },
    { title: "Données personnelles", body: ["Voir notre politique de confidentialité."] },
    { title: "Droit applicable", body: ["Les présentes conditions sont soumises au droit français."] },
  ];
}
