// PayPal (Orders v2, redirection).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertManager, getRow } from "./shared";

export type PaypalCfg = { base: string; clientId: string; secret: string; live: boolean };
export async function paypalForRestaurant(restaurantId: string, requireEnabled = true): Promise<PaypalCfg | null> {
  const r = await getRow(restaurantId, "paypal");
  const c = r?.credentials ?? {};
  if ((requireEnabled && !r?.enabled) || !c["clientId"] || !c["secret"]) return null;
  const live = c["mode"] === "live";
  return { base: live ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com", clientId: c["clientId"], secret: c["secret"], live };
}
export async function paypalToken(p: PaypalCfg) {
  const res = await fetch(`${p.base}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${p.clientId}:${p.secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const body = await res.json().catch(() => null) as { access_token?: string; error_description?: string } | null;
  if (!res.ok || !body?.access_token) throw new Error(`PayPal : ${body?.error_description ?? `identifiants refusés (${res.status})`}`);
  return body.access_token;
}
export async function paypalCall(p: PaypalCfg, path: string, json?: unknown) {
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
