import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/api/public/push/staff-messages")({
  server: { handlers: { POST: async ({ request }) => {
    const parsed = z.object({ id: z.string().uuid(), token: z.string().min(64).max(100) }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return new Response("Forbidden", { status: 403 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashDeviceToken, staffCanAccess } = await import("@/lib/staff-push.server");
    const { data: device } = await supabaseAdmin.from("staff_push_devices").select("id, user_id, restaurant_ids").eq("id", parsed.data.id).eq("token_hash", await hashDeviceToken(parsed.data.token)).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!device) return new Response("Forbidden", { status: 403 });
    const { data: deliveries } = await supabaseAdmin.from("staff_push_deliveries").select("id, restaurant_id, title, url").eq("device_id", device.id).is("read_at", null).gt("created_at", new Date(Date.now() - 86400_000).toISOString()).order("created_at").limit(20);
    const messages = [];
    for (const delivery of deliveries ?? []) {
      if (device.restaurant_ids.includes(delivery.restaurant_id) && await staffCanAccess(supabaseAdmin, device.user_id, delivery.restaurant_id)) {
        messages.push({ title: delivery.title, body: "Nouvelle commande à traiter", url: delivery.url, tag: delivery.id });
      }
      await supabaseAdmin.from("staff_push_deliveries").update({ read_at: new Date().toISOString() }).eq("id", delivery.id).eq("device_id", device.id);
    }
    return Response.json({ messages }, { headers: { "Cache-Control": "no-store" } });
  } } },
});