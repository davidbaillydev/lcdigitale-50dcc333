// Mollie : paiement hébergé, Connect OAuth, webhook et suivi des commissions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin, assertManager, getRow, markPaid } from "./shared";

export type MollieCfg = { key: string; live: boolean; profileId?: string | undefined; oauth: boolean };
// Jetons OAuth en mode test : Mollie exige testmode=true sur chaque appel (corps ou paramètre).
export const mollieOauthTestTokens = new Set<string>();
export const MOLLIE_PLATFORM_FEE_RATE = 0.07;
/** Commission plateforme en euros (arrondie au centime) pour un montant en centimes. */
export const mollieApplicationFee = (amountCents: number) => Math.round(amountCents * MOLLIE_PLATFORM_FEE_RATE) / 100;

export async function mollieTokenRequest(params: Record<string, string>) {
  const id = process.env["MOLLIE_CLIENT_ID"], secret = process.env["MOLLIE_CLIENT_SECRET"];
  if (!id || !secret) throw new Error("Mollie Connect n'est pas configuré sur la plateforme.");
  const res = await fetch("https://api.mollie.com/oauth2/tokens", {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${id}:${secret}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const body = await res.json().catch(() => null) as { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string; detail?: string } | null;
  if (!res.ok || !body?.access_token) {
    console.error("Mollie OAuth", res.status, JSON.stringify(body).slice(0, 300));
    throw new Error(`Mollie : ${body?.error_description ?? body?.detail ?? `erreur ${res.status}`}`);
  }
  return body as { access_token: string; refresh_token?: string; expires_in: number };
}
export async function exchangeMollieCode(code: string, redirectUri: string) {
  return mollieTokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
}

export async function mollieForRestaurant(restaurantId: string, requireEnabled = true): Promise<MollieCfg | null> {
  const r = await getRow(restaurantId, "mollie");
  const c = r?.credentials ?? {};
  const live = c["mode"] === "live";
  if (requireEnabled && !r?.enabled) return null;
  if (c["oauthRefreshToken"]) {
    let access = c["oauthAccessToken"] ?? "";
    // Renouvellement automatique 2 min avant l'expiration
    if (!access || Number(c["oauthExpiresAt"] ?? 0) < Date.now() + 120_000) {
      const t = await mollieTokenRequest({ grant_type: "refresh_token", refresh_token: c["oauthRefreshToken"] });
      access = t.access_token;
      const credentials = { ...c, oauthAccessToken: access, oauthExpiresAt: String(Date.now() + t.expires_in * 1000), ...(t.refresh_token ? { oauthRefreshToken: t.refresh_token } : {}) };
      const db = await admin();
      await db.from("restaurant_payment_providers").update({ credentials }).eq("restaurant_id", restaurantId).eq("provider", "mollie");
    }
    if (!live) mollieOauthTestTokens.add(access);
    let profileId = c["profileId"] || undefined;
    // Mollie Connect exige un profil de site web : si absent, on récupère le profil du compte et on le mémorise.
    if (!profileId) {
      try {
        const prof = await mollieCall(access, "/profiles?limit=1") as { _embedded?: { profiles?: { id: string }[] } };
        profileId = prof._embedded?.profiles?.[0]?.id;
        if (profileId) {
          const db = await admin();
          await db.from("restaurant_payment_providers").update({ credentials: { ...c, profileId } }).eq("restaurant_id", restaurantId).eq("provider", "mollie");
        }
      } catch (e) { console.error("mollie profile fetch", e); }
    }
    return { key: access, live, profileId, oauth: true };
  }
  const key = live ? c["apiKeyLive"] : c["apiKeyTest"];
  if (!key) return null;
  return { key, live, profileId: c["profileId"] || undefined, oauth: false };
}
export async function mollieCall(key: string, path: string, json?: unknown, idempotencyKey?: string) {
  const test = mollieOauthTestTokens.has(key);
  let url = `https://api.mollie.com/v2${path}`;
  let payload = json;
  if (test) {
    if (json === undefined) url += `${url.includes("?") ? "&" : "?"}testmode=true`;
    else payload = { ...(json as Record<string, unknown>), testmode: true };
  }
  const res = await fetch(url, {
    method: json === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
    body: payload === undefined ? null : JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null) as Record<string, unknown> | null;
  if (!res.ok) {
    console.error("Mollie", path, res.status, JSON.stringify(body).slice(0, 500));
    throw new Error(`Mollie : ${(body as { detail?: string } | null)?.detail ?? `erreur ${res.status}`}`);
  }
  return body ?? {};
}

// ───────────── Mollie Connect (OAuth) ─────────────
export async function signState(payload: string) {
  const { createHmac } = await import("crypto");
  return createHmac("sha256", process.env["MOLLIE_CLIENT_SECRET"] ?? "").update(payload).digest("base64url");
}
export async function verifyMollieState(state: string): Promise<{ r: string; u: string; o: string } | null> {
  const [b64, sig] = state.split(".");
  if (!b64 || !sig || !process.env["MOLLIE_CLIENT_SECRET"]) return null;
  const { timingSafeEqual } = await import("crypto");
  const a = Buffer.from(await signState(b64)), b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(b64, "base64url").toString("utf8")) as { r: string; u: string; o: string; e: number };
    return p.e > Date.now() ? p : null;
  } catch { return null; }
}
export function mollieRedirectUri(origin: string) {
  return /localhost|127\.0\.0\.1/.test(origin) ? `${origin}/api/public/mollie-oauth-callback` : "https://restaurant.lcdigitale.fr/api/public/mollie-oauth-callback";
}

/** Génère l'URL d'autorisation Mollie Connect (state signé, valable 15 min). */
export const startMollieConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid(), origin: z.string().url().max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.restaurantId);
    const clientId = process.env["MOLLIE_CLIENT_ID"];
    if (!clientId || !process.env["MOLLIE_CLIENT_SECRET"]) throw new Error("Mollie Connect n'est pas configuré sur la plateforme.");
    const origin = new URL(data.origin).origin;
    const b64 = Buffer.from(JSON.stringify({ r: data.restaurantId, u: context.userId, o: origin, e: Date.now() + 15 * 60_000, n: crypto.randomUUID() })).toString("base64url");
    const state = `${b64}.${await signState(b64)}`;
    const scope = "payments.write payments.read refunds.write refunds.read profiles.read organizations.read";
    const q = new URLSearchParams({ client_id: clientId, redirect_uri: mollieRedirectUri(origin), response_type: "code", scope, state, approval_prompt: "auto" });
    return { url: `https://my.mollie.com/oauth2/authorize?${q.toString()}` };
  });

/** Enregistre les jetons + profil après le callback (appelé par la route publique). */
export async function saveMollieOauth(restaurantId: string, t: { access_token: string; refresh_token?: string; expires_in: number }) {
  if (!t.refresh_token) throw new Error("Mollie n'a pas fourni de jeton de renouvellement.");
  const prof = await mollieCall(t.access_token, "/profiles?limit=1") as { _embedded?: { profiles?: { id: string; name: string; mode?: string }[] } };
  const profile = prof._embedded?.profiles?.[0];
  const org = await mollieCall(t.access_token, "/organizations/me").catch(() => ({})) as { name?: string };
  const prev = await getRow(restaurantId, "mollie");
  const credentials = {
    ...(prev?.credentials ?? {}), mode: prev?.credentials["mode"] === "live" ? "live" : "test",
    oauthAccessToken: t.access_token, oauthRefreshToken: t.refresh_token, oauthExpiresAt: String(Date.now() + t.expires_in * 1000),
    ...(profile ? { profileId: profile.id } : {}),
  };
  const settings = { ...(prev?.settings ?? {}), oauthOrg: org.name ?? "", oauthProfile: profile?.name ?? "", oauthConnectedAt: new Date().toISOString() };
  const db = await admin();
  const { error } = await db.from("restaurant_payment_providers").upsert({ restaurant_id: restaurantId, provider: "mollie", enabled: true, credentials, settings });
  if (error) throw new Error("Enregistrement impossible");
}

/** Déconnecte Mollie Connect (révocation + suppression des jetons). */
export const disconnectMollie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.restaurantId);
    const r = await getRow(data.restaurantId, "mollie");
    if (!r) return { ok: true };
    const { oauthAccessToken, oauthRefreshToken, oauthExpiresAt, ...rest } = r.credentials;
    void oauthAccessToken; void oauthExpiresAt;
    if (oauthRefreshToken && process.env["MOLLIE_CLIENT_ID"]) {
      await fetch("https://api.mollie.com/oauth2/tokens", {
        method: "DELETE",
        headers: { Authorization: `Basic ${btoa(`${process.env["MOLLIE_CLIENT_ID"]}:${process.env["MOLLIE_CLIENT_SECRET"]}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token_type_hint: "refresh_token", token: oauthRefreshToken }).toString(),
      }).catch(() => null);
    }
    const { oauthOrg, oauthProfile, oauthConnectedAt, ...settings } = r.settings;
    void oauthOrg; void oauthProfile; void oauthConnectedAt;
    const hasKey = !!rest[rest["mode"] === "live" ? "apiKeyLive" : "apiKeyTest"];
    const db = await admin();
    await db.from("restaurant_payment_providers").update({ credentials: rest, settings, enabled: r.enabled && hasKey }).eq("restaurant_id", data.restaurantId).eq("provider", "mollie");
    return { ok: true };
  });

/** Vérifie la clé Mollie active et liste les moyens de paiement activés sur le compte. */
export const testMollie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.restaurantId);
    const m = await mollieForRestaurant(data.restaurantId, false);
    if (!m) throw new Error("Enregistrez d'abord la clé correspondant au mode choisi.");
    if (m.oauth && !m.profileId) throw new Error("Aucun profil de site trouvé sur le compte Mollie connecté : créez-en un dans Mollie puis réessayez.");
    const qs = new URLSearchParams({ locale: "fr_FR" });
    if (m.oauth && m.profileId) { qs.set("profileId", m.profileId); if (!m.live) qs.set("testmode", "true"); }
    const res = await mollieCall(m.key, `/methods?${qs}`) as { _embedded?: { methods?: { id: string; description: string }[] } };
    return { live: m.live, methods: (res._embedded?.methods ?? []).map((x) => ({ id: x.id, name: x.description })) };
  });

export const MOLLIE_FAIL = ["failed", "expired", "canceled"];
/** Récupère le statut réel d'un paiement Mollie auprès de l'API et met la commande à jour (idempotent). */
export async function handleMolliePayment(paymentId: string): Promise<"paid" | "failed" | "pending"> {
  const db = await admin();
  const { data: o } = await db.from("orders").select("id, restaurant_id, status, total, payment_method, payment_status, payment_ref").eq("payment_ref", `mollie:${paymentId}`).maybeSingle();
  if (!o) return "pending";
  if (o.payment_status !== "pending") return o.payment_status === "paid" ? "paid" : "failed";
  const m = await mollieForRestaurant(o.restaurant_id, false);
  if (!m) return "pending";
  const p = await mollieCall(m.key, `/payments/${encodeURIComponent(paymentId)}`) as { status?: string; amount?: { value?: string; currency?: string }; metadata?: { order_id?: string } };
  if (p.metadata?.order_id !== o.id) throw new Error("Paiement non reconnu");
  if (p.status === "paid" && p.amount?.currency === "EUR" && Number(p.amount?.value) === Number(o.total)) { await markPaid(o); return "paid"; }
  if (MOLLIE_FAIL.includes(p.status ?? "")) {
    await db.from("orders").update({ payment_status: p.status === "expired" ? "expired" : "failed", status: "cancelled", updated_at: new Date().toISOString() }).eq("id", o.id).eq("payment_status", "pending");
    return "failed";
  }
  return "pending";
}

/** Suivi des paiements Mollie : montant, commission plateforme et remboursements (agence). */
export const listMolliePayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.restaurantId);
    const db = await admin();
    const { data: orders } = await db.from("orders")
      .select("id, order_number, created_at, total, platform_fee, payment_status, refund_status, refunded_amount, payment_ref")
      .eq("restaurant_id", data.restaurantId).like("payment_ref", "mollie:%").order("created_at", { ascending: false }).limit(200);
    const ids = ((orders ?? []) as { id: string }[]).map((o) => o.id);
    const { data: refunds } = ids.length ? await db.from("order_refunds").select("order_id, amount, credit_note_number, provider_refund_id, created_at").in("order_id", ids) : { data: [] };
    return ((orders ?? []) as Record<string, unknown>[]).map((o) => ({
      id: o["id"] as string, number: o["order_number"] as number, date: o["created_at"] as string,
      total: Number(o["total"]), fee: Number(o["platform_fee"] ?? 0), status: o["payment_status"] as string,
      refundStatus: (o["refund_status"] as string | null) ?? null, refunded: Number(o["refunded_amount"] ?? 0),
      refunds: ((refunds ?? []) as { order_id: string; amount: number; credit_note_number: string; provider_refund_id: string | null; created_at: string }[])
        .filter((r) => r.order_id === o["id"]).map((r) => ({ amount: Number(r.amount), creditNote: r.credit_note_number, ref: r.provider_refund_id, date: r.created_at })),
    }));
  });
