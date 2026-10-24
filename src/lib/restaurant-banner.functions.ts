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
    const { data: allowed, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !allowed) throw new Error("Réservé à l'agence");
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
/** Vidéo d'en-tête (MP4/WebM, 8 Mo max), affichée en boucle muette par-dessus la bannière image qui sert d'affiche. */
export const saveRestaurantBannerVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    restaurantId: z.string().uuid(),
    video: z.string().max(11_200_000).nullable(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !allowed) throw new Error("Réservé à l'agence");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: restaurant, error: readError } = await supabaseAdmin.from("restaurants").select("brand").eq("id", data.restaurantId).single();
    if (readError) throw new Error("Restaurant introuvable");
    let videoPath: string | undefined;
    if (data.video) {
      const match = /^data:video\/(mp4|webm);base64,([A-Za-z0-9+/=]+)$/.exec(data.video);
      if (!match?.[2]) throw new Error("Vidéo MP4 ou WebM attendue");
      const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
      const isMp4 = bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
      const isWebm = bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
      if (bytes.length > 8 * 1024 * 1024 || !(isMp4 || isWebm)) throw new Error("Vidéo invalide ou trop lourde (8 Mo maximum)");
      videoPath = `${data.restaurantId}/${crypto.randomUUID()}.${isMp4 ? "mp4" : "webm"}`;
      const { error } = await supabaseAdmin.storage.from("restaurant-banners").upload(videoPath, bytes, { contentType: isMp4 ? "video/mp4" : "video/webm", upsert: false });
      if (error) throw new Error("Impossible d'envoyer la vidéo");
    }
    const brand = typeof restaurant.brand === "object" && restaurant.brand && !Array.isArray(restaurant.brand) ? { ...restaurant.brand } : {};
    const old = brand["bannerVideoPath"];
    delete brand["bannerVideoPath"];
    if (videoPath) brand["bannerVideoPath"] = videoPath;
    const { error } = await supabaseAdmin.from("restaurants").update({ brand }).eq("id", data.restaurantId);
    if (error) {
      if (videoPath) await supabaseAdmin.storage.from("restaurant-banners").remove([videoPath]);
      throw new Error("Impossible d'enregistrer la vidéo");
    }
    if (typeof old === "string" && old.startsWith(`${data.restaurantId}/`)) await supabaseAdmin.storage.from("restaurant-banners").remove([old]);
    return { ok: true };
  });
