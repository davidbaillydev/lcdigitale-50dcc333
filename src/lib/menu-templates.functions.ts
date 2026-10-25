import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { baseCategories } from "./catalogs";
import { loadOptionData } from "./menu-options";
import { captureStructure, type MenuTemplate } from "./menu-templates";
import type { Category } from "./menu";
import type { Json } from "@/integrations/supabase/types";

export const listMenuTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: allowed, error: accessError } = await context.supabase.rpc("is_restaurant_manager", { _user_id: context.userId, _restaurant_id: data.restaurantId });
    if (accessError || !allowed) throw new Error("Accès réservé au gérant ou à l’agence");
    // Curated cross-restaurant snapshots, not access to source restaurants or their private data.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.from("menu_structure_templates").select("id, restaurant_id, name, structure, updated_at").order("name");
    if (error) throw new Error("Impossible de charger les modèles de carte");
    return (rows ?? []) as unknown as MenuTemplate[];
  });

export const publishMenuTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid(), name: z.string().trim().min(1).max(80), remove: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: allowed, error: accessError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (accessError || !allowed) throw new Error("Réservé à l’agence");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.remove) {
      const { error } = await supabaseAdmin.from("menu_structure_templates").delete().eq("restaurant_id", data.restaurantId);
      if (error) throw new Error("Impossible de retirer le modèle");
      return { ok: true };
    }
    const { data: r, error: readError } = await context.supabase.from("restaurants").select("menu, menu_key").eq("id", data.restaurantId).single();
    if (readError || !r) throw new Error("Restaurant introuvable");
    const menu = r.menu as unknown as Category[] | null;
    const categories = menu?.length ? menu : baseCategories(r.menu_key);
    if (!categories.some((c) => c.items.length)) throw new Error("Enregistrez une carte avec des plats avant de créer un modèle");
    const options = await loadOptionData(context.supabase, data.restaurantId);
    const { error } = await supabaseAdmin.from("menu_structure_templates").upsert({ restaurant_id: data.restaurantId, name: data.name, structure: captureStructure(categories, options) as unknown as Json, updated_at: new Date().toISOString() }, { onConflict: "restaurant_id" });
    if (error) throw new Error("Impossible d’enregistrer le modèle");
    return { ok: true };
  });