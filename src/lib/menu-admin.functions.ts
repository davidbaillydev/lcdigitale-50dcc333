import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ALLERGEN_IDS } from "./allergens";
import { MENU_PHOTO_RE } from "./menu-photos.functions";

const id = z.string().trim().min(1).max(80);
const choice = z.object({ id, label: z.string().max(120), price: z.number().min(0).max(1000).optional() });
const group = z.object({
  id, label: z.string().max(120), min: z.number().int().min(0).max(50), max: z.number().int().min(0).max(50),
  included: z.number().int().min(0).max(50).optional(), extraPrice: z.number().min(0).max(1000).optional(), choices: z.array(choice).max(100),
});
const tr = z.object({ name: z.string().trim().min(1).max(120), description: z.string().max(500).optional() });
const translations = z.object({ en: tr.optional(), es: tr.optional(), de: tr.optional() }).optional();
const labelTr = z.object({ en: z.string().max(80).optional(), es: z.string().max(80).optional(), de: z.string().max(80).optional() }).optional();
const item = z.object({
  id, name: z.string().trim().min(1).max(120), desc: z.string().max(500).optional(), price: z.number().min(0).max(1000),
  tag: z.string().max(40).optional(), options: z.array(group).max(20).optional(), builder: z.boolean().optional(), hidden: z.boolean().optional(), allergens: z.array(z.enum(ALLERGEN_IDS)).max(14).optional(), vatRate: z.union([z.literal(5.5), z.literal(10), z.literal(20)]).optional(),
  image: z.string().max(200).regex(MENU_PHOTO_RE).optional(), translations,
});
const category = z.object({ id, label: z.string().trim().min(1).max(80), note: z.string().max(300).optional(), items: z.array(item).max(300), translations: labelTr });

/** Enregistre la carte d'UN restaurant (gérant de ce restaurant ou agence uniquement). */
export const saveMenu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid(), menu: z.array(category).max(60).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("is_restaurant_manager", { _user_id: context.userId, _restaurant_id: data.restaurantId });
    if (!ok) throw new Error("Réservé au gérant ou à l'agence");
    const ids = data.menu?.flatMap((c) => c.items.map((i) => i.id)) ?? [];
    if (new Set(ids).size !== ids.length) throw new Error("Deux plats ont le même identifiant");
    if (data.menu?.some((c) => c.items.some((i) => i.image && i.image.match(MENU_PHOTO_RE)?.[1] !== data.restaurantId))) throw new Error("Photo d'un autre restaurant");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("restaurants").update({ menu: data.menu }).eq("id", data.restaurantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const loadMenu = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("restaurants").select("menu, menu_key").eq("id", data.restaurantId).single();
    if (error) throw new Error(error.message);
    return row as unknown as { menu: import("./menu").Category[] | null; menu_key: string };
  });
