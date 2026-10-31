import { featuresOf } from "./features";
import { assertItemAvailable, itemOrderDate } from "./shop";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { validateSelections, orderLine } from "./menu";
import { loadOptionData, withOptions } from "./menu-options";
import { getCatalog } from "./catalogs";
import { computeServiceFee, type ServiceFeeChannel } from "./service-fee";
import { ORDERS_PAUSED_MSG, ordersPaused, RESTAURANT_COLUMNS, deliveryFee, pickupMinOrder, isValidSlot, isOpenNow, asapSlot, timingOf, modeEnabled, paymentEnabled, onlinePaymentEnabled, availableSlots, DELIVERY_FULL_MSG, kioskCardOnly, type Restaurant } from "./shop";
import { cgvVersion } from "./legal";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const orderSchema = z.object({
  restaurant: z.string().max(40),
  mode: z.enum(["pickup", "delivery", "dine_in"]),
  table: z.string().trim().regex(/^[0-9]{1,3}$/).optional(),
  room: z.string().trim().regex(/^[A-Za-z0-9-]{1,8}$/).optional(),
  qr: z.literal("self").optional(),
  slot: z.string().max(40),
  asap: z.boolean().optional(),
  first_name: z.string().trim().min(1, "Prénom obligatoire").max(60),
  last_name: z.string().trim().min(1, "Nom obligatoire").max(60),
  phone: z.string().trim().regex(/^[0-9 +().-]{8,20}$/),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  address: z.string().trim().max(200).optional(),
  postal_code: z.string().trim().max(10).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  notes: z.string().trim().max(500).optional(),
  billing: z.object({ company: z.string().trim().min(2).max(120), siren: z.string().trim().regex(/^\d{9}$/, "SIREN : 9 chiffres"), vatNumber: z.string().trim().regex(/^[A-Z]{2}[0-9A-Z]{2,13}$/).optional().or(z.literal("")), address: z.string().trim().min(3).max(200), postalCode: z.string().trim().regex(/^\d{5}$/), city: z.string().trim().min(1).max(80), email: z.string().trim().email().max(255).optional().or(z.literal("")) }).optional(),
  payment_method: z.enum(["on_site", "online"]),
  promo_code: z.string().trim().max(30).optional(),
  cgv: z.literal(true, { message: "Merci d'accepter les conditions générales de vente." }),
  provider: z.enum(["stripe", "paypal", "lyra", "mollie"]).optional(),
  origin: z.string().url().max(200).regex(/^https?:\/\/[^/]+$/).optional(),
  source: z.enum(["web", "embed", "facebook", "link", "qr"]).optional(),
  returnTo: z.string().max(300).regex(/^https:\/\/[^\s]+$/).optional(),
  ref: z.string().max(253).regex(/^[a-z0-9.-]+$/i).optional(),
  lines: z
    .array(z.object({ itemId: z.string().max(80), qty: z.number().int().min(1).max(50), sel: z.record(z.string(), z.array(z.string().max(60)).max(12)) }))
    .min(1)
    .max(60),
});

/** `?back=` validé : URL https du site parent, même hôte que le ref transmis par embed.js. */
function backParam(returnTo?: string, ref?: string): string {
  if (!returnTo || !ref) return "";
  try {
    const u = new URL(returnTo);
    if (u.protocol !== "https:" || u.hostname.toLowerCase() !== ref.toLowerCase() || u.username || u.password) return "";
    return `?back=${encodeURIComponent(u.href)}`;
  } catch { return ""; }
}

function categoryOf(catalog: ReturnType<typeof getCatalog>, itemId: string) {
  return catalog.categories.find((c) => c.items.some((i) => i.id === itemId))?.label;
}

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => orderSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return createCalculatedOrder(supabaseAdmin, data);
  });

/** Only the authenticated agency endpoint can supply the test audit. */
export const createAdminTestOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orderSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: allowed, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error || allowed !== true) throw new Error("CB Test (Admin) réservé aux administrateurs agence connectés.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return createCalculatedOrder(supabaseAdmin, { ...data, payment_method: "online" }, context.userId);
  });

async function createCalculatedOrder(supabaseAdmin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"], data: z.infer<typeof orderSchema>, testUserId?: string) {
    const { data: rRow } = await supabaseAdmin.from("restaurants").select(RESTAURANT_COLUMNS).eq("slug", data.restaurant).eq("active", true).maybeSingle();
    const r = rRow as unknown as Restaurant | null;
    if (!r) throw new Error("Restaurant introuvable");
    if (ordersPaused(r)) throw new Error(ORDERS_PAUSED_MSG);
    const catalog = withOptions(getCatalog(r), await loadOptionData(supabaseAdmin, r.id));

    const dineIn = data.mode === "dine_in";
    { const ft = featuresOf(r.enabled_features);
      if (dineIn && !ft.qrcode) throw new Error("La commande à table n'est pas proposée.");
      if (data.mode === "delivery" && !ft.livraison) throw new Error("La livraison n'est pas proposée par ce restaurant.");
      if (data.source === "embed" && !ft.embed) throw new Error("Le bouton de commande intégré n'est pas activé pour ce restaurant."); }
    if (dineIn) {
      const n = Number(data.table);
      if (data.room) { if (!r.config.qr?.room) throw new Error("Le room service n'est pas proposé."); }
      else if (data.qr === "self" && !data.table) { if (!r.config.qr?.self) throw new Error("Le libre-service n'est pas proposé."); }
      else if (!data.table || !(n >= 1 && n <= (r.config.qr?.tables ?? 0))) throw new Error("Table inconnue : scannez à nouveau le QR code de votre table.");
    } else if (!modeEnabled(r, "pickup") && !modeEnabled(r, "delivery")) throw new Error("Commandes en ligne désactivées pour le moment.");
    else if (!modeEnabled(r, data.mode as "pickup" | "delivery")) throw new Error("Ce mode de commande n'est pas proposé.");
    else if (data.asap) {
      if (!timingOf(r).asap) throw new Error("Les commandes « Dès que possible » ne sont pas proposées.");
      if (!isOpenNow(r, data.mode as "pickup" | "delivery")) throw new Error("Le restaurant est fermé pour le moment : choisissez un horaire.");
      data.slot = asapSlot(r, data.mode as "pickup" | "delivery");
    } else if (!timingOf(r).scheduled) throw new Error("Les commandes planifiées ne sont pas proposées.");
    else if (!isValidSlot(r, data.mode as "pickup" | "delivery", data.slot)) throw new Error("Ce créneau n'est plus disponible, merci d'en choisir un autre.");
    if (data.mode === "delivery") {
      const { deliveryLoad, isFull } = await import("./delivery-capacity.server");
      const load = await deliveryLoad(supabaseAdmin, r);
      if (isFull(load, data.slot)) {
        // ASAP saturé : on bascule sur le premier créneau suivant disponible.
        const next = data.asap ? availableSlots(r, "delivery").find((s) => new Date(s) > new Date(data.slot) && !isFull(load, s)) : undefined;
        if (!next) throw new Error(DELIVERY_FULL_MSG);
        data.slot = next; data.asap = false;
      }
    }
    if (data.payment_method === "online" && !onlinePaymentEnabled(r, data.mode)) throw new Error(onlinePaymentEnabled(r) ? "Le paiement en ligne est réservé à la livraison." : "Le paiement en ligne est désactivé par ce restaurant.");
    const { stripeForRestaurant, stripeCall, startOnlinePayment } = await import("./payments.functions");
    const provider = !testUserId && data.payment_method === "online" ? (data.provider ?? "stripe") : null;
    const stripe = provider === "stripe" ? await stripeForRestaurant(r.id) : null;
    if (provider === "stripe" && !stripe) throw new Error("Le paiement en ligne n'est pas disponible pour ce restaurant.");
    if ((provider === "paypal" || provider === "lyra" || provider === "mollie") && !data.origin) throw new Error("Paiement en ligne indisponible.");
    if (!dineIn && !modeEnabled(r, data.mode)) throw new Error(data.mode === "delivery" ? "La livraison n'est pas proposée par ce restaurant." : "La vente à emporter n'est pas proposée.");
    if (data.payment_method === "online" && !onlinePaymentEnabled(r)) throw new Error("Le paiement en ligne est désactivé par ce restaurant.");
    if (!dineIn && data.mode === "delivery" && !onlinePaymentEnabled(r)) throw new Error("La livraison n'est pas proposée par ce restaurant.");
    if (!dineIn && data.mode === "delivery" && data.payment_method === "on_site") throw new Error("La livraison nécessite un paiement en ligne.");
    if (data.payment_method === "on_site" && !paymentEnabled(r, "on_site")) throw new Error("Ce mode de paiement n'est pas accepté.");

    const { data: so } = await supabaseAdmin.from("menu_stock").select("item_id").eq("restaurant_id", r.id).eq("sold_out", true);
    const soldOut = new Set((so ?? []).map((x) => x.item_id));
    const availabilityDate = itemOrderDate(dineIn || !!data.asap, data.slot);
    const items = data.lines.map((l) => {
      const item = catalog.itemsById[l.itemId];
      if (!item) throw new Error("Article inconnu");
      assertItemAvailable(item, availabilityDate);
      if (soldOut.has(item.id)) throw new Error(`« ${item.name} » est momentanément épuisé. Retirez-le de votre panier.`);
      const err = validateSelections(item, l.sel);
      if (err) throw new Error(err);
      return orderLine(item, l.sel, l.qty, categoryOf(catalog, item.id));
    });
    const subtotal = Math.round(items.reduce((s, i) => s + i.total, 0) * 100) / 100;

    let fee = 0;
    let city: string | null = null;
    let zoneName: string | null = null;
    const geo = r.delivery.geoZones ?? [];
    if (data.mode === "delivery" && geo.length) {
      if (data.lat == null || data.lng == null) throw new Error("Vérifiez votre adresse de livraison sur la carte.");
      const { findZone, zoneFee } = await import("./geo");
      const zone = findZone([data.lat, data.lng], geo);
      if (!zone) throw new Error("Désolé, cette adresse est hors de notre zone de livraison.");
      if (!data.address || data.address.length < 5) throw new Error("Adresse de livraison requise.");
      if (subtotal < zone.minOrder) throw new Error(`Minimum de commande pour ${zone.name} : ${zone.minOrder} €`);
      fee = zoneFee(zone, subtotal);
      zoneName = zone.name;
    } else if (data.mode === "delivery") {
      const zone = r.delivery.zones.find((z) => z.cp === data.postal_code);
      if (!zone) throw new Error("Désolé, cette adresse est hors de notre zone de livraison.");
      if (!data.address || data.address.length < 5) throw new Error("Adresse de livraison requise.");
      if (subtotal < r.delivery.minOrder) throw new Error(`Minimum de commande en livraison : ${r.delivery.minOrder} €`);
      fee = deliveryFee(r, subtotal);
      city = zone.city;
    } else if (data.mode === "pickup") {
      const min = pickupMinOrder(r);
      if (min != null && subtotal < min) throw new Error(`Minimum de commande à emporter : ${min} €`);
    }
    const { resolveDiscount } = await import("./promo.server");
    const promo = await resolveDiscount(supabaseAdmin, r, subtotal, { code: data.promo_code, email: data.email, phone: data.phone, channel: "web" });
    const serviceFee = computeServiceFee(r.config.serviceFee, subtotal, data.mode as ServiceFeeChannel);
    if (promo.error) throw new Error(promo.error);

    const { data: row, error } = await supabaseAdmin
      .from("orders")
      .insert({
        restaurant_id: r.id,
        customer_name: `${data.first_name} ${data.last_name}`,
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone,
        email: data.email || null,
        mode: data.mode,
        address: data.mode === "delivery" ? (data.address ?? null) : null,
        postal_code: data.mode === "delivery" ? (data.postal_code ?? null) : null,
        city,
        delivery_lat: data.mode === "delivery" ? (data.lat ?? null) : null,
        delivery_lng: data.mode === "delivery" ? (data.lng ?? null) : null,
        zone_name: zoneName,
        slot: dineIn ? new Date().toISOString() : data.slot,
        asap: !dineIn && !!data.asap,
        table_label: dineIn ? (data.table ?? null) : null,
        room_label: dineIn ? (data.room ?? null) : null,
        qr_mode: dineIn ? (data.room ? "room" : data.qr === "self" && !data.table ? "self" : "table") : null,
        items,
        notes: data.notes || null,
        billing: data.billing ? { ...data.billing, country: "FR" } : null,
        subtotal,
        delivery_fee: fee,
        service_fee: serviceFee,
        discount: promo.discount,
        promo_code: promo.discount ? promo.code : null,
        total: Math.round((subtotal - promo.discount + fee + serviceFee) * 100) / 100,
        payment_method: data.payment_method,
        ...(testUserId ? { is_test: true, test_created_by: testUserId, test_created_at: new Date().toISOString(), payment_status: "paid", payment_ref: `admin-test:${crypto.randomUUID()}` } : {}),
        source: dineIn && (data.table || data.room || data.qr) ? "qr" : (data.source ?? "web"),
        source_ref: data.source === "embed" && data.ref ? data.ref.toLowerCase().slice(0, 253) : null,
        cgv_accepted_at: new Date().toISOString(),
        cgv_version: cgvVersion(r.legal ?? {}),
        status: provider ? "awaiting_payment" : dineIn && ((data.qr === "self" && !data.table && !data.room) || (!!data.table && !!r.config.qr?.tableValidation)) ? "pending_approval" : r.config.autoAccept ? "accepted" : "new",
      })
      .select("id, order_number, total")
      .single();
    if (error) {
      console.error(error);
      throw new Error("Impossible d'enregistrer la commande.");
    }
    if (!testUserId && promo.discount && promo.code && promo.code !== "PREMIERE-COMMANDE") {
      const { data: pc } = await supabaseAdmin.from("restaurant_promo_codes").select("id, uses").eq("restaurant_id", r.id).eq("code", promo.code).maybeSingle();
      if (pc) await supabaseAdmin.from("restaurant_promo_codes").update({ uses: pc.uses + 1 }).eq("id", pc.id);
    }
    if (!provider && !testUserId) { const { syncOrderToPos } = await import("./pos.server"); await syncOrderToPos(row.id); }
    if (!provider && !testUserId) {
      const { notifyNewOrder } = await import("./order-email.server");
      await notifyNewOrder(supabaseAdmin, row.id, data.origin).catch((e) => console.error(e));
    }
    const base = { id: row.id, order_number: row.order_number, clientSecret: null as string | null, redirectUrl: null as string | null, form: null as { action: string; fields: Record<string, string> } | null };
    if (provider === "paypal" || provider === "lyra" || provider === "mollie") {
      const res = await startOnlinePayment(provider, { id: row.id, order_number: row.order_number, total: Number(row.total), restaurant_id: r.id, email: data.email || null }, r.name, `${data.origin}/${r.slug}/suivi/${row.id}${backParam(data.returnTo, data.ref)}`, data.mode);
      return { ...base, redirectUrl: "redirectUrl" in res ? res.redirectUrl : null, form: "form" in res ? res.form : null };
    }
    if (!stripe) return base;
    const pi = await stripeCall("/payment_intents", stripe.secret, {
      amount: String(Math.round(Number(row.total) * 100)),
      currency: "eur",
      "automatic_payment_methods[enabled]": "true",
      description: `${r.name} — commande n° ${row.order_number}`,
      "metadata[order_id]": row.id,
      ...(data.email ? { receipt_email: data.email } : {}),
    }) as { id: string; client_secret: string };
    await supabaseAdmin.from("orders").update({ payment_ref: pi.id }).eq("id", row.id);
    return { ...base, clientSecret: pi.client_secret };
  }

export const getOrderStatus = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("orders")
      .select("id, is_test, order_number, status, courier_status, mode, slot, total, items, payment_method, payment_status, customer_name, discount, promo_code, delivery_fee, service_fee, table_label, restaurants(slug, config)")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) return row;
    const rest = row.restaurants as unknown as { slug: string; config: { qr?: { reviewUrl?: string } } | null } | null;
    return { ...row, restaurants: rest ? { slug: rest.slug } : null, review_url: rest?.config?.qr?.reviewUrl ?? null };
  });

const kioskSchema = z.object({
  restaurant: z.string().max(40),
  mode: z.enum(["dine_in", "pickup"]),
  payment_method: z.enum(["counter", "card_terminal", "qr"]),
  customer_name: z.string().trim().max(40).optional(),
  promo_code: z.string().trim().max(30).optional(),
  lines: orderSchema.shape.lines,
});

/** Commande passée depuis la borne en restaurant : préparation immédiate, paiement au comptoir/TPE */
export const createKioskOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => kioskSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rRow } = await supabaseAdmin.from("restaurants").select(RESTAURANT_COLUMNS).eq("slug", data.restaurant).eq("active", true).maybeSingle();
    const r = rRow as unknown as Restaurant | null;
    if (!r) throw new Error("Restaurant introuvable");
    if (ordersPaused(r)) throw new Error(ORDERS_PAUSED_MSG);
    { const ft = featuresOf(r.enabled_features);
      if (!ft.borne) throw new Error("La borne n'est pas activée pour ce restaurant.");
      if (data.payment_method === "counter" && !ft.borne_cash_payment) throw new Error("Le paiement au comptoir n'est pas accepté sur la borne."); }
    const cardOnly = kioskCardOnly(r);
    const qr = data.payment_method === "qr";
    if (qr) {
      // QR code : le client paie sur son téléphone (Mollie/Stripe), validation automatique après paiement.
      if (r.config.payments?.qr !== true) throw new Error("Le paiement par QR code n'est pas proposé.");
      const { kioskQrReady } = await import("./payments.functions");
      if (!(await kioskQrReady(r.id))) throw new Error("Le paiement par QR code est indisponible pour le moment.");
    } else if (cardOnly) {
      // Voie B : la borne n'enregistre que des paiements carte sur un terminal bancaire connecté.
      if (data.payment_method !== "card_terminal") throw new Error("Cette borne accepte uniquement le paiement par carte bancaire.");
      const { kioskTerminalReady } = await import("./payments.functions");
      if (!(await kioskTerminalReady(r.id))) throw new Error("Le terminal de paiement est indisponible. Merci de commander au comptoir.");
    }
    if (!modeEnabled(r, data.mode)) throw new Error("Ce mode n'est pas proposé.");
    if (!cardOnly && !qr && !paymentEnabled(r, data.payment_method as "counter" | "card_terminal")) throw new Error("Ce mode de paiement n'est pas accepté.");
    const catalog = withOptions(getCatalog(r), await loadOptionData(supabaseAdmin, r.id));
    const { data: so } = await supabaseAdmin.from("menu_stock").select("item_id").eq("restaurant_id", r.id).eq("sold_out", true);
    const soldOut = new Set((so ?? []).map((x) => x.item_id));
    const availabilityDate = new Date();
    const items = data.lines.map((l) => {
      const item = catalog.itemsById[l.itemId];
      if (!item) throw new Error("Article inconnu");
      assertItemAvailable(item, availabilityDate);
      if (soldOut.has(item.id)) throw new Error(`« ${item.name} » est momentanément épuisé. Retirez-le de votre panier.`);
      const err = validateSelections(item, l.sel);
      if (err) throw new Error(err);
      return orderLine(item, l.sel, l.qty, categoryOf(catalog, item.id));
    });
    const subtotal = Math.round(items.reduce((s, i) => s + i.total, 0) * 100) / 100;
    if (data.mode === "pickup") {
      const min = pickupMinOrder(r);
      if (min != null && subtotal < min) throw new Error(`Minimum de commande à emporter : ${min} €`);
    }
    const { resolveDiscount } = await import("./promo.server");
    const promo = await resolveDiscount(supabaseAdmin, r, subtotal, { code: data.promo_code, channel: "kiosk" });
    const serviceFee = computeServiceFee(r.config.serviceFee, subtotal, "kiosk");
    if (promo.error) throw new Error(promo.error);
    const { data: row, error } = await supabaseAdmin
      .from("orders")
      .insert({
        restaurant_id: r.id,
        customer_name: data.customer_name || "Borne",
        phone: "-",
        mode: data.mode,
        slot: new Date().toISOString(),
        items,
        subtotal,
        delivery_fee: 0,
        service_fee: serviceFee,
        discount: promo.discount,
        promo_code: promo.discount ? promo.code : null,
        total: Math.round((subtotal - promo.discount + serviceFee) * 100) / 100,
        payment_method: qr ? "online" : data.payment_method,
        source: "kiosk",
        // Voie B : rien n'arrive en cuisine tant que la banque n'a pas accepté le paiement.
        ...(cardOnly || qr ? { payment_status: "pending" } : {}),
        status: cardOnly || qr ? "awaiting_payment" : r.config.autoAccept ? "accepted" : "new",
      })
      .select("id, order_number, total")
      .single();
    if (error) {
      console.error(error);
      throw new Error("Impossible d'enregistrer la commande.");
    }
    if (promo.discount && promo.code && promo.code !== "PREMIERE-COMMANDE") {
      const { data: pc } = await supabaseAdmin.from("restaurant_promo_codes").select("id, uses").eq("restaurant_id", r.id).eq("code", promo.code).maybeSingle();
      if (pc) await supabaseAdmin.from("restaurant_promo_codes").update({ uses: pc.uses + 1 }).eq("id", pc.id);
    }
    if (cardOnly || qr) return row;
    { const { syncOrderToPos } = await import("./pos.server"); await syncOrderToPos(row.id); }
    if (data.payment_method === "counter") { const { sendRestaurantNewOrder } = await import("./order-email.server"); await sendRestaurantNewOrder(supabaseAdmin, row.id).catch((e) => console.error(e)); }
    return row;
  });
