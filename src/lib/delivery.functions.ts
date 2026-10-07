import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ll = z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)]);
const money = z.number().min(0).max(1000);
const zoneSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().min(1).max(60),
  type: z.enum(["circle", "polygon"]),
  center: ll.optional(),
  radiusKm: z.number().min(0.1).max(50).optional(),
  points: z.array(ll).max(100).optional(),
  minOrder: money, fee: money, freeFrom: money,
  tiers: z.array(z.object({ from: money, fee: money })).max(5).optional(),
}).refine((z) => (z.type === "circle" ? !!z.center && !!z.radiusKm : (z.points?.length ?? 0) >= 3), "Zone incomplète : placez le centre ou au moins 3 points");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertManager(supabase: any, userId: string, restaurantId: string) {
  const { data } = await supabase.rpc("is_restaurant_manager", { _user_id: userId, _restaurant_id: restaurantId });
  if (!data) throw new Error("Réservé au gérant ou à l'agence");
}

/** Gérant : enregistre les zones dessinées sur la carte (+ point du restaurant). */
export const saveDeliveryZones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid(), zones: z.array(zoneSchema).max(30), origin: ll.optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.restaurantId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cur } = await supabaseAdmin.from("restaurants").select("delivery").eq("id", data.restaurantId).single();
    const delivery = { ...((cur?.delivery as Record<string, unknown>) ?? {}), geoZones: data.zones, ...(data.origin ? { origin: data.origin } : {}) };
    const { error } = await supabaseAdmin.from("restaurants").update({ delivery: delivery as never }).eq("id", data.restaurantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Public : adresse → coordonnées (OpenStreetMap Nominatim, gratuit). */
export const geocodeAddress = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ q: z.string().trim().min(5).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=fr&q=${encodeURIComponent(data.q)}`;
    const res = await fetch(url, { headers: { "User-Agent": "LC-Digitale-Commande/1.0 (contact@lcdigitale.fr)", "Accept-Language": "fr" } });
    if (!res.ok) throw new Error("Recherche d'adresse indisponible, réessayez.");
    const list = (await res.json()) as { lat: string; lon: string; display_name: string }[];
    const hit = list[0];
    if (!hit) return null;
    return { lat: Number(hit.lat), lng: Number(hit.lon), label: hit.display_name };
  });

/* ---------- Livreurs (code PIN, sans compte) ---------- */

async function hashPin(pin: string, salt: string) {
  const { pbkdf2Sync } = await import("crypto");
  return pbkdf2Sync(pin, salt, 100_000, 32, "sha256").toString("hex");
}
async function sign(restaurantId: string, exp: number, key: string) {
  const { createHmac } = await import("crypto");
  return createHmac("sha256", key).update(`${restaurantId}.${exp}`).digest("hex");
}
/** Jeton livreur : restaurantId.exp.hmac (clé = empreinte du PIN → changer le PIN déconnecte tout le monde). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkToken(admin: any, token: string) {
  const [rid, expS, mac] = token.split(".");
  const exp = Number(expS);
  if (!rid || !mac || !(exp > Date.now())) throw new Error("Session expirée : saisissez à nouveau le code");
  const { data: row } = await admin.from("restaurant_courier_pins").select("pin_hash").eq("restaurant_id", rid).maybeSingle();
  if (!row) throw new Error("Session expirée : saisissez à nouveau le code");
  const { timingSafeEqual } = await import("crypto");
  const good = await sign(rid, exp, row.pin_hash);
  if (good.length !== mac.length || !timingSafeEqual(Buffer.from(good), Buffer.from(mac))) throw new Error("Session expirée : saisissez à nouveau le code");
  return rid as string;
}

export const courierPinStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.restaurantId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("restaurant_courier_pins").select("restaurant_id").eq("restaurant_id", data.restaurantId).maybeSingle();
    return { enabled: !!row };
  });

export const setCourierPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid(), pin: z.string().regex(/^\d{4,6}$/, "Le code doit contenir 4 à 6 chiffres").nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.restaurantId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.pin === null) { await supabaseAdmin.from("restaurant_courier_pins").delete().eq("restaurant_id", data.restaurantId); return { enabled: false }; }
    const { randomBytes } = await import("crypto");
    const salt = randomBytes(16).toString("hex");
    const { error } = await supabaseAdmin.from("restaurant_courier_pins").upsert({ restaurant_id: data.restaurantId, salt, pin_hash: await hashPin(data.pin, salt), failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { enabled: true };
  });

/** Public : connexion livreur avec slug + PIN (5 essais puis blocage 5 min). */
export const courierLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().trim().min(1).max(40), pin: z.string().regex(/^\d{4,6}$/) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r } = await supabaseAdmin.from("restaurants").select("id, name, slug").eq("slug", data.slug.toLowerCase()).eq("active", true).maybeSingle();
    const { data: row } = r ? await supabaseAdmin.from("restaurant_courier_pins").select("*").eq("restaurant_id", r.id).maybeSingle() : { data: null };
    if (!r || !row) throw new Error("Restaurant ou code incorrect");
    if (row.locked_until && new Date(row.locked_until) > new Date()) throw new Error("Trop d'essais : réessayez dans quelques minutes");
    const { timingSafeEqual } = await import("crypto");
    const ok = timingSafeEqual(Buffer.from(await hashPin(data.pin, row.salt), "hex"), Buffer.from(row.pin_hash, "hex"));
    if (!ok) {
      const fails = row.failed_attempts + 1;
      await supabaseAdmin.from("restaurant_courier_pins").update({ failed_attempts: fails >= 5 ? 0 : fails, locked_until: fails >= 5 ? new Date(Date.now() + 5 * 60_000).toISOString() : null }).eq("restaurant_id", r.id);
      throw new Error("Restaurant ou code incorrect");
    }
    await supabaseAdmin.from("restaurant_courier_pins").update({ failed_attempts: 0, locked_until: null }).eq("restaurant_id", r.id);
    const exp = Date.now() + 14 * 3600_000;
    const { data: drivers } = await supabaseAdmin.from("restaurant_drivers").select("id, name").eq("restaurant_id", r.id).eq("active", true).order("name");
    return { token: `${r.id}.${exp}.${await sign(r.id, exp, row.pin_hash)}`, name: r.name, drivers: drivers ?? [] };
  });

/** Active roster requires a valid profile; omission must never widen access. */
async function checkDriver(admin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"], rid: string, driverId?: string) {
  const { data: roster, error } = await admin.from("restaurant_drivers").select("id").eq("restaurant_id", rid).eq("active", true);
  if (error) throw new Error("Vérification du profil indisponible");
  if (driverId && !roster?.some((d) => d.id === driverId)) throw new Error("Livreur inactif : reconnectez-vous");
  if (roster?.length && !driverId) throw new Error("Choisissez votre profil : reconnectez-vous");
}

const DELIVERY_COLS = "id, order_number, customer_name, phone, address, postal_code, city, notes, slot, total, payment_method, payment_status, status, delivery_lat, delivery_lng, zone_name, courier_status, courier_name, driver_id";

export const courierOrders = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().max(200), driverId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rid = await checkToken(supabaseAdmin, data.token);
    await checkDriver(supabaseAdmin, rid, data.driverId);
    const since = new Date(Date.now() - 12 * 3600_000).toISOString();
    let q = supabaseAdmin.from("orders").select(DELIVERY_COLS).eq("restaurant_id", rid).eq("mode", "delivery")
      .in("status", ["accepted", "ready", "done"]).gte("created_at", since);
    // Un livreur identifié voit ses courses et celles non attribuées, jamais celles d'un collègue.
    if (!data.driverId) q = q.is("driver_id", null);
    if (data.driverId) q = q.or(`driver_id.eq.${data.driverId},driver_id.is.null`);
    const { data: rows } = await q.order("slot");
    type Row = { id: string; order_number: number; customer_name: string; phone: string; address: string | null; postal_code: string | null; city: string | null; notes: string | null; slot: string; total: number; payment_method: string; payment_status: string; status: string; delivery_lat: number | null; delivery_lng: number | null; zone_name: string | null; courier_status: string | null; courier_name: string | null; driver_id: string | null };
    return ((rows ?? []) as unknown as Row[]).filter((o) => o.status !== "done" || o.courier_status === "delivered");
  });

export const courierUpdate = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().max(200), orderId: z.string().uuid(), step: z.enum(["assigned", "en_route", "delivered"]), name: z.string().trim().max(40).optional(), driverId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rid = await checkToken(supabaseAdmin, data.token);
    await checkDriver(supabaseAdmin, rid, data.driverId);
    const patch: Record<string, unknown> = { courier_status: data.step, courier_at: new Date().toISOString() };
    if (data.name) patch["courier_name"] = data.name;
    if (data.step === "delivered") patch["status"] = "done";
    if (data.driverId) {
      const { data: d } = await supabaseAdmin.from("restaurant_drivers").select("id, name").eq("id", data.driverId).eq("restaurant_id", rid).eq("active", true).maybeSingle();
      if (!d) throw new Error("Livreur inconnu");
      patch["driver_id"] = d.id; patch["courier_name"] = d.name;
    }
    let uq = supabaseAdmin.from("orders").update(patch as never).eq("id", data.orderId).eq("restaurant_id", rid).eq("mode", "delivery");
    if (!data.driverId) uq = uq.is("driver_id", null);
    uq = uq.in("status", data.step === "assigned" ? ["accepted", "ready"] : ["ready"]);
    if (data.step === "delivered") uq = uq.eq("courier_status", "en_route");
    if (data.driverId) uq = uq.or(`driver_id.eq.${data.driverId},driver_id.is.null`);
    const { data: o, error } = await uq
      .select("id, order_number, restaurants(slug, name)").maybeSingle();
    if (error || !o) throw new Error("Commande introuvable");
    if (data.step !== "assigned") {
      const r = o.restaurants as unknown as { slug: string; name: string } | null;
      const { notifySubscribers } = await import("./push.server");
      await notifySubscribers(supabaseAdmin, { order_id: o.id, audience: "customer" }, {
        title: r?.name ?? "Votre commande",
        body: data.step === "en_route" ? `Commande n°${o.order_number} : votre livreur est en route !` : `Commande n°${o.order_number} livrée. Bon appétit !`,
        url: `/${r?.slug ?? ""}/suivi/${o.id}`,
      }).catch((e) => console.error(e));
    }
    return { ok: true };
  });
