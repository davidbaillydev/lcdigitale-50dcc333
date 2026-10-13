import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const STEPS = ["view_menu", "add_to_cart", "checkout_started", "payment_pending", "completed"] as const;
export type CartStep = (typeof STEPS)[number];

const schema = z.object({
  session_id: z.string().uuid(),
  restaurant_id: z.string().uuid(),
  channel: z.enum(["web", "borne", "qr_code"]),
  step: z.enum(STEPS),
  items: z.array(z.object({ id: z.string().max(80), name: z.string().max(120), qty: z.number().int().min(0).max(999), price: z.number().min(0).max(10000) })).max(80),
  total: z.number().min(0).max(100000),
  exit_page: z.string().max(80).optional(),
  traffic_source: z.string().max(80).optional(),
  order_id: z.string().uuid().optional(),
});

/** Suivi anonyme du parcours panier (aucune donnée personnelle). Écriture serveur uniquement. */
export const trackCartSession = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: prev } = await supabaseAdmin.from("cart_sessions").select("restaurant_id,current_step,max_step,traffic_source").eq("session_id", data.session_id).maybeSingle();
      if (prev && (prev.restaurant_id !== data.restaurant_id || prev.current_step === "completed")) return { ok: false };
      if (!prev) {
        const { data: r } = await supabaseAdmin.from("restaurants").select("id").eq("id", data.restaurant_id).eq("active", true).maybeSingle();
        if (!r) return { ok: false };
      }
      const rank = STEPS.indexOf(data.step);
      await supabaseAdmin.from("cart_sessions").upsert({
        session_id: data.session_id,
        restaurant_id: data.restaurant_id,
        channel: data.channel,
        current_step: data.step,
        max_step: Math.max(rank, prev?.max_step ?? 0),
        cart_items: data.items,
        cart_total: Math.round(data.total * 100) / 100,
        exit_page: data.exit_page ?? null,
        traffic_source: prev?.traffic_source ?? data.traffic_source ?? null,
        ...(data.order_id ? { order_id: data.order_id } : {}),
        last_active_at: new Date().toISOString(),
      });
      return { ok: true };
    } catch (e) {
      console.error("trackCartSession", e);
      return { ok: false };
    }
  });
