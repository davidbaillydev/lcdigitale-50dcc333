// Prestataires de paiement par restaurant. Les clés sont stockées côté serveur uniquement
// (table accessible au seul rôle service) et ne sont jamais renvoyées en clair au navigateur.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PROVIDERS = ["sumup", "stripe", "paypal", "lyra"] as const;
export type Provider = (typeof PROVIDERS)[number];
const SUMUP = "https://api.sumup.com";

type Row = { restaurant_id: string; provider: Provider; enabled: boolean; credentials: Record<string, string>; settings: Record<string, string> };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertManager(supabase: any, userId: string, restaurantId: string) {
  const { data } = await supabase.rpc("is_restaurant_manager", { _user_id: userId, _restaurant_id: restaurantId });
  if (!data) throw new Error("Réservé au gérant ou à l'agence");
}
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any;
}
async function getRow(restaurantId: string, provider: Provider): Promise<Row | null> {
  const db = await admin();
  const { data } = await db.from("restaurant_payment_providers").select("*").eq("restaurant_id", restaurantId).eq("provider", provider).maybeSingle();
  return data as Row | null;
}
const mask = (v?: string) => (v ? `••••${v.slice(-4)}` : "");
// Champs non secrets, réaffichés en clair dans les réglages
const PUBLIC_FIELDS = ["merchantCode", "publishableKey", "mode", "siteId", "gateway"];

async function sumup(path: string, apiKey: string, init?: RequestInit) {
  const res = await fetch(`${SUMUP}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    console.error("SumUp", path, res.status, text.slice(0, 500));
    const msg = (body as { detail?: string; message?: string; errors?: { detail?: string } })?.detail
      ?? (body as { message?: string })?.message ?? `erreur ${res.status}`;
    throw new Error(`SumUp : ${msg}`);
  }
  return body;
}

/** État des prestataires d'un restaurant (clés masquées). */
export const listPaymentProviders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.restaurantId);
    const db = await admin();
    const { data: rows } = await db.from("restaurant_payment_providers").select("*").eq("restaurant_id", data.restaurantId);
    return PROVIDERS.map((p) => {
      const r = (rows as Row[] | null)?.find((x) => x.provider === p);
      return {
        provider: p,
        enabled: r?.enabled ?? false,
        credentials: Object.fromEntries(Object.entries(r?.credentials ?? {}).map(([k, v]) => [k, PUBLIC_FIELDS.includes(k) ? v : mask(v)])),
        settings: r?.settings ?? {},
      };
    });
  });

const credSchema = z.record(z.string().max(40), z.string().trim().max(300));

/** Active/désactive un prestataire et met à jour ses clés (champ vide = clé conservée). */
export const savePaymentProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    restaurantId: z.string().uuid(), provider: z.enum(PROVIDERS), enabled: z.boolean(), credentials: credSchema,
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.restaurantId);
    const prev = await getRow(data.restaurantId, data.provider);
    const credentials = { ...(prev?.credentials ?? {}) };
    for (const [k, v] of Object.entries(data.credentials)) if (v) credentials[k] = v;
    if (data.enabled && data.provider === "sumup" && (!credentials["apiKey"] || !credentials["merchantCode"]))
      throw new Error("Renseignez la clé API et le code marchand SumUp.");
    if (data.provider === "stripe") {
      const pk = credentials["publishableKey"] ?? "", sk = credentials["secretKey"] ?? "";
      if (data.enabled && (!pk || !sk)) throw new Error("Renseignez la clé publiable et la clé secrète Stripe.");
      if (pk && !/^pk_(test|live)_/.test(pk)) throw new Error("La clé publiable doit commencer par pk_test_ ou pk_live_.");
      if (sk && !/^(sk|rk)_(test|live)_/.test(sk)) throw new Error("La clé secrète doit commencer par sk_test_ ou sk_live_.");
      const mode = data.credentials["mode"] || credentials["mode"] || "test";
      credentials["mode"] = mode;
      if (pk && sk && (!pk.includes(`_${mode}_`) || !sk.includes(`_${mode}_`))) throw new Error(`Les clés ne correspondent pas au mode ${mode === "live" ? "réel" : "test"}.`);
    }
    if (data.provider === "paypal") {
      credentials["mode"] = credentials["mode"] === "live" ? "live" : "sandbox";
      if (data.enabled && (!credentials["clientId"] || !credentials["secret"])) throw new Error("Renseignez le Client ID et le Secret PayPal.");
    }
    if (data.provider === "lyra") {
      credentials["mode"] = credentials["mode"] === "PRODUCTION" ? "PRODUCTION" : "TEST";
      if (credentials["siteId"] && !/^\d{8}$/.test(credentials["siteId"])) throw new Error("L'identifiant boutique doit contenir 8 chiffres.");
      if (credentials["gateway"] && !/^https:\/\/[a-z0-9.-]+\/vads-payment\/?$/i.test(credentials["gateway"])) throw new Error("Adresse de plateforme invalide (ex. https://secure.payzen.eu/vads-payment/).");
      if (data.enabled && (!credentials["siteId"] || !credentials["key"])) throw new Error("Renseignez l'identifiant boutique et la clé Lyra.");
    }
    const db = await admin();
    const { error } = await db.from("restaurant_payment_providers").upsert({
      restaurant_id: data.restaurantId, provider: data.provider, enabled: data.enabled, credentials, settings: prev?.settings ?? {},
    });
    if (error) throw new Error("Enregistrement impossible");
    return { ok: true };
  });

/** Vérifie les clés SumUp et liste les terminaux associés au compte. */
export const testSumup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.restaurantId);
    const r = await getRow(data.restaurantId, "sumup");
    if (!r?.credentials["apiKey"] || !r.credentials["merchantCode"]) throw new Error("Enregistrez d'abord la clé API et le code marchand.");
    const body = await sumup(`/v0.1/merchants/${encodeURIComponent(r.credentials["merchantCode"])}/readers`, r.credentials["apiKey"]) as { items?: { id: string; name: string; status: string }[] };
    return { readers: (body?.items ?? []).map((x) => ({ id: x.id, name: x.name, status: x.status })) };
  });

/** Associe un terminal SumUp (Solo) avec le code affiché sur l'appareil. */
export const pairSumupReader = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    restaurantId: z.string().uuid(),
    pairingCode: z.string().trim().max(20).optional(),
    readerId: z.string().trim().max(80).optional(),
    name: z.string().trim().min(1).max(60).default("Borne"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.restaurantId);
    const r = await getRow(data.restaurantId, "sumup");
    if (!r?.credentials["apiKey"] || !r.credentials["merchantCode"]) throw new Error("Enregistrez d'abord la clé API et le code marchand.");
    let readerId = data.readerId; let readerName = data.name;
    if (!readerId) {
      if (!data.pairingCode) throw new Error("Saisissez le code d'association affiché sur le terminal.");
      const body = await sumup(`/v0.1/merchants/${encodeURIComponent(r.credentials["merchantCode"])}/readers`, r.credentials["apiKey"], {
        method: "POST", body: JSON.stringify({ pairing_code: data.pairingCode.toUpperCase(), name: data.name }),
      }) as { id: string; name: string };
      readerId = body.id; readerName = body.name;
    }
    const db = await admin();
    await db.from("restaurant_payment_providers").update({ settings: { ...r.settings, readerId, readerName } })
      .eq("restaurant_id", data.restaurantId).eq("provider", "sumup");
    return { readerId, readerName };
  });

async function sumupForRestaurant(restaurantId: string) {
  const r = await getRow(restaurantId, "sumup");
  if (!r?.enabled || !r.credentials["apiKey"] || !r.credentials["merchantCode"] || !r.settings["readerId"]) return null;
  return { apiKey: r.credentials["apiKey"], merchant: encodeURIComponent(r.credentials["merchantCode"]), reader: encodeURIComponent(r.settings["readerId"]) };
}

/** Indique à la borne si un terminal de paiement est prêt (aucune clé n'est exposée). */
export const kioskTerminalAvailable = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().max(40) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: r } = await db.from("restaurants").select("id").eq("slug", data.slug).eq("active", true).maybeSingle();
    if (!r) return { available: false };
    return { available: !!(await sumupForRestaurant(r.id)) };
  });

async function kioskOrder(orderId: string) {
  const db = await admin();
  const { data: o } = await db.from("orders").select("id, restaurant_id, order_number, total, source, payment_method, payment_status, payment_ref, created_at").eq("id", orderId).maybeSingle();
  if (!o || o.source !== "kiosk" || o.payment_method !== "card_terminal") throw new Error("Commande introuvable");
  if (Date.now() - new Date(o.created_at).getTime() > 30 * 60_000) throw new Error("Commande expirée");
  return { db, o };
}

/** Envoie le montant de la commande borne sur le terminal SumUp. */
export const startKioskCardPayment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { db, o } = await kioskOrder(data.orderId);
    if (o.payment_status === "paid") return { status: "paid" as const };
    const s = await sumupForRestaurant(o.restaurant_id);
    if (!s) throw new Error("Terminal de paiement non configuré");
    const body = await sumup(`/v0.1/merchants/${s.merchant}/readers/${s.reader}/checkout`, s.apiKey, {
      method: "POST",
      body: JSON.stringify({
        total_amount: { currency: "EUR", minor_unit: 2, value: Math.round(Number(o.total) * 100) },
        description: `Commande n° ${o.order_number}`,
      }),
    }) as { data?: { client_transaction_id?: string } };
    const ref = body?.data?.client_transaction_id ?? null;
    await db.from("orders").update({ payment_ref: ref, payment_status: "pending" }).eq("id", o.id);
    return { status: "pending" as const };
  });

/** Statut du paiement sur terminal (la borne interroge toutes les 2 s). */
export const kioskPaymentStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { db, o } = await kioskOrder(data.orderId);
    if (o.payment_status === "paid" || o.payment_status === "failed") return { status: o.payment_status as "paid" | "failed" };
    if (!o.payment_ref) return { status: "pending" as const };
    const s = await sumupForRestaurant(o.restaurant_id);
    if (!s) return { status: "failed" as const };
    let tx: { status?: string } | null = null;
    try {
      tx = await sumup(`/v2.1/merchants/${s.merchant}/transactions?client_transaction_id=${encodeURIComponent(o.payment_ref)}`, s.apiKey) as { status?: string };
    } catch { return { status: "pending" as const }; } // transaction pas encore créée
    const st = tx?.status;
    const next = st === "SUCCESSFUL" ? "paid" : st === "FAILED" || st === "CANCELLED" ? "failed" : "pending";
    if (next !== "pending") await db.from("orders").update({ payment_status: next }).eq("id", o.id);
    return { status: next as "paid" | "failed" | "pending" };
  });

/** Annule le paiement en cours sur le terminal. */
export const cancelKioskPayment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { db, o } = await kioskOrder(data.orderId);
    if (o.payment_status === "paid") return { status: "paid" as const };
    const s = await sumupForRestaurant(o.restaurant_id);
    if (s) { try { await sumup(`/v0.1/merchants/${s.merchant}/readers/${s.reader}/terminate`, s.apiKey, { method: "POST" }); } catch { /* déjà terminé */ } }
    await db.from("orders").update({ payment_status: "failed" }).eq("id", o.id);
    return { status: "failed" as const };
  });

// ───────────── Stripe (paiement en ligne sur le site) ─────────────
const STRIPE = "https://api.stripe.com/v1";

export async function stripeCall(path: string, secret: string, form?: Record<string, string>) {
  const res = await fetch(`${STRIPE}${path}`, {
    method: form ? "POST" : "GET",
    headers: { Authorization: `Bearer ${secret}`, ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: form ? new URLSearchParams(form).toString() : null,
  });
  const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
  if (!res.ok) {
    console.error("Stripe", path, res.status, body?.error?.message);
    throw new Error(`Stripe : ${body?.error?.message ?? `erreur ${res.status}`}`);
  }
  return body as Record<string, unknown>;
}

export async function stripeForRestaurant(restaurantId: string) {
  const r = await getRow(restaurantId, "stripe");
  const c = r?.credentials ?? {};
  if (!r?.enabled || !c["secretKey"] || !c["publishableKey"]) return null;
  return { secret: c["secretKey"], publishable: c["publishableKey"] };
}

/** Vérifie les clés Stripe du restaurant. */
export const testStripe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.restaurantId);
    const r = await getRow(data.restaurantId, "stripe");
    if (!r?.credentials["secretKey"]) throw new Error("Enregistrez d'abord la clé secrète.");
    const acc = await stripeCall("/account", r.credentials["secretKey"]) as { id?: string; settings?: { dashboard?: { display_name?: string } }; charges_enabled?: boolean };
    return { name: acc.settings?.dashboard?.display_name ?? acc.id ?? "", chargesEnabled: !!acc.charges_enabled, live: r.credentials["secretKey"].startsWith("sk_live_") };
  });

/** Indique au site si le paiement en ligne est disponible (renvoie seulement la clé publiable). */
export const onlinePaymentInfo = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().max(40) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: r } = await db.from("restaurants").select("id").eq("slug", data.slug).eq("active", true).maybeSingle();
    if (!r) return { available: false, publishableKey: null as string | null };
    const s = await stripeForRestaurant(r.id);
    return { available: !!s, publishableKey: s?.publishable ?? null };
  });

/** Vérifie auprès de Stripe le paiement d'une commande en ligne et l'envoie en cuisine si payé. */
export const confirmOnlinePayment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: o } = await db.from("orders").select("id, restaurant_id, status, payment_method, payment_status, payment_ref").eq("id", data.orderId).maybeSingle();
    if (!o || o.payment_method !== "online") throw new Error("Commande introuvable");
    if (o.payment_status === "paid") return { status: "paid" as const };
    if (!o.payment_ref) return { status: "failed" as const };
    const s = await stripeForRestaurant(o.restaurant_id);
    if (!s) return { status: "pending" as const };
    const pi = await stripeCall(`/payment_intents/${encodeURIComponent(o.payment_ref)}`, s.secret) as { status?: string; metadata?: { order_id?: string } };
    if (pi.metadata?.order_id !== o.id) throw new Error("Paiement non reconnu");
    if (pi.status === "succeeded") {
      const { data: r } = await db.from("restaurants").select("config").eq("id", o.restaurant_id).maybeSingle();
      const next = (r?.config as { autoAccept?: boolean } | null)?.autoAccept ? "accepted" : "new";
      await db.from("orders").update({ payment_status: "paid", status: o.status === "awaiting_payment" ? next : o.status, updated_at: new Date().toISOString() }).eq("id", o.id);
      return { status: "paid" as const };
    }
    if (pi.status === "canceled" || pi.status === "requires_payment_method") return { status: pi.status === "canceled" ? "failed" as const : "retry" as const };
    return { status: "pending" as const };
  });
