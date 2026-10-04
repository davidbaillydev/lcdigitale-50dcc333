import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const opt = (max: number) => z.string().trim().max(max).nullable().transform((v) => (v ? v : null));

/** Réglages du widget vocal Kaito (site web) — gérant du restaurant ou agence. */
export const saveVapiWebSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      restaurantId: z.string().uuid(),
      enabled: z.boolean(),
      assistantId: opt(100),
      publicKey: opt(100),
      phone: opt(30).refine((v) => !v || /^[+\d][\d\s.-]{5,}$/.test(v), "Numéro de téléphone invalide"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("is_restaurant_manager", { _user_id: context.userId, _restaurant_id: data.restaurantId });
    if (!ok) throw new Error("Réservé au gérant ou à l'agence");
    if (data.enabled && (!data.assistantId || !data.publicKey)) throw new Error("Renseignez l'ID d'assistant et la clé publique Vapi pour activer le widget");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("restaurants").update({
      is_vapi_web_enabled: data.enabled, vapi_assistant_id: data.assistantId, vapi_public_key: data.publicKey, vapi_phone_number: data.phone,
    } as never).eq("id", data.restaurantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
