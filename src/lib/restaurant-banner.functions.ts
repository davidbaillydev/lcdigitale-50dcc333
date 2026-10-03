import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const saveRestaurantBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    restaurantId: z.string().uuid(),
    image: z.string().max(4_200_000).nullable(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed, error: roleError } = await context.supabase.rpc("is_restaurant_manager", { _user_id: context.userId, _restaurant_id: data.restaurantId });
    if (roleError || !allowed) throw new Error("Réservé au gérant ou à l'agence");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: restaurant, error: readError } = await supabaseAdmin.from("restaurants").select("brand").eq("id", data.restaurantId).single();
    if (readError) throw new Error("Restaurant introuvable");
    let bannerPath: string | undefined;
    if (data.image) {
      const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(data.image);
      if (!match?.[1]) throw new Error("Image JPEG attendue");
      const bytes = Uint8Array.from(atob(match[1]), (c) => c.charCodeAt(0));
      if (bytes.length > 3 * 1024 * 1024 || bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) throw new Error("Image invalide ou trop volumineuse (3 Mo maximum)");
      bannerPath = `${data.restaurantId}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabaseAdmin.storage.from("restaurant-banners").upload(bannerPath, bytes, { contentType: "image/jpeg", upsert: false });
      if (error) throw new Error("Impossible d'envoyer la bannière");
    }
    const brand = typeof restaurant.brand === "object" && restaurant.brand && !Array.isArray(restaurant.brand) ? { ...restaurant.brand } : {};
    delete brand["bannerPath"];
    if (bannerPath) brand["bannerPath"] = bannerPath;
    const { error } = await supabaseAdmin.from("restaurants").update({ brand }).eq("id", data.restaurantId);
    if (error) {
      if (bannerPath) await supabaseAdmin.storage.from("restaurant-banners").remove([bannerPath]);
      throw new Error("Impossible d'enregistrer la bannière");
    }
    return { ok: true };
  });