import { trustedOrigin } from "./trusted-origin";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { notificationRolesSchema, orderModeSchema } from "./order-notification-roles";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertManager(supabase: any, userId: string, restaurantId: string) {
  const { data } = await supabase.rpc("is_restaurant_manager", { _user_id: userId, _restaurant_id: restaurantId });
  if (!data) throw new Error("Réservé au gérant ou à l'agence");
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAgency(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Réservé à l'agence");
}

/** Membres de CE restaurant uniquement (aucun autre compte n'est exposé) */
export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.restaurantId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: members, error } = await supabaseAdmin.from("restaurant_members").select("user_id, role, notification_roles, notification_modes").eq("restaurant_id", data.restaurantId);
    if (error) throw new Error(error.message);
    const ids = [...new Set((members ?? []).map((m) => m.user_id))];
    const users = await Promise.all(ids.map((id) => supabaseAdmin.auth.admin.getUserById(id).then((r) => r.data.user)));
    return ids.map((id, i) => { const mine = (members ?? []).filter((m) => m.user_id === id); return { id, email: users[i]?.email ?? "", roles: mine.map((m) => m.role), notificationRoles: [...new Set(mine.flatMap((m) => m.notification_roles))], notificationModes: mine.find((m) => m.notification_modes)?.notification_modes ?? null }; });
  });

/** Invite un restaurateur par email (crée le compte si besoin) et le rattache à ce restaurant. */
export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ restaurantId: z.string().uuid(), email: z.string().trim().toLowerCase().email().max(255), role: z.enum(["kitchen", "manager"]), origin: z.string().url().max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAgency(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let userId: string | undefined;
    let invited = false;
    const { data: inv, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, { redirectTo: `${trustedOrigin(data.origin)}/reset-password` });
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
    await assertAgency(context.supabase, context.userId);
    if (data.userId === context.userId && data.role === "manager" && !data.grant) throw new Error("Vous ne pouvez pas retirer votre propre accès gérant");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin.from("restaurant_members").select("notification_roles, notification_modes").eq("restaurant_id", data.restaurantId).eq("user_id", data.userId);
    const notification_roles = [...new Set((existing ?? []).flatMap((m) => m.notification_roles))];
    const notification_modes = (existing ?? []).find((m) => m.notification_modes)?.notification_modes ?? null;
    const result = data.grant
      ? await supabaseAdmin.from("restaurant_members").upsert(
        { restaurant_id: data.restaurantId, user_id: data.userId, role: data.role, notification_roles, notification_modes },
        { onConflict: "restaurant_id,user_id,role" },
      )
      : await supabaseAdmin.from("restaurant_members").delete().eq("restaurant_id", data.restaurantId).eq("user_id", data.userId).eq("role", data.role);
    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  });

/** Fonctions de notification, distinctes des permissions d'accès. */
export const setStaffNotificationRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid(), userId: z.string().uuid(), roles: notificationRolesSchema, modes: z.array(orderModeSchema).max(3) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAgency(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.from("restaurant_members")
      .update({ notification_roles: [...new Set(data.roles)], notification_modes: [...new Set(data.modes)] }).eq("restaurant_id", data.restaurantId).eq("user_id", data.userId).select("id");
    if (error) throw new Error(error.message);
    if (!rows?.length) throw new Error("Ce compte n'appartient pas à ce restaurant");
    return { ok: true };
  });

/** Lien direct d'activation (nouveau compte) ou de choix de mot de passe (compte existant) à partager au restaurateur. */
export const getActivationLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid(), userId: z.string().uuid(), origin: z.string().url().max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAgency(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: member } = await supabaseAdmin.from("restaurant_members").select("user_id").eq("restaurant_id", data.restaurantId).eq("user_id", data.userId).limit(1).maybeSingle();
    if (!member) throw new Error("Ce compte n'appartient pas à ce restaurant");
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    const email = u.user?.email;
    if (!email) throw new Error("Compte introuvable");
    const redirectTo = `${trustedOrigin(data.origin)}/reset-password`;
    const type = u.user?.email_confirmed_at || u.user?.last_sign_in_at ? "recovery" : "invite";
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({ type, email, options: { redirectTo } } as Parameters<typeof supabaseAdmin.auth.admin.generateLink>[0]);
    if (error || !link.properties?.action_link) throw new Error(error?.message ?? "Lien impossible");
    return { link: link.properties.action_link, email };
  });

/** Code de connexion à 6 chiffres (usage unique, ~1 h) à dicter ou envoyer par WhatsApp/SMS. */
export const getLoginCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ restaurantId: z.string().uuid(), userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAgency(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: member } = await supabaseAdmin.from("restaurant_members").select("user_id").eq("restaurant_id", data.restaurantId).eq("user_id", data.userId).limit(1).maybeSingle();
    if (!member) throw new Error("Ce compte n'appartient pas à ce restaurant");
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    const email = u.user?.email;
    if (!email) throw new Error("Compte introuvable");
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
    const code = link?.properties?.email_otp;
    if (error || !code) throw new Error(error?.message ?? "Code impossible");
    return { code, email };
  });
