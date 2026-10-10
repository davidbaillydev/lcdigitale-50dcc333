import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { RESTAURANT_COLUMNS, type Restaurant } from "./shop";

const minutes = z.number().int().min(0).max(1440);
export const settingsSchema = z.object({
  opening: z.record(z.enum(["0", "1", "2", "3", "4", "5", "6"]), z.array(z.tuple([minutes, minutes])).max(4)),
  delivery: z.object({
    minOrder: z.number().min(0).max(500),
    fee: z.number().min(0).max(100),
    freeFrom: z.number().min(0).max(1000),
    zones: z.array(z.object({ cp: z.string().trim().regex(/^\d{5}$/), city: z.string().trim().min(1).max(80) })).max(100),
  }),
  config: z.object({
    slotMinutes: z.number().int().min(5).max(120),
    lead: z.object({ pickup: z.number().int().min(0).max(240), delivery: z.number().int().min(0).max(240) }),
    hoursLabel: z.string().max(120).optional(),
    tagline: z.string().max(200).optional(),
    autoAccept: z.boolean(),
    ordersPaused: z.boolean().optional(),
    timing: z.object({ asap: z.boolean(), scheduled: z.boolean(), prepMode: z.enum(["auto", "manual"]), defaultPrep: z.number().int().min(5).max(180) }),
    modes: z.object({ pickup: z.boolean(), delivery: z.boolean(), dine_in: z.boolean() }),
    payments: z.object({ on_site: z.boolean(), counter: z.boolean(), card_terminal: z.boolean() }),
    serviceFee: z.object({
      enabled: z.boolean(), kind: z.enum(["fixed", "percent"]), value: z.number().min(0).max(100),
      modes: z.object({ delivery: z.boolean(), pickup: z.boolean(), dine_in: z.boolean(), kiosk: z.boolean() }),
    }).optional(),
    printing: z.object({
      width: z.union([z.literal(58), z.literal(80)]), auto: z.boolean(),
      kitchen: z.object({ allergens: z.boolean().default(true), options: z.boolean(), notes: z.boolean(), customer: z.boolean(), contact: z.boolean(), prices: z.boolean(), paid: z.boolean().default(true), qc: z.boolean().default(false) }),
    }),
  }),
});
export type Settings = z.infer<typeof settingsSchema>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertManager(supabase: any, userId: string, restaurantId: string) {
  const { data } = await supabase.rpc("is_restaurant_manager", { _user_id: userId, _restaurant_id: restaurantId });
  if (!data) throw new Error("Réservé au gérant ou à l'agence");
}

/** Fiche complète d'un restaurant pour son gérant ou l'agence (y compris hors ligne). */
export const loadRestaurantAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("restaurants").select(`${RESTAURANT_COLUMNS}, active`).eq("slug", data.slug).maybeSingle();
    if (!row) throw new Error("Restaurant introuvable");
    await assertManager(context.supabase, context.userId, (row as { id: string }).id);
    return row as unknown as Restaurant & { active: boolean };
  });

export const saveRestaurantSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid(), settings: settingsSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.restaurantId);
    const s = data.settings;
    if (!s.config.timing.asap && !s.config.timing.scheduled) throw new Error("Proposez au moins « Dès que possible » ou « Planifiée »");
    if (!s.config.modes.pickup && !s.config.modes.delivery && !s.config.modes.dine_in) throw new Error("Activez au moins un mode de commande");
    for (const ranges of Object.values(s.opening)) for (const [a, b] of ranges) if (a >= b) throw new Error("Une plage horaire a une fin avant son début");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cur } = await supabaseAdmin.from("restaurants").select("config, delivery").eq("id", data.restaurantId).single();
    const marketing = (cur?.config as { marketing?: unknown } | null)?.marketing;
    const qr = (cur?.config as { qr?: unknown } | null)?.qr;
    const reservations = (cur?.config as { reservations?: unknown } | null)?.reservations;
    const { geoZones, origin } = (cur?.delivery as { geoZones?: unknown; origin?: unknown } | null) ?? {};
    // L'impression est un réglage agence : un gérant ne peut pas la modifier.
    const { data: isAgency } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const printing = (cur?.config as { printing?: unknown } | null)?.printing;
    if (!isAgency && printing) s.config.printing = printing as typeof s.config.printing;
    const { error } = await supabaseAdmin.from("restaurants").update({ opening: s.opening, delivery: { ...s.delivery, ...(geoZones ? { geoZones } : {}), ...(origin ? { origin } : {}) } as never, config: { ...s.config, ...(marketing ? { marketing } : {}), ...(qr ? { qr } : {}), ...(reservations ? { reservations } : {}) } as never }).eq("id", data.restaurantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Menu QR par table et lien d'avis Google (gérant ou agence). */
export const saveQrSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    restaurantId: z.string().uuid(),
    tables: z.number().int().min(0).max(300).optional(),
    embed: z.object({
      label: z.string().trim().min(1).max(30),
      color: z.string().regex(/^#[0-9a-f]{6}$/i),
      position: z.enum(["right", "left"]),
      mode: z.enum(["floating", "inline"]),
      domains: z.array(z.string().trim().max(200).regex(/^https:\/\/[a-z0-9.-]+(:\d+)?\/?$/i)).max(20),
    }).optional(),
    room: z.boolean().optional(),
    self: z.boolean().optional(),
    tableValidation: z.boolean().optional(),
    reviewUrl: z.string().trim().max(300).regex(/^https:\/\/[^\s]+$/).optional().or(z.literal("")),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.restaurantId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cur } = await supabaseAdmin.from("restaurants").select("config").eq("id", data.restaurantId).single();
    const prev = (cur?.config as Record<string, unknown>) ?? {};
    const config = data.tables === undefined
      ? { ...prev, ...(data.embed ? { embed: data.embed } : {}) }
      : { ...prev, ...(data.embed ? { embed: data.embed } : {}), qr: { tables: data.tables, room: !!data.room, self: !!data.self, tableValidation: !!data.tableValidation, ...(data.reviewUrl ? { reviewUrl: data.reviewUrl } : {}) } };
    const { error } = await supabaseAdmin.from("restaurants").update({ config: config as never }).eq("id", data.restaurantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
