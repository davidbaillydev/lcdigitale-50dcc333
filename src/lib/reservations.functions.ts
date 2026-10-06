// Réservations avec empreinte bancaire Stripe (SetupIntent) : aucun débit à la réservation,
// débit off-session du montant no-show uniquement sur action de l'équipe.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { stripeCall, stripeForRestaurant } from "@/lib/payments.functions";

export type ReservationSettings = { enabled: boolean; noShowFee: number; maxParty: number };

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const settingsOf = (config: any): ReservationSettings => ({
  enabled: !!config?.reservations?.enabled,
  noShowFee: Math.max(0, Number(config?.reservations?.noShowFee ?? 0)),
  maxParty: Math.min(30, Math.max(1, Number(config?.reservations?.maxParty ?? 10))),
});

/** Infos publiques pour le formulaire de réservation. */
export const reservationInfo = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().max(40) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: r } = await db.from("restaurants").select("id, config").eq("slug", data.slug).eq("active", true).maybeSingle();
    if (!r) return null;
    const s = settingsOf(r.config);
    const stripe = s.noShowFee > 0 ? await stripeForRestaurant(r.id) : null;
    return { ...s, cardRequired: s.noShowFee > 0 && !!stripe, publishableKey: stripe?.publishable ?? null };
  });

export const createReservation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    slug: z.string().max(40),
    customer_name: z.string().trim().min(2).max(80),
    phone: z.string().trim().min(8).max(20),
    email: z.string().trim().email().max(255).or(z.literal("")),
    party_size: z.number().int().min(1).max(30),
    starts_at: z.string().datetime(),
    notes: z.string().max(500).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: r } = await db.from("restaurants").select("id, name, config").eq("slug", data.slug).eq("active", true).maybeSingle();
    if (!r) throw new Error("Restaurant introuvable");
    const s = settingsOf(r.config);
    if (!s.enabled) throw new Error("Ce restaurant ne prend pas de réservations en ligne.");
    if (data.party_size > s.maxParty) throw new Error(`Au-delà de ${s.maxParty} personnes, appelez le restaurant.`);
    const when = new Date(data.starts_at);
    if (when.getTime() < Date.now() + 30 * 60_000) throw new Error("Choisissez un horaire au moins 30 minutes à l'avance.");
    if (when.getTime() > Date.now() + 90 * 86_400_000) throw new Error("Réservation possible jusqu'à 90 jours à l'avance.");
    const stripe = s.noShowFee > 0 ? await stripeForRestaurant(r.id) : null;
    const { data: row, error } = await db.from("reservations").insert({
      restaurant_id: r.id, customer_name: data.customer_name, phone: data.phone, email: data.email || null,
      party_size: data.party_size, starts_at: when.toISOString(), notes: data.notes || null,
      status: stripe ? "pending_card" : "confirmed", no_show_fee: stripe ? s.noShowFee : 0,
    }).select("id").single();
    if (error) throw new Error("Réservation impossible");
    if (!stripe) return { id: row.id as string, clientSecret: null as string | null };
    const cus = await stripeCall("/customers", stripe.secret, {
      name: data.customer_name, phone: data.phone, ...(data.email ? { email: data.email } : {}),
      "metadata[reservation_id]": row.id,
    }) as { id: string };
    const si = await stripeCall("/setup_intents", stripe.secret, {
      customer: cus.id, usage: "off_session", "automatic_payment_methods[enabled]": "true",
      "metadata[reservation_id]": row.id, "metadata[restaurant_id]": r.id,
      description: `Garantie réservation ${r.name}`,
    }) as { id: string; client_secret: string };
    await db.from("reservations").update({ stripe_customer: cus.id, setup_intent: si.id }).eq("id", row.id);
    return { id: row.id as string, clientSecret: si.client_secret };
  });

/** Vérifie l'empreinte auprès de Stripe après le retour du formulaire. */
export const confirmReservation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: res } = await db.from("reservations").select("id, restaurant_id, status, setup_intent, starts_at, party_size, customer_name, no_show_fee").eq("id", data.id).maybeSingle();
    if (!res) throw new Error("Réservation introuvable");
    if (res.status === "pending_card" && res.setup_intent) {
      const stripe = await stripeForRestaurant(res.restaurant_id);
      if (stripe) {
        const si = await stripeCall(`/setup_intents/${encodeURIComponent(res.setup_intent)}`, stripe.secret) as { status: string; payment_method?: string; metadata?: { reservation_id?: string } };
        if (si.metadata?.reservation_id === res.id && si.status === "succeeded" && si.payment_method) {
          await db.from("reservations").update({ status: "confirmed", payment_method: si.payment_method }).eq("id", res.id);
          res.status = "confirmed";
        }
      }
    }
    return { status: res.status as string, starts_at: res.starts_at as string, party_size: res.party_size as number, customer_name: res.customer_name as string, no_show_fee: Number(res.no_show_fee) };
  });

/** Débite le montant no-show sur la carte enregistrée (équipe du restaurant). */
export const chargeNoShow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Lecture via RLS : vérifie l'accès au restaurant
    const { data: res } = await context.supabase.from("reservations").select("id, restaurant_id, status, stripe_customer, payment_method, no_show_fee, starts_at").eq("id", data.id).maybeSingle();
    if (!res) throw new Error("Réservation introuvable");
    if (res.status !== "confirmed") throw new Error("Seule une réservation confirmée peut être déclarée no-show.");
    if (new Date(res.starts_at).getTime() > Date.now()) throw new Error("L'heure de la réservation n'est pas encore passée.");
    const db = await admin();
    if (!res.payment_method || !res.stripe_customer || Number(res.no_show_fee) <= 0) {
      await db.from("reservations").update({ status: "no_show" }).eq("id", res.id);
      return { charged: 0 };
    }
    const stripe = await stripeForRestaurant(res.restaurant_id);
    if (!stripe) throw new Error("Stripe n'est plus actif pour ce restaurant.");
    const amount = Math.round(Number(res.no_show_fee) * 100);
    const pi = await stripeCall("/payment_intents", stripe.secret, {
      amount: String(amount), currency: "eur", customer: res.stripe_customer, payment_method: res.payment_method,
      off_session: "true", confirm: "true", "metadata[reservation_id]": res.id, description: "Frais de non-présentation",
    }) as { id: string; status: string };
    if (pi.status !== "succeeded") throw new Error(`Débit non abouti (${pi.status}).`);
    await db.from("reservations").update({ status: "no_show", charged_amount: Number(res.no_show_fee), charge_ref: pi.id }).eq("id", res.id);
    return { charged: Number(res.no_show_fee) };
  });

/** Réglages réservation (gérant ou agence). */
export const saveReservationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    restaurantId: z.string().uuid(), enabled: z.boolean(), noShowFee: z.number().min(0).max(200), maxParty: z.number().int().min(1).max(30),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("is_restaurant_manager", { _user_id: context.userId, _restaurant_id: data.restaurantId });
    if (!ok) throw new Error("Réservé au gérant");
    const db = await admin();
    const { data: r } = await db.from("restaurants").select("config").eq("id", data.restaurantId).single();
    const config = { ...(r?.config ?? {}), reservations: { enabled: data.enabled, noShowFee: data.noShowFee, maxParty: data.maxParty } };
    const { error } = await db.from("restaurants").update({ config }).eq("id", data.restaurantId);
    if (error) throw new Error("Enregistrement impossible");
    return settingsOf(config);
  });
