import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertManager(supabase: any, userId: string, restaurantId: string) {
  const { data } = await supabase.rpc("is_restaurant_manager", { _user_id: userId, _restaurant_id: restaurantId });
  if (!data) throw new Error("Réservé au gérant ou à l'agence");
}

/** Membres de CE restaurant uniquement (aucun autre compte n'est exposé) */
export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.restaurantId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: members } = await supabaseAdmin.from("restaurant_members").select("user_id, role").eq("restaurant_id", data.restaurantId);
    const ids = [...new Set((members ?? []).map((m) => m.user_id))];
    const users = await Promise.all(ids.map((id) => supabaseAdmin.auth.admin.getUserById(id).then((r) => r.data.user)));
    return ids.map((id, i) => ({ id, email: users[i]?.email ?? "", roles: (members ?? []).filter((m) => m.user_id === id).map((m) => m.role) }));
  });

/** Invite un restaurateur par email (crée le compte si besoin) et le rattache à ce restaurant. */
export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ restaurantId: z.string().uuid(), email: z.string().trim().toLowerCase().email().max(255), role: z.enum(["kitchen", "manager"]), origin: z.string().url().max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.restaurantId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let userId: string | undefined;
    let invited = false;
    const { data: inv, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, { redirectTo: `${data.origin}/reset-password` });
    if (inv?.user) { userId = inv.user.id; invited = true; }
    else {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      userId = list?.users.find((u) => u.email?.toLowerCase() === data.email)?.id;
      if (!userId) throw new Error(error?.message ?? "Invitation impossible");
    }
    const { error: e2 } = await supabaseAdmin.from("restaurant_members").upsert(
      { restaurant_id: data.restaurantId, user_id: userId, role: data.role },
      { onConflict: "restaurant_id,user_id,role" },
    );
    if (e2) throw new Error(e2.message);
    return { invited };
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
