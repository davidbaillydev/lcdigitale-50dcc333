import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aggregateGains, gainsByDay, paymentDetails, type GainOrderRow } from "@/lib/agency-gains";
import type { Restaurant } from "@/lib/shop";
import type { PlatformFeeConfig } from "@/lib/platform-fee";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAgency(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Réservé à l'agence");
}

const input = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const getAgencyGains = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    await assertAgency(context.supabase, context.userId);
    const from = `${data.from}T00:00:00.000Z`;
    const to = `${data.to}T23:59:59.999Z`;
    const { data: rs, error: restaurantError } = await context.supabase.from("restaurants").select("id, name, slug, config, active").order("name");
    if (restaurantError) throw new Error("Impossible de charger les restaurants.");
    const rows: GainOrderRow[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data: orders, error } = await context.supabase.from("orders")
        .select("id, order_number, restaurant_id, service_fee, total, status, created_at, payment_status, payment_method, payment_ref, platform_fee, refunded_amount, delivery_fee, discount, source, mode")
        .eq("is_test", false).gte("created_at", from).lte("created_at", to)
        .order("id").range(offset, offset + 999);
      if (error) throw new Error("Impossible de charger les montants des commandes.");
      rows.push(...(orders ?? []) as GainOrderRow[]);
      if ((orders ?? []).length < 1000) break;
    }
    const gains = aggregateGains(rows);
    const names = Object.fromEntries((rs ?? []).map((r) => [r.id, { name: r.name as string, slug: r.slug as string }]));
    return {
      ...gains,
      details: paymentDetails(rows),
      restaurants: (rs ?? []).map((r) => ({
        restaurantId: r.id, name: r.name, slug: r.slug, active: r.active,
        config: r.config as Restaurant["config"] & { platformFee?: Partial<PlatformFeeConfig> },
        ...paymentDetails(rows.filter((o) => o.restaurant_id === r.id)),
      })),
      transactions: rows.filter((r) => !["cancelled", "awaiting_payment"].includes(r.status)).sort((a, b) => b.created_at.localeCompare(a.created_at)).map((r) => ({
        ...r, payment_ref: undefined, provider: r.payment_ref?.startsWith("mollie:") ? "Mollie" : r.payment_ref?.startsWith("mollie_term:") ? "Mollie TPE" : r.payment_ref?.startsWith("pi_") || r.payment_ref?.startsWith("cs_") ? "Stripe" : r.payment_ref?.startsWith("paypal:") ? "PayPal" : r.payment_ref?.startsWith("lyra:") ? "Lyra" : "Non identifié",
        name: names[r.restaurant_id]?.name ?? "Restaurant",
      })),
      byDay: gainsByDay(rows),
      perRestaurant: gains.perRestaurant.map((g) => ({
        ...g,
        name: names[g.restaurantId]?.name ?? "Restaurant",
        slug: names[g.restaurantId]?.slug ?? "",
      })),
    };
  });
