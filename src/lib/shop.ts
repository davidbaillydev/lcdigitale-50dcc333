// Règles d'un restaurant : horaires, créneaux, livraison (config stockée par restaurant)
export type Zone = { cp: string; city: string };
export type DeliveryConfig = { minOrder: number; fee: number; freeFrom: number; zones: Zone[]; geoZones?: import("./geo").GeoZone[]; origin?: import("./geo").LatLng };
export type Restaurant = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  menu_key: string;
  logo_url: string | null;
  menu: import("./menu").Category[] | null;
  vapi_assistant_id?: string | null;
  vapi_public_key?: string | null;
  vapi_phone_number?: string | null;
  is_vapi_web_enabled?: boolean;
  brand: { primary?: string; accent?: string; bannerPath?: string };
  legal?: import("./legal").LegalInfo;
  enabled_features?: Partial<import("./features").Features>;
  /** 0 = dimanche. Plages en minutes depuis minuit (heure de Paris) */
  opening: Record<string, [number, number][]>;
  delivery: DeliveryConfig;
  config: {
    slotMinutes?: number; lead?: { pickup: number; delivery: number }; hoursLabel?: string; tagline?: string;
    /** Commandes acceptées automatiquement (sinon validation manuelle en cuisine) */
    autoAccept?: boolean;
    printing?: Partial<import("./ticket").PrintingConfig>;
    modes?: { pickup?: boolean; delivery?: boolean; dine_in?: boolean };
    payments?: { on_site?: boolean; counter?: boolean; card_terminal?: boolean };
    marketing?: import("./promo").Marketing;
    serviceFee?: Partial<import("./service-fee").ServiceFeeConfig>;
    /** Menu QR par table (nombre de tables) et lien d'avis Google proposé après la commande */
    embed?: { label: string; color: string; position: "right" | "left"; mode: "floating" | "inline"; domains: string[] };
    qr?: { tables?: number; reviewUrl?: string; room?: boolean; self?: boolean; tableValidation?: boolean };
    /** Moment de commande (ASAP / planifiée) et acceptation en cuisine */
    timing?: TimingConfig;
    reservations?: { enabled?: boolean; noShowFee?: number; maxParty?: number };
  };
};

export type TimingConfig = { asap?: boolean; scheduled?: boolean; prepMode?: "auto" | "manual"; defaultPrep?: number };
export function timingOf(r: Pick<Restaurant, "config">) {
  const t = r.config?.timing ?? {};
  let asap = t.asap !== false, scheduled = t.scheduled !== false;
  if (!asap && !scheduled) { asap = true; scheduled = true; }
  return { asap, scheduled, prepMode: t.prepMode === "manual" ? "manual" as const : "auto" as const, defaultPrep: t.defaultPrep ?? 20 };
}

export const RESTAURANT_COLUMNS = "id, slug, name, city, address, phone, email, menu_key, logo_url, brand, menu, opening, delivery, config, legal, enabled_features, vapi_assistant_id, vapi_public_key, vapi_phone_number, is_vapi_web_enabled";

export function deliveryFee(r: Restaurant, subtotal: number) {
  return subtotal >= r.delivery.freeFrom ? 0 : r.delivery.fee;
}

const TZ = "Europe/Paris";
function parisParts(d: Date) {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });
  const p: Record<string, string> = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  const g = (k: string) => p[k] ?? "0";
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(g("weekday"));
  return { wd, minutes: (+g("hour") % 24) * 60 + +g("minute") };
}

/** Créneaux disponibles aujourd'hui (ISO strings) */
export function availableSlots(r: Restaurant, mode: "pickup" | "delivery", now = new Date()): string[] {
  const step = r.config.slotMinutes ?? 20;
  const lead = r.config.lead ?? { pickup: 20, delivery: 40 };
  const { wd, minutes } = parisParts(now);
  const earliest = minutes + lead[mode];
  const out: string[] = [];
  for (const [start, end] of r.opening[String(wd)] ?? []) {
    for (let m = start + (mode === "delivery" ? step : 0); m <= end; m += step) {
      if (m >= earliest) out.push(new Date(now.getTime() + (m - minutes) * 60000).toISOString().slice(0, 16) + ":00.000Z");
    }
  }
  return out;
}

export function isValidSlot(r: Restaurant, mode: "pickup" | "delivery", iso: string) {
  const t = new Date(iso).getTime();
  return availableSlots(r, mode).some((s) => Math.abs(new Date(s).getTime() - t) < 60000);
}

/** Le restaurant est-il ouvert maintenant (et encore assez longtemps pour préparer) ? */
export function isOpenNow(r: Restaurant, mode: "pickup" | "delivery", now = new Date()) {
  const lead = (r.config.lead ?? { pickup: 20, delivery: 40 })[mode];
  const { wd, minutes } = parisParts(now);
  return (r.opening[String(wd)] ?? []).some(([a, b]) => minutes >= a && minutes + lead <= b + 15);
}
export const asapSlot = (r: Restaurant, mode: "pickup" | "delivery", now = new Date()) =>
  new Date(now.getTime() + (r.config.lead ?? { pickup: 20, delivery: 40 })[mode] * 60000).toISOString();

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

/** Un mode/paiement est actif sauf s'il a été explicitement désactivé */
export const modeEnabled = (r: Restaurant, m: "pickup" | "delivery" | "dine_in") => r.config.modes?.[m] !== false;
export const paymentEnabled = (r: Restaurant, p: "on_site" | "counter" | "card_terminal") => r.config.payments?.[p] !== false;
