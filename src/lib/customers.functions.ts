import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normEmail, normPhone } from "./customers";

export type CustomerActivity = { lastAt: string; orderId: string; label: string; orders: number };

/** Dernière commande de chaque fiche client (max(created_at)), calculée côté serveur pour UN restaurant. */
export const customerActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("is_restaurant_manager", { _user_id: context.userId, _restaurant_id: data.restaurantId });
    if (!ok) throw new Error("Accès refusé");
    const db = context.supabase;
    type O = { id: string; email: string | null; phone: string; created_at: string; first_name: string | null; last_name: string | null; customer_name: string };
    const orders: O[] = [];
    for (let i = 0; ; i += 1000) {
      const { data: o, error } = await db.from("orders").select("id, email, phone, created_at, first_name, last_name, customer_name")
        .eq("restaurant_id", data.restaurantId).not("status", "in", "(awaiting_payment,cancelled)").order("created_at", { ascending: false }).range(i, i + 999);
      if (error) throw new Error(error.message);
      orders.push(...((o ?? []) as O[]));
      if (!o || o.length < 1000) break;
    }
    const byKey = new Map<string, { last: O; count: number }>();
    for (const o of orders) {
      for (const k of [normEmail(o.email) && `e:${normEmail(o.email)}`, normPhone(o.phone) && `p:${normPhone(o.phone)}`]) {
        if (!k) continue;
        const cur = byKey.get(k);
        if (cur) cur.count++; else byKey.set(k, { last: o, count: 1 }); // trié du plus récent au plus ancien
      }
    }
    const out: Record<string, CustomerActivity> = {};
    for (let i = 0; ; i += 1000) {
      const { data: cs, error } = await db.from("restaurant_customers").select("id, email, phone").eq("restaurant_id", data.restaurantId).range(i, i + 999);
      if (error) throw new Error(error.message);
      for (const c of cs ?? []) {
        const hits = [c.email && byKey.get(`e:${c.email}`), c.phone && byKey.get(`p:${c.phone}`)].filter(Boolean) as { last: O; count: number }[];
        if (!hits.length) continue;
        const best = hits.reduce((a, b) => (b.last.created_at > a.last.created_at ? b : a));
        const fn = best.last.first_name?.trim() || best.last.customer_name.split(" ")[0] || "";
        const ln = best.last.last_name?.trim() || best.last.customer_name.split(" ").slice(1).join(" ");
        const label = `${fn}${ln ? ` ${ln[0]!.toUpperCase()}.` : ""} — Dernier ticket le ${new Date(best.last.created_at).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}`;
        out[c.id] = { lastAt: best.last.created_at, orderId: best.last.id, label, orders: Math.max(...hits.map((h) => h.count)) };
      }
      if (!cs || cs.length < 1000) break;
    }
    return out;
  });
