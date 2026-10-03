// Règles du restaurant : horaires, créneaux, livraison
export const RESTAURANT = {
  name: "Wok & Sushi",
  city: "Colomiers",
  phone: "05 00 00 00 00",
};

// 0 = dimanche. Plages en minutes depuis minuit (heure de Paris)
export const OPENING: Record<number, [number, number][]> = {
  0: [[18 * 60, 22 * 60 + 30]],
  1: [[11 * 60 + 30, 14 * 60 + 30], [18 * 60, 22 * 60 + 30]],
  2: [[11 * 60 + 30, 14 * 60 + 30], [18 * 60, 22 * 60 + 30]],
  3: [[11 * 60 + 30, 14 * 60 + 30], [18 * 60, 22 * 60 + 30]],
  4: [[11 * 60 + 30, 14 * 60 + 30], [18 * 60, 22 * 60 + 30]],
  5: [[11 * 60 + 30, 14 * 60 + 30], [18 * 60, 23 * 60]],
  6: [[11 * 60 + 30, 14 * 60 + 30], [18 * 60, 23 * 60]],
};
export const SLOT_MINUTES = 20;
export const LEAD = { pickup: 20, delivery: 40 }; // délai mini avant 1er créneau

export const DELIVERY = {
  minOrder: 20,
  fee: 2.5,
  freeFrom: 40,
  zones: [
    { cp: "31770", city: "Colomiers" },
    { cp: "31820", city: "Pibrac" },
    { cp: "31700", city: "Cornebarrieu / Blagnac" },
    { cp: "31170", city: "Tournefeuille" },
    { cp: "31490", city: "Léguevin / Brax" },
    { cp: "31300", city: "Toulouse Purpan / Saint-Martin" },
  ],
};

export function deliveryFee(subtotal: number) {
  return subtotal >= DELIVERY.freeFrom ? 0 : DELIVERY.fee;
}

const TZ = "Europe/Paris";
function parisParts(d: Date) {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { wd, minutes: (+p.hour % 24) * 60 + +p.minute };
}

/** Créneaux disponibles aujourd'hui (ISO strings) */
export function availableSlots(mode: "pickup" | "delivery", now = new Date()): string[] {
  const { wd, minutes } = parisParts(now);
  const earliest = minutes + LEAD[mode];
  const out: string[] = [];
  for (const [start, end] of OPENING[wd] ?? []) {
    for (let m = start + (mode === "delivery" ? 20 : 0); m <= end; m += SLOT_MINUTES) {
      if (m >= earliest) out.push(new Date(now.getTime() + (m - minutes) * 60000).toISOString().slice(0, 16) + ":00.000Z");
    }
  }
  return out;
}

export function isValidSlot(mode: "pickup" | "delivery", iso: string) {
  const t = new Date(iso).getTime();
  return availableSlots(mode).some((s) => Math.abs(new Date(s).getTime() - t) < 60000);
}

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
