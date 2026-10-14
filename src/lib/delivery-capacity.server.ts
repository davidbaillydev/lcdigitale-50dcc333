import { capacityBucket, capacityLimit, capacityOf, type Restaurant } from "./shop";

/** Charge des créneaux de livraison du jour (commandes non annulées). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function deliveryLoad(admin: any, r: Pick<Restaurant, "id" | "delivery">) {
  const cap = capacityOf(r);
  if (!cap.enabled) return { limit: null as number | null, minutes: cap.slotMinutes, counts: {} as Record<string, number> };
  const { count } = await admin.from("restaurant_drivers").select("id", { count: "exact", head: true }).eq("restaurant_id", r.id).eq("active", true);
  const from = new Date(Date.now() - 3 * 3600_000).toISOString();
  const to = new Date(Date.now() + 24 * 3600_000).toISOString();
  const { data } = await admin.from("orders").select("slot, status").eq("restaurant_id", r.id).eq("mode", "delivery").gte("slot", from).lte("slot", to).not("status", "in", "(cancelled,rejected)");
  const counts: Record<string, number> = {};
  for (const o of (data ?? []) as { slot: string }[]) { const k = capacityBucket(o.slot, cap.slotMinutes); counts[k] = (counts[k] ?? 0) + 1; }
  return { limit: capacityLimit(cap, count ?? 0), minutes: cap.slotMinutes, counts };
}
export const isFull = (load: Awaited<ReturnType<typeof deliveryLoad>>, iso: string) =>
  load.limit !== null && (load.counts[capacityBucket(iso, load.minutes)] ?? 0) >= load.limit;
