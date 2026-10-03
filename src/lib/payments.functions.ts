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

// ───────────── PayPal (Orders v2, redirection) ─────────────
type PaypalCfg = { base: string; clientId: string; secret: string; live: boolean };
async function paypalForRestaurant(restaurantId: string, requireEnabled = true): Promise<PaypalCfg | null> {
  const r = await getRow(restaurantId, "paypal");
  const c = r?.credentials ?? {};
  if ((requireEnabled && !r?.enabled) || !c["clientId"] || !c["secret"]) return null;
  const live = c["mode"] === "live";
  return { base: live ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com", clientId: c["clientId"], secret: c["secret"], live };
}
async function paypalToken(p: PaypalCfg) {
  const res = await fetch(`${p.base}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${p.clientId}:${p.secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const body = await res.json().catch(() => null) as { access_token?: string; error_description?: string } | null;
  if (!res.ok || !body?.access_token) throw new Error(`PayPal : ${body?.error_description ?? `identifiants refusés (${res.status})`}`);
  return body.access_token;
}
async function paypalCall(p: PaypalCfg, path: string, json?: unknown) {
  const token = await paypalToken(p);
  const res = await fetch(`${p.base}${path}`, {
    method: json === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: json === undefined ? null : JSON.stringify(json),
  });
  const body = await res.json().catch(() => null) as Record<string, unknown> | null;
  if (!res.ok) {
    console.error("PayPal", path, res.status, JSON.stringify(body).slice(0, 500));
    throw new Error(`PayPal : ${(body as { message?: string } | null)?.message ?? `erreur ${res.status}`}`);
  }
  return body ?? {};
}

export const testPaypal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.restaurantId);
    const p = await paypalForRestaurant(data.restaurantId, false);
    if (!p) throw new Error("Enregistrez d'abord le Client ID et le Secret.");
    await paypalToken(p);
    return { live: p.live };
  });

// ───────────── Lyra / PayZen (formulaire de paiement V2 signé HMAC-SHA-256) ─────────────
type LyraCfg = { siteId: string; key: string; mode: "TEST" | "PRODUCTION"; gateway: string };
async function lyraForRestaurant(restaurantId: string, requireEnabled = true): Promise<LyraCfg | null> {
  const r = await getRow(restaurantId, "lyra");
  const c = r?.credentials ?? {};
  if ((requireEnabled && !r?.enabled) || !c["siteId"] || !c["key"]) return null;
  return { siteId: c["siteId"], key: c["key"], mode: c["mode"] === "PRODUCTION" ? "PRODUCTION" : "TEST", gateway: c["gateway"] || "https://secure.payzen.eu/vads-payment/" };
}
async function lyraSign(fields: Record<string, string>, key: string) {
  const { createHmac } = await import("crypto");
  const payload = Object.keys(fields).filter((k) => k.startsWith("vads_")).sort().map((k) => fields[k]).join("+") + "+" + key;
  return createHmac("sha256", key).update(payload, "utf8").digest("base64");
}
async function lyraVerify(fields: Record<string, string>, key: string) {
  const { timingSafeEqual } = await import("crypto");
  const a = Buffer.from(await lyraSign(fields, key)), b = Buffer.from(fields["signature"] ?? "");
  return a.length === b.length && timingSafeEqual(a, b);
}

export const testLyra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.restaurantId);
    const l = await lyraForRestaurant(data.restaurantId, false);
    if (!l) throw new Error("Enregistrez d'abord l'identifiant boutique et la clé.");
    let reachable = false;
    try { reachable = (await fetch(l.gateway, { method: "GET" })).status < 500; } catch { reachable = false; }
    if (!reachable) throw new Error("La plateforme de paiement ne répond pas : vérifiez son adresse.");
    return { mode: l.mode, gateway: l.gateway };
  });

/** Prépare le paiement en ligne choisi pour une commande déjà enregistrée (appelé par createOrder). */
export async function startOnlinePayment(provider: "paypal" | "lyra", o: { id: string; order_number: number; total: number; restaurant_id: string; email?: string | null }, restaurantName: string, returnBase: string) {
  const db = await admin();
  const amount = Math.round(Number(o.total) * 100);
  if (provider === "paypal") {
    const p = await paypalForRestaurant(o.restaurant_id);
    if (!p) throw new Error("PayPal n'est pas disponible pour ce restaurant.");
    const res = await paypalCall(p, "/v2/checkout/orders", {
      intent: "CAPTURE",
      purchase_units: [{ custom_id: o.id, description: `${restaurantName} — commande n° ${o.order_number}`.slice(0, 127), amount: { currency_code: "EUR", value: (amount / 100).toFixed(2) } }],
      application_context: { brand_name: restaurantName.slice(0, 127), user_action: "PAY_NOW", shipping_preference: "NO_SHIPPING", locale: "fr-FR", return_url: returnBase, cancel_url: `${returnBase}?annule=1` },
    }) as { id: string; links?: { rel: string; href: string }[] };
    const url = res.links?.find((l) => l.rel === "approve" || l.rel === "payer-action")?.href;
    if (!url) throw new Error("PayPal : lien de paiement manquant");
    await db.from("orders").update({ payment_ref: `paypal:${res.id}` }).eq("id", o.id);
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

async function markPaid(o: { id: string; restaurant_id: string; status: string }) {
  const db = await admin();
  const { data: r } = await db.from("restaurants").select("config").eq("id", o.restaurant_id).maybeSingle();
  const next = (r?.config as { autoAccept?: boolean } | null)?.autoAccept ? "accepted" : "new";
  await db.from("orders").update({ payment_status: "paid", status: o.status === "awaiting_payment" ? next : o.status, updated_at: new Date().toISOString() }).eq("id", o.id);
}

const LYRA_OK = ["AUTHORISED", "CAPTURED", "ACCEPTED", "AUTHORISED_TO_VALIDATE"];
const LYRA_KO = ["REFUSED", "ABANDONED", "CANCELLED", "EXPIRED", "NOT_CREATED"];

/** Traite un retour Lyra signé (retour navigateur ou notification serveur). */
export async function handleLyraResult(fields: Record<string, string>): Promise<"paid" | "failed" | "pending"> {
  const db = await admin();
  const { data: o } = await db.from("orders").select("id, restaurant_id, status, total, payment_method, payment_status, payment_ref").eq("id", fields["vads_order_id"] ?? "").maybeSingle();
  if (!o || o.payment_method !== "online" || !String(o.payment_ref ?? "").startsWith("lyra:")) return "pending";
  const l = await lyraForRestaurant(o.restaurant_id, false);
  if (!l || fields["vads_site_id"] !== l.siteId || !(await lyraVerify(fields, l.key))) throw new Error("Signature de paiement invalide");
  if (o.payment_status === "paid") return "paid";
  if (fields["vads_trans_id"] !== String(o.payment_ref).slice(5)) return "pending";
  const st = fields["vads_trans_status"] ?? "";
  if (LYRA_OK.includes(st) && fields["vads_amount"] === String(Math.round(Number(o.total) * 100))) { await markPaid(o); return "paid"; }
  if (LYRA_KO.includes(st)) return "failed";
  return "pending";
}

/** Indique au site les paiements en ligne disponibles (renvoie seulement la clé publiable Stripe). */
export const onlinePaymentInfo = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().max(40) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: r } = await db.from("restaurants").select("id").eq("slug", data.slug).eq("active", true).maybeSingle();
    if (!r) return { stripe: null as string | null, paypal: false, lyra: false };
    const [s, p, l] = await Promise.all([stripeForRestaurant(r.id), paypalForRestaurant(r.id), lyraForRestaurant(r.id)]);
    return { stripe: s?.publishable ?? null, paypal: !!p, lyra: !!l };
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
    if (!o.payment_ref) return { status: "failed" as const };
    const ref = String(o.payment_ref);

    if (ref.startsWith("lyra:")) {
      if (data.lyra?.["vads_order_id"] === o.id) {
        const r = await handleLyraResult(data.lyra);
        return { status: r === "failed" ? "retry" as const : r };
      }
      return { status: data.cancelled ? "retry" as const : "pending" as const };
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

    const s = await stripeForRestaurant(o.restaurant_id);
    if (!s) return { status: "pending" as const };
    const pi = await stripeCall(`/payment_intents/${encodeURIComponent(ref)}`, s.secret) as { status?: string; metadata?: { order_id?: string } };
    if (pi.metadata?.order_id !== o.id) throw new Error("Paiement non reconnu");
    if (pi.status === "succeeded") { await markPaid(o); return { status: "paid" as const }; }
    if (pi.status === "canceled" || pi.status === "requires_payment_method") return { status: pi.status === "canceled" ? "failed" as const : "retry" as const };
    return { status: "pending" as const };
  });
