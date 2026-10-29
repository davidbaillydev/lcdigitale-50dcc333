// Paiement en ligne du site : démarrage, disponibilité et confirmation multi-prestataires.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { platformFeeFor, type PlatformFeeChannel } from "../platform-fee";
import { admin, assertOrdersOpen, markPaid } from "./shared";
import { handleStripeSession, stripeCall, stripeForRestaurant } from "./stripe";
import { paypalCall, paypalForRestaurant } from "./paypal";
import { handleMolliePayment, mollieCall, mollieForRestaurant } from "./mollie";
import { handleLyraResult, lyraForRestaurant, lyraSign } from "./lyra";

/** Prépare le paiement en ligne choisi pour une commande déjà enregistrée (appelé par createOrder). */
export async function startOnlinePayment(provider: "paypal" | "lyra" | "mollie", o: { id: string; order_number: number; total: number; restaurant_id: string; email?: string | null }, restaurantName: string, returnBase: string, channel: PlatformFeeChannel) {
  await assertOrdersOpen(o.restaurant_id);
  const db = await admin();
  const amount = Math.round(Number(o.total) * 100);
  if (provider === "paypal") {
    const p = await paypalForRestaurant(o.restaurant_id);
    if (!p) throw new Error("PayPal n'est pas disponible pour ce restaurant.");
    const res = await paypalCall(p, "/v2/checkout/orders", {
      intent: "CAPTURE",
      purchase_units: [{ custom_id: o.id, description: `${restaurantName} — commande n° ${o.order_number}`.slice(0, 127), amount: { currency_code: "EUR", value: (amount / 100).toFixed(2) } }],
      application_context: { brand_name: restaurantName.slice(0, 127), user_action: "PAY_NOW", shipping_preference: "NO_SHIPPING", locale: "fr-FR", return_url: returnBase, cancel_url: `${returnBase}${returnBase.includes("?") ? "&" : "?"}annule=1` },
    }) as { id: string; links?: { rel: string; href: string }[] };
    const url = res.links?.find((l) => l.rel === "approve" || l.rel === "payer-action")?.href;
    if (!url) throw new Error("PayPal : lien de paiement manquant");
    await db.from("orders").update({ payment_ref: `paypal:${res.id}` }).eq("id", o.id);
    return { redirectUrl: url };
  }
  if (provider === "mollie") {
    const m = await mollieForRestaurant(o.restaurant_id);
    if (!m) throw new Error("Mollie n'est pas disponible pour ce restaurant.");
    const origin = new URL(returnBase).origin;
    const { data: rc } = await db.from("restaurants").select("config").eq("id", o.restaurant_id).maybeSingle();
    const fee = m.oauth ? platformFeeFor(amount, (rc?.config as { platformFee?: unknown } | null)?.platformFee, channel) : 0;
    const publicHook = !/localhost|127\.0\.0\.1/.test(origin);
    const res = await mollieCall(m.key, "/payments", {
      amount: { currency: "EUR", value: (amount / 100).toFixed(2) },
      description: `${restaurantName} — commande n° ${o.order_number}`.slice(0, 255),
      redirectUrl: `${returnBase}${returnBase.includes("?") ? "&" : "?"}origin=mollie`, cancelUrl: `${returnBase}${returnBase.includes("?") ? "&" : "?"}origin=mollie&annule=1`,
      ...(publicHook ? { webhookUrl: `${origin}/api/public/mollie-webhook` } : {}),
      locale: "fr_FR", metadata: { order_id: o.id },
      ...(m.profileId ? { profileId: m.profileId } : {}),
      // Commission plateforme (uniquement pour les comptes reliés via Mollie Connect)
      ...(fee > 0 ? { applicationFee: { amount: { currency: "EUR", value: fee.toFixed(2) }, description: "Commission plateforme LCDIGITALE" } } : {}),
    }, `pay_${o.id}`) as { id: string; _links?: { checkout?: { href?: string } } };
    const url = res._links?.checkout?.href;
    if (!url) throw new Error("Mollie : lien de paiement manquant");
    await db.from("orders").update({ payment_ref: `mollie:${res.id}`, platform_fee: fee }).eq("id", o.id);
    return { redirectUrl: url };
  }
  const l = await lyraForRestaurant(o.restaurant_id);
  if (!l) throw new Error("Le paiement Lyra n'est pas disponible pour ce restaurant.");
  const transId = String(Math.floor(Math.random() * 900000)).padStart(6, "0");
  const d = new Date();
  const p2 = (n: number) => String(n).padStart(2, "0");
  const fields: Record<string, string> = {
    vads_action_mode: "INTERACTIVE", vads_amount: String(amount), vads_ctx_mode: l.mode, vads_currency: "978",
    vads_language: "fr", vads_order_id: o.id, vads_page_action: "PAYMENT", vads_payment_config: "SINGLE",
    vads_return_mode: "GET", vads_site_id: l.siteId,
    vads_trans_date: `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}`,
    vads_trans_id: transId, vads_url_return: returnBase, vads_url_check: `${new URL(returnBase).origin}/api/public/lyra-ipn`, vads_version: "V2",
    ...(o.email ? { vads_cust_email: o.email } : {}),
  };
  fields["signature"] = await lyraSign(fields, l.key);
  await db.from("orders").update({ payment_ref: `lyra:${transId}` }).eq("id", o.id);
  return { form: { action: l.gateway, fields } };
}

/** Indique au site les paiements en ligne disponibles (renvoie seulement la clé publiable Stripe). */
export const onlinePaymentInfo = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().max(40) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: r } = await db.from("restaurants").select("id").eq("slug", data.slug).eq("active", true).maybeSingle();
    if (!r) return { stripe: null as string | null, paypal: false, lyra: false, mollie: false };
    const [s, p, l, m] = await Promise.all([stripeForRestaurant(r.id), paypalForRestaurant(r.id), lyraForRestaurant(r.id), mollieForRestaurant(r.id)]);
    return { stripe: s?.publishable ?? null, paypal: !!p, lyra: !!l, mollie: !!m };
  });

/** Vérifie auprès du prestataire le paiement d'une commande en ligne et l'envoie en cuisine si payé. */
export const confirmOnlinePayment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    orderId: z.string().uuid(),
    cancelled: z.boolean().optional(),
    lyra: z.record(z.string().max(60), z.string().max(500)).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: o } = await db.from("orders").select("id, restaurant_id, status, total, payment_method, payment_status, payment_ref").eq("id", data.orderId).maybeSingle();
    if (!o || o.payment_method !== "online") throw new Error("Commande introuvable");
    if (o.payment_status === "paid") return { status: "paid" as const };
    if (o.payment_status !== "pending") return { status: "failed" as const };
    if (!o.payment_ref) return { status: "failed" as const };
    const ref = String(o.payment_ref);

    if (ref.startsWith("lyra:")) {
      if (data.lyra?.["vads_order_id"] === o.id) {
        const r = await handleLyraResult(data.lyra!);
        return { status: r === "failed" ? "retry" as const : r };
      }
      return { status: data.cancelled ? "retry" as const : "pending" as const };
    }

    if (ref.startsWith("mollie:")) {
      const r = await handleMolliePayment(ref.slice(7));
      return { status: r === "failed" ? "failed" as const : r === "pending" && data.cancelled ? "retry" as const : r };
    }

    if (ref.startsWith("paypal:")) {
      const p = await paypalForRestaurant(o.restaurant_id, false);
      if (!p) return { status: "pending" as const };
      const id = encodeURIComponent(ref.slice(7));
      let po = await paypalCall(p, `/v2/checkout/orders/${id}`) as { status?: string; purchase_units?: { custom_id?: string; amount?: { value?: string } }[] };
      if (po.purchase_units?.[0]?.custom_id !== o.id) throw new Error("Paiement non reconnu");
      if (po.status === "APPROVED") {
        try { po = await paypalCall(p, `/v2/checkout/orders/${id}/capture`, {}) as typeof po; }
        catch { return { status: "retry" as const }; }
      }
      if (po.status === "COMPLETED") {
        const cap = (po.purchase_units?.[0] as { payments?: { captures?: { status?: string; amount?: { value?: string } }[] } } | undefined)?.payments?.captures?.[0];
        const value = cap?.amount?.value ?? po.purchase_units?.[0]?.amount?.value;
        if (Number(value) === Number(o.total) && (!cap || cap.status === "COMPLETED")) { await markPaid(o); return { status: "paid" as const }; }
        return { status: "pending" as const };
      }
      if (po.status === "VOIDED") return { status: "failed" as const };
      return { status: data.cancelled ? "retry" as const : "pending" as const };
    }

    if (ref.startsWith("stripecs:")) return { status: await handleStripeSession(o) };

    const s = await stripeForRestaurant(o.restaurant_id);
    if (!s) return { status: "pending" as const };
    const pi = await stripeCall(`/payment_intents/${encodeURIComponent(ref)}`, s.secret) as { status?: string; metadata?: { order_id?: string } };
    if (pi.metadata?.order_id !== o.id) throw new Error("Paiement non reconnu");
    if (pi.status === "succeeded") { await markPaid(o); return { status: "paid" as const }; }
    if (pi.status === "canceled" || pi.status === "requires_payment_method") return { status: pi.status === "canceled" ? "failed" as const : "retry" as const };
    return { status: "pending" as const };
  });
