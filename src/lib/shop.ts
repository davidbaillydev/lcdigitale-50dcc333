// Règles d'un restaurant : horaires, créneaux, livraison (config stockée par restaurant)
export type Zone = { cp: string; city: string };
export type DeliveryConfig = { minOrder: number; fee: number; freeFrom: number; zones: Zone[] };
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
  brand: { primary?: string; accent?: string };
  /** 0 = dimanche. Plages en minutes depuis minuit (heure de Paris) */
  opening: Record<string, [number, number][]>;
  delivery: DeliveryConfig;
  config: { slotMinutes?: number; lead?: { pickup: number; delivery: number }; hoursLabel?: string; tagline?: string };
};

export const RESTAURANT_COLUMNS = "id, slug, name, city, address, phone, email, menu_key, logo_url, brand, opening, delivery, config";

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

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
