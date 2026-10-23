import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Photo de couverture (vignette de l'accueil) : gérant ou agence. Stockée dans le stockage privé des photos, servie par /api/public/menu-photo. */
export const saveRestaurantCover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    restaurantId: z.string().uuid(),
    image: z.string().max(4_200_000).nullable(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("is_restaurant_manager", { _user_id: context.userId, _restaurant_id: data.restaurantId });
    if (!ok) throw new Error("Réservé au gérant ou à l'agence");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: restaurant, error: readError } = await supabaseAdmin.from("restaurants").select("brand").eq("id", data.restaurantId).single();
    if (readError) throw new Error("Restaurant introuvable");
    let coverUrl: string | undefined;
    if (data.image) {
      const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(data.image);
      if (!match?.[1]) throw new Error("Image JPEG attendue");
      const bytes = Uint8Array.from(atob(match[1]), (c) => c.charCodeAt(0));
      if (bytes.length > 3 * 1024 * 1024 || bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) throw new Error("Image invalide ou trop volumineuse (3 Mo maximum)");
      const name = `${crypto.randomUUID()}.jpg`;
      const { error } = await supabaseAdmin.storage.from("menu-photos").upload(`${data.restaurantId}/${name}`, bytes, { contentType: "image/jpeg", upsert: false });
      if (error) throw new Error("Impossible d'envoyer la photo");
      coverUrl = `/api/public/menu-photo/${data.restaurantId}/${name}`;
    }
    const brand = typeof restaurant.brand === "object" && restaurant.brand && !Array.isArray(restaurant.brand) ? { ...restaurant.brand } : {};
    delete brand["coverUrl"];
    if (coverUrl) brand["coverUrl"] = coverUrl;
    const { error } = await supabaseAdmin.from("restaurants").update({ brand }).eq("id", data.restaurantId);
    if (error) throw new Error("Impossible d'enregistrer la photo");
    return { ok: true };
  });
