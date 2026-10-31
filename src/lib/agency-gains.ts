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

const EXCLUDED_STATUSES = new Set(["cancelled", "awaiting_payment"]);

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
