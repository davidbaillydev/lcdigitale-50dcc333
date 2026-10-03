import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { unitPrice, validateSelections, describeSelections } from "./menu";
import { getCatalog } from "./catalogs";
import { RESTAURANT_COLUMNS, deliveryFee, isValidSlot, modeEnabled, paymentEnabled, type Restaurant } from "./shop";

const orderSchema = z.object({
  restaurant: z.string().max(40),
  mode: z.enum(["pickup", "delivery"]),
  slot: z.string().max(40),
  customer_name: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^[0-9 +().-]{8,20}$/),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  address: z.string().trim().max(200).optional(),
  postal_code: z.string().trim().max(10).optional(),
  notes: z.string().trim().max(500).optional(),
  payment_method: z.enum(["on_site", "online"]),
  lines: z
    .array(z.object({ itemId: z.string().max(80), qty: z.number().int().min(1).max(50), sel: z.record(z.string(), z.array(z.string().max(60)).max(12)) }))
    .min(1)
    .max(60),
});

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => orderSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rRow } = await supabaseAdmin.from("restaurants").select(RESTAURANT_COLUMNS).eq("slug", data.restaurant).eq("active", true).maybeSingle();
    const r = rRow as unknown as Restaurant | null;
    if (!r) throw new Error("Restaurant introuvable");
    const catalog = getCatalog(r);

    if (!isValidSlot(r, data.mode, data.slot)) throw new Error("Ce créneau n'est plus disponible, merci d'en choisir un autre.");
    if (data.payment_method === "online") throw new Error("Le paiement en ligne n'est pas encore activé.");
    if (!modeEnabled(r, data.mode)) throw new Error(data.mode === "delivery" ? "La livraison n'est pas proposée par ce restaurant." : "La vente à emporter n'est pas proposée.");
    if (!paymentEnabled(r, "on_site")) throw new Error("Ce mode de paiement n'est pas accepté.");

    const items = data.lines.map((l) => {
      const item = catalog.itemsById[l.itemId];
      if (!item) throw new Error("Article inconnu");
      const err = validateSelections(item, l.sel);
      if (err) throw new Error(err);
      const unit = unitPrice(item, l.sel);
      return { id: item.id, name: item.name, qty: l.qty, unit, total: Math.round(unit * l.qty * 100) / 100, details: describeSelections(item, l.sel) };
    });
    const subtotal = Math.round(items.reduce((s, i) => s + i.total, 0) * 100) / 100;

    let fee = 0;
    let city: string | null = null;
    if (data.mode === "delivery") {
      const zone = r.delivery.zones.find((z) => z.cp === data.postal_code);
      if (!zone) throw new Error("Désolé, cette adresse est hors de notre zone de livraison.");
      if (!data.address || data.address.length < 5) throw new Error("Adresse de livraison requise.");
      if (subtotal < r.delivery.minOrder) throw new Error(`Minimum de commande en livraison : ${r.delivery.minOrder} €`);
      fee = deliveryFee(r, subtotal);
      city = zone.city;
    }

    const { data: row, error } = await supabaseAdmin
      .from("orders")
      .insert({
        restaurant_id: r.id,
        customer_name: data.customer_name,
        phone: data.phone,
        email: data.email || null,
        mode: data.mode,
        address: data.mode === "delivery" ? (data.address ?? null) : null,
        postal_code: data.mode === "delivery" ? (data.postal_code ?? null) : null,
        city,
        slot: data.slot,
        items,
        notes: data.notes || null,
        subtotal,
        delivery_fee: fee,
        total: Math.round((subtotal + fee) * 100) / 100,
        payment_method: data.payment_method,
        status: r.config.autoAccept ? "accepted" : "new",
      })
      .select("id, order_number")
      .single();
    if (error) {
      console.error(error);
      throw new Error("Impossible d'enregistrer la commande.");
    }
    return row;
  });

export const getOrderStatus = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, status, mode, slot, total, items, payment_method, customer_name, restaurants(slug)")
      .eq("id", data.id)
      .maybeSingle();
    return row;
  });

const kioskSchema = z.object({
  restaurant: z.string().max(40),
  mode: z.enum(["dine_in", "pickup"]),
  payment_method: z.enum(["counter", "card_terminal"]),
  customer_name: z.string().trim().max(40).optional(),
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
    if (!modeEnabled(r, data.mode)) throw new Error("Ce mode n'est pas proposé.");
    if (!paymentEnabled(r, data.payment_method)) throw new Error("Ce mode de paiement n'est pas accepté.");
    const catalog = getCatalog(r);
    const items = data.lines.map((l) => {
      const item = catalog.itemsById[l.itemId];
      if (!item) throw new Error("Article inconnu");
      const err = validateSelections(item, l.sel);
      if (err) throw new Error(err);
      const unit = unitPrice(item, l.sel);
      return { id: item.id, name: item.name, qty: l.qty, unit, total: Math.round(unit * l.qty * 100) / 100, details: describeSelections(item, l.sel) };
    });
    const subtotal = Math.round(items.reduce((s, i) => s + i.total, 0) * 100) / 100;
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
        total: subtotal,
        payment_method: data.payment_method,
        source: "kiosk",
        status: r.config.autoAccept ? "accepted" : "new",
      })
      .select("id, order_number, total")
      .single();
    if (error) {
      console.error(error);
      throw new Error("Impossible d'enregistrer la commande.");
    }
    return row;
  });
