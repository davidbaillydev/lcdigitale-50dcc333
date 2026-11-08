import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { baseCategories } from "./catalogs";
import type { Category } from "./menu";
import { duplicateCatalog, duplicateRestaurantSchema } from "./restaurant-duplication";

export const duplicateAgencyRestaurant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => duplicateRestaurantSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: admin, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || admin !== true) throw new Error("Réservé à un administrateur agence");
    const [restaurant, variants, groups, items, links] = await Promise.all([
      context.supabase.from("restaurants").select("menu, menu_key").eq("id", data.sourceId).single(),
      context.supabase.from("product_variants").select("id, product_id, name, price, is_default, is_available, sort_order").eq("restaurant_id", data.sourceId),
      context.supabase.from("option_groups").select("id, name, min_selection, max_selection, is_required, sort_order").eq("restaurant_id", data.sourceId),
      context.supabase.from("option_items").select("id, group_id, name, price, is_available, sort_order").eq("restaurant_id", data.sourceId),
      context.supabase.from("product_option_groups").select("id, product_id, group_id, variant_id").eq("restaurant_id", data.sourceId),
    ]);
    if (restaurant.error || !restaurant.data) throw new Error("Restaurant source introuvable");
    if ([variants, groups, items, links].some((r) => r.error)) throw new Error("Impossible de lire la carte complète ; aucune duplication effectuée");
    const source = restaurant.data;
    const catalog = duplicateCatalog(Array.isArray(source.menu) ? source.menu as unknown as Category[] : baseCategories(source.menu_key), {
      variants: variants.data ?? [], groups: groups.data ?? [], items: items.data ?? [], links: links.data ?? [],
    }, data, () => crypto.randomUUID());
    const { data: result, error } = await context.supabase.rpc("duplicate_agency_restaurant", {
      _source: data.sourceId,
      _identity: { name: data.name, slug: data.slug, city: data.city, address: data.address, phone: data.phone, email: data.email, country: data.country, currency: data.currency },
      _menu: catalog.menu as unknown as Json, _options: catalog.options as unknown as Json,
      _copy_brand: data.copyBrand, _copy_opening: data.copyOpening,
    });
    if (error) throw new Error(error.code === "23505" ? "Cette adresse web est déjà utilisée ; choisissez une autre adresse" : error.message);
    return { slug: data.slug, id: String(result) };
  });