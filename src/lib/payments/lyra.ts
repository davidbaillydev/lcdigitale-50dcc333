// Lyra / PayZen (formulaire V2 signé HMAC-SHA-256).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin, assertManager, getRow, markPaid } from "./shared";

export type LyraCfg = { siteId: string; key: string; mode: "TEST" | "PRODUCTION"; gateway: string };
export async function lyraForRestaurant(restaurantId: string, requireEnabled = true): Promise<LyraCfg | null> {
  const r = await getRow(restaurantId, "lyra");
  const c = r?.credentials ?? {};
  if ((requireEnabled && !r?.enabled) || !c["siteId"] || !c["key"]) return null;
  return { siteId: c["siteId"], key: c["key"], mode: c["mode"] === "PRODUCTION" ? "PRODUCTION" : "TEST", gateway: c["gateway"] || "https://secure.payzen.eu/vads-payment/" };
}
export async function lyraSign(fields: Record<string, string>, key: string) {
  const { createHmac } = await import("crypto");
  const payload = Object.keys(fields).filter((k) => k.startsWith("vads_")).sort().map((k) => fields[k]).join("+") + "+" + key;
  return createHmac("sha256", key).update(payload, "utf8").digest("base64");
}
export async function lyraVerify(fields: Record<string, string>, key: string) {
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

export const LYRA_OK = ["AUTHORISED", "CAPTURED", "ACCEPTED", "AUTHORISED_TO_VALIDATE"];
export const LYRA_KO = ["REFUSED", "ABANDONED", "CANCELLED", "EXPIRED", "NOT_CREATED"];

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
