import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const MENU_PHOTO_RE = /^\/api\/public\/menu-photo\/([0-9a-f-]{36})\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

/** Enregistre la photo d'un plat (importée ou créée par l'IA) dans le stockage privé ; renvoie l'adresse publique servie par /api/public/menu-photo. */
export const uploadMenuPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    restaurantId: z.string().uuid(),
    dataUrl: z.string().max(7_000_000).regex(/^data:image\/(jpeg|png|webp);base64,/),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("is_restaurant_manager", { _user_id: context.userId, _restaurant_id: data.restaurantId });
    if (!ok) throw new Error("Réservé au gérant ou à l'agence");
    const [, mime, b64] = data.dataUrl.match(/^data:image\/(jpeg|png|webp);base64,(.+)$/) ?? [];
    if (!mime || !b64) throw new Error("Image invalide");
    const bytes = Buffer.from(b64, "base64");
    if (bytes.length > 5 * 1024 * 1024) throw new Error("Image trop lourde (5 Mo maximum)");
    const ext = mime === "jpeg" ? "jpg" : mime;
    const name = `${crypto.randomUUID()}.${ext}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage.from("menu-photos").upload(`${data.restaurantId}/${name}`, bytes, { contentType: `image/${mime}`, upsert: false });
    if (error) throw new Error("Enregistrement de la photo impossible");
    return { url: `/api/public/menu-photo/${data.restaurantId}/${name}` };
  });
