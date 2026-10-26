import type { supabase } from "@/integrations/supabase/client";

/** Historical reads remain scoped to the selected restaurant and existing RLS. */
export function queryKitchenHistory(client: typeof supabase, restaurantId: string, filters: { search: string; date: string }, page: number) {
  if (!restaurantId) throw new Error("Restaurant requis");
  let query = client.from("orders").select("*", { count: "exact" }).eq("restaurant_id", restaurantId).neq("status", "awaiting_payment");
  if (filters.date) {
    const start = new Date(`${filters.date}T00:00:00`);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    query = query.gte("created_at", start.toISOString()).lt("created_at", end.toISOString());
  }
  if (/^\d+$/.test(filters.search)) query = query.eq("order_number", Number(filters.search));
  else if (filters.search) query = query.ilike("customer_name", `%${filters.search.replace(/[\\%_]/g, "\\$&")}%`);
  const offset = Math.max(0, page) * 30;
  return query.order("created_at", { ascending: false }).range(offset, offset + 29);
}