import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PDP_PROVIDERS = { jefacture: "JeFacture", pennylane: "Pennylane", dext: "Dext", other: "Autre" } as const;
export type PdpStatus = { restaurantId: string; provider: keyof typeof PDP_PROVIDERS | null; accountHint: string; mandateSigned: boolean; complete: boolean; updatedAt: string | null };

async function canManage(ctx: { supabase: any; userId: string }, restaurantId: string) {
  const [{ data: m }, { data: a }] = await Promise.all([
    ctx.supabase.rpc("is_restaurant_manager", { _user_id: ctx.userId, _restaurant_id: restaurantId }),
    ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" }),
  ]);
  return !!m || !!a;
}

/** Statut PDP des établissements accessibles ; la clé n'est jamais renvoyée en clair. */
export const getPdpStatuses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantIds: z.array(z.string().uuid()).max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    const ok: string[] = [];
    for (const id of data.restaurantIds) {
      const { data: can } = await context.supabase.rpc("can_access_restaurant", { _user_id: context.userId, _restaurant_id: id });
      if (can) ok.push(id);
    }
    if (!ok.length) return [] as PdpStatus[];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin.from("restaurant_pdp_configs").select("*").in("restaurant_id", ok);
    return ok.map((id): PdpStatus => {
      const r = rows?.find((x) => x.restaurant_id === id);
      const key = r?.account_id ?? "";
      return { restaurantId: id, provider: (r?.provider as PdpStatus["provider"]) ?? null, accountHint: key ? `••••${key.slice(-4)}` : "", mandateSigned: !!r?.mandate_signed, complete: !!r && key.length >= 4 && r.mandate_signed, updatedAt: r?.updated_at ?? null };
    });
  });

export const savePdpConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    restaurantId: z.string().uuid(),
    provider: z.enum(["jefacture", "pennylane", "dext", "other"]),
    accountId: z.string().trim().max(500).optional(), // vide = conserver la clé existante
    mandateSigned: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await canManage(context, data.restaurantId))) throw new Error("Accès refusé");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cur } = await supabaseAdmin.from("restaurant_pdp_configs").select("account_id").eq("restaurant_id", data.restaurantId).maybeSingle();
    const account_id = data.accountId ? data.accountId : cur?.account_id ?? "";
    const { error } = await supabaseAdmin.from("restaurant_pdp_configs").upsert({ restaurant_id: data.restaurantId, provider: data.provider, account_id, mandate_signed: data.mandateSigned, updated_by: context.userId, updated_at: new Date().toISOString() });
    if (error) throw new Error("Enregistrement impossible");
    return { ok: true };
  });
