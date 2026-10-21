import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function agency(client: SupabaseClient<Database>, userId: string) {
  const { data, error } = await client.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || data !== true) throw new Error("Réservé aux administrateurs de l’agence");
}

export const getMenuAiSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await agency(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("agency_menu_ai_credentials").select("id, last_fallback_reason, last_fallback_at").eq("id", "gemini").maybeSingle();
    if (error) throw new Error("Impossible de charger le réglage Gemini");
    return { configured: Boolean(data), fallbackReason: data?.last_fallback_reason ?? null, fallbackAt: data?.last_fallback_at ?? null };
  });

export const saveMenuAiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ apiKey: z.string().trim().min(1).max(512).regex(/^\S+$/, "Clé invalide") }).parse(input))
  .handler(async ({ context, data }) => {
    await agency(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("agency_menu_ai_credentials").upsert({ id: "gemini", api_key: data.apiKey, updated_at: new Date().toISOString(), last_fallback_reason: null, last_fallback_at: null });
    if (error) throw new Error("La clé Gemini n’a pas pu être enregistrée");
    return { configured: true };
  });

export const removeMenuAiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await agency(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("agency_menu_ai_credentials").delete().eq("id", "gemini");
    if (error) throw new Error("La clé Gemini n’a pas pu être supprimée");
    return { configured: false };
  });