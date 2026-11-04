import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeCode, type PromoScope } from "./promo";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function isAgency(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  return !!data;
}
const scopeSchema = z.object({ categories: z.array(z.string().max(100)).max(200), items: z.array(z.string().max(100)).max(500) }).nullable().optional();

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

export type PromoCode = { id: string; code: string; kind: "percent" | "fixed"; value: number; min_order: number; starts_at: string | null; ends_at: string | null; active: boolean; uses: number; scope: PromoScope };
export type PromoTargets = { id: string; label: string; items: { id: string; name: string }[] }[];

export const listPromos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.restaurantId);
    const { data: rows } = await (await admin()).from("restaurant_promo_codes")
      .select("id, code, kind, value, min_order, starts_at, ends_at, active, uses, scope").eq("restaurant_id", data.restaurantId).order("created_at", { ascending: false });
    const agency = await isAgency(context.supabase, context.userId);
    let targets: PromoTargets = [];
    if (agency) {
      const { data: r } = await (await admin()).from("restaurants").select("menu, menu_key").eq("id", data.restaurantId).single();
      const { getCatalog } = await import("./catalogs");
      targets = getCatalog(r).categories.map((c) => ({ id: c.id, label: c.label, items: c.items.map((i) => ({ id: i.id, name: i.name })) }));
    }
    return { promos: (rows ?? []) as PromoCode[], agency, targets };
  });

const promoSchema = z.object({
  restaurantId: z.string().uuid(),
  id: z.string().uuid().optional(),
  code: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9_-]+$/, "Lettres, chiffres, - et _ uniquement"),
  kind: z.enum(["percent", "fixed"]),
  value: z.number().positive().max(1000),
  min_order: z.number().min(0).max(1000),
  starts_at: z.string().datetime().nullable(),
  ends_at: z.string().datetime().nullable(),
  active: z.boolean(),
  scope: scopeSchema,
});

export const savePromo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => promoSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.restaurantId);
    if (data.kind === "percent" && data.value > 100) throw new Error("Un pourcentage ne peut pas dépasser 100 %");
    if (data.starts_at && data.ends_at && data.starts_at > data.ends_at) throw new Error("La date de fin est avant la date de début");
    const scope = data.scope && (data.scope.categories.length || data.scope.items.length) ? data.scope : null;
    const agency = await isAgency(context.supabase, context.userId);
    if (!agency && scope) throw new Error("Le ciblage par catégorie ou article est réservé à l'agence");
    const row: Record<string, unknown> = { restaurant_id: data.restaurantId, code: normalizeCode(data.code), kind: data.kind, value: data.value, min_order: data.min_order, starts_at: data.starts_at, ends_at: data.ends_at, active: data.active };
    if (agency && data.scope !== undefined) row.scope = scope; // un gérant ne modifie jamais le ciblage existant
    const db = await admin();
    const { error } = data.id
      ? await db.from("restaurant_promo_codes").update(row).eq("id", data.id).eq("restaurant_id", data.restaurantId)
      : await db.from("restaurant_promo_codes").insert(row);
    if (error) throw new Error(error.code === "23505" ? "Ce code existe déjà" : error.message);
    return { ok: true };
  });

export const deletePromo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid(), id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.restaurantId);
    await (await admin()).from("restaurant_promo_codes").delete().eq("id", data.id).eq("restaurant_id", data.restaurantId);
    return { ok: true };
  });

export const marketingSchema = z.object({
  announcement: z.object({ enabled: z.boolean(), text: z.string().trim().max(160) }),
  firstOrder: z.object({ enabled: z.boolean(), kind: z.enum(["percent", "fixed"]), value: z.number().min(0).max(1000), minOrder: z.number().min(0).max(1000) }),
});

export const saveMarketing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid(), marketing: marketingSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.restaurantId);
    const m = data.marketing;
    if (m.firstOrder.enabled && (m.firstOrder.value <= 0 || (m.firstOrder.kind === "percent" && m.firstOrder.value > 100))) throw new Error("Montant de l'offre de premier achat invalide");
    if (m.announcement.enabled && !m.announcement.text) throw new Error("Saisissez le texte de la bannière");
    const db = await admin();
    const { data: r } = await db.from("restaurants").select("config").eq("id", data.restaurantId).single();
    const { error } = await db.from("restaurants").update({ config: { ...(r?.config ?? {}), marketing: m } }).eq("id", data.restaurantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Aperçu public de la remise (le montant définitif est recalculé à la commande). */
export const checkDiscount = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    slug: z.string().max(40), code: z.string().max(30).optional(), subtotal: z.number().min(0).max(10000),
    email: z.string().max(255).optional(), phone: z.string().max(20).optional(), channel: z.enum(["web", "kiosk"]),
    lines: z.array(z.object({ id: z.string().max(100), total: z.number().min(0).max(10000) })).max(200).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: r } = await db.from("restaurants").select("id, config, menu, menu_key").eq("slug", data.slug).eq("active", true).maybeSingle();
    if (!r) throw new Error("Restaurant introuvable");
    const { resolveDiscount } = await import("./promo.server");
    const { getCatalog } = await import("./catalogs");
    const cats = getCatalog(r).categories;
    return resolveDiscount(db, r, data.subtotal, { code: data.code, email: data.email, phone: data.phone, channel: data.channel,
      lines: data.lines, categoryIdOf: (id: string) => cats.find((c) => c.items.some((i) => i.id === id))?.id });
  });
