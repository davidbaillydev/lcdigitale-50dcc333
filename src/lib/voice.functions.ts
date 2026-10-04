import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAgency(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Réservé à l'agence");
}

const rid = z.object({ restaurantId: z.string().uuid() });

/** Agence : lit la configuration du canal « Téléphone IA » (Vapi) d'un restaurant. */
export const getVoiceChannel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rid.parse(d))
  .handler(async ({ data, context }) => {
    await assertAgency(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("restaurant_voice_channels").select("*").eq("restaurant_id", data.restaurantId).maybeSingle();
    return row ? { enabled: row.enabled, secret: row.webhook_secret, phone_number: row.phone_number, calls_count: row.calls_count, last_call_at: row.last_call_at } : null;
  });

/** Agence : active/désactive le canal, enregistre le numéro, (re)génère la clé secrète du webhook. */
export const saveVoiceChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rid.extend({ enabled: z.boolean(), phone_number: z.string().trim().max(30).nullable(), regenerate: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAgency(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { randomBytes } = await import("crypto");
    const { data: cur } = await supabaseAdmin.from("restaurant_voice_channels").select("webhook_secret").eq("restaurant_id", data.restaurantId).maybeSingle();
    const secret = !cur || data.regenerate ? randomBytes(32).toString("hex") : cur.webhook_secret;
    const { error } = await supabaseAdmin.from("restaurant_voice_channels").upsert({
      restaurant_id: data.restaurantId, enabled: data.enabled, phone_number: data.phone_number || null, webhook_secret: secret, updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
