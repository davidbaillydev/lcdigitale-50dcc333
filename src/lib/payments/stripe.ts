// Stripe : API, clés du restaurant et Checkout Sessions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertManager, getRow, markPaid } from "./shared";

// ───────────── Stripe (paiement en ligne sur le site) ─────────────
export const STRIPE = "https://api.stripe.com/v1";

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
