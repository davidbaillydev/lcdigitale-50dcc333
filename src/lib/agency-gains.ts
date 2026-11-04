// Agrégation pure des gains agence (frais de service) — testable sans réseau.

export type GainOrderRow = {
  id?: string;
  order_number?: number;
  payment_status?: string;
  payment_method?: string;
  payment_ref?: string | null;
  platform_fee?: number | null;
  refunded_amount?: number | null;
  delivery_fee?: number | null;
  discount?: number | null;
  source?: string;
  mode?: string;
  is_test?: boolean;
  restaurant_id: string;
  service_fee: number | null;
  total: number | null;
  status: string;
  created_at: string;
};

export type RestaurantGains = {
  restaurantId: string;
  orders: number;
  serviceFees: number;
  revenue: number;
};

export type AgencyGains = {
  orders: number;
  serviceFees: number;
  revenue: number;
  perRestaurant: RestaurantGains[];
};

const EXCLUDED_STATUSES = new Set(["cancelled", "awaiting_payment", "no_show"]);

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Agrège les commandes payées/valides : frais de service et chiffre d'affaires par restaurant. */
export function aggregateGains(rows: GainOrderRow[]): AgencyGains {
  const per = new Map<string, RestaurantGains>();
  let orders = 0;
  let serviceFees = 0;
  let revenue = 0;
  for (const r of rows) {
    if (r.is_test || EXCLUDED_STATUSES.has(r.status)) continue;
    const fee = Number(r.service_fee ?? 0) || 0;
    const tot = Number(r.total ?? 0) || 0;
    orders += 1;
    serviceFees += fee;
    revenue += tot;
    const cur = per.get(r.restaurant_id) ?? { restaurantId: r.restaurant_id, orders: 0, serviceFees: 0, revenue: 0 };
    cur.orders += 1;
    cur.serviceFees += fee;
    cur.revenue += tot;
    per.set(r.restaurant_id, cur);
  }
  const perRestaurant = [...per.values()]
    .map((g) => ({ ...g, serviceFees: round2(g.serviceFees), revenue: round2(g.revenue) }))
    .sort((a, b) => b.serviceFees - a.serviceFees);
  return { orders, serviceFees: round2(serviceFees), revenue: round2(revenue), perRestaurant };
}

/** Regroupe les frais de service par jour (YYYY-MM-DD) pour un graphique simple. */
export function gainsByDay(rows: GainOrderRow[]): { day: string; serviceFees: number }[] {
  const per = new Map<string, number>();
  for (const r of rows) {
    if (r.is_test || EXCLUDED_STATUSES.has(r.status)) continue;
    const day = r.created_at.slice(0, 10);
    per.set(day, (per.get(day) ?? 0) + (Number(r.service_fee ?? 0) || 0));
  }
  return [...per.entries()]
    .map(([day, serviceFees]) => ({ day, serviceFees: round2(serviceFees) }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

export type PaymentTotals = {
  orders: number; paidOrders: number; paid: number; unpaid: number;
  serviceFees: number; paidServiceFees: number; platformFees: number;
  refunds: number; deliveryFees: number; discounts: number; restaurantBalanceEstimate: number;
};

export function paymentProvider(ref?: string | null): string {
  if (ref?.startsWith("mollie_term:")) return "Mollie TPE";
  if (ref?.startsWith("mollie:")) return "Mollie";
  if (ref?.startsWith("pi_") || ref?.startsWith("cs_")) return "Stripe";
  if (ref?.startsWith("paypal:")) return "PayPal";
  if (ref?.startsWith("lyra:")) return "Lyra";
  return "Non identifié";
}

export function orderChannel(row: GainOrderRow): string {
  return row.source === "kiosk" ? "kiosk" : row.mode ?? "unknown";
}

/** Historical snapshots only: never recalculate commissions with today's configuration. */
export function paymentDetails(rows: GainOrderRow[]) {
  const valid = rows.filter((r) => !r.is_test && !EXCLUDED_STATUSES.has(r.status));
  const totals: PaymentTotals = { orders: valid.length, paidOrders: 0, paid: 0, unpaid: 0, serviceFees: 0, paidServiceFees: 0, platformFees: 0, refunds: 0, deliveryFees: 0, discounts: 0, restaurantBalanceEstimate: 0 };
  for (const r of valid) {
    const paid = ["paid", "partially_refunded", "refunded"].includes(r.payment_status ?? "");
    const total = Number(r.total ?? 0), fee = Number(r.service_fee ?? 0);
    totals.serviceFees += fee;
    totals.deliveryFees += Number(r.delivery_fee ?? 0);
    totals.discounts += Number(r.discount ?? 0);
    if (paid) {
      totals.paidOrders += 1;
      totals.paid += total;
      totals.paidServiceFees += fee;
      const commission = paymentProvider(r.payment_ref) === "Mollie" ? Number(r.platform_fee ?? 0) : 0;
      const refunded = Number(r.refunded_amount ?? 0);
      totals.platformFees += commission;
      totals.refunds += refunded;
      totals.restaurantBalanceEstimate += total - refunded - commission;
    } else totals.unpaid += total;
  }
  for (const key of Object.keys(totals) as (keyof PaymentTotals)[]) totals[key] = round2(totals[key]);
  return { ...totals, channels: [...new Set(valid.map(orderChannel))].map((channel) => ({ channel, orders: valid.filter((r) => orderChannel(r) === channel).length, total: round2(valid.filter((r) => orderChannel(r) === channel).reduce((s, r) => s + Number(r.total ?? 0), 0)) })) };
}

/** Jour calendaire Europe/Paris (YYYY-MM-DD) d'un horodatage ISO. */
export function parisDay(iso: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

export const OFFLINE_POTENTIAL_RATE = 0.07;
const PAID_STATES = ["paid", "partially_refunded", "refunded"];
const isInHand = (r: GainOrderRow) => r.payment_method === "on_site" || r.payment_method === "counter" || r.payment_method === "card_terminal";

export type DailyGains = {
  day: string; orders: number; revenue: number; online: number; inHand: number;
  commission: number; offlinePotential: number; serviceFees: number;
};

/**
 * Vue jour par jour (Paris). commission = platform_fee Mollie enregistrée sur paiements réglés.
 * offlinePotential = 7 % indicatif du total des commandes sans commission enregistrée (non facturé).
 */
export function dailyGains(rows: GainOrderRow[]): DailyGains[] {
  const per = new Map<string, DailyGains>();
  for (const r of rows) {
    if (r.is_test || EXCLUDED_STATUSES.has(r.status)) continue;
    const day = parisDay(r.created_at);
    const d = per.get(day) ?? { day, orders: 0, revenue: 0, online: 0, inHand: 0, commission: 0, offlinePotential: 0, serviceFees: 0 };
    const total = Number(r.total ?? 0) || 0;
    const paid = PAID_STATES.includes(r.payment_status ?? "");
    const commission = paid && (r.payment_ref ? paymentProvider(r.payment_ref) : (r as { provider?: string }).provider) === "Mollie" ? Number(r.platform_fee ?? 0) || 0 : 0;
    d.orders += 1; d.revenue += total; d.serviceFees += Number(r.service_fee ?? 0) || 0;
    if (isInHand(r)) d.inHand += total; else d.online += total;
    d.commission += commission;
    if (commission === 0) d.offlinePotential += total * OFFLINE_POTENTIAL_RATE;
    per.set(day, d);
  }
  return [...per.values()].map((d) => ({ ...d, revenue: round2(d.revenue), online: round2(d.online), inHand: round2(d.inHand), commission: round2(d.commission), offlinePotential: round2(d.offlinePotential), serviceFees: round2(d.serviceFees) })).sort((a, b) => b.day.localeCompare(a.day));
}

/** Bornes de période en jours Paris. */
export function periodRange(key: string, now = new Date()): { from: string; to: string } {
  const today = parisDay(now);
  const shift = (n: number) => { const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  if (key === "today") return { from: today, to: today };
  if (key === "yesterday") return { from: shift(1), to: shift(1) };
  if (key === "month") return { from: `${today.slice(0, 7)}-01`, to: today };
  return { from: shift((Number(key) || 30) - 1), to: today };
}

/** Bornes (Paris) d'un mois "YYYY-MM" : du 1er au dernier jour, plafonné à aujourd'hui. */
export function monthRange(month: string, now = new Date()): { from: string; to: string } {
  const [y = 0, m = 1] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const today = parisDay(now);
  return { from: `${month}-01`, to: last < today ? last : today };
}

/** Les N derniers mois (Paris), du plus récent au plus ancien. */
export function recentMonths(n: number, now = new Date()): string[] {
  const [y = 0, m = 1] = parisDay(now).split("-").map(Number);
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 7));
}

export type MonthlyCommissionRow = {
  restaurantId: string; name: string; company: string; siret: string; seat: string; vat: string;
  orders: number; base: number; commission: number;
};

/** Commission Mollie enregistrée par restaurant (commandes réglées, snapshots historiques). */
export function monthlyCommissions(rows: GainOrderRow[], restaurants: { restaurantId: string; name: string; legal?: { company?: string; siret?: string; seat?: string; vat?: string } | null }[]): MonthlyCommissionRow[] {
  return restaurants.map((r) => {
    const own = rows.filter((o) => o.restaurant_id === r.restaurantId && !o.is_test && !EXCLUDED_STATUSES.has(o.status)
      && ["paid", "partially_refunded", "refunded"].includes(o.payment_status ?? "")
      && paymentProvider(o.payment_ref) === "Mollie" && Number(o.platform_fee ?? 0) > 0);
    return {
      restaurantId: r.restaurantId, name: r.name,
      company: r.legal?.company ?? "", siret: r.legal?.siret ?? "", seat: r.legal?.seat ?? "", vat: r.legal?.vat ?? "",
      orders: own.length,
      base: round2(own.reduce((s, o) => s + Number(o.total ?? 0), 0)),
      commission: round2(own.reduce((s, o) => s + Number(o.platform_fee ?? 0), 0)),
    };
  }).filter((r) => r.commission > 0).sort((a, b) => b.commission - a.commission);
}
