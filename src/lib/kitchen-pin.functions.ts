import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function hashPin(pin: string, salt: string) {
  const { pbkdf2Sync } = await import("crypto");
  return pbkdf2Sync(pin, salt, 100_000, 32, "sha256").toString("hex");
}

const rid = z.object({ restaurantId: z.string().uuid() });

/** Indique si un code PIN cuisine est configuré (membres du restaurant). */
export const hasKitchenPin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rid.parse(d))
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("can_access_restaurant", { _user_id: context.userId, _restaurant_id: data.restaurantId });
    if (!ok) throw new Error("Accès refusé");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("restaurant_kitchen_pins").select("restaurant_id").eq("restaurant_id", data.restaurantId).maybeSingle();
    return { enabled: !!row };
  });

/** Gérant/agence : définit (ou supprime avec pin=null) le code PIN cuisine. */
export const setKitchenPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rid.extend({ pin: z.string().regex(/^\d{4,6}$/, "Le code doit contenir 4 à 6 chiffres").nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!ok) throw new Error("Réservé à l'agence");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.pin === null) {
      await supabaseAdmin.from("restaurant_kitchen_pins").delete().eq("restaurant_id", data.restaurantId);
      return { enabled: false };
    }
    const { randomBytes } = await import("crypto");
    const salt = randomBytes(16).toString("hex");
    const { error } = await supabaseAdmin.from("restaurant_kitchen_pins").upsert({
      restaurant_id: data.restaurantId, salt, pin_hash: await hashPin(data.pin, salt), failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { enabled: true };
  });

/** Vérifie le code PIN (5 essais, puis blocage 5 minutes). */
export const verifyKitchenPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rid.extend({ pin: z.string().regex(/^\d{4,6}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("can_access_restaurant", { _user_id: context.userId, _restaurant_id: data.restaurantId });
    if (!ok) throw new Error("Accès refusé");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("restaurant_kitchen_pins").select("*").eq("restaurant_id", data.restaurantId).maybeSingle();
    if (!row) return { ok: true };
    if (row.locked_until && new Date(row.locked_until) > new Date()) throw new Error("Trop d'essais : réessayez dans quelques minutes");
    const { timingSafeEqual } = await import("crypto");
    const good = timingSafeEqual(Buffer.from(await hashPin(data.pin, row.salt), "hex"), Buffer.from(row.pin_hash, "hex"));
    if (good) {
      await supabaseAdmin.from("restaurant_kitchen_pins").update({ failed_attempts: 0, locked_until: null }).eq("restaurant_id", data.restaurantId);
      return { ok: true };
    }
    const fails = row.failed_attempts + 1;
    await supabaseAdmin.from("restaurant_kitchen_pins").update({
      failed_attempts: fails >= 5 ? 0 : fails,
      locked_until: fails >= 5 ? new Date(Date.now() + 5 * 60_000).toISOString() : null,
    }).eq("restaurant_id", data.restaurantId);
    return { ok: false };
  });

/** Agence : indique si un code PIN dédié aux bornes est défini. */
export const hasKioskPin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rid.parse(d))
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!ok) throw new Error("Réservé à l'agence");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("restaurant_kiosk_pins").select("restaurant_id").eq("restaurant_id", data.restaurantId).maybeSingle();
    const { data: kitchen } = await supabaseAdmin.from("restaurant_kitchen_pins").select("restaurant_id").eq("restaurant_id", data.restaurantId).maybeSingle();
    return { enabled: !!row, kitchenFallback: !row && !!kitchen };
  });

/** Agence : définit ou réinitialise (pin=null) le code PIN des bornes. */
export const setKioskPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rid.extend({ pin: z.string().regex(/^\d{4,6}$/, "Le code doit contenir 4 à 6 chiffres").nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!ok) throw new Error("Réservé à l'agence");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.pin === null) {
      await supabaseAdmin.from("restaurant_kiosk_pins").delete().eq("restaurant_id", data.restaurantId);
      return { enabled: false };
    }
    const { randomBytes } = await import("crypto");
    const salt = randomBytes(16).toString("hex");
    const { error } = await supabaseAdmin.from("restaurant_kiosk_pins").upsert({
      restaurant_id: data.restaurantId, salt, pin_hash: await hashPin(data.pin, salt), failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { enabled: true };
  });

/**
 * Borne (public, sans compte) : déverrouille le sélecteur de borne avec le code PIN des bornes,
 * ou à défaut le code PIN cuisine. Sans aucun code, le sélecteur reste verrouillé. 5 essais puis 5 minutes.
 */
export const verifyKioskSwitchPin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => rid.extend({ pin: z.string().regex(/^\d{4,6}$/) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const kiosk = await supabaseAdmin.from("restaurant_kiosk_pins").select("*").eq("restaurant_id", data.restaurantId).maybeSingle();
    const table = kiosk.data ? "restaurant_kiosk_pins" as const : "restaurant_kitchen_pins" as const;
    const row = kiosk.data ?? (await supabaseAdmin.from("restaurant_kitchen_pins").select("*").eq("restaurant_id", data.restaurantId).maybeSingle()).data;
    if (!row) return { ok: false, reason: "no_pin" as const };
    if (row.locked_until && new Date(row.locked_until) > new Date()) return { ok: false, reason: "locked" as const };
    const { timingSafeEqual } = await import("crypto");
    const good = timingSafeEqual(Buffer.from(await hashPin(data.pin, row.salt), "hex"), Buffer.from(row.pin_hash, "hex"));
    if (good) {
      await supabaseAdmin.from(table).update({ failed_attempts: 0, locked_until: null }).eq("restaurant_id", data.restaurantId);
      return { ok: true, reason: null };
    }
    const fails = row.failed_attempts + 1;
    await supabaseAdmin.from(table).update({
      failed_attempts: fails >= 5 ? 0 : fails,
      locked_until: fails >= 5 ? new Date(Date.now() + 5 * 60_000).toISOString() : null,
    }).eq("restaurant_id", data.restaurantId);
    return { ok: false, reason: fails >= 5 ? "locked" as const : "wrong" as const };
  });
