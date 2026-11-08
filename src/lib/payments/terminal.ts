// TPE Cloud de la borne (Stripe Terminal, Mollie POS ou SumUp Solo).
import { legacyPaymentsSupported } from "../money";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin, assertManager, assertOrdersOpen, getRow } from "./shared";
import { sumup, sumupForRestaurant } from "./sumup";
import { stripeCall } from "./stripe";
import { mollieCall, mollieForRestaurant } from "./mollie";
import { kioskReadersOf, normalizeKioskId, readerForKiosk } from "../kiosk-readers";

// ───────────── TPE Cloud de la borne (Stripe Terminal, Mollie POS ou SumUp Solo) ─────────────
export const TERMINALS = ["stripe", "mollie", "sumup"] as const;
export type TerminalKind = (typeof TERMINALS)[number];
export type Terminal =
  | { kind: "sumup"; apiKey: string; merchant: string; reader: string }
  | { kind: "stripe"; secret: string; reader: string }
  | { kind: "mollie"; key: string; terminal: string; profileId?: string | undefined; live: boolean };

export async function terminalCandidate(restaurantId: string, kind: TerminalKind): Promise<Terminal | null> {
  if (kind === "sumup") { const s = await sumupForRestaurant(restaurantId); return s ? { kind, ...s } : null; }
  if (kind === "stripe") {
    const r = await getRow(restaurantId, "stripe");
    const sk = r?.credentials["secretKey"], reader = r?.credentials["readerId"];
    return r?.enabled && sk && reader ? { kind, secret: sk, reader } : null;
  }
  const r = await getRow(restaurantId, "mollie");
  const m = await mollieForRestaurant(restaurantId);
  const t = r?.credentials["terminalId"];
  return m && t ? { kind, key: m.key, terminal: t, profileId: m.profileId, live: m.live } : null;
}
/** Terminal choisi par l'agence (restaurants.config.terminal), sinon le premier prêt. */
export async function terminalForRestaurant(restaurantId: string, kioskId?: string | null): Promise<Terminal | null> {
  const db = await admin();
  const { data } = await db.from("restaurants").select("config").eq("id", restaurantId).maybeSingle();
  if (!data || !legacyPaymentsSupported(data)) return null;
  const chosen = (data?.config as { terminal?: TerminalKind } | null)?.terminal;
  let t: Terminal | null = null;
  if (chosen && TERMINALS.includes(chosen)) t = await terminalCandidate(restaurantId, chosen);
  else for (const k of ["sumup", "stripe", "mollie"] as const) { t = await terminalCandidate(restaurantId, k); if (t) break; }
  // Borne identifiée : même compte prestataire, mais son propre lecteur physique
  const own = t ? readerForKiosk(data?.config, kioskId) : null;
  if (t && own) return t.kind === "mollie" ? { ...t, terminal: own } : { ...t, reader: own };
  return t;
}
const kioskField = z.string().max(40).nullish();
export async function mollieDelete(key: string, path: string) {
  await fetch(`https://api.mollie.com/v2${path}`, { method: "DELETE", headers: { Authorization: `Bearer ${key}` } }).catch(() => null);
}

/** TPE Cloud choisi pour la borne (null = automatique). */
export const getKioskTerminal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.restaurantId);
    const db = await admin();
    const { data: r } = await db.from("restaurants").select("config").eq("id", data.restaurantId).single();
    const t = (r?.config as { terminal?: TerminalKind } | null)?.terminal;
    const ready = await terminalForRestaurant(data.restaurantId);
    return { terminal: t && TERMINALS.includes(t) ? t : null, active: ready?.kind ?? null, kiosks: kioskReadersOf(r?.config) };
  });

/** Choix du TPE Cloud de la borne (agence). */
export const setKioskTerminal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid(), terminal: z.enum(TERMINALS).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.restaurantId);
    const db = await admin();
    const { data: r } = await db.from("restaurants").select("config").eq("id", data.restaurantId).single();
    const config = { ...(r?.config ?? {}) } as Record<string, unknown>;
    if (data.terminal) config["terminal"] = data.terminal; else delete config["terminal"];
    const { error } = await db.from("restaurants").update({ config }).eq("id", data.restaurantId);
    if (error) throw new Error("Enregistrement impossible");
    return { ok: true };
  });

/** Lecteurs propres à chaque borne (agence) : la borne ouverte avec ?borne=<id> utilise son lecteur. */
export const setKioskReaders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid(), kiosks: z.array(z.object({ id: z.string().max(20), label: z.string().max(40), reader: z.string().trim().min(3).max(80).regex(/^[A-Za-z0-9_-]+$/) })).max(20) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.restaurantId);
    const kiosks = data.kiosks.map((k) => ({ ...k, id: normalizeKioskId(k.id) ?? "" }));
    if (kiosks.some((k) => !k.id)) throw new Error("Chaque borne doit avoir un identifiant (lettres, chiffres ou tirets).");
    if (new Set(kiosks.map((k) => k.id)).size !== kiosks.length) throw new Error("Deux bornes ont le même identifiant.");
    const db = await admin();
    const { data: r } = await db.from("restaurants").select("config").eq("id", data.restaurantId).single();
    const config = { ...(r?.config ?? {}) } as Record<string, unknown>;
    if (kiosks.length) config["kioskReaders"] = kiosks; else delete config["kioskReaders"];
    const { error } = await db.from("restaurants").update({ config }).eq("id", data.restaurantId);
    if (error) throw new Error("Enregistrement impossible");
    return { ok: true };
  });

/** Vérifie que le lecteur configuré est joignable (identifiants jamais renvoyés). */
export const testKioskTerminal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid(), kind: z.enum(TERMINALS) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.restaurantId);
    const t = await terminalCandidate(data.restaurantId, data.kind);
    if (!t) throw new Error("Prestataire désactivé ou identifiant du lecteur manquant.");
    if (t.kind === "stripe") {
      const r = await stripeCall(`/terminal/readers/${encodeURIComponent(t.reader)}`, t.secret) as { status?: string; label?: string; device_type?: string };
      return { online: r.status === "online", label: r.label ?? r.device_type ?? "Lecteur Stripe", status: r.status ?? "inconnu" };
    }
    if (t.kind === "mollie") {
      const r = await mollieCall(t.key, `/terminals/${encodeURIComponent(t.terminal)}`) as { status?: string; description?: string; brand?: string; model?: string };
      return { online: r.status === "active", label: r.description ?? `${r.brand ?? "Mollie"} ${r.model ?? ""}`.trim(), status: r.status ?? "inconnu" };
    }
    const body = await sumup(`/v0.1/merchants/${t.merchant}/readers/${t.reader}`, t.apiKey) as { name?: string; status?: string };
    return { online: body.status !== "expired", label: body.name ?? "SumUp Solo", status: body.status ?? "inconnu" };
  });

/** Indique à la borne si un terminal de paiement est prêt (aucune clé n'est exposée). */
export const kioskTerminalAvailable = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().max(40) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: r } = await db.from("restaurants").select("id, config").eq("slug", data.slug).eq("active", true).maybeSingle();
    if (!r || (r.config as { payments?: { online?: boolean } } | null)?.payments?.online === false) return { available: false };
    return { available: !!(await terminalForRestaurant(r.id)) };
  });

/** Terminal de borne configuré (usage serveur uniquement). */
export async function kioskTerminalReady(restaurantId: string) { return !!(await terminalForRestaurant(restaurantId)); }

/** Commande borne en attente de paiement carte (Voie B) : passe en cuisine une fois payée. */
export async function releaseKioskOrder(db: Awaited<ReturnType<typeof admin>>, orderId: string) {
  const { data: o } = await db.from("orders").select("id, status, restaurants(config)").eq("id", orderId).single();
  if (!o || o.status !== "awaiting_payment") return;
  const cfg = (o.restaurants as unknown as { config: { autoAccept?: boolean } | null } | null)?.config;
  const { data: upd } = await db.from("orders").update({ status: cfg?.autoAccept ? "accepted" : "new", updated_at: new Date().toISOString() }).eq("id", orderId).eq("status", "awaiting_payment").select("id");
  if (!upd?.length) return;
  try { const { syncOrderToPos } = await import("../pos.server"); await syncOrderToPos(orderId); } catch (e) { console.error(e); }
}

export async function kioskOrder(orderId: string) {
  const db = await admin();
  const { data: o } = await db.from("orders").select("id, restaurant_id, order_number, total, source, payment_method, payment_status, payment_ref, created_at").eq("id", orderId).maybeSingle();
  if (!o || o.source !== "kiosk" || o.payment_method !== "card_terminal") throw new Error("Commande introuvable");
  if (Date.now() - new Date(o.created_at).getTime() > 30 * 60_000) throw new Error("Commande expirée");
  return { db, o };
}

/** Envoie le montant de la commande borne sur le TPE Cloud du restaurant. */
export const startKioskCardPayment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid(), kioskId: kioskField }).parse(d))
  .handler(async ({ data }) => {
    const { requireCustomerAccess } = await import("../customer-access.server");
    requireCustomerAccess("kiosk", data.orderId);
    const { db, o } = await kioskOrder(data.orderId);
    if (o.payment_status === "paid") return { status: "paid" as const };
    await assertOrdersOpen(o.restaurant_id);
    const t = await terminalForRestaurant(o.restaurant_id, data.kioskId);
    if (!t) throw new Error("Terminal de paiement non configuré");
    const cents = Math.round(Number(o.total) * 100);
    const description = `Commande borne n° ${o.order_number}`;
    let ref: string | null = null;
    if (t.kind === "stripe") {
      const pi = await stripeCall("/payment_intents", t.secret, {
        amount: String(cents), currency: "eur", "payment_method_types[]": "card_present", capture_method: "automatic",
        description, "metadata[order_id]": o.id,
      }) as { id: string };
      await stripeCall(`/terminal/readers/${encodeURIComponent(t.reader)}/process_payment_intent`, t.secret, { payment_intent: pi.id });
      ref = `stripe_term:${pi.id}`;
    } else if (t.kind === "mollie") {
      const p = await mollieCall(t.key, "/payments", {
        amount: { currency: "EUR", value: (cents / 100).toFixed(2) }, description, method: "pointofsale", terminalId: t.terminal,
        metadata: { order_id: o.id }, ...(t.profileId ? { profileId: t.profileId } : {}), ...(t.profileId && !t.live ? { testmode: true } : {}),
      }, `kiosk-${o.id}-${Date.now()}`) as { id: string };
      ref = `mollie_term:${p.id}`;
    } else {
      const body = await sumup(`/v0.1/merchants/${t.merchant}/readers/${t.reader}/checkout`, t.apiKey, {
        method: "POST", body: JSON.stringify({ total_amount: { currency: "EUR", minor_unit: 2, value: cents }, description }),
      }) as { data?: { client_transaction_id?: string } };
      ref = body?.data?.client_transaction_id ?? null;
    }
    await db.from("orders").update({ payment_ref: ref, payment_status: "pending" }).eq("id", o.id);
    return { status: "pending" as const };
  });

/** Statut du paiement sur terminal (la borne interroge toutes les 2 s ; l'état est toujours relu chez le prestataire). */
export const kioskPaymentStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid(), kioskId: kioskField }).parse(d))
  .handler(async ({ data }) => {
    const { requireCustomerAccess } = await import("../customer-access.server");
    requireCustomerAccess("kiosk", data.orderId);
    const { db, o } = await kioskOrder(data.orderId);
    if (o.payment_status === "paid" || o.payment_status === "failed") return { status: o.payment_status as "paid" | "failed" };
    if (!o.payment_ref) return { status: "pending" as const };
    const t = await terminalForRestaurant(o.restaurant_id, data.kioskId);
    if (!t) return { status: "failed" as const };
    let next: "paid" | "failed" | "pending" = "pending";
    try {
      if (o.payment_ref.startsWith("stripe_term:") && t.kind === "stripe") {
        const pi = await stripeCall(`/payment_intents/${o.payment_ref.slice(12)}`, t.secret) as { status: string };
        if (pi.status === "succeeded") next = "paid";
        else if (pi.status === "canceled") next = "failed";
        else {
          const rd = await stripeCall(`/terminal/readers/${encodeURIComponent(t.reader)}`, t.secret) as { action?: { status?: string } | null };
          if (rd.action?.status === "failed") next = "failed";
        }
      } else if (o.payment_ref.startsWith("mollie_term:") && t.kind === "mollie") {
        const p = await mollieCall(t.key, `/payments/${o.payment_ref.slice(12)}${t.profileId && !t.live ? "?testmode=true" : ""}`) as { status: string };
        next = p.status === "paid" ? "paid" : ["failed", "canceled", "expired"].includes(p.status) ? "failed" : "pending";
      } else if (t.kind === "sumup") {
        const tx = await sumup(`/v2.1/merchants/${t.merchant}/transactions?client_transaction_id=${encodeURIComponent(o.payment_ref)}`, t.apiKey) as { status?: string };
        next = tx?.status === "SUCCESSFUL" ? "paid" : tx?.status === "FAILED" || tx?.status === "CANCELLED" ? "failed" : "pending";
      }
    } catch { return { status: "pending" as const }; } // transaction pas encore créée
    if (next !== "pending") await db.from("orders").update({ payment_status: next, updated_at: new Date().toISOString() }).eq("id", o.id).eq("payment_status", "pending");
    if (next === "paid") await releaseKioskOrder(db, o.id);
    return { status: next };
  });

/** Annule le paiement en cours sur le terminal. */
export const cancelKioskPayment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid(), kioskId: kioskField }).parse(d))
  .handler(async ({ data }) => {
    const { requireCustomerAccess } = await import("../customer-access.server");
    requireCustomerAccess("kiosk", data.orderId);
    const { db, o } = await kioskOrder(data.orderId);
    if (o.payment_status === "paid") { await releaseKioskOrder(db, o.id); return { status: "paid" as const }; }
    // Jamais d'annulation sur le terminal sans paiement en attente propre à cette commande
    if (o.payment_status !== "pending" || !o.payment_ref) return { status: "failed" as const };
    const t = await terminalForRestaurant(o.restaurant_id, data.kioskId);
    try {
      if (t?.kind === "stripe" && o.payment_ref.startsWith("stripe_term:")) {
        const pi = o.payment_ref.slice(12);
        const reader = await stripeCall(`/terminal/readers/${encodeURIComponent(t.reader)}`, t.secret) as { action?: { process_payment_intent?: { payment_intent?: string | { id?: string } } } | null };
        const cur = reader.action?.process_payment_intent?.payment_intent;
        const curId = typeof cur === "string" ? cur : cur?.id;
        if (curId === pi) await stripeCall(`/terminal/readers/${encodeURIComponent(t.reader)}/cancel_action`, t.secret, {}).catch(() => null);
        await stripeCall(`/payment_intents/${encodeURIComponent(pi)}/cancel`, t.secret, {});
      } else if (t?.kind === "mollie" && o.payment_ref.startsWith("mollie_term:")) {
        await mollieDelete(t.key, `/payments/${o.payment_ref.slice(12)}${t.profileId && !t.live ? "?testmode=true" : ""}`);
      } else if (t?.kind === "sumup") {
        const tx = await sumup(`/v2.1/merchants/${t.merchant}/transactions?client_transaction_id=${encodeURIComponent(o.payment_ref)}`, t.apiKey) as { status?: string };
        if (tx?.status === "PENDING") await sumup(`/v0.1/merchants/${t.merchant}/readers/${t.reader}/terminate`, t.apiKey, { method: "POST" });
      }
    } catch { /* déjà terminé */ }
    // Un paiement validé juste avant l'annulation reste payé
    const { data: cur } = await db.from("orders").select("payment_status").eq("id", o.id).single();
    if (cur?.payment_status === "paid") { await releaseKioskOrder(db, o.id); return { status: "paid" as const }; }
    await db.from("orders").update({ payment_status: "failed" }).eq("id", o.id).eq("payment_status", "pending");
    return { status: "failed" as const };
  });

/** Voie B : le client abandonne après un refus/annulation — la commande non payée est annulée, jamais envoyée en cuisine. */
export const abandonKioskOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireCustomerAccess } = await import("../customer-access.server");
    requireCustomerAccess("kiosk", data.orderId);
    const db = await admin();
    const { data: o } = await db.from("orders").select("id, source, payment_method, payment_status, payment_ref, status").eq("id", data.orderId).maybeSingle();
    if (!o || o.source !== "kiosk" || o.payment_method !== "card_terminal" || o.status !== "awaiting_payment") return { status: "ignored" as const };
    if (o.payment_status === "paid") { await releaseKioskOrder(db, o.id); return { status: "paid" as const }; }
    if (o.payment_status === "pending" && o.payment_ref) return { status: "pending" as const }; // annuler d'abord sur le terminal
    await db.from("orders").update({ status: "cancelled", payment_status: "failed", updated_at: new Date().toISOString() }).eq("id", o.id).eq("status", "awaiting_payment").neq("payment_status", "paid");
    return { status: "cancelled" as const };
  });
