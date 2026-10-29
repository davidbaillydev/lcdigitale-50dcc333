// Agrégation pure des gains agence (frais de service) — testable sans réseau.

export type GainOrderRow = {
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
