type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

export async function hashDeviceToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Recheck membership on every send and read; device possession never grants order access. */
export async function staffCanAccess(admin: Admin, userId: string, restaurantId: string) {
  const { data, error } = await admin.rpc("can_access_restaurant", { _user_id: userId, _restaurant_id: restaurantId });
  return !error && data === true;
}

export async function notifyStaffOrder(admin: Admin, orderId: string) {
  const { data: order } = await admin.from("orders").select("id, restaurant_id, status, is_test, source, restaurants(name, slug)").eq("id", orderId).maybeSingle();
  if (!order || order.is_test || order.source === "pos" || !["new", "accepted", "pending_approval"].includes(order.status)) return 0;
  const { data: devices } = await admin.from("staff_push_devices").select("id, endpoint, user_id").contains("restaurant_ids", [order.restaurant_id]).gt("expires_at", new Date().toISOString());
  const restaurant = order.restaurants as unknown as { name: string; slug: string } | null;
  if (!restaurant) return 0;
  const { sendEmptyPush } = await import("./push.server");
  let sent = 0;
  for (const device of devices ?? []) {
    if (!(await staffCanAccess(admin, device.user_id, order.restaurant_id))) continue;
    // A unique claim prevents duplicate payment callbacks from sending twice.
    const { error } = await admin.from("staff_push_deliveries").insert({ device_id: device.id, order_id: order.id, restaurant_id: order.restaurant_id, title: restaurant.name, url: `/espace/${restaurant.slug}` });
    if (error) { if (error.code !== "23505") console.error("staff push claim", error.code); continue; }
    try {
      const status = await sendEmptyPush(device.endpoint);
      if (status === 404 || status === 410) await admin.from("staff_push_devices").delete().eq("id", device.id);
      else if (status < 300) sent++;
      else console.error("staff push delivery", status);
    } catch { console.error("staff push delivery unavailable"); }
  }
  return sent;
}