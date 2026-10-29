// Autocomplétion d'adresses via la Base Adresse Nationale (api-adresse.data.gouv.fr) —
// adresses officielles françaises, gratuite, sans clé. Helpers purs, partagés et testables.

export type BanFeature = {
  properties?: {
    label?: string;
    housenumber?: string;
    street?: string;
    name?: string;
    postcode?: string;
    city?: string;
  };
  geometry?: { coordinates?: [number, number] };
};

export type BanAddress = {
  /** Numéro + rue (ex : « 12 rue des Lilas ») */
  address: string;
  postcode: string;
  city: string;
  lat: number;
  lng: number;
  /** Libellé complet affiché dans les suggestions */
  label: string;
};

/** URL de recherche BAN : 5 suggestions, mode autocomplétion (tolère la saisie partielle). */
export const banSearchUrl = (q: string) =>
  `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=5&autocomplete=1`;

/** Transforme une réponse BAN en adresse exploitable par le tunnel de commande. */
export function banFeatureToAddress(f: BanFeature): BanAddress {
  const p = f.properties ?? {};
  const [lng, lat] = f.geometry?.coordinates ?? [0, 0];
  const street = [p.housenumber, p.street ?? p.name].filter(Boolean).join(" ").trim();
  const firstLine = (p.label ?? "").split(",")[0]?.trim() ?? "";
  return {
    address: street || firstLine,
    postcode: p.postcode ?? "",
    city: p.city ?? "",
    lat,
    lng,
    label: p.label ?? street,
  };
}

/** Zone « par code postal » correspondant à une adresse (null si hors zone). */
export const matchCpZone = <T extends { cp: string }>(zones: T[], postcode: string) =>
  zones.find((z) => z.cp === postcode) ?? null;
