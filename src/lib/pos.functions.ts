// Connecteur caisse : configuration (agence), test et relance de synchronisation (équipe du restaurant).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAgency(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Réservé à l'agence");
}
const SECRET_FIELDS = ["accessToken", "apiKey", "secret"] as const;
const mask = (v?: string) => (v ? `••••••••${v.slice(-4)}` : "");

export const getPosConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { restaurantId: string }) => z.object({ restaurantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAgency(context.supabase, context.userId);
    const { getPosRow } = await import("./pos.server");
    const p = await getPosRow(data.restaurantId);
    return {
      provider: p?.provider ?? "none", silent_sync: p?.silent_sync ?? true, settings: (p?.settings ?? {}) as Record<string, string>,
      masked: Object.fromEntries(SECRET_FIELDS.map((k) => [k, mask((p?.credentials as Record<string, string> | undefined)?.[k])])) as Record<string, string>,
    };
  });

export const savePosConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    restaurantId: z.string().uuid(),
    provider: z.enum(["none", "hubrise", "hiboutik", "webhook"]),
    silent_sync: z.boolean(),
    settings: z.record(z.string(), z.string().max(300)),
    credentials: z.record(z.string(), z.string().max(500)),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAgency(context.supabase, context.userId);
    const { getPosRow } = await import("./pos.server");
    const prev = await getPosRow(data.restaurantId);
    const credentials: Record<string, string> = { ...((prev?.credentials ?? {}) as Record<string, string>) };
    for (const k of SECRET_FIELDS) { const v = data.credentials[k]?.trim(); if (v) credentials[k] = v; }
    if (data.provider === "webhook" && data.settings["url"] && !/^https:\/\//.test(data.settings["url"])) throw new Error("L'URL doit commencer par https://");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any).from("restaurant_pos_connectors").upsert({
      restaurant_id: data.restaurantId, provider: data.provider, silent_sync: data.silent_sync,
      settings: Object.fromEntries(Object.entries(data.settings).map(([k, v]) => [k, v.trim()])), credentials, updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("Enregistrement impossible");
    return { ok: true };
  });

export const testPosConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { restaurantId: string }) => z.object({ restaurantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAgency(context.supabase, context.userId);
    const { getPosRow, testPos } = await import("./pos.server");
    const p = await getPosRow(data.restaurantId);
    if (!p || p.provider === "none") throw new Error("Enregistrez d'abord une caisse");
    return { message: await testPos(p) };
  });

/** Relance manuelle : toute personne ayant accès au restaurant (RLS sur la commande). */
export const retryPosSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orderId: string }) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: o } = await context.supabase.from("orders").select("id").eq("id", data.orderId).maybeSingle();
    if (!o) throw new Error("Commande introuvable");
    const { syncOrderToPos } = await import("./pos.server");
    const res = await syncOrderToPos(data.orderId, { force: true });
    if (res.status === "skipped") throw new Error("Aucune caisse active pour ce restaurant");
    if (res.status === "error") throw new Error(res.error);
    return res;
  });
