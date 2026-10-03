import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertManager(supabase: any, userId: string, restaurantId: string) {
  const { data } = await supabase.rpc("is_restaurant_manager", { _user_id: userId, _restaurant_id: restaurantId });
  if (!data) throw new Error("Réservé au gérant ou à l'agence");
}

/** Membres du restaurant + comptes en attente (sans aucun rattachement) */
export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.restaurantId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: members }, { data: allMembers }, { data: agency }, { data: users }] = await Promise.all([
      supabaseAdmin.from("restaurant_members").select("user_id, role").eq("restaurant_id", data.restaurantId),
      supabaseAdmin.from("restaurant_members").select("user_id"),
      supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin"),
      supabaseAdmin.auth.admin.listUsers({ perPage: 500 }),
    ]);
    const assigned = new Set((allMembers ?? []).map((m) => m.user_id));
    const agencyIds = new Set((agency ?? []).map((a) => a.user_id));
    return (users?.users ?? [])
      .filter((u) => !agencyIds.has(u.id))
      .map((u) => ({ id: u.id, email: u.email ?? "", roles: (members ?? []).filter((m) => m.user_id === u.id).map((m) => m.role) }))
      .filter((u) => u.roles.length > 0 || !assigned.has(u.id));
  });

export const setStaffRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ restaurantId: z.string().uuid(), userId: z.string().uuid(), role: z.enum(["kitchen", "manager"]), grant: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.restaurantId);
    if (data.userId === context.userId && data.role === "manager" && !data.grant) throw new Error("Vous ne pouvez pas retirer votre propre accès gérant");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.grant)
      await supabaseAdmin.from("restaurant_members").upsert(
        { restaurant_id: data.restaurantId, user_id: data.userId, role: data.role },
        { onConflict: "restaurant_id,user_id,role" },
      );
    else await supabaseAdmin.from("restaurant_members").delete().eq("restaurant_id", data.restaurantId).eq("user_id", data.userId).eq("role", data.role);
    return { ok: true };
  });
