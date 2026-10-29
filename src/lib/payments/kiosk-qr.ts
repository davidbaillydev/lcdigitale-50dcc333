// QR code de paiement sur la borne (paiement sur le téléphone du client).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { admin, assertOrdersOpen } from "./shared";
import { handleStripeSession, stripeCall, stripeForRestaurant } from "./stripe";
import { handleMolliePayment, mollieCall, mollieForRestaurant } from "./mollie";

/** Prestataire en ligne utilisable pour le QR borne : Mollie en priorité, sinon Stripe. */
export async function qrProvider(restaurantId: string): Promise<"mollie" | "stripe" | null> {
  if (await mollieForRestaurant(restaurantId)) return "mollie";
  if (await stripeForRestaurant(restaurantId)) return "stripe";
  return null;
}
export async function kioskQrReady(restaurantId: string) { return !!(await qrProvider(restaurantId)); }

export const kioskQrAvailable = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().max(40) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: r } = await db.from("restaurants").select("id").eq("slug", data.slug).eq("active", true).maybeSingle();
    return { available: !!r && !!(await qrProvider(r.id)) };
  });

export async function kioskQrOrder(orderId: string) {
  const db = await admin();
  const { data: o } = await db.from("orders").select("id, restaurant_id, order_number, total, source, status, payment_method, payment_status, payment_ref, created_at").eq("id", orderId).maybeSingle();
  if (!o || o.source !== "kiosk" || o.payment_method !== "online") throw new Error("Commande introuvable");
  if (Date.now() - new Date(o.created_at).getTime() > 30 * 60_000) throw new Error("Commande expirée");
  return { db, o };
}

/** Crée le lien de paiement encodé dans le QR code affiché par la borne. */
export const startKioskQrPayment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid(), origin: z.string().url().max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { db, o } = await kioskQrOrder(data.orderId);
    if (o.status !== "awaiting_payment" || o.payment_status !== "pending") throw new Error("Cette commande n'attend plus de paiement");
    if (o.payment_ref) throw new Error("Un QR code a déjà été généré pour cette commande");
    const u = new URL(data.origin);
    const origin = u.protocol === "https:" || /^(localhost|127\.0\.0\.1)$/.test(u.hostname) ? u.origin : "https://restaurant.lcdigitale.fr";
    const { data: r } = await db.from("restaurants").select("name, slug").eq("id", o.restaurant_id).single();
    const returnBase = `${origin}/${r!.slug}/suivi/${o.id}`;
    const provider = await qrProvider(o.restaurant_id);
    if (provider === "mollie") {
      const res = await startOnlinePayment("mollie", o, r!.name, returnBase, "kiosk") as { redirectUrl: string };
      return { url: res.redirectUrl };
    }
    if (provider === "stripe") {
      await assertOrdersOpen(o.restaurant_id);
      const s = (await stripeForRestaurant(o.restaurant_id))!;
      const cs = await stripeCall("/checkout/sessions", s.secret, {
        mode: "payment", locale: "fr", success_url: returnBase, cancel_url: `${returnBase}?annule=1`,
        "line_items[0][quantity]": "1", "line_items[0][price_data][currency]": "eur",
        "line_items[0][price_data][unit_amount]": String(Math.round(Number(o.total) * 100)),
        "line_items[0][price_data][product_data][name]": `${r!.name} — commande n° ${o.order_number}`.slice(0, 200),
        "metadata[order_id]": o.id, "payment_intent_data[metadata][order_id]": o.id,
        expires_at: String(Math.floor(Date.now() / 1000) + 30 * 60),
      }) as { id: string; url?: string };
      if (!cs.url) throw new Error("Stripe : lien de paiement manquant");
      await db.from("orders").update({ payment_ref: `stripecs:${cs.id}` }).eq("id", o.id);
      return { url: cs.url };
    }
    throw new Error("Aucun paiement en ligne n'est configuré pour ce restaurant.");
  });

/** Vérifie une Checkout Session Stripe et valide la commande si elle est payée. */
export async function handleStripeSession(o: { id: string; restaurant_id: string; status: string; total: number | string; payment_ref: string | null }): Promise<"paid" | "failed" | "pending"> {
  const s = await stripeForRestaurant(o.restaurant_id);
  if (!s || !o.payment_ref) return "pending";
  const cs = await stripeCall(`/checkout/sessions/${encodeURIComponent(o.payment_ref.slice(9))}`, s.secret) as { status?: string; payment_status?: string; amount_total?: number; currency?: string; metadata?: { order_id?: string } };
  if (cs.metadata?.order_id !== o.id) throw new Error("Paiement non reconnu");
  if (cs.payment_status === "paid" && cs.currency === "eur" && cs.amount_total === Math.round(Number(o.total) * 100)) { await markPaid(o); return "paid"; }
  if (cs.status === "expired") return "failed";
  return "pending";
}

/** Interrogée par la borne toutes les 2 s : la commande part en cuisine dès que le paiement est confirmé. */
export const kioskQrStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { o } = await kioskQrOrder(data.orderId);
    if (o.payment_status === "paid") return { status: "paid" as const };
    if (o.status === "cancelled" || o.payment_status !== "pending") return { status: "failed" as const };
    const ref = String(o.payment_ref ?? "");
    if (ref.startsWith("mollie:")) return { status: await handleMolliePayment(ref.slice(7)) };
    if (ref.startsWith("stripecs:")) return { status: await handleStripeSession(o) };
    return { status: "pending" as const };
  });

/** Le client abandonne le QR : on vérifie une dernière fois le paiement, on ferme le lien puis on annule. */
export const abandonKioskQr = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { db, o } = await kioskQrOrder(data.orderId);
    if (o.payment_status === "paid") return { status: "paid" as const };
    if (o.status !== "awaiting_payment") return { status: "ignored" as const };
    const ref = String(o.payment_ref ?? "");
    if (ref.startsWith("stripecs:")) {
      if ((await handleStripeSession(o)) === "paid") return { status: "paid" as const };
      const s = await stripeForRestaurant(o.restaurant_id);
      if (s) await stripeCall(`/checkout/sessions/${encodeURIComponent(ref.slice(9))}/expire`, s.secret, {}).catch(() => {});
      if ((await handleStripeSession(o)) === "paid") return { status: "paid" as const };
    }
    if (ref.startsWith("mollie:")) {
      if ((await handleMolliePayment(ref.slice(7))) === "paid") return { status: "paid" as const };
      const m = await mollieForRestaurant(o.restaurant_id, false);
      if (m) await fetch(`https://api.mollie.com/v2/payments/${encodeURIComponent(ref.slice(7))}`, { method: "DELETE", headers: { Authorization: `Bearer ${m.key}` } }).catch(() => {});
      if ((await handleMolliePayment(ref.slice(7))) === "paid") return { status: "paid" as const };
    }
    await db.from("orders").update({ status: "cancelled", payment_status: "failed", updated_at: new Date().toISOString() }).eq("id", o.id).eq("status", "awaiting_payment").neq("payment_status", "paid");
    return { status: "cancelled" as const };
  });
