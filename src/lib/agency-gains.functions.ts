import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aggregateGains, gainsByDay, type GainOrderRow } from "@/lib/agency-gains";

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
    const [{ data: orders, error }, { data: rs }] = await Promise.all([
      context.supabase
        .from("orders")
        .select("restaurant_id, service_fee, total, status, created_at")
        .eq("is_test", false)
        .gte("created_at", from)
        .lte("created_at", to)
        .limit(10000),
      context.supabase.from("restaurants").select("id, name, slug").order("name"),
    ]);
    if (error) throw new Error(error.message);
    const rows = (orders ?? []) as GainOrderRow[];
    const gains = aggregateGains(rows);
    const names = Object.fromEntries((rs ?? []).map((r) => [r.id, { name: r.name as string, slug: r.slug as string }]));
    return {
      ...gains,
      byDay: gainsByDay(rows),
      perRestaurant: gains.perRestaurant.map((g) => ({
        ...g,
        name: names[g.restaurantId]?.name ?? "Restaurant",
        slug: names[g.restaurantId]?.slug ?? "",
      })),
    };
  });
