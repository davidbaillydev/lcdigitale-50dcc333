import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const pushEndpoint = z.string().url().max(2000).refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password && (
    url.hostname === "fcm.googleapis.com" || url.hostname === "updates.push.services.mozilla.com" ||
    url.hostname.endsWith(".push.apple.com") || url.hostname === "web.push.apple.com" ||
    url.hostname.endsWith(".notify.windows.com"));
}, "Service de notification non pris en charge");

export const registerStaffPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ endpoint: pushEndpoint, restaurantIds: z.array(z.string().uuid()).min(1).max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    for (const id of data.restaurantIds) {
      const { data: allowed, error } = await context.supabase.rpc("can_access_restaurant", { _user_id: context.userId, _restaurant_id: id });
      if (error || !allowed) throw new Error("Accès restaurant refusé");
    }
    const token = crypto.randomUUID() + crypto.randomUUID();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashDeviceToken } = await import("./staff-push.server");
    const { data: device, error } = await supabaseAdmin.from("staff_push_devices").upsert({ endpoint: data.endpoint, user_id: context.userId, restaurant_ids: [...new Set(data.restaurantIds)], token_hash: await hashDeviceToken(token), updated_at: new Date().toISOString(), expires_at: new Date(Date.now() + 90 * 86400_000).toISOString() }, { onConflict: "endpoint" }).select("id").single();
    if (error || !device) throw new Error("Activation des notifications impossible");
    return { id: device.id, token };
  });

export const removeStaffPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("staff_push_devices").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error("Désactivation impossible");
    return { ok: true };
  });