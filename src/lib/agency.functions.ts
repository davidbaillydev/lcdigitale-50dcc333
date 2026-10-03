import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAgency(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Réservé à l'agence");
}

export type AgencyRestaurant = {
  id: string; slug: string; name: string; city: string | null; address: string | null; phone: string | null; email: string | null;
  menu_key: string; logo_url: string | null; brand: { primary?: string; accent?: string }; active: boolean; orders_today: number;
};

export const listAgencyRestaurants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAgency(context.supabase, context.userId);
    const since = new Date(); since.setHours(0, 0, 0, 0);
    const [{ data: rs }, { data: orders }] = await Promise.all([
      context.supabase.from("restaurants").select("id, slug, name, city, address, phone, email, menu_key, logo_url, brand, active").order("name"),
      context.supabase.from("orders").select("restaurant_id").gte("created_at", since.toISOString()),
    ]);
    const count: Record<string, number> = {};
    (orders ?? []).forEach((o) => { count[o.restaurant_id] = (count[o.restaurant_id] ?? 0) + 1; });
    return (rs ?? []).map((r) => ({ ...r, orders_today: count[r.id] ?? 0 })) as unknown as AgencyRestaurant[];
  });

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/).optional();
const input = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,40}$/, "Adresse : lettres minuscules, chiffres et tirets"),
  city: z.string().trim().max(80).nullable(),
  address: z.string().trim().max(200).nullable(),
  phone: z.string().trim().max(30).nullable(),
  email: z.string().trim().max(120).nullable(),
  menu_key: z.string().trim().min(1).max(40),
  logo_url: z.string().max(400_000).nullable(),
  brand: z.object({ primary: hex, accent: hex }),
  active: z.boolean(),
});

const RESERVED = new Set(["cuisine", "connexion", "agence", "commande", "suivi", "api", "admin", "espace", "reset-password"]);
const DEFAULT_OPENING = Object.fromEntries([1, 2, 3, 4, 5, 6].map((d) => [String(d), [[690, 870], [1110, 1350]]]));

export const saveRestaurant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    await assertAgency(context.supabase, context.userId);
    if (RESERVED.has(data.slug)) throw new Error("Cette adresse est réservée");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: clash } = await supabaseAdmin.from("restaurants").select("id").eq("slug", data.slug).maybeSingle();
    if (clash && clash.id !== data.id) throw new Error("Cette adresse est déjà utilisée");
    const { id, ...fields } = data;
    if (id) {
      const { error } = await supabaseAdmin.from("restaurants").update(fields).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await supabaseAdmin.from("restaurants").insert({
      ...fields, opening: DEFAULT_OPENING,
      delivery: { minOrder: 20, fee: 2.5, freeFrom: 40, zones: [] },
      config: { slotMinutes: 20, lead: { pickup: 20, delivery: 40 } },
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const setRestaurantActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAgency(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("restaurants").update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
